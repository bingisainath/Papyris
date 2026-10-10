"""Request bodies for the messages routes (app/api/v1/messages.py)."""

from pydantic import BaseModel, Field, field_validator
from app.services import media_storage
from app.websocket.routes import MAX_ENCRYPTED_LENGTH, MAX_TEXT_LENGTH


class EditMessageRequest(BaseModel):
    text: str = Field(..., max_length=MAX_ENCRYPTED_LENGTH)
    has_link: bool = False  # encrypted edits: whether the new text contains a link

    @field_validator("text")
    @classmethod
    def strip_text(cls, v: str) -> str:
        v = v.strip()
        if not media_storage.is_encrypted(v) and len(v) > MAX_TEXT_LENGTH:
            raise ValueError(f"Message too long (max {MAX_TEXT_LENGTH} characters)")
        return v


class ReactRequest(BaseModel):
    emoji: str = Field(..., max_length=16)
