"""wrong_answer_service 的 TDD 测试。

按照 TDD 原则：先写测试，看测试失败，再修复代码。
这个测试复现了用户报告的 bug：
- 错题本"错题练习"功能不生效

根因：wrong_answer_service.get_wrong_answers 的 SQL 没有 SELECT question_id 字段，
导致前端 practiceWrongAnswers 获取不到 question_id，无法调用错题练习 API。
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
import asyncpg

from app.services import wrong_answer_service
from app.config.settings import settings


@pytest.fixture
def db_conn():
    """创建数据库连接用于测试（同步 fixture 返回协程）。"""
    async def _create():
        conn = await asyncpg.connect(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            database=settings.DB_NAME,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
        )
        return conn
    return _create


# ===== Bug: 错题本 API 返回的数据缺少 question_id 字段 =====

@pytest.mark.asyncio
async def test_wrong_answers_return_question_id(db_conn):
    """错题本查询结果应包含 question_id 字段。

    前端 practiceWrongAnswers 函数需要 item.question_id 来调用错题练习 API：
        const questionIds = (data.data || data).map(item => item.question_id);

    如果 question_id 缺失，questionIds 会是 [undefined, ...]，
    导致 POST /api/wrong-answers/practice 的 Pydantic 校验失败（list[int] 不接受 null）。
    """
    create_conn = db_conn
    conn = await create_conn()
    try:
        # 先确保数据库中有错题记录（使用已存在的测试数据）
        count = await wrong_answer_service.get_wrong_answer_count(conn, "张洛琳")
        if count == 0:
            pytest.skip("数据库中没有张洛琳的错题记录，跳过测试")

        result = await wrong_answer_service.get_wrong_answers(conn, "张洛琳", page=1, limit=5)
        assert len(result["data"]) > 0, "应该有错题记录"

        # 每条错题记录都必须包含 question_id 字段
        for item in result["data"]:
            assert "question_id" in item, (
                f"错题记录缺少 question_id 字段！返回的字段: {list(item.keys())}。"
                "前端 practiceWrongAnswers 需要 question_id 来调用错题练习 API。"
            )
            assert item["question_id"] is not None, f"错题记录 question_id 为 None: {item}"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_practice_wrong_answers_api_works(db_conn):
    """错题练习 API 应能根据 question_id 查询到题目。

    这是 practiceWrongAnswers 的完整流程测试：
    1. 获取错题列表（包含 question_id）
    2. 提取 question_id 列表
    3. 调用 get_practice_questions 查询题目
    """
    create_conn = db_conn
    conn = await create_conn()
    try:
        count = await wrong_answer_service.get_wrong_answer_count(conn, "张洛琳")
        if count == 0:
            pytest.skip("数据库中没有张洛琳的错题记录，跳过测试")

        # 模拟前端 practiceWrongAnswers 的逻辑
        result = await wrong_answer_service.get_wrong_answers(conn, "张洛琳", page=1, limit=count)
        question_ids = [item["question_id"] for item in result["data"] if item.get("question_id")]

        assert len(question_ids) > 0, (
            "无法从错题记录中提取 question_id，practiceWrongAnswers 会失败。"
            f"返回的数据: {result['data'][:1]}"
        )

        # 调用 get_practice_questions
        practice_questions = await wrong_answer_service.get_practice_questions(conn, question_ids)
        assert len(practice_questions) > 0, "根据 question_id 应该能查询到练习题目"
    finally:
        await conn.close()
