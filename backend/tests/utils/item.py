from sqlmodel import Session

from app.models import Item, ItemCreate
from app.repositories import item_repo
from tests.utils.user import create_random_user
from tests.utils.utils import random_lower_string


def create_random_item(db: Session) -> Item:
    user = create_random_user(db)
    owner_id = user.id
    assert owner_id is not None
    title = random_lower_string()
    description = random_lower_string()
    item_in = ItemCreate(title=title, description=description)
    return item_repo.create_with_owner(session=db, obj_in=item_in, owner_id=owner_id)
