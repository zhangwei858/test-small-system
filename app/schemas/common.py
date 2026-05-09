from __future__ import annotations
from typing import Any

from pydantic import BaseModel


class ApiResponse(BaseModel):
    code: int = 200
    message: str = "success"
    data: Any = None


class PaginationInfo(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
