# from pydantic_settings import BaseSettings, SettingsConfigDict
# from pydantic import field_validator
# from typing import List

# class Settings(BaseSettings):
#     model_config = SettingsConfigDict(
#         env_file=".env",
#         env_file_encoding="utf-8",
#     )

#     APP_NAME: str = "Papyris"
#     ENV: str = "local"
#     DEBUG: bool = False

#     DATABASE_URL: str

#     CORS_ORIGINS: List[str] = ["http://localhost:3000"]

#     JWT_SECRET_KEY: str
#     JWT_ALGORITHM: str = "HS256"
#     ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

#     @field_validator("CORS_ORIGINS", mode="before")
#     @classmethod
#     def parse_cors_origins(cls, v):
#         if isinstance(v, list):
#             return v
#         return [x.strip() for x in v.split(",") if x.strip()]

# settings = Settings()


from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    APP_NAME: str = "Papyris"
    ENV: str = "local"
    DEBUG: bool = False

    DATABASE_URL: str

    CORS_ORIGINS: List[str]

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

settings = Settings()
