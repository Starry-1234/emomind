from typing import Any

from fastapi import APIRouter, Depends
from sqlmodel import func, select

from app.api.deps import SessionDep, get_current_active_superuser
from app.models import FileAnalysisReport, TestRecord, User

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminStatsResponse:
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
    from sqlmodel import col

    count_query = select(func.count()).select_from(TestRecord)
    query = select(TestRecord).order_by(col(TestRecord.created_at).desc()).offset(skip).limit(limit)

    if user_id:
        count_query = count_query.where(TestRecord.owner_id == user_id)
        query = query.where(TestRecord.owner_id == user_id)

    count = session.exec(count_query).one()
    records = session.exec(query).all()

    return {"data": records, "count": count}


@router.delete("/test-records/{id}", dependencies=[Depends(get_current_active_superuser)])
def delete_admin_test_record(
    session: SessionDep,
    id: str,
) -> Any:
    """
    Delete any test record (superadmin only).
    """
    record = session.get(TestRecord, id)
    if not record:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Test record not found")
    session.delete(record)
    session.commit()
    return {"message": "Test record deleted successfully"}


@router.get("/stats", dependencies=[Depends(get_current_active_superuser)])
def get_admin_stats(session: SessionDep) -> Any:
    """
    Get admin dashboard statistics.
    """
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone(timedelta(hours=8)))
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Total counts
    total_users = session.exec(select(func.count()).select_from(User)).one()
    total_test_records = session.exec(select(func.count()).select_from(TestRecord)).one()
    total_analysis_reports = session.exec(
        select(func.count()).select_from(FileAnalysisReport)
    ).one()

    # Today's new users
    today_new_users = session.exec(
        select(func.count()).select_from(User).where(User.created_at >= today_start)
    ).one()

    # Today's new test records
    today_new_test_records = session.exec(
        select(func.count())
        .select_from(TestRecord)
        .where(TestRecord.created_at >= today_start)
    ).one()

    return {
        "total_users": total_users,
        "total_test_records": total_test_records,
        "total_analysis_reports": total_analysis_reports,
        "today_new_users": today_new_users,
        "today_new_test_records": today_new_test_records,
    }