from datetime import datetime

from sqlalchemy import (
    String,
    JSON,
    DateTime,
    Enum,
    ForeignKey
)

from sqlalchemy.orm import (
    Mapped,
    mapped_column
)

from app.database.base import Base


class Command(Base):

    __tablename__ = "commands"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    drone_id: Mapped[int] = mapped_column(
        ForeignKey("drones.id")
    )

    command: Mapped[str] = mapped_column(
        String(100)
    )

    payload: Mapped[dict] = mapped_column(
        JSON,
        nullable=True
    )

    status: Mapped[str] = mapped_column(
        Enum(
            "PENDING",
            "SENT",
            "SUCCESS",
            "FAILED",
            name="command_status"
        ),
        default="PENDING"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )