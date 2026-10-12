from pydantic import BaseModel, Field
from typing import List, Optional

class UserPick(BaseModel):
    id: str
    username: str
    email: str

class SearchUsersResponse(BaseModel):
    users: List[UserPick]

class CreateDMRequest(BaseModel):
    identifier: str = Field(..., description="username OR email")

class CreateGroupRequest(BaseModel):
    title: str
    member_ids: List[str] = Field(..., min_length=2)

class ConversationResponse(BaseModel):
    id: str
    kind: str
    title: Optional[str] = None
    members: List[UserPick]


class CreateConversationRequest(BaseModel):
    kind: str  # 'dm' or 'group'
    title: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = None
    participant_ids: List[str]
