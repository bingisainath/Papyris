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
