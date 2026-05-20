import uuid

from sqlmodel import Session

from app.models import Item, ItemCreate, ItemUpdate

from .base import BaseRepository


class ItemRepository(BaseRepository[Item, ItemCreate, ItemUpdate]):
    def __init__(self):
        super().__init__(Item)

    def create_with_owner(
        self, session: Session, *, obj_in: ItemCreate, owner_id: uuid.UUID
    ) -> Item:
        return self.create(session, obj_in=obj_in, extra_data={"owner_id": owner_id})


item_repo = ItemRepository()
