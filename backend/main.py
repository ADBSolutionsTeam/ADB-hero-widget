"""
Container Hunter — FastAPI Backend
===================================
Serves the API that the Next.js frontend expects.
Run:  uvicorn main:app --reload --port 8000
"""

import asyncio
import csv
import io
import json
import logging
import os
import random
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import init_db, get_db
from models import Business, Scan, PipelineState
from detector import init_model, detect_containers, get_model_info, get_backend
from imagery import fetch_satellite_image, IMAGE_WIDTH, IMAGE_HEIGHT

load_dotenv()
logger = logging.getLogger("container_hunter")

MAPBOX_TOKEN = os.getenv("MAPBOX_TOKEN", "")
AUTO_APPROVE_THRESHOLD = float(os.getenv("AUTO_APPROVE_THRESHOLD", "0.92"))
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.45"))


# ── Lifespan ──────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Ensure pipeline_state singleton exists
    async for db in get_db():
        row = await db.get(PipelineState, 1)
        if not row:
            db.add(PipelineState(id=1))
            await db.commit()
    # Initialize ML detection model
    backend = init_model()
    logger.info(f"Detection backend: {backend}")
    yield


app = FastAPI(title="Container Hunter API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic Schemas ──────────────────────────────────────────

class ScanRequest(BaseModel):
    batch_size: int = 50


class ReviewRequest(BaseModel):
    status: str  # "confirmed" | "rejected"
    notes: str | None = None


class BatchReviewRequest(BaseModel):
    business_ids: list[int]
    status: str  # "confirmed" | "rejected" | "review" | "clear"
    notes: str | None = None


# ── GET /api/stats ────────────────────────────────────────────

@app.get("/api/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Scan.status, func.count(Scan.id)).group_by(Scan.status)
    )
    counts = {row[0]: row[1] for row in result.all()}

    # Also count businesses with no scan yet
    total_biz = (await db.execute(select(func.count(Business.id)))).scalar() or 0
    scanned_biz = (
        await db.execute(select(func.count(func.distinct(Scan.business_id))))
    ).scalar() or 0
    pending_count = total_biz - scanned_biz

    return {
        "confirmed": counts.get("confirmed", 0),
        "needs_review": counts.get("review", 0),
        "rejected": counts.get("rejected", 0),
        "pending": pending_count + counts.get("pending", 0),
        "scan_failed": counts.get("failed", 0),
    }


# ── GET /api/locations ────────────────────────────────────────

@app.get("/api/locations")
async def get_locations(db: AsyncSession = Depends(get_db)):
    # Left-join businesses with their latest scan
    businesses = (await db.execute(select(Business))).scalars().all()

    locations = []
    for biz in businesses:
        # Get latest scan for this business
        latest_scan = (
            await db.execute(
                select(Scan)
                .where(Scan.business_id == biz.id)
                .order_by(Scan.scanned_at.desc())
                .limit(1)
            )
        ).scalar()

        locations.append(
            {
                "id": biz.id,
                "business_name": biz.name,
                "address": f"{biz.address}, {biz.city}, {biz.state} {biz.zip}".strip(", "),
                "lat": biz.lat or 0,
                "lng": biz.lng or 0,
                "status": latest_scan.status if latest_scan else biz.status,
                "containers_detected": latest_scan.containers_detected if latest_scan else 0,
                "max_confidence": latest_scan.max_confidence if latest_scan else 0,
                "scan_id": latest_scan.id if latest_scan else None,
                "has_imagery": bool(latest_scan and latest_scan.imagery_path),
                "detection_backend": latest_scan.detection_backend if latest_scan else None,
                "detection_details": json.loads(latest_scan.detection_details) if latest_scan and latest_scan.detection_details else [],
            }
        )

    return {"locations": locations}


# ── GET /api/pipeline/status ──────────────────────────────────

@app.get("/api/pipeline/status")
async def get_pipeline_status(db: AsyncSession = Depends(get_db)):
    state = await db.get(PipelineState, 1)
    if not state:
        return {
            "geocoding": False,
            "scanning": False,
            "geocode_progress": 0,
            "geocode_total": 0,
            "scan_progress": 0,
            "scan_total": 0,
            "last_error": None,
        }
    return {
        "geocoding": state.geocoding,
        "scanning": state.scanning,
        "geocode_progress": state.geocode_progress,
        "geocode_total": state.geocode_total,
        "scan_progress": state.scan_progress,
        "scan_total": state.scan_total,
        "last_error": state.last_error,
    }


# ── GET /api/config ───────────────────────────────────────────

@app.get("/api/config")
async def get_config():
    return {
        "mapbox_token": MAPBOX_TOKEN[:8] + "..." if MAPBOX_TOKEN else "",
        "auto_approve_threshold": AUTO_APPROVE_THRESHOLD,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
    }


# ── GET /api/model/status ────────────────────────────────────

@app.get("/api/model/status")
async def model_status():
    """Return info about the active ML detection backend."""
    return get_model_info()


# ── GET /api/imagery/{scan_id} ───────────────────────────────

@app.get("/api/imagery/{scan_id}")
async def get_imagery(scan_id: int, db: AsyncSession = Depends(get_db)):
    """Serve the satellite image for a scan."""
    scan = await db.get(Scan, scan_id)
    if not scan:
        raise HTTPException(404, "Scan not found")

    if not scan.imagery_path or not Path(scan.imagery_path).exists():
        raise HTTPException(404, "No imagery available for this scan")

    return FileResponse(
        scan.imagery_path,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


# ── POST /api/upload ─────────────────────────────────────────

@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    content = (await file.read()).decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))

    count = 0
    skipped = 0

    for row in reader:
        # Flexible column matching (case-insensitive)
        lower = {k.lower().strip(): v.strip() for k, v in row.items()}

        name = lower.get("business name") or lower.get("name") or lower.get("business") or ""
        address = lower.get("address") or lower.get("street") or ""

        if not name and not address:
            skipped += 1
            continue

        biz = Business(
            name=name,
            address=address,
            city=lower.get("city", ""),
            state=lower.get("state", ""),
            zip=lower.get("zip") or lower.get("postal") or lower.get("zipcode") or "",
        )
        db.add(biz)
        count += 1

    await db.commit()

    # Kick off geocoding in background
    asyncio.create_task(_geocode_all(db))

    return {"message": f"Uploaded {count} businesses", "count": count, "skipped": skipped}


