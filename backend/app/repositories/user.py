import uuid

from sqlmodel import Session, select

from app.core.security import get_password_hash, verify_password
from app.models import User, UserCreate, UserUpdate

from .base import BaseRepository

DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MjQyZWE1MzBjYjJlZTI0Yw$YTU4NGM5ZTZmYjE2NzZlZjY0ZWY3ZGRkY2U2OWFjNjk"


class UserRepository(BaseRepository[User, UserCreate, UserUpdate]):
    def __init__(self):
        super().__init__(User)

    def get_by_email(self, session: Session, email: str) -> User | None:
        statement = select(User).where(User.email == email)
        return session.exec(statement).first()

    def create_with_password(
        self,
        session: Session,
        *,
        obj_in: UserCreate,
    ) -> User:
        extra = {
            "hashed_password": get_password_hash(obj_in.password),
        }
        return self.create(session, obj_in=obj_in, extra_data=extra)

    def update(
        self,
        session: Session,
        *,
        db_obj: User,
        obj_in: UserUpdate | dict,
    ) -> User:
        update_data = (
            obj_in.model_dump(exclude_unset=True)
            if hasattr(obj_in, "model_dump")
            else obj_in
        )
        extra_data: dict = {}
        if "password" in update_data:
            extra_data["hashed_password"] = get_password_hash(
                update_data.pop("password")
            )
        db_obj.sqlmodel_update(update_data, update=extra_data)
        session.add(db_obj)
        session.commit()
        session.refresh(db_obj)
        return db_obj

    def authenticate(
        self, session: Session, *, email: str, password: str
    ) -> User | None:
        db_user = self.get_by_email(session, email)
        if not db_user:
            # Prevent timing attacks
            verify_password(password, DUMMY_HASH)
            return None
        verified, updated_password_hash = verify_password(
            password, db_user.hashed_password
        )
        if not verified:
            return None
        if updated_password_hash:
            db_user.hashed_password = updated_password_hash
            session.add(db_user)
            session.commit()
            session.refresh(db_user)
        return db_user


user_repo = UserRepository()
