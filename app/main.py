from __future__ import annotations
import os
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config.settings import settings
from app.config.logger import logger
from app.middleware.performance import PerformanceMiddleware
from app.routers import (
    users, questions, exams, grades, types, papers,
    lottery, prizes, wrong_answers,
)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="小学考试评测系统",
    description="Python + FastAPI 重构版",
    version="2.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
)

app.add_middleware(PerformanceMiddleware)

app.include_router(users.router)
app.include_router(questions.router)
app.include_router(exams.router)
app.include_router(grades.router)
app.include_router(types.router)
app.include_router(papers.router)
app.include_router(lottery.router)
app.include_router(prizes.router)
app.include_router(wrong_answers.router)

base_dir = os.path.dirname(os.path.dirname(__file__))
static_dir = os.path.join(base_dir, "static")

if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/health")
async def health_check():
    return {
        "code": 200,
        "message": "服务正常运行",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/videos/{name}")
async def stream_video(name: str, request: Request):
    video_dir = os.path.join(static_dir, "videos")
    video_path = os.path.join(video_dir, name)

    if not os.path.exists(video_path):
        return {"code": 404, "message": "视频不存在"}

    file_size = os.path.getsize(video_path)
    range_header = request.headers.get("range")

    if range_header:
        start, end = _parse_range(range_header, file_size)
        chunk_size = end - start + 1

        async def _stream():
            with open(video_path, "rb") as f:
                f.seek(start)
                remaining = chunk_size
                while remaining > 0:
                    chunk = f.read(min(65536, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        return StreamingResponse(
            _stream(),
            status_code=206,
            media_type="video/mp4",
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(chunk_size),
            },
        )

    async def _full_stream():
        with open(video_path, "rb") as f:
            while True:
                chunk = f.read(65536)
                if not chunk:
                    break
                yield chunk

    return StreamingResponse(
        _full_stream(),
        media_type="video/mp4",
        headers={
            "Content-Length": str(file_size),
            "Accept-Ranges": "bytes",
        },
    )


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        return {"code": 404, "message": "请求的资源不存在"}

    static_dir_path = os.path.join(static_dir, full_path)
    if full_path and os.path.isfile(static_dir_path):
        return FileResponse(static_dir_path)

    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)

    return {"code": 404, "message": "页面不存在"}


@app.on_event("startup")
async def startup():
    logger.info(f"服务器启动 - 环境: {settings.NODE_ENV}")
    logger.info(f"数据库: {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")


@app.on_event("shutdown")
async def shutdown():
    logger.info("服务器关闭")


def _parse_range(range_header: str, file_size: int) -> tuple[int, int]:
    range_match = range_header.replace("bytes=", "")
    parts = range_match.split("-")
    start = int(parts[0]) if parts[0] else 0
    end = int(parts[1]) if parts[1] else file_size - 1
    end = min(end, file_size - 1)
    return start, end
