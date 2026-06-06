from fastapi import APIRouter
from fastapi import Depends
from fastapi import Query

from sqlalchemy.orm import Session

from app.database.database import get_db

from app.schemas.telemetry import (TelemetryCreate)
from app.services.telemetry_services import (TelemetryService)
from app.core.dependencies import (get_current_user)


router = APIRouter(
    prefix="/api/v1/telemetry",
    tags=["Telemetry"]
)


@router.post("")
async def create_telemetry(
    payload: TelemetryCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    return await TelemetryService.create(
        db,
        payload
    )


@router.get("/latest")
def latest_telemetry(
    drone_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    return TelemetryService.latest(
        db,
        drone_id
    )


@router.get("/history")
def telemetry_history(
    drone_id: int,
    limit: int = Query(
        default=100,
        le=1000
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    return TelemetryService.history(
        db,
        drone_id,
        limit
    )