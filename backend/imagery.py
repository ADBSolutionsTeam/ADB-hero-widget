"""
Satellite Imagery Fetcher
=========================
Fetches high-resolution satellite tiles from Mapbox Static Images API
and caches them locally for ML detection.
"""

import hashlib
import os
from pathlib import Path

import httpx

CACHE_DIR = Path(os.getenv("IMAGERY_CACHE_DIR", "imagery_cache"))
MAPBOX_TOKEN = os.getenv("MAPBOX_TOKEN", "")

# Image settings — 512x512 at zoom 18 gives ~0.3m/px resolution
IMAGE_WIDTH = 512
IMAGE_HEIGHT = 512
ZOOM_LEVEL = 18


def _cache_key(lat: float, lng: float) -> str:
    raw = f"{lat:.6f},{lng:.6f}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _ensure_cache_dir() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def get_cached_path(lat: float, lng: float) -> Path | None:
    """Return cached image path if it exists."""
    path = CACHE_DIR / f"{_cache_key(lat, lng)}.jpg"
    return path if path.exists() else None


async def fetch_satellite_image(
    lat: float,
    lng: float,
    *,
    client: httpx.AsyncClient | None = None,
) -> Path | None:
    """
    Fetch a satellite tile for the given coordinates.

    Returns the path to the saved JPEG, or None on failure.
    Uses Mapbox Static Images API with @2x for high-res tiles.
    """
    _ensure_cache_dir()

    # Check cache first
    cached = get_cached_path(lat, lng)
    if cached:
        return cached

    if not MAPBOX_TOKEN:
        return None

    # Mapbox Static Images API — satellite style, @2x for retina
    url = (
        f"https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/"
        f"{lng:.6f},{lat:.6f},{ZOOM_LEVEL},0/"
        f"{IMAGE_WIDTH}x{IMAGE_HEIGHT}@2x"
    )
    params = {"access_token": MAPBOX_TOKEN, "attribution": "false", "logo": "false"}

    owns_client = client is None
    if owns_client:
        client = httpx.AsyncClient(timeout=30)

    try:
        resp = await client.get(url, params=params)
        if resp.status_code != 200:
            return None

        content_type = resp.headers.get("content-type", "")
        if "image" not in content_type:
            return None

        out_path = CACHE_DIR / f"{_cache_key(lat, lng)}.jpg"
        out_path.write_bytes(resp.content)
        return out_path
    except Exception:
        return None
    finally:
        if owns_client:
            await client.aclose()


async def fetch_satellite_image_bytes(
    lat: float,
    lng: float,
    *,
    client: httpx.AsyncClient | None = None,
) -> bytes | None:
    """
    Fetch satellite tile and return raw JPEG bytes.
    Also caches to disk.
    """
    path = await fetch_satellite_image(lat, lng, client=client)
    if path and path.exists():
        return path.read_bytes()
    return None
