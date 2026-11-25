from sqlalchemy.orm import Session
from app.models.flight_log import FlightLog
from app.schemas.flight_log import FlightLogCreate


class FlightLogService:

    @staticmethod
    def create(db: Session, payload: FlightLogCreate):
        log = FlightLog(
            drone_id=payload.drone_id,
            mission_id=payload.mission_id,
            start_time=payload.start_time,
            end_time=payload.end_time,
            distance=payload.distance,
            max_altitude=payload.max_altitude,
            avg_speed=payload.avg_speed
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def list(db: Session, drone_id: int = 1, limit: int = 50):
        return (
            db.query(FlightLog)
            .filter(FlightLog.drone_id == drone_id)
            .order_by(FlightLog.start_time.desc())
            .limit(limit)
            .all()
        )

    @staticmethod
    def delete(db: Session, log_id: int):
        log = db.query(FlightLog).filter(FlightLog.id == log_id).first()
        if log:
            db.delete(log)
            db.commit()
            return True
        return False
