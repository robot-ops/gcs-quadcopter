from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class FlightLogCreate(BaseModel):
    drone_id: int = 1
    mission_id: Optional[int] = None
    start_time: datetime
    end_time: datetime
    distance: Optional[float] = 0.0
    max_altitude: Optional[float] = 0.0
    avg_speed: Optional[float] = 0.0


class FlightLogResponse(BaseModel):
    id: int
    drone_id: int
    mission_id: Optional[int] = None
    start_time: datetime
    end_time: datetime
    distance: Optional[float] = 0.0
    max_altitude: Optional[float] = 0.0
    avg_speed: Optional[float] = 0.0

    class Config:
        from_attributes = True
