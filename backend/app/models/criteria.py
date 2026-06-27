from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Criterion(Base):
    """An admin-editable rubric rule used during no-JD analysis."""

    __tablename__ = "criteria"

    id: Mapped[int] = mapped_column(primary_key=True)
    # stable machine key used to map LLM output back to the rule
    key: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(20), default="do", nullable=False)  # do | dont
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    # if True, failing this rule forces overall verdict to "reject"
    is_critical: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class BannedProject(Base):
    """NxtWave internal projects that must not appear as self-made projects."""

    __tablename__ = "banned_projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
