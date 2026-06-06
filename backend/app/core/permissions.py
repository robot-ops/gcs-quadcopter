from fastapi import Depends
from fastapi import HTTPException
from fastapi import status

from app.models.user import User

from app.core.dependencies import (
    get_current_user
)


def require_role(*roles):

    def checker(
        current_user: User = Depends(
            get_current_user
        )
    ):

        user_role = current_user.role.name

        if user_role not in roles:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied"
            )

        return current_user

    return checker