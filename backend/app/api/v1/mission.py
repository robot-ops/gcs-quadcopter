from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.schemas.mission import MissionCreate
from app.services.mission_services import MissionService
from app.core.dependencies import get_current_user

router = APIRouter(
    prefix="/api/v1/missions",
    tags=["Missions"]
)


@router.post("")
async def create_and_upload_mission(
    payload: MissionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return await MissionService.create_and_upload(db, payload)


@router.get("/latest")
def get_latest_mission(
    drone_id: int = 1,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return MissionService.latest(db, drone_id)
