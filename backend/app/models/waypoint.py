from sqlalchemy import (
    Float,
    Integer,
    ForeignKey
)

from sqlalchemy.orm import (
    Mapped,
    mapped_column
)

from app.database.base import Base


class Waypoint(Base):

    __tablename__ = "waypoints"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    mission_id: Mapped[int] = mapped_column(
        ForeignKey(
            "missions.id",
            ondelete="CASCADE"
        )
    )

    seq: Mapped[int] = mapped_column(
        Integer
    )

    latitude: Mapped[float] = mapped_column(
        Float
    )

    longitude: Mapped[float] = mapped_column(
        Float
    )

    altitude: Mapped[float] = mapped_column(
        Float
    )