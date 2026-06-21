import os
from dataclasses import dataclass


ALLOWED_LOG_LEVELS = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}


def read_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


def read_port() -> int:
    try:
        port = int(os.getenv("PORT", "8000"))
    except ValueError:
        return 8000
    return port if 1 <= port <= 65535 else 8000


def read_log_level() -> str:
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    return log_level if log_level in ALLOWED_LOG_LEVELS else "INFO"


def read_cors_origins() -> tuple[str, ...]:
    origins = os.getenv("CORS_ORIGINS", "")
    return tuple(origin.strip() for origin in origins.split(",") if origin.strip())


@dataclass(frozen=True)
class Settings:
    ai_mode: str = os.getenv("AI_MODE", "mock").lower()
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = read_port()
    mock_delay_min: float = max(0.0, read_float("MOCK_DELAY_MIN", 0.5))
    mock_delay_max: float = max(0.0, read_float("MOCK_DELAY_MAX", 1.5))
    log_level: str = read_log_level()
    cors_origins: tuple[str, ...] = read_cors_origins()


settings = Settings()
