from typing import Any

import httpx

from app.core.config import settings
from app.services.base import ServiceError


# Headers that should be stripped from Dify responses to avoid CORS conflicts
# with FastAPI's CORSMiddleware
_CORS_HEADERS = {
    "access-control-allow-origin",
    "access-control-allow-credentials",
    "access-control-allow-methods",
    "access-control-allow-headers",
    "access-control-expose-headers",
    "access-control-max-age",
}


class DifyService:
    """Service for proxying requests to Dify AI platform."""

    def __init__(self, timeout: float = 60.0):
        self.client = httpx.AsyncClient(timeout=timeout)
        self.base_url = settings.DIFY_API_URL

    def _get_api_key(self, api_key_name: str | None) -> str:
        if api_key_name == "test":
            return settings.DIFY_TEST_API_KEY
        return settings.DIFY_AI_DOCTOR_API_KEY

    def _request_headers(self, api_key_name: str | None) -> dict[str, str]:
        api_key = self._get_api_key(api_key_name)
        if not api_key:
            raise ServiceError("Dify API key not configured", 500)
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _filter_cors_headers(headers: dict[str, str]) -> dict[str, str]:
        """Remove CORS headers from upstream response to avoid conflicts."""
        return {
            k: v for k, v in headers.items()
            if k.lower() not in _CORS_HEADERS
        }

    async def send_chat_message_stream(
        self,
        request_data: dict[str, Any],
        api_key_name: str | None,
    ):
        """Stream a chat message to Dify and yield chunks."""
        headers = self._request_headers(api_key_name)
        try:
            async with self.client.stream(
                "POST",
                f"{self.base_url}/chat-messages",
                json=request_data,
                headers=headers,
                follow_redirects=True,
            ) as response:
                response.raise_for_status()
                async for chunk in response.aiter_bytes():
                    yield chunk
        except GeneratorExit:
            # 客户端断开连接，正常清理（重新抛出以维持生成器协议）
            raise
        except httpx.HTTPStatusError as e:
            raise ServiceError(
                f"Dify API error: {e.response.text}",
                e.response.status_code,
            ) from e
        except Exception as e:
            raise ServiceError(
                f"Failed to connect to Dify: {str(e)}",
                500,
            ) from e

    async def upload_file(
        self,
        file_name: str,
        file_data: bytes,
        user_id: str,
        api_key_name: str | None,
    ) -> dict[str, Any]:
        """Upload a file to Dify."""
        api_key = self._get_api_key(api_key_name)
        if not api_key:
            raise ServiceError("Dify API key not configured", 500)

        files = {"file": (file_name, file_data)}
        data = {"user": user_id}

        try:
            response = await self.client.post(
                f"{self.base_url}/files/upload",
                files=files,
                data=data,
                headers={"Authorization": f"Bearer {api_key}"},
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise ServiceError(
                f"Dify API error: {e.response.text}",
                e.response.status_code,
            ) from e
        except Exception as e:
            raise ServiceError(
                f"Failed to upload file to Dify: {str(e)}",
                500,
            ) from e

    async def get_conversations(
        self,
        user_id: str,
        limit: int,
        last_id: str | None,
        api_key_name: str | None,
    ) -> dict[str, Any]:
        """Get conversation list from Dify."""
        api_key = self._get_api_key(api_key_name)
        if not api_key:
            raise ServiceError("Dify API key not configured", 500)

        params: dict[str, Any] = {"user": user_id, "limit": limit}
        if last_id:
            params["last_id"] = last_id

        try:
            response = await self.client.get(
                f"{self.base_url}/conversations",
                params=params,
                headers={"Authorization": f"Bearer {api_key}"},
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise ServiceError(
                f"Dify API error: {e.response.text}",
                e.response.status_code,
            ) from e
        except Exception as e:
            raise ServiceError(
                f"Failed to get conversations from Dify: {str(e)}",
                500,
            ) from e

    async def get_messages(
        self,
        user_id: str,
        conversation_id: str,
        limit: int,
        first_id: str | None,
        api_key_name: str | None,
    ) -> dict[str, Any]:
        """Get messages from Dify."""
        api_key = self._get_api_key(api_key_name)
        if not api_key:
            raise ServiceError("Dify API key not configured", 500)

        params: dict[str, Any] = {
            "user": user_id,
            "conversation_id": conversation_id,
            "limit": limit,
        }
        if first_id:
            params["first_id"] = first_id

        try:
            response = await self.client.get(
                f"{self.base_url}/messages",
                params=params,
                headers={"Authorization": f"Bearer {api_key}"},
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise ServiceError(
                f"Dify API error: {e.response.text}",
                e.response.status_code,
            ) from e
        except Exception as e:
            raise ServiceError(
                f"Failed to get messages from Dify: {str(e)}",
                500,
            ) from e

    async def delete_conversation(
        self,
        conversation_id: str,
        user_id: str,
        api_key_name: str | None,
    ) -> None:
        """Delete a conversation from Dify."""
        api_key = self._get_api_key(api_key_name)
        if not api_key:
            raise ServiceError("Dify API key not configured", 500)

        try:
            response = await self.client.request(
                "DELETE",
                f"{self.base_url}/conversations/{conversation_id}",
                json={"user": user_id},
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            if response.status_code not in (200, 204):
                response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise ServiceError(
                f"Dify API error: {e.response.text}",
                e.response.status_code,
            ) from e
        except Exception as e:
            raise ServiceError(
                f"Failed to delete conversation from Dify: {str(e)}",
                500,
            ) from e
