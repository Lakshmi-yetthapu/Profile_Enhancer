from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Setting(Base):
    """Simple admin-editable key/value config (e.g. scoring thresholds)."""

    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
