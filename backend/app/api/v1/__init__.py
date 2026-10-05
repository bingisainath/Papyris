# from fastapi import APIRouter
# from app.api.v1.auth import router as auth_router

# api_router = APIRouter()
# api_router.include_router(auth_router)


# backend/app/api/v1/__init__.py

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.media import router as media_router
from app.api.v1.messages import router as messages_router
from app.api.v1.groups import router as groups_router

api_router = APIRouter()

# Auth routes
api_router.include_router(auth_router)

# Chat / Conversations routes
api_router.include_router(chat_router)

# Conversation details and group management
api_router.include_router(groups_router)

# Media uploads / downloads
api_router.include_router(media_router)

# Message actions (edit, delete, react)
api_router.include_router(messages_router)
