# backend/app/api/v1/media.py

import os
import re

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import Response, StreamingResponse

from app.api.dependencies import get_current_user
from app.models.user import User
from app.services import media_storage

router = APIRouter(prefix="/media", tags=["Media"])

CHUNK_SIZE = 1024 * 1024
_RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Store an image, video or document and return its URL for use in a message."""
    mime = (file.content_type or "").split(";")[0].strip().lower()
    if mime not in media_storage.ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {mime or 'unknown'}")

    media_type, extension = media_storage.ALLOWED_TYPES[mime]
    max_size = media_storage.max_size_for(media_type)

    head = await file.read(16)
    if not media_storage.content_matches(mime, head):
        raise HTTPException(status_code=415, detail="File content does not match its type")

    key = media_storage.new_key(extension)
    path = media_storage.path_for_key(key)
    path.parent.mkdir(parents=True, exist_ok=True)

    size = len(head)
    try:
        with open(path, "wb") as out:
            out.write(head)
            while chunk := await file.read(CHUNK_SIZE):
                size += len(chunk)
                if size > max_size:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large (max {max_size // (1024 * 1024)}MB for {media_type}s)",
                    )
                out.write(chunk)
    except BaseException:
        path.unlink(missing_ok=True)
        raise

    return {
        "success": True,
        "message": "File uploaded successfully",
        "data": {
            "url": media_storage.MEDIA_URL_PREFIX + key,
            "mediaType": media_type,
            "mimeType": mime,
            "size": size,
            "filename": os.path.basename(file.filename or "")[:255] or f"file{extension}",
        },
    }


def _iter_file(path, start: int, length: int):
    with open(path, "rb") as f:
        f.seek(start)
        remaining = length
        while remaining > 0:
            chunk = f.read(min(CHUNK_SIZE, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@router.get("/{key:path}")
async def get_media(key: str, request: Request):
    """Serve an uploaded file. Supports Range requests so videos can seek."""
    path = media_storage.path_for_key(key)
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="Media not found")

    mime = media_storage.EXTENSION_MIME.get(path.suffix, "application/octet-stream")
    file_size = path.stat().st_size
    headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
    }
    if not (mime.startswith("image/") or mime.startswith("video/")):
        headers["Content-Disposition"] = "attachment"

    range_header = request.headers.get("range")
    if not range_header:
        headers["Content-Length"] = str(file_size)
        return StreamingResponse(_iter_file(path, 0, file_size), media_type=mime, headers=headers)

    match = _RANGE_RE.match(range_header.strip())
    if not match or (not match.group(1) and not match.group(2)):
        return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})

    if match.group(1):
        start = int(match.group(1))
        end = int(match.group(2)) if match.group(2) else file_size - 1
    else:  # suffix range: last N bytes
        start = max(file_size - int(match.group(2)), 0)
        end = file_size - 1
    end = min(end, file_size - 1)

    if start > end or start >= file_size:
        return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})

    length = end - start + 1
    headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"
    headers["Content-Length"] = str(length)
    return StreamingResponse(
        _iter_file(path, start, length), status_code=206, media_type=mime, headers=headers
    )
