import uuid

from sqlmodel import Session

from app.models import (
    FileAnalysisReport,
    FileAnalysisReportCreate,
    FileAnalysisReportUpdate,
)

from .base import BaseRepository


class FileAnalysisReportRepository(
    BaseRepository[FileAnalysisReport, FileAnalysisReportCreate, FileAnalysisReportUpdate]
):
    def __init__(self):
        super().__init__(FileAnalysisReport)

    def create_with_owner(
        self,
        session: Session,
        *,
        obj_in: FileAnalysisReportCreate,
        owner_id: uuid.UUID,
    ) -> FileAnalysisReport:
        return self.create(
            session, obj_in=obj_in, extra_data={"owner_id": owner_id}
        )


analysis_repo = FileAnalysisReportRepository()
