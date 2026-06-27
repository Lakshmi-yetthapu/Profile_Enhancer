from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class JobDescription(Base):
    """A parsed, embedded job description that many resumes can be matched/ranked against."""

    __tablename__ = "job_descriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    # LLM-parsed requirements (skills, experience, keywords, …)
    structured_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    # embedding vector of the JD's representative text, stored as a JSON float array
    embedding: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    provider: Mapped[str] = mapped_column(String(20), default="mistral")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    analyses: Mapped[list["Analysis"]] = relationship(back_populates="job_description")  # noqa: F821
