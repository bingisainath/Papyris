# backend/app/api/v1/groups.py

"""
Conversation details and group management: rename, photo, description,
add/remove members, roles and leaving.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.conversation import Conversation
from app.models.conversation_member import ConversationMember, MemberRole
from app.models.user import User
from app.services import media_storage
from app.services.message_service import MessageService
from app.websocket.routes import publish_users

router = APIRouter(prefix="/conversations", tags=["Groups"])


class UpdateGroupRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = Field(None, description="Uploaded image URL, or empty string to remove")


class AddMembersRequest(BaseModel):
    user_ids: List[UUID] = Field(..., min_length=1, max_length=100)


class UpdateMemberRequest(BaseModel):
    role: MemberRole


async def _load(db: AsyncSession, conversation_id: UUID, user: User) -> tuple[Conversation, ConversationMember]:
    conversation = await db.get(Conversation, conversation_id)
    member = (await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user.id,
        )
    )).scalar_one_or_none()
    if conversation is None or member is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation, member


def _require_group_admin(conversation: Conversation, member: ConversationMember) -> None:
    if conversation.kind != "group":
        raise HTTPException(status_code=400, detail="Only groups can be changed")
    if member.role != MemberRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only group admins can do this")


async def _notify(db: AsyncSession, conversation_id: UUID, system_payloads: list[dict]) -> None:
    """Send system messages and a conversation_updated event to current members"""
    member_ids = await MessageService.member_ids(db, conversation_id)
    for payload in system_payloads:
        await publish_users(member_ids, payload)
    await publish_users(member_ids, {"type": "conversation_updated", "conversationId": str(conversation_id)})


def _names(users: list[User]) -> str:
    names = [u.username for u in users]
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Conversation details with its members (used by the group/contact info panel)"""
    conversation, me = await _load(db, conversation_id, current_user)

    rows = (await db.execute(
        select(ConversationMember, User)
        .join(User, User.id == ConversationMember.user_id)
        .where(ConversationMember.conversation_id == conversation_id)
        .order_by(ConversationMember.joined_at)
    )).all()

    role_order = {MemberRole.ADMIN: 0, MemberRole.MODERATOR: 1, MemberRole.MEMBER: 2, MemberRole.VIEWER: 3}
    members = sorted(
        (
            {
                "id": str(user.id),
                "username": user.username,
                "name": user.name,
                "avatar": user.avatar,
                "bio": user.bio,
                "role": member.role.value,
                "joined_at": member.joined_at.isoformat() if member.joined_at else None,
                "is_me": user.id == current_user.id,
            }
            for member, user in rows
        ),
        key=lambda m: (not m["is_me"], role_order.get(MemberRole(m["role"]), 9), m["username"].lower()),
    )

    return {
        "success": True,
        "message": "Conversation fetched successfully",
        "data": {
            "id": str(conversation.id),
            "kind": conversation.kind,
            "title": conversation.title,
            "description": conversation.description,
            "avatar_url": conversation.avatar_url or None,
            "created_by": str(conversation.created_by) if conversation.created_by else None,
            "created_at": conversation.created_at.isoformat(),
            "my_role": me.role.value,
            "members": members,
        },
    }


