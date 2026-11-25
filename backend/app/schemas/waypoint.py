from pydantic import BaseModel
from typing import Optional


class WaypointBase(BaseModel):
    seq: int
    latitude: float
    longitude: float
    altitude: float


class WaypointCreate(WaypointBase):
    pass


class WaypointResponse(WaypointBase):
    id: int
    mission_id: int

    class Config:
        from_attributes = True
