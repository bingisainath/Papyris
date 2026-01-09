# from pydantic_settings import BaseSettings
# from pydantic import Field
# from typing import List, Optional

# class Settings(BaseSettings):
#     APP_NAME: str = "Papyris"
#     ENV: str = "local"
#     DEBUG: bool = True

#     # Database
#     DATABASE_URL: str
#     DB_SSL: bool = False  # ✅ add this to match .env

#     # JWT
#     JWT_SECRET_KEY: str
#     JWT_ALGORITHM: str = "HS256"
#     ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

#     # CORS
#     CORS_ORIGINS: List[str] = Field(default_factory=list)

#     # Redis (support both styles)
#     REDIS_URL: Optional[str] = None  # ✅ add this to match .env
#     REDIS_HOST: str = "redis"
#     REDIS_PORT: int = 6379

#     @property
#     def redis_dsn(self) -> str:
#         # prefer REDIS_URL if provided, else build from host/port
#         return self.REDIS_URL or f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

#     class Config:
#         env_file = ".env"
#         extra = "forbid"

# settings = Settings()


# backend/app/config/settings.py

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    # Environment
    ENV: str = "local"  # local, staging, production
    
    # Application
    APP_NAME: str = "Papyris API"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/papyris"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    redis_dsn: str = "redis://localhost:6379/0"  # Alias for compatibility
    
    # JWT Authentication
    JWT_SECRET_KEY: str = "your-secret-key-change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ]
    
    # File Upload (for future media messages)
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    UPLOAD_DIR: str = "uploads"
    
    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30  # seconds
    WS_MAX_CONNECTIONS_PER_USER: int = 5
    
    # Redis Streams
    STREAM_KEY: str = "papyris:messages"
    CONSUMER_GROUP: str = "papyris-workers"
    STREAM_MAX_LEN: int = 100000
    
    # ✅ Pydantic v2 configuration - allows extra fields from .env
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra='ignore'  # ✅ This ignores unknown fields from .env
    )


# Create global settings instance
settings = Settings()