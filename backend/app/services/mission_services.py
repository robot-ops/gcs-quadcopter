from sqlalchemy.orm import Session
from app.models.mission import Mission
from app.models.waypoint import Waypoint
from app.schemas.mission import MissionCreate
from app.websocket.manager import manager


class MissionService:

    @staticmethod
    async def create_and_upload(db: Session, payload: MissionCreate):
        mission = Mission(
            drone_id=payload.drone_id,
            mission_name=payload.mission_name,
            description=payload.description,
            status="READY"
        )
        db.add(mission)
        db.flush()

        wp_records = []
        for idx, wp in enumerate(payload.waypoints):
            record = Waypoint(
                mission_id=mission.id,
                seq=wp.seq if wp.seq else idx + 1,
                latitude=wp.latitude,
                longitude=wp.longitude,
                altitude=wp.altitude
            )
            db.add(record)
            wp_records.append(record)

        db.commit()
        db.refresh(mission)

        ws_waypoints = [
            {
                "seq": w.seq,
                "lat": w.latitude,
                "lng": w.longitude,
                "alt": w.altitude
            }
            for w in wp_records
        ]

        await manager.broadcast({
            "event": "upload_mission",
            "data": {
                "mission_id": mission.id,
                "drone_id": mission.drone_id,
                "mission_name": mission.mission_name,
                "waypoints": ws_waypoints
            }
        })

        return {
            "id": mission.id,
            "drone_id": mission.drone_id,
            "mission_name": mission.mission_name,
            "description": mission.description,
            "status": mission.status,
            "created_at": mission.created_at,
            "waypoints": wp_records
        }

    @staticmethod
    def latest(db: Session, drone_id: int = 1):
        mission = (
            db.query(Mission)
            .filter(Mission.drone_id == drone_id)
            .order_by(Mission.created_at.desc())
            .first()
        )
        if not mission:
            return None
        wps = (
            db.query(Waypoint)
            .filter(Waypoint.mission_id == mission.id)
            .order_by(Waypoint.seq.asc())
            .all()
        )
        return {
            "id": mission.id,
            "drone_id": mission.drone_id,
            "mission_name": mission.mission_name,
            "description": mission.description,
            "status": mission.status,
            "created_at": mission.created_at,
            "waypoints": wps
        }
