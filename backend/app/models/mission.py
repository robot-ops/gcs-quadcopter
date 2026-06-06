from datetime import datetime

from sqlalchemy import (
    String,
    Text,
    DateTime,
    Enum,
    ForeignKey
)

from sqlalchemy.orm import (
    Mapped,
    mapped_column
)

from app.database.base import Base


class Mission(Base):

    __tablename__ = "missions"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    drone_id: Mapped[int] = mapped_column(
        ForeignKey("drones.id")
    )

    mission_name: Mapped[str] = mapped_column(
        String(255)
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=True
    )

    status: Mapped[str] = mapped_column(
        Enum(
            "DRAFT",
            "READY",
            "RUNNING",
            "COMPLETED",
            "FAILED",
            name="mission_status"
        ),
        default="DRAFT"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )