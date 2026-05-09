from __future__ import annotations
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PORT: int = 3000
    NODE_ENV: str = "development"

    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "kaoshiku"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "password"

    FRONTEND_URL: str = "http://localhost:8080"

    JWT_SECRET: str = "your_jwt_secret_key"
    JWT_EXPIRES_IN: str = "24h"

    MAX_FILE_SIZE: int = 10485760

    DEFAULT_TIME_LIMIT: int = 1800
    CELEBRATION_SCORE: int = 90

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:
        return (
            f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def allowed_origins(self) -> list[str]:
        origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
        if self.FRONTEND_URL:
            origins.append(self.FRONTEND_URL)
        return origins

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
