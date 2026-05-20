from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import SessionDep, get_current_active_superuser
from app.services import ServiceError, admin_stats_service

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminStatsResponse(BaseModel):
    total_users: int
    total_test_records: int
    total_analysis_reports: int
    today_new_users: int
    today_new_test_records: int


@router.get("/test-records", dependencies=[Depends(get_current_active_superuser)])
def read_admin_test_records(
    session: SessionDep,
    user_id: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve all test records (superadmin only).
    Optionally filter by user_id.
    """
    try:
        records, count = admin_stats_service.get_test_records(
            session=session,
            user_id=user_id,
            skip=skip,
            limit=limit,
        )
        return {"data": records, "count": count}
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.delete("/test-records/{id}", dependencies=[Depends(get_current_active_superuser)])
def delete_admin_test_record(
    session: SessionDep,
    id: str,
) -> Any:
    """
    Delete any test record (superadmin only).
    """
    from sqlmodel import select
    from app.models import TestRecord

    record = session.get(TestRecord, id)
    if not record:
        raise HTTPException(status_code=404, detail="Test record not found")
    session.delete(record)
    session.commit()
    return {"message": "Test record deleted successfully"}


@router.get("/stats", dependencies=[Depends(get_current_active_superuser)])
def get_admin_stats(session: SessionDep) -> AdminStatsResponse:
    """
    Get admin dashboard statistics.
    """
    stats = admin_stats_service.get_stats(session=session)
    return AdminStatsResponse(**stats)
