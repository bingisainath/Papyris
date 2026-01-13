# from sqlalchemy import Column, String, Boolean, DateTime
# from sqlalchemy.dialects.postgresql import UUID
# from sqlalchemy.sql import func
# import uuid

# from app.db.base_class import Base

# class User(Base):
#     __tablename__ = "users"

#     id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
#     username = Column(String, nullable=False)
#     email = Column(String, unique=True, index=True, nullable=False)
#     hashed_password = Column(String, nullable=False)
#     is_active = Column(Boolean, default=True)

#     avatar = Column(String, nullable=True)

#     created_at = Column(DateTime(timezone=True), server_default=func.now())


"""
User Model
"""
import uuid
import enum
from sqlalchemy import Column, String, Boolean, DateTime, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.base import Base


class UserStatus(str, enum.Enum):
    """User account status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class Gender(str, enum.Enum):
    """User gender options"""
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    NOT_SPECIFIED = ""


class User(Base):
    """
    User model with comprehensive profile information.
    Enhanced from MongoDB version with proper PostgreSQL types.
    """
    __tablename__ = "users"

    # Core Identity
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), nullable=False, unique=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    
    # Profile Information
    name = Column(String(100), nullable=True)  # Full display name
    phone = Column(String(20), nullable=True)
    date_of_birth = Column(DateTime(timezone=False), nullable=True)
    gender = Column(SQLEnum(Gender, name="gender_enum"), default=Gender.NOT_SPECIFIED)
    address = Column(Text, nullable=True)
    bio = Column(String(500), nullable=True)
    
    # Media
    avatar = Column(String, nullable=True)  # URL to profile picture
    
    # Social IDs (for OAuth integration - future)
    google_id = Column(String, nullable=True, unique=True)
    facebook_id = Column(String, nullable=True, unique=True)
    
    # Account Status
    is_active = Column(Boolean, default=True)
    status = Column(SQLEnum(UserStatus, name="user_status_enum"), default=UserStatus.ACTIVE)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Online Status (can be moved to Redis for real-time)
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username}, email={self.email})>"