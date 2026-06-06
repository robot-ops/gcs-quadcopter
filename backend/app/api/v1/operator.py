from fastapi import APIRouter
from fastapi import Depends

from app.core.permissions import (
    require_role
)


router = APIRouter(
    prefix="/api/v1/operator",
    tags=["Operator"]
)


@router.get("/dashboard")
def dashboard(
    current_user=Depends(
        require_role(
            "ADMIN",
            "OPERATOR"
        )
    )
):

    return {
        "message": "Operator Dashboard"
    }