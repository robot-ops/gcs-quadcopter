from fastapi import APIRouter
from fastapi import Depends

from app.core.permissions import (
    require_role
)


router = APIRouter(
    prefix="/api/v1/admin",
    tags=["Admin"]
)


@router.get("/dashboard")
def dashboard(
    current_user=Depends(
        require_role("ADMIN")
    )
):

    return {
        "message": "Admin Dashboard"
    }