"""Request bodies for the groups routes (app/api/v1/groups.py)."""

from typing import List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, Field
from app.models.conversation_member import MemberRole


class UpdateGroupRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = Field(None, description="Uploaded image URL, or empty string to remove")


class AddMembersRequest(BaseModel):
    user_ids: List[UUID] = Field(..., min_length=1, max_length=100)


class UpdateMemberRequest(BaseModel):
    role: MemberRole


class PinRequest(BaseModel):
    pinned: bool


class MuteRequest(BaseModel):
    """How long to mute the chat for; null unmutes."""
    duration: Optional[Literal["8h", "1w", "always"]] = None


class ArchiveRequest(BaseModel):
    archived: bool
