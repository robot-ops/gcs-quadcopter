from app.database.session import SessionLocal

from app.database.seeds.seed_roles import (
    seed_roles
)
from app.models.user import User
from app.models.role import Role
from app.core.security import hash_password

from app.models.drone import Drone

def seed_users(db):
    admin_role = db.query(Role).filter(Role.name == "ADMIN").first()
    if not admin_role:
        return
    admin_user = db.query(User).filter(User.username == "admin").first()
    if not admin_user:
        admin = User(
            username="admin",
            email="admin@aerolink.co",
            password_hash=hash_password("admin123"),
            role_id=admin_role.id
        )
        db.add(admin)
        db.commit()

def seed_drones(db):
    admin_user = db.query(User).filter(User.username == "admin").first()
    if not admin_user:
        return
    
    drones = [
        {"name": "Quadcopter X-1", "serial_number": "QC-2026-X1", "model": "X-series", "firmware_version": "v1.4.2", "status": "ONLINE"}
    ]
    for d_data in drones:
        exists = db.query(Drone).filter(Drone.serial_number == d_data["serial_number"]).first()
        if not exists:
            drone = Drone(
                user_id=admin_user.id,
                name=d_data["name"],
                serial_number=d_data["serial_number"],
                model=d_data["model"],
                firmware_version=d_data["firmware_version"],
                status=d_data["status"]
            )
            db.add(drone)
    db.commit()

def run():

    db = SessionLocal()

    try:

        seed_roles(db)
        seed_users(db)
        seed_drones(db)

    finally:

        db.close()


if __name__ == "__main__":
    run()