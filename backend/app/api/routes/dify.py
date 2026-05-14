from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing_extensions import Annotated

from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings

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


def _get_api_key(api_key_name: str | None) -> str:
    """Get API key based on name, fallback to AI doctor key"""
    if api_key_name == "test":
        return settings.DIFY_TEST_API_KEY
    return settings.DIFY_AI_DOCTOR_API_KEY


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
    # Verify user access
    _verify_user_access(request.user, current_user)

    api_key = _get_api_key(api_key_name)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Dify API key not configured",
        )

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                f"{settings.DIFY_API_URL}/chat-messages",
                json=request.model_dump(exclude_none=True),
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                follow_redirects=True,
            )
            response.raise_for_status()

            # For streaming responses, return the stream directly
            return StreamingResponse(
                content=response.aiter_bytes(),
                media_type="text/event-stream",
                headers=dict(response.headers),
            )
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Dify API error: {e.response.text}",
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to connect to Dify: {str(e)}",
            )


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
    # Verify user access
    _verify_user_access(request.user, current_user)

    api_key = _get_api_key(api_key_name)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Dify API key not configured",
        )

    import base64

    files = {
        "file": (request.file_name, base64.b64decode(request.file_data)),
    }
    data = {"user": request.user}

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                f"{settings.DIFY_API_URL}/files/upload",
                files=files,
                data=data,
                headers={"Authorization": f"Bearer {api_key}"},
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Dify API error: {e.response.text}",
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload file to Dify: {str(e)}",
            )


@router.get("/conversations")
async def get_conversations(
    current_user: CurrentUser,
    last_id: str | None = None,
    limit: int = 20,
    api_key_name: str | None = None,
):
    """
    Proxy for Dify conversations list endpoint.
    Requires authentication. User ID is taken from JWT token, not request params.
    """
    user_id = str(current_user.id)

    api_key = _get_api_key(api_key_name)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Dify API key not configured",
        )

    params = {"user": user_id, "limit": limit}
    if last_id:
        params["last_id"] = last_id

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.get(
                f"{settings.DIFY_API_URL}/conversations",
                params=params,
                headers={"Authorization": f"Bearer {api_key}"},
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Dify API error: {e.response.text}",
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get conversations from Dify: {str(e)}",
            )


@router.get("/messages")
async def get_messages(
    current_user: CurrentUser,
    conversation_id: str,
    first_id: str | None = None,
    limit: int = 20,
    api_key_name: str | None = None,
):
    """
    Proxy for Dify messages list endpoint.
    Requires authentication. User ID is taken from JWT token, not request params.
    """
    user_id = str(current_user.id)

    api_key = _get_api_key(api_key_name)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Dify API key not configured",
        )

    params = {
        "user": user_id,
        "conversation_id": conversation_id,
        "limit": limit,
    }
    if first_id:
        params["first_id"] = first_id

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.get(
                f"{settings.DIFY_API_URL}/messages",
                params=params,
                headers={"Authorization": f"Bearer {api_key}"},
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Dify API error: {e.response.text}",
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get messages from Dify: {str(e)}",
            )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: CurrentUser,
    api_key_name: str | None = None,
):
    """
    Proxy for Dify conversation deletion endpoint.
    Requires authentication. User ID is taken from JWT token, not request params.
    """
    user_id = str(current_user.id)

    api_key = _get_api_key(api_key_name)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Dify API key not configured",
        )

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.delete(
                f"{settings.DIFY_API_URL}/conversations/{conversation_id}",
                json={"user": user_id},
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            if response.status_code != 204:
                response.raise_for_status()
            return {"status": "ok"}
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Dify API error: {e.response.text}",
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete conversation from Dify: {str(e)}",
            )
