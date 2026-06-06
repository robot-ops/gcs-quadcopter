from datetime import datetime

from pydantic import BaseModel


class TelemetryCreate(BaseModel):

    drone_id: int

    latitude: float
    longitude: float
    altitude: float

    roll: float
    pitch: float
    yaw: float

    battery: float
    speed: float

    rssi: int
    snr: float


class TelemetryResponse(BaseModel):

    id: int

    drone_id: int

    latitude: float
    longitude: float
    altitude: float

    roll: float
    pitch: float
    yaw: float

    battery: float
    speed: float

    rssi: int
    snr: float

    created_at: datetime

    class Config:
        from_attributes = True