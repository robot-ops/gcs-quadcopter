from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.schemas.flight_log import FlightLogCreate, FlightLogResponse
from app.services.flight_log_services import FlightLogService
from app.core.dependencies import get_current_user

router = APIRouter(
    prefix="/api/v1/flight-logs",
    tags=["Flight Logs"]
)


@router.post("", response_model=FlightLogResponse)
def create_flight_log(
    payload: FlightLogCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return FlightLogService.create(db, payload)


@router.get("", response_model=List[FlightLogResponse])
def get_flight_logs(
    drone_id: int = 1,
    limit: int = Query(default=50, le=500),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return FlightLogService.list(db, drone_id, limit)


@router.delete("/{log_id}")
def delete_flight_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    success = FlightLogService.delete(db, log_id)
    if not success:
        raise HTTPException(status_code=404, detail="Flight log not found")
    return {"status": "deleted", "id": log_id}
