# import uuid
# from datetime import datetime
# from sqlalchemy import String, Boolean, DateTime, func
# from sqlalchemy.dialects.postgresql import UUID
# from sqlalchemy.orm import Mapped, mapped_column
# from app.db.base import Base

# class User(Base):
#     __tablename__ = "users"

#     id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
#     username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
#     email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)

#     hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
#     is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

#     created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# app/models/user.py

from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.db.base_class import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    avatar = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
