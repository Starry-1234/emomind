import uuid

from sqlmodel import Session

from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.models import User, UserCreate, UserRegister, UserUpdate, UserUpdateMe
from app.repositories import user_repo
from app.services.base import ServiceError
from app.utils import generate_new_account_email, send_email


class UserService:
    """Service for user-related business logic."""

    def create_user(
        self,
        session: Session,
        user_in: UserCreate,
        *,
        send_welcome_email: bool = True,
    ) -> User:
        """Create a new user with email uniqueness check and optional welcome email."""
        existing = user_repo.get_by_email(session=session, email=user_in.email)
        if existing:
            raise ServiceError(
                "The user with this email already exists in the system.",
                400,
            )

        user = user_repo.create_with_password(session=session, obj_in=user_in)

        if send_welcome_email and settings.emails_enabled and user_in.email:
            email_data = generate_new_account_email(
                email_to=user_in.email, username=user_in.email
            )
            send_email(
                email_to=user_in.email,
                subject=email_data.subject,
                html_content=email_data.html_content,
            )

        return user

    def register_user(self, session: Session, user_in: UserRegister) -> User:
        """Register a new user without authentication."""
        existing = user_repo.get_by_email(session=session, email=user_in.email)
        if existing:
            raise ServiceError(
                "The user with this email already exists in the system",
                400,
            )

        user_create = UserCreate.model_validate(user_in)
        return user_repo.create_with_password(session=session, obj_in=user_create)

    def update_user_me(
        self,
        session: Session,
        current_user: User,
        user_in: UserUpdateMe,
    ) -> User:
        """Update own user profile."""
        if user_in.email:
            existing = user_repo.get_by_email(session=session, email=user_in.email)
            if existing and existing.id != current_user.id:
                raise ServiceError(
                    "User with this email already exists",
                    409,
                )

        user_data = user_in.model_dump(exclude_unset=True)
        current_user.sqlmodel_update(user_data)
        session.add(current_user)
        session.commit()
        session.refresh(current_user)
        return current_user

    def update_password_me(
        self,
        session: Session,
        current_user: User,
        current_password: str,
        new_password: str,
    ) -> None:
        """Update own password after verifying current password."""
        verified, _ = verify_password(current_password, current_user.hashed_password)
        if not verified:
            raise ServiceError("Incorrect password", 400)

        if current_password == new_password:
            raise ServiceError(
                "New password cannot be the same as the current one",
                400,
            )

        current_user.hashed_password = get_password_hash(new_password)
        session.add(current_user)
        session.commit()

    def update_user(
        self,
        session: Session,
        user_id: uuid.UUID,
        user_in: UserUpdate,
    ) -> User:
        """Update a user by ID (admin operation)."""
        db_user = user_repo.get(session=session, id=user_id)
        if not db_user:
            raise ServiceError(
                "The user with this id does not exist in the system",
                404,
            )

        if user_in.email:
            existing = user_repo.get_by_email(session=session, email=user_in.email)
            if existing and existing.id != user_id:
                raise ServiceError(
                    "User with this email already exists",
                    409,
                )

        return user_repo.update(session=session, db_obj=db_user, obj_in=user_in)

    def delete_user(self, session: Session, user_id: uuid.UUID) -> User:
        """Delete a user by ID."""
        user = user_repo.get(session=session, id=user_id)
        if not user:
            raise ServiceError("User not found", 404)

        session.delete(user)
        session.commit()
        return user


user_service = UserService()
