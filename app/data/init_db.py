from __future__ import annotations
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import asyncpg
from app.config.settings import settings
from app.config.logger import logger

DDL_SQL = """
CREATE TABLE IF NOT EXISTS grades (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) UNIQUE NOT NULL,
    level VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS question_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'examiner',
    allowed_grades JSON DEFAULT '["low","middle","high"]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exam_papers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    grade_id INTEGER REFERENCES grades(id) ON DELETE CASCADE,
    source_file VARCHAR(255) UNIQUE,
    question_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    grade_id INTEGER NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
    type_id INTEGER NOT NULL REFERENCES question_types(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    options JSON,
    answer VARCHAR(500) NOT NULL,
    points INTEGER DEFAULT 10,
    paper_id INTEGER REFERENCES exam_papers(id) ON DELETE SET NULL,
    reading_content TEXT,
    reading_title VARCHAR(200),
    passage TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exam_records (
    id SERIAL PRIMARY KEY,
    user_name VARCHAR(100) NOT NULL,
    grade_id INTEGER NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
    paper_id INTEGER,
    total_score INTEGER DEFAULT 0,
    total_questions INTEGER NOT NULL,
    correct_count INTEGER DEFAULT 0,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'ongoing'
);

CREATE TABLE IF NOT EXISTS answer_records (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL REFERENCES exam_records(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_answer VARCHAR(500),
    is_correct BOOLEAN NOT NULL,
    points_earned INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wrong_answers (
    id SERIAL PRIMARY KEY,
    user_name VARCHAR(100) NOT NULL,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_answer VARCHAR(500),
    exam_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prizes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    emoji VARCHAR(10),
    color VARCHAR(20),
    base_probability NUMERIC(5,2) DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lottery_records (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL REFERENCES exam_records(id) ON DELETE CASCADE,
    user_name VARCHAR(100) NOT NULL,
    prize_name VARCHAR(100) NOT NULL,
    prize_emoji VARCHAR(10),
    is_redeemed BOOLEAN DEFAULT FALSE,
    redeemed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

SEED_SQL = """
INSERT INTO grades (id, name, level) VALUES
    (1, '低年级（1-2年级）', 'low'),
    (2, '中年级（3-4年级）', 'middle'),
    (3, '高年级（5-6年级）', 'high')
ON CONFLICT (id) DO NOTHING;

INSERT INTO question_types (id, name) VALUES
    (1, '选择题'),
    (2, '填空题'),
    (3, '判断题'),
    (4, '计算题')
ON CONFLICT (id) DO NOTHING;

INSERT INTO prizes (name, emoji, color, base_probability, is_default) VALUES
    ('2元钱', '💰', '#ef4444', 14.29, FALSE),
    ('1元钱', '💵', '#f59e0b', 14.29, FALSE),
    ('游乐场一次', '🎡', '#10b981', 14.29, FALSE),
    ('火锅一次', '🍲', '#6366f1', 14.29, FALSE),
    ('一个西瓜', '🍉', '#22c55e', 14.29, FALSE),
    ('看爸爸手机0分钟', '📱', '#8b5cf6', 14.29, FALSE),
    ('谢谢惠顾', '🎁', '#6b7280', 14.25, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO users (username, role) VALUES
    ('张伟', 'admin'),
    ('张洛琳', 'examiner'),
    ('张洛晗', 'examiner')
ON CONFLICT (username) DO NOTHING;
"""


async def init_tables(conn: asyncpg.Connection):
    await conn.execute(DDL_SQL)
    logger.info("数据库表创建/确认完成（纯 DDL SQL）")


async def seed_data(conn: asyncpg.Connection):
    logger.info("开始种子数据初始化...")
    grade_row = await conn.fetchrow("SELECT COUNT(*) as cnt FROM grades")
    if grade_row["cnt"] == 0:
        await conn.execute(SEED_SQL)
        logger.info("种子数据初始化完成")
    else:
        logger.info("种子数据已存在，跳过全量插入，仅补充缺失数据")
        await conn.execute(SEED_SQL)
        logger.info("种子数据补充完成")


async def main():
    logger.info("开始数据库初始化（PostgreSQL - kaoshiku）...")

    conn = await asyncpg.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        database=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
    )

    try:
        await init_tables(conn)
        await seed_data(conn)
    finally:
        await conn.close()

    logger.info("数据库初始化完成！已有数据不受影响。")


if __name__ == "__main__":
    asyncio.run(main())