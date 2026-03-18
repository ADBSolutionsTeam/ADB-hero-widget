"""
Container Detection — ML Module
================================
Object detection on satellite imagery using YOLOv8 (ultralytics) or
ONNX Runtime, with automatic fallback to simulation when no model
is available.

Supports three detection backends (tried in order):
  1. Custom ONNX model  — set DETECTOR_ONNX_PATH env var
  2. Ultralytics YOLOv8 — auto-downloads yolov8n on first use
  3. Simulation fallback — deterministic mock (no ML)

Detection output matches the existing ContainerDetection format:
  { type, confidence, x, y, width, height, excluded }
"""

import logging
import os
import random
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger("detector")

# ── Configuration ────────────────────────────────────────────────

ONNX_MODEL_PATH = os.getenv("DETECTOR_ONNX_PATH", "")
YOLO_MODEL_NAME = os.getenv("DETECTOR_YOLO_MODEL", "yolov8n.pt")
CONFIDENCE_FLOOR = float(os.getenv("DETECTOR_CONFIDENCE_FLOOR", "0.25"))

# COCO class IDs that map to container-like objects
# 7=truck, 5=bus, 2=car (ignore), 6=train
CONTAINER_CLASSES = {7: "40ft", 5: "other", 6: "40ft"}
VEHICLE_CLASSES = {2: "other", 3: "other"}  # car, motorcycle — low value
TRAILER_INDICATORS = {7}  # trucks can be trailers

# Image dimensions the model sees (must match imagery.py output)
IMG_W = 1024  # 512 @2x
IMG_H = 1024

# ── State ────────────────────────────────────────────────────────

_backend: str = "none"
_model: Any = None
_onnx_session: Any = None


# ── Initialization ───────────────────────────────────────────────

def get_backend() -> str:
    """Return the active detection backend name."""
    return _backend


def get_model_info() -> dict:
    """Return info about the loaded model for the status endpoint."""
    return {
        "backend": _backend,
        "model_name": YOLO_MODEL_NAME if _backend == "yolo" else (
            Path(ONNX_MODEL_PATH).name if _backend == "onnx" else "simulation"
        ),
        "confidence_floor": CONFIDENCE_FLOOR,
        "img_size": [IMG_W, IMG_H],
        "container_classes": list(CONTAINER_CLASSES.values()),
    }


def init_model() -> str:
    """
    Try to initialize the best available detection backend.
    Returns the backend name: "onnx", "yolo", or "simulation".
    """
    global _backend, _model, _onnx_session

    # 1. Try custom ONNX model
    if ONNX_MODEL_PATH and Path(ONNX_MODEL_PATH).exists():
        try:
            import onnxruntime as ort

            _onnx_session = ort.InferenceSession(
                ONNX_MODEL_PATH,
                providers=["CPUExecutionProvider"],
            )
            _backend = "onnx"
            logger.info(f"Loaded ONNX model from {ONNX_MODEL_PATH}")
            return _backend
        except Exception as e:
            logger.warning(f"Failed to load ONNX model: {e}")

    # 2. Try ultralytics YOLO
    try:
        from ultralytics import YOLO

        _model = YOLO(YOLO_MODEL_NAME)
        # Warm up with a dummy image
        _model.predict(np.zeros((IMG_H, IMG_W, 3), dtype=np.uint8), verbose=False)
        _backend = "yolo"
        logger.info(f"Loaded YOLO model: {YOLO_MODEL_NAME}")
        return _backend
    except Exception as e:
        logger.warning(f"YOLO not available: {e}")

    # 3. Fallback — simulation
    _backend = "simulation"
    logger.info("Using simulation fallback (no ML model available)")
    return _backend


# ── Detection ────────────────────────────────────────────────────

def detect_containers(
    image_path: str | Path | None,
    *,
    business_name: str = "",
    business_address: str = "",
) -> list[dict]:
    """
    Run container detection on a satellite image.

    Args:
        image_path: Path to JPEG satellite image (or None for simulation)
        business_name: Used for simulation seed
        business_address: Used for simulation seed

    Returns:
        List of detection dicts: {type, confidence, x, y, width, height, excluded}
    """
    if _backend == "yolo" and image_path and Path(image_path).exists():
        return _detect_yolo(image_path)
    elif _backend == "onnx" and image_path and Path(image_path).exists():
        return _detect_onnx(image_path)
    else:
        return _simulate_detection(business_name, business_address)


