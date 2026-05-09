from __future__ import annotations
import logging
import os
from logging.handlers import TimedRotatingFileHandler

from app.config.settings import settings

log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs")
os.makedirs(log_dir, exist_ok=True)

log_level = logging.DEBUG if settings.NODE_ENV == "development" else logging.INFO

formatter = logging.Formatter(
    "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

error_handler = TimedRotatingFileHandler(
    os.path.join(log_dir, "error.log"),
    when="midnight",
    interval=1,
    backupCount=14,
    encoding="utf-8",
)
error_handler.setLevel(logging.ERROR)
error_handler.setFormatter(formatter)

combined_handler = TimedRotatingFileHandler(
    os.path.join(log_dir, "combined.log"),
    when="midnight",
    interval=1,
    backupCount=30,
    encoding="utf-8",
)
combined_handler.setLevel(logging.INFO)
combined_handler.setFormatter(formatter)

console_handler = logging.StreamHandler()
console_handler.setLevel(log_level)
console_handler.setFormatter(formatter)

logger = logging.getLogger("exam_system")
logger.setLevel(log_level)
logger.addHandler(error_handler)
logger.addHandler(combined_handler)
logger.addHandler(console_handler)
logger.propagate = False