# ── POST /api/scan ────────────────────────────────────────────

@app.post("/api/scan")
async def start_scan(req: ScanRequest, db: AsyncSession = Depends(get_db)):
    # Find businesses with coordinates that haven't been scanned yet
    scanned_ids_q = select(func.distinct(Scan.business_id))
    unscanned = (
        await db.execute(
            select(Business)
            .where(Business.lat.isnot(None))
            .where(Business.id.notin_(scanned_ids_q))
            .limit(req.batch_size)
        )
    ).scalars().all()

    if not unscanned:
        return {"message": "No unscanned businesses with coordinates", "batch_size": 0}

    asyncio.create_task(_run_scan_batch([b.id for b in unscanned]))

    return {
        "message": f"Scanning {len(unscanned)} businesses",
        "batch_size": len(unscanned),
    }


# ── GET /api/reviews/pending ─────────────────────────────────

@app.get("/api/reviews/pending")
async def get_pending_reviews(limit: int = 20, db: AsyncSession = Depends(get_db)):
    scans = (
        await db.execute(
            select(Scan).where(Scan.status == "review").order_by(Scan.scanned_at.desc()).limit(limit)
        )
    ).scalars().all()

    reviews = []
    for scan in scans:
        biz = await db.get(Business, scan.business_id)
        if not biz:
            continue
        reviews.append(
            {
                "scan_id": scan.id,
                "business_id": biz.id,
                "business_name": biz.name,
                "address": f"{biz.address}, {biz.city}, {biz.state} {biz.zip}".strip(", "),
                "lat": biz.lat or 0,
                "lng": biz.lng or 0,
                "containers_detected": scan.containers_detected,
                "max_confidence": scan.max_confidence,
                "status": scan.status,
                "scanned_at": scan.scanned_at.isoformat() if scan.scanned_at else "",
                "imagery_note": scan.imagery_note,
                "has_imagery": bool(scan.imagery_path),
                "detection_backend": scan.detection_backend,
                "detection_details": json.loads(scan.detection_details) if scan.detection_details else [],
            }
        )

    return {"reviews": reviews}


