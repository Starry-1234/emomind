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
from app.repositories import test_record_repo

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
    record = test_record_repo.create_with_owner(
        session, obj_in=test_record_in, owner_id=current_user.id
    )
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
    record = test_record_repo.update(
        session, db_obj=record, obj_in=test_record_in
    )
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
    test_record_repo.delete(session, id=id)
    return Message(message="Test record deleted successfully")