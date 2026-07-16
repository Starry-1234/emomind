"""File upload + download endpoints. Internal-only (X-Internal-Token)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from app.auth import verify_internal_token
from app.memory.cache import get_meta, read_file, write_file

# Inner routes are mounted under "/files" so when main.py registers this
# router with prefix="/v1" the final paths become "/v1/files/upload" and
# "/v1/files/{file_id}" — matching the Spring AiController contract.
router = APIRouter(prefix="/files")


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user_id: str = Depends(verify_internal_token),
) -> dict:
    if not file.content_type:
        raise HTTPException(status_code=415, detail={"code": "MISSING_CONTENT_TYPE"})
    content = await file.read()
    name = file.filename or "uploaded"
    try:
        meta = write_file(
            user_id=user_id, content=content, mime=file.content_type, name=name
        )
    except ValueError as e:
        # mime or size rejection
        raise HTTPException(
            status_code=415, detail={"code": "UNSUPPORTED", "message": str(e)}
        )
    return {
        "file_id": meta["file_id"],
        "url": f"/v1/files/{meta['file_id']}",
        "mime": meta["mime"],
        "size": meta["size"],
        "name": meta["name"],
    }


@router.get("/{file_id}")
async def get_file(
    file_id: str,
    user_id: str = Depends(verify_internal_token),
) -> Response:
    meta = get_meta(file_id)
    if meta is None:
        raise HTTPException(status_code=404, detail={"code": "FILE_NOT_FOUND"})
    if meta.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail={"code": "FILE_ACCESS_DENIED"})
    content = read_file(file_id, user_id)
    if content is None:
        raise HTTPException(status_code=404, detail={"code": "FILE_NOT_FOUND"})
    return Response(content=content, media_type=meta["mime"])