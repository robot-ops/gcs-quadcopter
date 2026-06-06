from datetime import datetime

from sqlalchemy import (
    Float,
    DateTime,
    ForeignKey
)

from sqlalchemy.orm import (
    Mapped,
    mapped_column
)

from app.database.base import Base


class DroneState(Base):

    __tablename__ = "drone_state"

    drone_id: Mapped[int] = mapped_column(
        ForeignKey("drones.id"),
        primary_key=True
    )

    latitude: Mapped[float] = mapped_column(
        Float,
        nullable=True
    )

    longitude: Mapped[float] = mapped_column(
        Float,
        nullable=True
    )

    altitude: Mapped[float] = mapped_column(
        Float,
        nullable=True
    )

    roll: Mapped[float] = mapped_column(
        Float,
        nullable=True
    )

    pitch: Mapped[float] = mapped_column(
        Float,
        nullable=True
    )

    yaw: Mapped[float] = mapped_column(
        Float,
        nullable=True
    )

    speed: Mapped[float] = mapped_column(
        Float,
        nullable=True
    )

    battery: Mapped[float] = mapped_column(
        Float,
        nullable=True
    )

    signal: Mapped[float] = mapped_column(
        Float,
        nullable=True
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )