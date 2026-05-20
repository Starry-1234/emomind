import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import col, delete, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    FileAnalysisReport,
    FileAnalysisReportCreate,
    FileAnalysisReportPublic,
    FileAnalysisReportsPublic,
    Message,
)
from app.repositories import analysis_repo

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/reports", response_model=FileAnalysisReportsPublic)
def read_analysis_reports(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """获取当前用户的分析报告列表"""
    count_statement = (
        select(func.count())
        .select_from(FileAnalysisReport)
        .where(FileAnalysisReport.owner_id == current_user.id)
    )
    count = session.exec(count_statement).one()

    statement = (
        select(FileAnalysisReport)
        .where(FileAnalysisReport.owner_id == current_user.id)
        .order_by(col(FileAnalysisReport.created_at).desc())
        .offset(skip)
        .limit(limit)
    )
    reports = session.exec(statement).all()

    return FileAnalysisReportsPublic(data=reports, count=count)


@router.get("/reports/{report_id}", response_model=FileAnalysisReportPublic)
def read_analysis_report(
    session: SessionDep,
    current_user: CurrentUser,
    report_id: uuid.UUID,
) -> Any:
    """获取单个分析报告详情"""
    report = session.get(FileAnalysisReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if not current_user.is_superuser and (report.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return report


@router.post("/reports", response_model=FileAnalysisReportPublic)
def create_analysis_report(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    report_in: FileAnalysisReportCreate,
) -> Any:
    """创建分析报告（由前端调用，接收 JSON 请求体）"""
    report = analysis_repo.create_with_owner(
        session, obj_in=report_in, owner_id=current_user.id
    )
    return report


@router.delete("/reports/{report_id}", response_model=Message)
def delete_analysis_report(
    session: SessionDep,
    current_user: CurrentUser,
    report_id: uuid.UUID,
) -> Message:
    """删除分析报告"""
    report = session.get(FileAnalysisReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if not current_user.is_superuser and (report.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    analysis_repo.delete(session, id=report_id)
    return Message(message="Report deleted successfully")
