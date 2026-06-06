import json
from fastapi import FastAPI
from fastapi import WebSocket
from fastapi import WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.websocket.manager import manager

from app.api.v1.auth import (router as auth_router)
from app.api.v1.admin import (router as admin_router)
from app.api.v1.operator import (router as operator_router)
from app.api.v1.telemetry import (router as telemetry_router)

app = FastAPI(
    title="Digital Twin Quadcopter API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(operator_router)
app.include_router(telemetry_router)


@app.get("/")
def root():
    return {
        "status": "running"
    }


@app.websocket("/ws/telemetry")
async def telemetry_ws(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("event") == "command":
                    await manager.broadcast(msg)
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)