from sqlmodel import Session, col, func, select

from app.models import FileAnalysisReport, TestRecord, User, get_cst_now
from app.services.base import ServiceError


class AdminStatsService:
    """Service for admin dashboard statistics."""

    def get_stats(self, session: Session) -> dict[str, int]:
        """Get admin dashboard statistics."""
        now = get_cst_now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        total_users = session.exec(
            select(func.count()).select_from(User)
        ).one()
        total_test_records = session.exec(
            select(func.count()).select_from(TestRecord)
        ).one()
        total_analysis_reports = session.exec(
            select(func.count()).select_from(FileAnalysisReport)
        ).one()
        today_new_users = session.exec(
            select(func.count())
            .select_from(User)
            .where(User.created_at >= today_start)
        ).one()
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

    def get_test_records(
        self,
        session: Session,
        *,
        user_id: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list, int]:
        """Get test records with optional user filter."""
        count_query = select(func.count()).select_from(TestRecord)
        query = (
            select(TestRecord)
            .order_by(col(TestRecord.created_at).desc())
            .offset(skip)
            .limit(limit)
        )

        if user_id:
            count_query = count_query.where(TestRecord.owner_id == user_id)
            query = query.where(TestRecord.owner_id == user_id)

        count = session.exec(count_query).one()
        records = session.exec(query).all()
        return records, count


admin_stats_service = AdminStatsService()
