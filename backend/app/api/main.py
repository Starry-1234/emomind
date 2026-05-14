from fastapi import APIRouter

from app.api.routes import admin, analysis, dify, items, login, private, test_records, users, utils
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(items.router)
api_router.include_router(analysis.router)
api_router.include_router(test_records.router)
api_router.include_router(admin.router)
api_router.include_router(dify.router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
