from __future__ import annotations
import time
import logging

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("exam_system")


class PerformanceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start_time = time.time()
        response = await call_next(request)
        duration = int((time.time() - start_time) * 1000)

        method = request.method
        path = request.url.path
        status_code = response.status_code

        log_data = {
            "method": method,
            "path": path,
            "statusCode": status_code,
            "duration": duration,
        }

        if duration > 3000:
            logger.warning(f"慢请求警告: {method} {path} 耗时 {duration}ms", extra=log_data)

        if status_code >= 500:
            logger.error(f"服务器错误: {method} {path} {status_code}", extra=log_data)

        if duration > 500:
            logger.info(f"请求完成: {method} {path} {status_code} - {duration}ms")

        return response
