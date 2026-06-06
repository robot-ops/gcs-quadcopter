from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import Float
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey

from sqlalchemy.sql import func

from app.database.base import Base


class Telemetry(Base):

    __tablename__ = "telemetry"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    drone_id = Column(
        Integer,
        ForeignKey("drones.id"),
        nullable=False,
        index=True
    )

    latitude = Column(Float)
    longitude = Column(Float)
    altitude = Column(Float)

    roll = Column(Float)
    pitch = Column(Float)
    yaw = Column(Float)

    battery = Column(Float)
    speed = Column(Float)

    rssi = Column(Integer)
    snr = Column(Float)

    created_at = Column(
        DateTime,
        server_default=func.now(),
        index=True
    )