import uuid

from sqlmodel import Session

from app.models import TestRecord, TestRecordCreate, TestRecordUpdate

from .base import BaseRepository


class TestRecordRepository(BaseRepository[TestRecord, TestRecordCreate, TestRecordUpdate]):
    def __init__(self):
        super().__init__(TestRecord)

    def create_with_owner(
        self,
        session: Session,
        *,
        obj_in: TestRecordCreate,
        owner_id: uuid.UUID,
    ) -> TestRecord:
        return self.create(
            session, obj_in=obj_in, extra_data={"owner_id": owner_id}
        )


test_record_repo = TestRecordRepository()
