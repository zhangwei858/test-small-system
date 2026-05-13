from __future__ import annotations
import json
import logging
import os
import asyncpg

from app.services import parser_service, paper_service

logger = logging.getLogger("exam_system")


async def find_all(db: asyncpg.Connection, filters: dict = None) -> list[dict]:
    filters = filters or {}
    conditions = ["1=1"]
    params = []
    idx = 1

    if filters.get("grade_id"):
        conditions.append(f"q.grade_id = ${idx}")
        params.append(filters["grade_id"])
        idx += 1

    if filters.get("type_id"):
        conditions.append(f"q.type_id = ${idx}")
        params.append(filters["type_id"])
        idx += 1

    if filters.get("type_ids") and len(filters["type_ids"]) > 0:
        placeholders = []
        for tid in filters["type_ids"]:
            placeholders.append(f"${idx}")
            params.append(tid)
            idx += 1
        conditions.append(f"q.type_id IN ({','.join(placeholders)})")

    if filters.get("paper_id"):
        conditions.append(f"q.paper_id = ${idx}")
        params.append(filters["paper_id"])
        idx += 1

    where_clause = " AND ".join(conditions)
    sql = (
        f"SELECT q.*, g.name as grade_name, t.name as type_name, ep.name as paper_name "
        f"FROM questions q "
        f"LEFT JOIN grades g ON q.grade_id = g.id "
        f"LEFT JOIN question_types t ON q.type_id = t.id "
        f"LEFT JOIN exam_papers ep ON q.paper_id = ep.id "
        f"WHERE {where_clause} ORDER BY q.id"
    )

    if filters.get("limit"):
        sql += f" LIMIT ${idx}"
        params.append(filters["limit"])
        idx += 1

    if filters.get("offset"):
        sql += f" OFFSET ${idx}"
        params.append(filters["offset"])
        idx += 1

    rows = await db.fetch(sql, *params)
    return [dict(r) for r in rows]


async def find_by_id(db: asyncpg.Connection, question_id: int) -> dict | None:
    row = await db.fetchrow(
        "SELECT q.*, g.name as grade_name, t.name as type_name "
        "FROM questions q "
        "LEFT JOIN grades g ON q.grade_id = g.id "
        "LEFT JOIN question_types t ON q.type_id = t.id "
        "WHERE q.id = $1",
        question_id,
    )
    return dict(row) if row else None


async def create_question(db: asyncpg.Connection, data) -> dict:
    options = json.dumps(data.options) if data.options else None
    row = await db.fetchrow(
        "INSERT INTO questions (grade_id, type_id, content, options, answer, points, paper_id, reading_content, reading_title) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
        data.grade_id, data.type_id, data.content, options,
        data.answer, data.points, data.paper_id,
        data.reading_content, data.reading_title,
    )
    logger.info(f"创建题目: ID={row['id']}, 内容={row['content'][:30]}")
    return dict(row)


async def update_question(db: asyncpg.Connection, question_id: int, data) -> dict | None:
    existing = await db.fetchrow("SELECT * FROM questions WHERE id = $1", question_id)
    if not existing:
        return None

    grade_id = data.grade_id if data.grade_id is not None else existing["grade_id"]
    type_id = data.type_id if data.type_id is not None else existing["type_id"]
    content = data.content if data.content is not None else existing["content"]
    options = json.dumps(data.options) if data.options is not None else existing["options"]
    answer = data.answer if data.answer is not None else existing["answer"]
    points = data.points if data.points is not None else existing["points"]
    reading_content = data.reading_content if hasattr(data, 'reading_content') and data.reading_content is not None else existing["reading_content"]
    reading_title = data.reading_title if hasattr(data, 'reading_title') and data.reading_title is not None else existing["reading_title"]

    row = await db.fetchrow(
        "UPDATE questions SET grade_id=$1, type_id=$2, content=$3, options=$4, answer=$5, "
        "points=$6, reading_content=$7, reading_title=$8 WHERE id=$9 RETURNING *",
        grade_id, type_id, content, options, answer, points,
        reading_content, reading_title, question_id,
    )
    return dict(row)


async def delete_question(db: asyncpg.Connection, question_id: int) -> dict | None:
    row = await db.fetchrow("DELETE FROM questions WHERE id = $1 RETURNING *", question_id)
    return dict(row) if row else None


async def count_questions(db: asyncpg.Connection, grade_id: int = None, type_id: int = None) -> int:
    conditions = ["1=1"]
    params = []
    idx = 1
    if grade_id:
        conditions.append(f"grade_id = ${idx}")
        params.append(grade_id)
        idx += 1
    if type_id:
        conditions.append(f"type_id = ${idx}")
        params.append(type_id)
        idx += 1
    where_clause = " AND ".join(conditions)
    row = await db.fetchrow(f"SELECT COUNT(*) as total FROM questions WHERE {where_clause}", *params)
    return row["total"]


