# backend/app/services/media_storage.py

"""
Local-disk media storage.

Files are written to UPLOAD_DIR/<yyyy>/<mm>/<random hex>.<ext> and served back
through GET /api/v1/media/<key>. Keys are random 128-bit names, so a media URL
is only known to people who received it in a conversation.
"""

import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.config.settings import settings

BACKEND_ROOT = Path(__file__).resolve().parents[2]

MEDIA_URL_PREFIX = "/api/v1/media/"

# mime type -> (media type, file extension)
ALLOWED_TYPES: dict[str, tuple[str, str]] = {
    "image/jpeg": ("image", ".jpg"),
    "image/png": ("image", ".png"),
    "image/gif": ("image", ".gif"),
    "image/webp": ("image", ".webp"),
    "video/mp4": ("video", ".mp4"),
    "video/webm": ("video", ".webm"),
    "video/quicktime": ("video", ".mov"),
    "application/pdf": ("file", ".pdf"),
    "application/msword": ("file", ".doc"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ("file", ".docx"),
}

EXTENSION_MIME = {ext: mime for mime, (_, ext) in ALLOWED_TYPES.items()}

MEDIA_TYPES = {"image", "video", "file"}

_KEY_RE = re.compile(r"^\d{4}/\d{2}/[0-9a-f]{32}\.[a-z0-9]{2,5}$")


def upload_root() -> Path:
    root = Path(settings.UPLOAD_DIR)
    return root if root.is_absolute() else BACKEND_ROOT / root


def max_size_for(media_type: str) -> int:
    return settings.MAX_VIDEO_UPLOAD_SIZE if media_type == "video" else settings.MAX_UPLOAD_SIZE


def new_key(extension: str) -> str:
    now = datetime.now(timezone.utc)
    return f"{now:%Y}/{now:%m}/{uuid.uuid4().hex}{extension}"


def path_for_key(key: str) -> Path | None:
    """Resolve a media key to a file path, or None if the key is malformed."""
    if not _KEY_RE.match(key):
        return None
    return upload_root() / key


def key_from_url(url: str) -> str | None:
    if not url or not url.startswith(MEDIA_URL_PREFIX):
        return None
    key = url[len(MEDIA_URL_PREFIX):]
    return key if _KEY_RE.match(key) else None


def is_stored_media_url(url: str) -> bool:
    """True if url points at a file that was uploaded to this server."""
    key = key_from_url(url)
    if not key:
        return False
    path = path_for_key(key)
    return path is not None and path.is_file()


def is_stored_image_url(url: str) -> bool:
    """True if url is an uploaded image (used for avatars and group photos)."""
    if not is_stored_media_url(url):
        return False
    return EXTENSION_MIME.get(Path(key_from_url(url)).suffix, "").startswith("image/")


def content_matches(mime: str, head: bytes) -> bool:
    """Check the file's leading bytes against its declared type."""
    if mime == "image/jpeg":
        return head.startswith(b"\xff\xd8\xff")
    if mime == "image/png":
        return head.startswith(b"\x89PNG\r\n\x1a\n")
    if mime == "image/gif":
        return head.startswith((b"GIF87a", b"GIF89a"))
    if mime == "image/webp":
        return head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    if mime in ("video/mp4", "video/quicktime"):
        return head[4:8] == b"ftyp"
    if mime == "video/webm":
        return head.startswith(b"\x1a\x45\xdf\xa3")
    if mime == "application/pdf":
        return head.startswith(b"%PDF")
    if mime == "application/msword":
        return head.startswith(b"\xd0\xcf\x11\xe0")
    if mime.endswith("wordprocessingml.document"):
        return head.startswith(b"PK\x03\x04")
    return False


def preview_text(message_type: str | None, text: str | None, filename: str | None = None) -> str:
    """Conversation-list preview for a message."""
    if text:
        return text
    if message_type == "image":
        return "📷 Photo"
    if message_type == "video":
        return "🎥 Video"
    if message_type == "file":
        return f"📎 {filename}" if filename else "📎 File"
    return ""
