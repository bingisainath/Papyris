# from pydantic_settings import BaseSettings
# from pydantic import Field
# from typing import List

# class Settings(BaseSettings):
#     APP_NAME: str = "Papyris"
#     ENV: str = "local"
#     DEBUG: bool = True

#     # Database
#     DATABASE_URL: str

#     # JWT
#     JWT_SECRET_KEY: str
#     JWT_ALGORITHM: str = "HS256"
#     ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

#     # CORS
#     CORS_ORIGINS: List[str] = Field(default_factory=list)

#     # Redis
#     REDIS_HOST: str = "redis"
#     REDIS_PORT: int = 6379

#     class Config:
#         env_file = ".env"
#         extra = "forbid"   # 👈 keep strict (recommended)

# settings = Settings()


from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List, Optional

class Settings(BaseSettings):
    APP_NAME: str = "Papyris"
    ENV: str = "local"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str
    DB_SSL: bool = False  # ✅ add this to match .env

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # CORS
    CORS_ORIGINS: List[str] = Field(default_factory=list)

    # Redis (support both styles)
    REDIS_URL: Optional[str] = None  # ✅ add this to match .env
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379

    @property
    def redis_dsn(self) -> str:
        # prefer REDIS_URL if provided, else build from host/port
        return self.REDIS_URL or f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    class Config:
        env_file = ".env"
        extra = "forbid"

settings = Settings()
