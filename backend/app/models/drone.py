from datetime import datetime

from sqlalchemy import (
    String,
    DateTime,
    Enum,
    ForeignKey
)

from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship
)

from app.database.base import Base


class Drone(Base):

    __tablename__ = "drones"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id")
    )

    serial_number: Mapped[str] = mapped_column(
        String(100),
        unique=True
    )

    name: Mapped[str] = mapped_column(
        String(100)
    )

    model: Mapped[str] = mapped_column(
        String(100),
        nullable=True
    )

    firmware_version: Mapped[str] = mapped_column(
        String(50),
        nullable=True
    )

    status: Mapped[str] = mapped_column(
        Enum(
            "ONLINE",
            "OFFLINE",
            "FLYING",
            "MISSION",
            "ERROR",
            name="drone_status"
        ),
        default="OFFLINE"
    )

    last_seen: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=True
    )

    user = relationship("User")