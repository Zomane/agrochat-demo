import hashlib
import logging
import tempfile
import time
from pathlib import Path

import uvicorn
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.config import settings
from backend.mock_ai import generate_demo_response


logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("agrochat.api")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
MAX_IMAGE_SIZE = 5 * 1024 * 1024
IMAGE_CHUNK_SIZE = 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

temporary_images = tempfile.TemporaryDirectory(prefix="agrochat-images-")
TEMP_IMAGE_DIR = Path(temporary_images.name)

app = FastAPI(
    title="AgroChat Demo API",
    description="Demo API with mock responses; no production AI model is connected.",
    version="1.0.0-demo",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Accept", "Content-Type"],
    )
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/user_images", StaticFiles(directory=TEMP_IMAGE_DIR), name="user_images")


class RequestData(BaseModel):
    userMessages: list[str | None] = Field(default_factory=list)
    botMessages: list[str | None] = Field(default_factory=list)
    image: list[str | None] = Field(default_factory=list)
    flags: list[str | None] = Field(default_factory=list)


class ChatResponse(BaseModel):
    text: str
    image: str | None = None


class HealthResponse(BaseModel):
    status: str
    mode: str


class ImageUploadResponse(BaseModel):
    imageName: str


class ErrorDetails(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetails


def error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}},
    )


@app.exception_handler(StarletteHTTPException)
async def handle_http_error(_request: Request, error: StarletteHTTPException) -> JSONResponse:
    message = str(error.detail) if error.detail else "Ошибка запроса"
    return error_response(error.status_code, "http_error", message)


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_request: Request, _error: RequestValidationError) -> JSONResponse:
    return error_response(422, "validation_error", "Некорректные данные запроса")


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, error: Exception) -> JSONResponse:
    logger.error(
        "unhandled_error method=%s path=%s error_type=%s",
        request.method,
        request.url.path,
        type(error).__name__,
    )
    return error_response(500, "internal_error", "Внутренняя ошибка сервера")


@app.middleware("http")
async def log_request(request: Request, call_next):
    started_at = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - started_at) * 1000
    logger.info(
        "request method=%s path=%s status=%s duration_ms=%.1f",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


def extract_text(message: str, prefix: str = "text:") -> str:
    return message.split(prefix, 1)[-1].strip() if prefix in message else message.strip()


def get_latest_message(messages: list[str | None]) -> str:
    for message in reversed(messages):
        if message and extract_text(message):
            return extract_text(message)
    return ""


def has_uploaded_image(images: list[str | None]) -> bool:
    return any(image and image.strip() for image in images)


def matches_image_signature(image_data: bytes, extension: str) -> bool:
    if extension == ".png":
        return image_data.startswith(b"\x89PNG\r\n\x1a\n")
    if extension == ".jpg":
        return image_data.startswith(b"\xff\xd8\xff")
    if extension == ".webp":
        return (
            len(image_data) >= 12
            and image_data.startswith(b"RIFF")
            and image_data[8:12] == b"WEBP"
        )
    return False


@app.get("/")
async def read_root() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health", response_model=HealthResponse)
async def healthcheck() -> HealthResponse:
    return HealthResponse(status="ok", mode=settings.ai_mode)


@app.post(
    "/request",
    response_model=ChatResponse,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
async def make_response(request_data: RequestData) -> ChatResponse:
    latest_message = get_latest_message(request_data.userMessages)
    has_image = has_uploaded_image(request_data.image)

    if not latest_message and not has_image:
        raise HTTPException(
            status_code=422,
            detail="Сообщение или изображение обязательно",
        )

    text = await generate_demo_response(
        message=latest_message,
        has_image=has_image,
        regenerate="regenerate" in request_data.flags,
    )
    return ChatResponse(text=text, image=None)


async def read_validated_image(upload: UploadFile) -> tuple[bytes, str]:
    expected_extension = ALLOWED_IMAGE_TYPES.get(upload.content_type or "")
    if expected_extension is None:
        raise HTTPException(
            status_code=415,
            detail="Разрешены изображения JPEG, PNG и WebP",
        )

    original_extension = Path(upload.filename or "").suffix.lower()
    allowed_extensions = {".jpg", ".jpeg"} if expected_extension == ".jpg" else {expected_extension}
    if original_extension not in allowed_extensions:
        raise HTTPException(
            status_code=415,
            detail="Расширение файла не соответствует формату изображения",
        )

    chunks: list[bytes] = []
    total_size = 0
    while chunk := await upload.read(IMAGE_CHUNK_SIZE):
        total_size += len(chunk)
        if total_size > MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Размер изображения не должен превышать 5 МБ",
            )
        chunks.append(chunk)

    if total_size == 0:
        raise HTTPException(status_code=422, detail="Изображение пустое")

    image_data = b"".join(chunks)
    if not matches_image_signature(image_data, expected_extension):
        raise HTTPException(
            status_code=415,
            detail="Содержимое файла не соответствует формату изображения",
        )

    return image_data, expected_extension


@app.post(
    "/get_image_hash",
    response_model=ImageUploadResponse,
    responses={413: {"model": ErrorResponse}, 415: {"model": ErrorResponse}},
)
async def get_image_hash(image: UploadFile = File(...)) -> ImageUploadResponse:
    image_data, extension = await read_validated_image(image)

    filename = f"{hashlib.sha256(image_data).hexdigest()}{extension}"
    destination = TEMP_IMAGE_DIR / filename
    if not destination.exists():
        destination.write_bytes(image_data)

    return ImageUploadResponse(imageName=filename)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
        access_log=False,
    )
