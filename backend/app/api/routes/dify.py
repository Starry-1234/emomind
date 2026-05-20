from typing import Any

import base64
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser
from app.services import DifyService, ServiceError

router = APIRouter(prefix="/dify", tags=["dify"])


class ChatMessageRequest(BaseModel):
    inputs: dict[str, Any] = {}
    query: str = Field(max_length=2000)
    response_mode: str = "streaming"
    conversation_id: str = ""
    user: str = Field(max_length=128)
    auto_generate_name: bool = True
    files: list[dict[str, Any]] = Field(default=[], max_length=10)


class UploadFileRequest(BaseModel):
    file_name: str
    file_data: str  # base64 encoded
    user: str = Field(max_length=128)


class DifyUploadResponse(BaseModel):
    id: str
    name: str
    size: int
    extension: str
    mime_type: str


def _verify_user_access(requested_user: str, current_user: CurrentUser) -> None:
    """Verify the requested user matches the current authenticated user."""
    if requested_user != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权访问该用户数据",
        )


@router.post("/chat-messages")
async def send_chat_message(
    request: ChatMessageRequest,
    current_user: CurrentUser,
    api_key_name: str | None = None,
):
    """
    Proxy for Dify chat-messages endpoint.
    API key is managed server-side, not exposed to frontend.
    Returns streaming response for SSE.
    Requires authentication.
    """
    _verify_user_access(request.user, current_user)

    service = DifyService()
    try:
        return StreamingResponse(
            content=service.send_chat_message_stream(
                request.model_dump(exclude_none=True),
                api_key_name,
            ),
            media_type="text/event-stream",
        )
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.post("/files/upload")
async def upload_file(
    request: UploadFileRequest,
    current_user: CurrentUser,
    api_key_name: str | None = None,
):
    """
    Proxy for Dify file upload endpoint.
    Requires authentication.
    """
    _verify_user_access(request.user, current_user)

    service = DifyService()
    try:
        result = await service.upload_file(
            file_name=request.file_name,
            file_data=base64.b64decode(request.file_data),
            user_id=request.user,
            api_key_name=api_key_name,
        )
        return result
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.get("/conversations")
async def get_conversations(
    current_user: CurrentUser,
    user: str | None = None,
    last_id: str | None = None,
    limit: int = 20,
    api_key_name: str | None = None,
):
    """
    Proxy for Dify conversations list endpoint.
    Requires authentication. Admin can specify any user ID.
    """
    user_id = user if current_user.is_superuser and user else str(current_user.id)
    service = DifyService()
    try:
        return await service.get_conversations(
            user_id=user_id,
            limit=limit,
            last_id=last_id,
            api_key_name=api_key_name,
        )
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.get("/messages")
async def get_messages(
    current_user: CurrentUser,
    conversation_id: str,
    user: str | None = None,
    first_id: str | None = None,
    limit: int = 20,
    api_key_name: str | None = None,
):
    """
    Proxy for Dify messages list endpoint.
    Requires authentication. Admin can specify any user ID.
    """
    user_id = user if current_user.is_superuser and user else str(current_user.id)
    service = DifyService()
    try:
        return await service.get_messages(
            user_id=user_id,
            conversation_id=conversation_id,
            limit=limit,
            first_id=first_id,
            api_key_name=api_key_name,
        )
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: CurrentUser,
    user: str | None = None,
    api_key_name: str | None = None,
):
    """
    Proxy for Dify conversation deletion endpoint.
    Requires authentication. Admin can specify any user ID.
    """
    user_id = user if current_user.is_superuser and user else str(current_user.id)
    service = DifyService()
    try:
        await service.delete_conversation(
            conversation_id=conversation_id,
            user_id=user_id,
            api_key_name=api_key_name,
        )
        return {"status": "ok"}
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e
