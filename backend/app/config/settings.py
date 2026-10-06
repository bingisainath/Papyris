# backend/app/config/settings.py

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    # Environment
    ENV: str = "local"  # local, staging, production
    
    # Application
    APP_NAME: str = "Papyris API"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"  # DEBUG shows every WebSocket event and worker step
    SQL_ECHO: bool = False  # log every SQL statement (very noisy)
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/papyris"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    redis_dsn: str = "redis://localhost:6379/0"  # Alias for compatibility
    
    # JWT Authentication
    JWT_SECRET_KEY: str = "your-secret-key-change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # 1 hour; clients renew via /auth/refresh
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ]
    
    # Media uploads (stored on local disk, served by /api/v1/media)
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB - images and documents
    MAX_VIDEO_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB
    UPLOAD_DIR: str = "uploads"  # relative paths resolve against the backend/ directory
    # Encrypts uploaded files on disk: 32 random bytes, base64. Generate with
    #   python -c "import secrets,base64;print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
    # Never change or lose it once files exist (they can't be read without it).
    # Empty = derived from JWT_SECRET_KEY (then never change that either).
    MEDIA_ENCRYPTION_KEY: str = ""
    
    # Receipt scanning. Keys live only here on the server, never in the app.
    ANTHROPIC_API_KEY: str = ""
    # Needed only when ANTHROPIC_API_KEY isn't scoped to a workspace (Console > Settings > Workspaces)
    ANTHROPIC_WORKSPACE_ID: str = ""
    OPENAI_API_KEY: str = ""
    # Encrypts the AI keys people add themselves; falls back to one derived from JWT_SECRET_KEY
    AI_KEY_ENCRYPTION_SECRET: str = ""
    RECEIPT_SCANS_PER_MONTH: int = 50  # per person on the app's key; admins can change it in the app
    RECEIPT_AI_TIMEOUT_SECONDS: int = 120
    RECEIPT_MAX_IMAGES: int = 4

    # Email (sign-up codes, password resets). With SMTP_USER and SMTP_PASSWORD set, emails are
    # really sent; without them (local development) they are written to the backend log instead.
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = ""  # defaults to SMTP_USER
    FROM_NAME: str = "Papyris"
    FRONTEND_URL: str = "http://localhost:3000"  # used in password-reset links

    # Push notifications (Firebase Cloud Messaging). Path to the service-account JSON downloaded
    # from Firebase console > Project settings > Service accounts. Empty = no push notifications.
    FIREBASE_SERVICE_ACCOUNT_FILE: str = ""
    PUSH_SHOW_MESSAGE_TEXT: bool = True  # False: notifications only say "New message"

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