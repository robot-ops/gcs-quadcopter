from sqlalchemy.orm import Session

from app.models.telemetry import Telemetry

from app.schemas.telemetry import (TelemetryCreate)
from app.websocket.manager import manager

class TelemetryService:

    @staticmethod
    async def create(
        db: Session,
        payload: TelemetryCreate
    ):

        telemetry = Telemetry(
            drone_id=payload.drone_id,

            latitude=payload.latitude,
            longitude=payload.longitude,
            altitude=payload.altitude,

            roll=payload.roll,
            pitch=payload.pitch,
            yaw=payload.yaw,

            battery=payload.battery,
            speed=payload.speed,

            rssi=payload.rssi,
            snr=payload.snr
        )

        db.add(telemetry)

        db.commit()

        db.refresh(telemetry)

        await manager.broadcast(
            {
                "event": "telemetry",

                "data": {
                    "id": telemetry.id,
                    "drone_id": telemetry.drone_id,

                    "latitude": telemetry.latitude,
                    "longitude": telemetry.longitude,
                    "altitude": telemetry.altitude,

                    "roll": telemetry.roll,
                    "pitch": telemetry.pitch,
                    "yaw": telemetry.yaw,

                    "battery": telemetry.battery,
                    "speed": telemetry.speed,

                    "rssi": telemetry.rssi,
                    "snr": telemetry.snr,

                    "created_at": str(
                        telemetry.created_at
                    )
                }
            }
        )

        return telemetry

    @staticmethod
    def latest(
        db: Session,
        drone_id: int
    ):

        return (
            db.query(Telemetry)
            .filter(
                Telemetry.drone_id == drone_id
            )
            .order_by(
                Telemetry.created_at.desc()
            )
            .first()
        )

    @staticmethod
    def history(
        db: Session,
        drone_id: int,
        limit: int = 100
    ):

        return (
            db.query(Telemetry)
            .filter(
                Telemetry.drone_id == drone_id
            )
            .order_by(
                Telemetry.created_at.desc()
            )
            .limit(limit)
            .all()
        )