# ── POST /api/reviews/:scan_id ───────────────────────────────

@app.post("/api/reviews/{scan_id}")
async def submit_review(scan_id: int, req: ReviewRequest, db: AsyncSession = Depends(get_db)):
    scan = await db.get(Scan, scan_id)
    if not scan:
        raise HTTPException(404, "Scan not found")

    if req.status not in ("confirmed", "rejected"):
        raise HTTPException(400, "Status must be 'confirmed' or 'rejected'")

    scan.status = req.status
    scan.reviewed_at = datetime.now(timezone.utc)
    scan.review_notes = req.notes

    # Also update the business status
    biz = await db.get(Business, scan.business_id)
    if biz:
        biz.status = req.status

    await db.commit()

    return {"ok": True, "scan_id": scan.id, "status": scan.status}


# ── POST /api/reviews/batch ──────────────────────────────────

@app.post("/api/reviews/batch")
async def batch_review(req: BatchReviewRequest, db: AsyncSession = Depends(get_db)):
    """Bulk status update for multiple businesses."""
    if req.status not in ("confirmed", "rejected", "review", "clear"):
        raise HTTPException(400, "Status must be 'confirmed', 'rejected', 'review', or 'clear'")

    updated = 0
    now = datetime.now(timezone.utc)

    for biz_id in req.business_ids:
        # Find latest scan for this business
        latest_scan = (
            await db.execute(
                select(Scan)
                .where(Scan.business_id == biz_id)
                .order_by(Scan.scanned_at.desc())
                .limit(1)
            )
        ).scalar()

        if latest_scan:
            latest_scan.status = req.status
            latest_scan.reviewed_at = now
            if req.notes:
                latest_scan.review_notes = req.notes

        # Update business status
        biz = await db.get(Business, biz_id)
        if biz:
            biz.status = req.status
            updated += 1

    await db.commit()

    return {"ok": True, "updated": updated, "status": req.status}


# ── GET /api/export ───────────────────────────────────────────