async def import_from_file(
    db: asyncpg.Connection, file_path: str, grade_id: int, type_id: int | None, original_name: str
) -> dict:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    questions_data = parser_service.parse(content, grade_id, type_id)
    if not questions_data:
        return {"success_count": 0, "fail_count": 0, "success_list": [], "fail_list": []}

    paper_name = os.path.splitext(original_name)[0]
    existing_paper = await paper_service.find_by_source_file(db, original_name)

    if existing_paper:
        logger.info(f"文件 {original_name} 已存在试卷记录，更新试卷 ID: {existing_paper['id']}")
        await db.execute("DELETE FROM questions WHERE paper_id = $1", existing_paper["id"])
        await db.execute("UPDATE exam_papers SET question_count = 0 WHERE id = $1", existing_paper["id"])
        paper = existing_paper
    else:
        logger.info(f"文件 {original_name} 不存在试卷记录，创建新试卷")
        paper = await paper_service.create_paper(db, paper_name, grade_id, original_name)

    success_list = []
    fail_list = []

    for qd in questions_data:
        qd.paper_id = paper["id"]
        try:
            q = await create_question(db, qd)
            success_list.append({"content": q["content"], "type_name": None, "points": q["points"]})
        except Exception as e:
            fail_list.append({"content": qd.content, "error": str(e)})

    await paper_service.update_paper_count(db, paper["id"], len(success_list))

    return {
        "success_count": len(success_list),
        "fail_count": len(fail_list),
        "success_list": success_list,
        "fail_list": fail_list,
    }


async def scan_question_bank(db: asyncpg.Connection) -> dict:
    bank_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "题库")
    if not os.path.exists(bank_path):
        return None

    files = [f for f in os.listdir(bank_path) if f.endswith(".txt")]
    logger.info(f"[扫描题库] 找到文件列表: {files}")

    all_success = []
    all_fail = []

    for file_name in files:
        logger.info(f"[扫描题库] 正在处理文件: {file_name}")
        file_path = os.path.join(bank_path, file_name)
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        questions_data = parser_service.parse(content)
        paper_name = os.path.splitext(file_name)[0]
        grade_id = _detect_grade_from_content(content)

        existing_paper = await paper_service.find_by_source_file(db, file_name)
        if existing_paper:
            logger.info(f"文件 {file_name} 已存在，更新试卷 ID: {existing_paper['id']}")
            await db.execute("DELETE FROM questions WHERE paper_id = $1", existing_paper["id"])
            await db.execute("UPDATE exam_papers SET question_count = 0 WHERE id = $1", existing_paper["id"])
            paper = existing_paper
        else:
            logger.info(f"文件 {file_name} 不存在，创建新试卷")
            paper = await paper_service.create_paper(db, paper_name, grade_id, file_name)

        logger.info(f"[扫描题库] 文件 {file_name}，准备插入 {len(questions_data)} 道题目")
        file_success = 0
        for qd in questions_data:
            qd.paper_id = paper["id"]
            qd.grade_id = grade_id
            try:
                q = await create_question(db, qd)
                all_success.append({"content": q["content"], "type_name": None, "points": q["points"]})
                file_success += 1
            except Exception as e:
                logger.info(f"[扫描题库] 插入题目失败: {e}")
                all_fail.append({"content": qd.content, "error": str(e)})

        logger.info(f"[扫描题库] 文件 {file_name}，成功插入 {file_success} 道题目")
        await paper_service.update_paper_count(db, paper["id"], file_success)

    return {
        "success_count": len(all_success),
        "fail_count": len(all_fail),
        "success_list": all_success,
        "fail_list": all_fail,
    }


async def clear_question_bank(db: asyncpg.Connection) -> None:
    logger.info("开始清空题库...")
    await db.execute("DELETE FROM answer_records")
    logger.info("已删除答题记录")
    await db.execute("DELETE FROM exam_records")
    logger.info("已删除考试记录")
    await db.execute("DELETE FROM questions")
    logger.info("已删除题目")
    await db.execute("UPDATE exam_papers SET question_count = 0")
    logger.info("已重置试卷题目计数")


async def reset_and_rescan(db: asyncpg.Connection) -> dict:
    logger.info("开始重置并重扫题库...")
    await clear_question_bank(db)
    return await scan_question_bank(db)


def _detect_grade_from_content(content: str) -> int:
    if any(kw in content for kw in ["幼儿园", "幼升小", "低年级"]):
        return 1
    if any(kw in content for kw in ["三年级", "中年级"]):
        return 2
    if any(kw in content for kw in ["高年级", "五年级", "六年级"]):
        return 3
    return 2