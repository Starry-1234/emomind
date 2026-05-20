import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import col, func, select

from app.api.deps import (
    CurrentUser,
    SessionDep,
    get_current_active_superuser,
)
from app.models import (
    Message,
    UpdatePassword,
    User,
    UserCreate,
    UserPublic,
    UserRegister,
    UsersPublic,
    UserUpdate,
    UserUpdateMe,
)
from app.repositories import user_repo
from app.services import ServiceError, user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UsersPublic,
)
def read_users(session: SessionDep, skip: int = 0, limit: int = 100) -> Any:
    """
    Retrieve users.
    """
    count_statement = select(func.count()).select_from(User)
    count = session.exec(count_statement).one()

    statement = (
        select(User).order_by(col(User.created_at).desc()).offset(skip).limit(limit)
    )
    users = session.exec(statement).all()

    return UsersPublic(data=users, count=count)


@router.post(
    "/", dependencies=[Depends(get_current_active_superuser)], response_model=UserPublic
)
def create_user(*, session: SessionDep, user_in: UserCreate) -> Any:
    """
    Create new user.
    """
    try:
        return user_service.create_user(session=session, user_in=user_in)
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.patch("/me", response_model=UserPublic)
def update_user_me(
    *, session: SessionDep, user_in: UserUpdateMe, current_user: CurrentUser
) -> Any:
    """
    Update own user.
    """
    try:
        return user_service.update_user_me(
            session=session, current_user=current_user, user_in=user_in
        )
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.patch("/me/password", response_model=Message)
def update_password_me(
    *, session: SessionDep, body: UpdatePassword, current_user: CurrentUser
) -> Any:
    """
    Update own password.
    """
    try:
        user_service.update_password_me(
            session=session,
            current_user=current_user,
            current_password=body.current_password,
            new_password=body.new_password,
        )
        return Message(message="Password updated successfully")
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.get("/me", response_model=UserPublic)
def read_user_me(current_user: CurrentUser) -> Any:
    """
    Get current user.
    """
    return current_user


@router.delete("/me", response_model=Message)
def delete_user_me(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Delete own user.
    """
    if current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="Super users are not allowed to delete themselves"
        )
    session.delete(current_user)
    session.commit()
    return Message(message="User deleted successfully")


@router.post("/signup", response_model=UserPublic)
def register_user(session: SessionDep, user_in: UserRegister) -> Any:
    """
    Create new user without the need to be logged in.
    """
    try:
        return user_service.register_user(session=session, user_in=user_in)
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.get("/{user_id}", response_model=UserPublic)
def read_user_by_id(
    user_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> Any:
    """
    Get a specific user by id.
    """
    user = user_repo.get(session=session, id=user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user == current_user:
        return user
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have enough privileges",
        )
    return user


@router.patch(
    "/{user_id}",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UserPublic,
)
def update_user(
    *,
    session: SessionDep,
    user_id: uuid.UUID,
    user_in: UserUpdate,
) -> Any:
    """
    Update a user.
    """
    try:
        return user_service.update_user(
            session=session, user_id=user_id, user_in=user_in
        )
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.delete("/{user_id}", dependencies=[Depends(get_current_active_superuser)])
def delete_user(
    session: SessionDep, current_user: CurrentUser, user_id: uuid.UUID
) -> Message:
    """
    Delete a user.
    """
    if current_user.id == user_id:
        raise HTTPException(
            status_code=403, detail="Super users are not allowed to delete themselves"
        )
    try:
        user_service.delete_user(session=session, user_id=user_id)
        return Message(message="User deleted successfully")
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e
