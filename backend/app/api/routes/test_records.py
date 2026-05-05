import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Message,
    TestRecord,
    TestRecordCreate,
    TestRecordPublic,
    TestRecordsPublic,
    TestRecordUpdate,
)

router = APIRouter(prefix="/test-records", tags=["test-records"])


@router.get("/", response_model=TestRecordsPublic)
def read_test_records(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve test records for the current user.
    """
    count_statement = (
        select(func.count())
        .select_from(TestRecord)
        .where(TestRecord.owner_id == current_user.id)
    )
    count = session.exec(count_statement).one()

    statement = (
        select(TestRecord)
        .where(TestRecord.owner_id == current_user.id)
        .order_by(col(TestRecord.created_at).desc())
        .offset(skip)
        .limit(limit)
    )
    records = session.exec(statement).all()

    return TestRecordsPublic(data=records, count=count)


@router.get("/{id}", response_model=TestRecordPublic)
def read_test_record(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get test record by ID.
    """
    record = session.get(TestRecord, id)
    if not record:
        raise HTTPException(status_code=404, detail="Test record not found")
    if record.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return record


@router.post("/", response_model=TestRecordPublic)
def create_test_record(
    *, session: SessionDep, current_user: CurrentUser, test_record_in: TestRecordCreate
) -> Any:
    """
    Create new test record.
    """
    record = TestRecord.model_validate(test_record_in, update={"owner_id": current_user.id})
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@router.put("/{id}", response_model=TestRecordPublic)
def update_test_record(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    test_record_in: TestRecordUpdate,
) -> Any:
    """
    Update a test record.
    """
    record = session.get(TestRecord, id)
    if not record:
        raise HTTPException(status_code=404, detail="Test record not found")
    if record.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    update_dict = test_record_in.model_dump(exclude_unset=True)
    record.sqlmodel_update(update_dict)
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@router.delete("/{id}")
def delete_test_record(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    """
    Delete a test record.
    """
    record = session.get(TestRecord, id)
    if not record:
        raise HTTPException(status_code=404, detail="Test record not found")
    if record.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    session.delete(record)
    session.commit()
    return Message(message="Test record deleted successfully")