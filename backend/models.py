"""SQLAlchemy ORM models."""

from datetime import datetime, timezone
from sqlalchemy import Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str] = mapped_column(String(500))
    city: Mapped[str] = mapped_column(String(100), default="")
    state: Mapped[str] = mapped_column(String(10), default="")
    zip: Mapped[str] = mapped_column(String(20), default="")
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(Integer, index=True)
    containers_detected: Mapped[int] = mapped_column(Integer, default=0)
    max_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    imagery_note: Mapped[str] = mapped_column(String(255), default="")
    imagery_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    detection_backend: Mapped[str] = mapped_column(String(20), default="simulation")
    detection_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    scanned_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class PipelineState(Base):
    """Singleton row tracking the current pipeline progress."""

    __tablename__ = "pipeline_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    geocoding: Mapped[bool] = mapped_column(Boolean, default=False)
    scanning: Mapped[bool] = mapped_column(Boolean, default=False)
    geocode_progress: Mapped[int] = mapped_column(Integer, default=0)
    geocode_total: Mapped[int] = mapped_column(Integer, default=0)
    scan_progress: Mapped[int] = mapped_column(Integer, default=0)
    scan_total: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