@router.patch("/{conversation_id}")
async def update_group(
    conversation_id: UUID,
    payload: UpdateGroupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rename the group, change its photo or description (admins only)"""
    conversation, me = await _load(db, conversation_id, current_user)
    _require_group_admin(conversation, me)

    changes: list[str] = []
    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Group name can't be empty")
        if title != conversation.title:
            conversation.title = title
            changes.append(f'{current_user.username} renamed the group to "{title}"')

    if payload.description is not None:
        description = payload.description.strip() or None
        if description != conversation.description:
            conversation.description = description
            changes.append(f"{current_user.username} changed the group description")

    if payload.avatar_url is not None:
        if payload.avatar_url and not media_storage.is_stored_image_url(payload.avatar_url):
            raise HTTPException(status_code=400, detail="Group photo must be an uploaded image")
        if payload.avatar_url != (conversation.avatar_url or ""):
            conversation.avatar_url = payload.avatar_url
            changes.append(
                f"{current_user.username} changed the group photo" if payload.avatar_url
                else f"{current_user.username} removed the group photo"
            )

    await db.commit()

    system_payloads = [
        await MessageService.post_system_message(db, conversation_id, current_user, text) for text in changes
    ]
    await _notify(db, conversation_id, system_payloads)
    return {"success": True, "message": "Group updated", "data": {"changes": len(changes)}}


@router.post("/{conversation_id}/members")
async def add_members(
    conversation_id: UUID,
    payload: AddMembersRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add people to the group (admins only)"""
    conversation, me = await _load(db, conversation_id, current_user)
    _require_group_admin(conversation, me)

    existing = set((await db.execute(
        select(ConversationMember.user_id).where(ConversationMember.conversation_id == conversation_id)
    )).scalars().all())
    new_ids = [uid for uid in dict.fromkeys(payload.user_ids) if uid not in existing]
    users = list((await db.execute(select(User).where(User.id.in_(new_ids)))).scalars().all()) if new_ids else []
    if not users:
        raise HTTPException(status_code=400, detail="Those users are already in the group")

    for user in users:
        db.add(ConversationMember(conversation_id=conversation_id, user_id=user.id, role=MemberRole.MEMBER))
    await db.commit()

    # New members see the group appear (with an "added you" toast)
    await publish_users([str(u.id) for u in users], {
        "type": "conversation_created",
        "conversationId": str(conversation_id),
        "kind": "group",
        "title": conversation.title,
        "createdBy": str(current_user.id),
        "createdByName": current_user.username,
    })
    system = await MessageService.post_system_message(
        db, conversation_id, current_user, f"{current_user.username} added {_names(users)}"
    )
    await _notify(db, conversation_id, [system])
    return {"success": True, "message": "Members added", "data": {"added": [str(u.id) for u in users]}}


@router.patch("/{conversation_id}/members/{user_id}")
async def update_member(
    conversation_id: UUID,
    user_id: UUID,
    payload: UpdateMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Make a member an admin, or dismiss an admin (admins only)"""
    conversation, me = await _load(db, conversation_id, current_user)
    _require_group_admin(conversation, me)
    if payload.role not in (MemberRole.ADMIN, MemberRole.MEMBER):
        raise HTTPException(status_code=400, detail="Role must be admin or member")

    target = (await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
        )
    )).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Member not found")
    if target.role == payload.role:
        return {"success": True, "message": "No change", "data": None}

    if payload.role == MemberRole.MEMBER:
        admins = (await db.execute(
            select(ConversationMember.id).where(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.role == MemberRole.ADMIN,
            )
        )).scalars().all()
        if len(admins) <= 1:
            raise HTTPException(status_code=400, detail="A group needs at least one admin")

    target.role = payload.role
    await db.commit()

    target_user = await db.get(User, user_id)
    text = (
        f"{current_user.username} made {target_user.username} an admin" if payload.role == MemberRole.ADMIN
        else f"{current_user.username} dismissed {target_user.username} as admin"
    )
    system = await MessageService.post_system_message(db, conversation_id, current_user, text)
    await _notify(db, conversation_id, [system])
    return {"success": True, "message": "Member updated", "data": None}


@router.delete("/{conversation_id}/members/{user_id}")
async def remove_member(
    conversation_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove someone from the group (admins), or leave it yourself (anyone)"""
    conversation, me = await _load(db, conversation_id, current_user)
    leaving = user_id == current_user.id
    if conversation.kind != "group":
        raise HTTPException(status_code=400, detail="You can't leave a direct chat")
    if not leaving:
        _require_group_admin(conversation, me)

    target = (await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.user_id == user_id,
        )
    )).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Member not found")
    target_user = await db.get(User, user_id)

    await db.delete(target)
    await db.flush()

    remaining = list((await db.execute(
        select(ConversationMember)
        .where(ConversationMember.conversation_id == conversation_id)
        .order_by(ConversationMember.joined_at)
    )).scalars().all())

    if not remaining:
        # Last person left: nothing left to keep
        await db.delete(conversation)
        await db.commit()
    else:
        # Never leave a group without an admin
        if not any(m.role == MemberRole.ADMIN for m in remaining):
            remaining[0].role = MemberRole.ADMIN
        await db.commit()

    await publish_users([str(user_id)], {
        "type": "conversation_removed",
        "conversationId": str(conversation_id),
        "title": conversation.title,
        "removedBy": str(current_user.id),
        "removedByName": current_user.username,
        "left": leaving,
    })

    if remaining:
        text = (
            f"{target_user.username} left" if leaving
            else f"{current_user.username} removed {target_user.username}"
        )
        system = await MessageService.post_system_message(db, conversation_id, current_user, text)
        await _notify(db, conversation_id, [system])

    return {"success": True, "message": "Left the group" if leaving else "Member removed", "data": None}
