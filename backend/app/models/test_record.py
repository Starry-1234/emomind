import uuid
from datetime import datetime

from sqlalchemy import DateTime, JSON
from sqlmodel import Field, Relationship, SQLModel

from .base import get_cst_now
from .user import User


# TestRecord - 测评记录
class TestRecordBase(SQLModel):
    test_name: str = Field(max_length=255)
    user_topic: str | None = Field(default=None, max_length=500)
    total_score: int | None = None
    total_max: int | None = None
    result_description: str | None = None
    questions: list = Field(default=[], sa_type=JSON)
    answers: list = Field(default=[], sa_type=JSON)
    scoring_ranges: list = Field(default=[], sa_type=JSON)
    conversation_id: str | None = None


class TestRecordCreate(TestRecordBase):
    pass


class TestRecordUpdate(SQLModel):
    test_name: str | None = Field(default=None, max_length=255)
    user_topic: str | None = Field(default=None, max_length=500)
    total_score: int | None = None
    total_max: int | None = None
    result_description: str | None = None
    scoring_ranges: list | None = None


class TestRecord(TestRecordBase, table=True):
    __tablename__ = "test_record"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_cst_now,
        sa_type=DateTime(timezone=False),  # type: ignore
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="test_records")


class TestRecordPublic(TestRecordBase):
    id: uuid.UUID
    created_at: datetime | None = None


class TestRecordsPublic(SQLModel):
    data: list[TestRecordPublic]
    count: int