def _detect_yolo(image_path: str | Path) -> list[dict]:
    """Run YOLOv8 detection and map results to container types."""
    from PIL import Image

    img = Image.open(image_path)
    img_w, img_h = img.size

    results = _model.predict(
        source=img,
        conf=CONFIDENCE_FLOOR,
        verbose=False,
        imgsz=640,
    )

    detections = []
    for result in results:
        boxes = result.boxes
        if boxes is None:
            continue

        for i in range(len(boxes)):
            cls_id = int(boxes.cls[i].item())
            conf = float(boxes.conf[i].item())

            # Map COCO class to our container types
            if cls_id in CONTAINER_CLASSES:
                container_type = CONTAINER_CLASSES[cls_id]
            elif cls_id in VEHICLE_CLASSES:
                container_type = VEHICLE_CLASSES[cls_id]
            else:
                continue  # Skip irrelevant classes

            # Get bounding box — xyxy format
            x1, y1, x2, y2 = boxes.xyxy[i].tolist()

            # Scale to display coordinates (the viewer is ~500px wide)
            scale_x = 500 / img_w
            scale_y = 440 / img_h

            x = int(x1 * scale_x)
            y = int(y1 * scale_y)
            w = int((x2 - x1) * scale_x)
            h = int((y2 - y1) * scale_y)

            # Heuristic: long narrow boxes at certain aspect ratios → container
            aspect = w / max(h, 1)
            is_trailer = cls_id in TRAILER_INDICATORS and aspect > 2.5

            # Boost confidence for container-like detections
            if container_type == "40ft" and aspect > 2.0:
                conf = min(conf * 1.1, 0.99)

            detections.append({
                "type": "trailer" if is_trailer else container_type,
                "confidence": round(conf, 3),
                "x": max(x, 0),
                "y": max(y, 0),
                "width": max(w, 20),
                "height": max(h, 10),
                "excluded": is_trailer,
            })

    return detections


def _detect_onnx(image_path: str | Path) -> list[dict]:
    """Run ONNX model inference for container detection."""
    from PIL import Image

    img = Image.open(image_path).convert("RGB")
    img_w, img_h = img.size

    # Preprocess — resize to model input and normalize
    input_size = 640
    img_resized = img.resize((input_size, input_size))
    img_array = np.array(img_resized, dtype=np.float32) / 255.0
    img_array = np.transpose(img_array, (2, 0, 1))  # HWC → CHW
    img_array = np.expand_dims(img_array, axis=0)  # Add batch dim

    # Run inference
    input_name = _onnx_session.get_inputs()[0].name
    outputs = _onnx_session.run(None, {input_name: img_array})

    # Parse output — assumes YOLO-format output [batch, num_boxes, 85]
    # (x_center, y_center, w, h, obj_conf, class_probs...)
    predictions = outputs[0]
    if predictions.ndim == 3:
        predictions = predictions[0]

    detections = []
    for pred in predictions:
        obj_conf = pred[4]
        if obj_conf < CONFIDENCE_FLOOR:
            continue

        class_probs = pred[5:]
        cls_id = int(np.argmax(class_probs))
        cls_conf = float(class_probs[cls_id])
        conf = float(obj_conf * cls_conf)

        if conf < CONFIDENCE_FLOOR:
            continue

        if cls_id in CONTAINER_CLASSES:
            container_type = CONTAINER_CLASSES[cls_id]
        elif cls_id in VEHICLE_CLASSES:
            container_type = VEHICLE_CLASSES[cls_id]
        else:
            continue

        # Convert from model coords to display coords
        cx, cy, bw, bh = pred[:4]
        scale_x = 500 / input_size
        scale_y = 440 / input_size

        x = int((cx - bw / 2) * scale_x)
        y = int((cy - bh / 2) * scale_y)
        w = int(bw * scale_x)
        h = int(bh * scale_y)

        aspect = w / max(h, 1)
        is_trailer = cls_id in TRAILER_INDICATORS and aspect > 2.5

        detections.append({
            "type": "trailer" if is_trailer else container_type,
            "confidence": round(conf, 3),
            "x": max(x, 0),
            "y": max(y, 0),
            "width": max(w, 20),
            "height": max(h, 10),
            "excluded": is_trailer,
        })

    return detections


def _simulate_detection(name: str, address: str) -> list[dict]:
    """Deterministic mock container detection (fallback when no ML model)."""
    seed = hash(f"{name}{address}")
    rng = random.Random(seed)

    count = rng.randint(0, 4)
    detections = []

    for _ in range(count):
        is_trailer = rng.random() > 0.75
        container_type = "trailer" if is_trailer else ("40ft" if rng.random() > 0.5 else "other")
        confidence = round(0.35 + rng.random() * 0.6, 2)

        detections.append({
            "type": container_type,
            "confidence": confidence,
            "x": 50 + rng.randint(0, 300),
            "y": 50 + rng.randint(0, 200),
            "width": 120 if container_type == "40ft" else (100 if container_type == "trailer" else 80),
            "height": 35 if container_type == "40ft" else (28 if container_type == "trailer" else 30),
            "excluded": is_trailer,
        })

    return detections
