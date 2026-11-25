from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from app.schemas.waypoint import WaypointCreate, WaypointResponse


class MissionCreate(BaseModel):
    drone_id: int = 1
    mission_name: str = "Auto Waypoint Mission"
    description: Optional[str] = None
    waypoints: List[WaypointCreate]


class MissionResponse(BaseModel):
    id: int
    drone_id: int
    mission_name: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    waypoints: List[WaypointResponse] = []

    class Config:
        from_attributes = True
