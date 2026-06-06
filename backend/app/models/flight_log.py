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


class FlightLog(Base):

    __tablename__ = "flight_logs"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    drone_id: Mapped[int] = mapped_column(
        ForeignKey("drones.id")
    )

    mission_id: Mapped[int] = mapped_column(
        ForeignKey("missions.id"),
        nullable=True
    )

    start_time: Mapped[datetime] = mapped_column(
        DateTime
    )

    end_time: Mapped[datetime] = mapped_column(
        DateTime
    )

    distance: Mapped[float] = mapped_column(
        Float,
        nullable=True
    )

    max_altitude: Mapped[float] = mapped_column(
        Float,
        nullable=True
    )

    avg_speed: Mapped[float] = mapped_column(
        Float,
        nullable=True
    )