import uuid
from datetime import datetime

from sqlalchemy import DateTime
from sqlmodel import Field, Relationship, SQLModel

from .base import get_cst_now
from .user import User


# Shared properties for file analysis report
class FileAnalysisReportBase(SQLModel):
    file_name: str = Field(max_length=255)
    file_type: str = Field(max_length=50)
    file_size: int | None = None
    analysis_result: str
    conversation_id: str | None = None


# Properties to receive on creation
class FileAnalysisReportCreate(FileAnalysisReportBase):
    pass


# Properties to receive on update
class FileAnalysisReportUpdate(SQLModel):
    file_name: str | None = Field(default=None, max_length=255)
    analysis_result: str | None = None


# Database model
class FileAnalysisReport(FileAnalysisReportBase, table=True):
    __tablename__ = "file_analysis_report"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_cst_now,
        sa_type=DateTime(timezone=False),  # type: ignore
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="analysis_reports")


# Properties to return via API
class FileAnalysisReportPublic(FileAnalysisReportBase):
    id: uuid.UUID
    created_at: datetime | None = None


class FileAnalysisReportsPublic(SQLModel):
    data: list[FileAnalysisReportPublic]
    count: int
