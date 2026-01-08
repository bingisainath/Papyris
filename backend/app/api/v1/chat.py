from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.schemas.chat import (
    SearchUsersResponse, UserPick,
    CreateDMRequest, CreateGroupRequest, ConversationResponse
)
from app.services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.get("/users/search", response_model=SearchUsersResponse)
async def search_users(q: str, db: AsyncSession = Depends(get_db), me: User = Depends(get_current_user)):
    users = await ChatService.search_users(db, q)
    return {"users": [UserPick(id=u.id, username=u.username, email=u.email) for u in users if u.id != me.id]}

@router.post("/dm", response_model=ConversationResponse)
async def create_dm(payload: CreateDMRequest, db: AsyncSession = Depends(get_db), me: User = Depends(get_current_user)):
    try:
        conv = await ChatService.create_dm(db, me.id, payload.identifier)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    # In production return members from DB; keeping brief here
    return {"id": conv.id, "kind": conv.kind, "title": conv.title, "members": []}

@router.post("/group", response_model=ConversationResponse)
async def create_group(payload: CreateGroupRequest, db: AsyncSession = Depends(get_db), me: User = Depends(get_current_user)):
    conv = await ChatService.create_group(db, me.id, payload.title, payload.member_ids)
    return {"id": conv.id, "kind": conv.kind, "title": conv.title, "members": []}
