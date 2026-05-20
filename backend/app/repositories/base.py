import uuid
from typing import Generic, TypeVar

from sqlmodel import Session, select, SQLModel

ModelType = TypeVar("ModelType", bound=SQLModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=SQLModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=SQLModel)


class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: type[ModelType]):
        self.model = model

    def get(self, session: Session, id: uuid.UUID) -> ModelType | None:
        return session.get(self.model, id)

    def get_multi(
        self, session: Session, *, skip: int = 0, limit: int = 100
    ) -> list[ModelType]:
        statement = select(self.model).offset(skip).limit(limit)
        return session.exec(statement).all()

    def create(
        self,
        session: Session,
        *,
        obj_in: CreateSchemaType,
        extra_data: dict | None = None,
    ) -> ModelType:
        db_obj = self.model.model_validate(obj_in, update=extra_data or {})
        session.add(db_obj)
        session.commit()
        session.refresh(db_obj)
        return db_obj

    def update(
        self,
        session: Session,
        *,
        db_obj: ModelType,
        obj_in: UpdateSchemaType | dict,
    ) -> ModelType:
        update_data = (
            obj_in.model_dump(exclude_unset=True)
            if hasattr(obj_in, "model_dump")
            else obj_in
        )
        db_obj.sqlmodel_update(update_data)
        session.add(db_obj)
        session.commit()
        session.refresh(db_obj)
        return db_obj

    def delete(self, session: Session, *, id: uuid.UUID) -> ModelType | None:
        obj = session.get(self.model, id)
        if obj:
            session.delete(obj)
            session.commit()
        return obj