@app.get("/api/export")
async def export_csv(db: AsyncSession = Depends(get_db)):
    confirmed_scans = (
        await db.execute(
            select(Scan).where(Scan.status == "confirmed")
        )
    ).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Business Name", "Address", "City", "State", "Zip",
        "Lat", "Lng", "Containers Detected", "Max Confidence",
        "Scanned At", "Review Notes",
    ])

    for scan in confirmed_scans:
        biz = await db.get(Business, scan.business_id)
        if not biz:
            continue
        writer.writerow([
            biz.name, biz.address, biz.city, biz.state, biz.zip,
            biz.lat, biz.lng, scan.containers_detected,
            f"{scan.max_confidence:.2f}",
            scan.scanned_at.isoformat() if scan.scanned_at else "",
            scan.review_notes or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=container_hunter_export.csv"},
    )


# ── Background: Geocoding ────────────────────────────────────

async def _geocode_all(db_session: AsyncSession):
    """Geocode all businesses missing lat/lng via Mapbox."""
    from database import SessionLocal

    async with SessionLocal() as db:
        state = await db.get(PipelineState, 1)

        ungeocoded = (
            await db.execute(select(Business).where(Business.lat.is_(None)))
        ).scalars().all()

        if not ungeocoded:
            return

        state.geocoding = True
        state.geocode_total = len(ungeocoded)
        state.geocode_progress = 0
        state.last_error = None
        await db.commit()

        async with httpx.AsyncClient(timeout=10) as client:
            for i, biz in enumerate(ungeocoded):
                coords = await _geocode_one(client, biz)
                if coords:
                    biz.lat = coords[0]
                    biz.lng = coords[1]

                state.geocode_progress = i + 1
                await db.commit()
                await asyncio.sleep(0.12)  # rate limit

        state.geocoding = False
        await db.commit()


async def _geocode_one(
    client: httpx.AsyncClient, biz: Business
) -> tuple[float, float] | None:
    if not MAPBOX_TOKEN:
        # Fallback: generate deterministic coords in Phoenix area
        seed = hash(f"{biz.name}{biz.address}")
        rng = random.Random(seed)
        return (33.35 + rng.random() * 0.3, -(111.8 + rng.random() * 0.4))

    query = ", ".join(filter(None, [biz.address, biz.city, biz.state, biz.zip]))

    try:
        resp = await client.get(
            f"https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json",
            params={"access_token": MAPBOX_TOKEN, "country": "US", "limit": 1, "types": "address,poi"},
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        if not data.get("features"):
            return None
        lng, lat = data["features"][0]["center"]
        return (lat, lng)
    except Exception:
        return None


# ── Background: Scanning ──────────────────────────────────────

async def _run_scan_batch(business_ids: list[int]):
    """
    Run container detection for a batch of businesses.

    Pipeline per business:
      1. Fetch satellite imagery from Mapbox (if coords + token available)
      2. Run ML detection (YOLO / ONNX / simulation fallback)
      3. Filter + classify detections
      4. Store results
    """
    from database import SessionLocal

    async with SessionLocal() as db:
        state = await db.get(PipelineState, 1)
        state.scanning = True
        state.scan_total = len(business_ids)
        state.scan_progress = 0
        state.last_error = None
        await db.commit()

        backend = get_backend()

        async with httpx.AsyncClient(timeout=30) as client:
            for i, biz_id in enumerate(business_ids):
                biz = await db.get(Business, biz_id)
                if not biz:
                    continue

                imagery_path = None
                imagery_note = "No coordinates"

                # Step 1: Fetch satellite imagery
                if biz.lat and biz.lng:
                    imagery_note = f"Satellite scan at ({biz.lat:.4f}, {biz.lng:.4f})"
                    try:
                        path = await fetch_satellite_image(
                            biz.lat, biz.lng, client=client
                        )
                        if path:
                            imagery_path = str(path)
                            imagery_note += f" | {IMAGE_WIDTH}x{IMAGE_HEIGHT}@2x"
                    except Exception as e:
                        logger.warning(f"Imagery fetch failed for {biz.name}: {e}")
                        imagery_note += " | imagery fetch failed"

                # Step 2: Run ML detection
                detections = detect_containers(
                    imagery_path,
                    business_name=biz.name,
                    business_address=biz.address,
                )

                # Step 3: Filter + classify
                valid = [
                    d for d in detections
                    if not d.get("excluded") and d["confidence"] >= CONFIDENCE_THRESHOLD
                ]
                containers = len(valid)
                max_conf = max((d["confidence"] for d in valid), default=0.0)

                if containers == 0:
                    status = "clear"
                elif max_conf >= AUTO_APPROVE_THRESHOLD:
                    status = "confirmed"
                else:
                    status = "review"

                # Step 4: Store scan
                scan = Scan(
                    business_id=biz_id,
                    containers_detected=containers,
                    max_confidence=round(max_conf, 2),
                    status=status,
                    imagery_note=imagery_note,
                    imagery_path=imagery_path,
                    detection_backend=backend,
                    detection_details=json.dumps(detections),
                )
                db.add(scan)

                biz.status = status
                state.scan_progress = i + 1
                await db.commit()

                # Small delay between scans to avoid rate limiting
                await asyncio.sleep(0.3)

        state.scanning = False
        await db.commit()
