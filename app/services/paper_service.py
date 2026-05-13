from __future__ import annotations
import logging
import asyncpg

logger = logging.getLogger("exam_system")


async def get_all_papers(db: asyncpg.Connection, user_name: str = None) -> list[dict]:
    rows = await db.fetch(
        "SELECT ep.*, g.name as grade_name "
        "FROM exam_papers ep LEFT JOIN grades g ON ep.grade_id = g.id "
        "ORDER BY ep.created_at DESC"
    )

    data = []
    for row in rows:
        d = dict(row)
        created_at = d.get("created_at")
        d["created_at"] = created_at.isoformat() if created_at else None
        d["done_count"] = 0
        d["remaining_count"] = d.get("question_count", 0)

        if user_name:
            count_row = await db.fetchrow(
                "SELECT COUNT(DISTINCT ar.question_id) as cnt FROM answer_records ar "
                "JOIN exam_records er ON ar.exam_id = er.id "
                "WHERE er.user_name = $1 AND er.paper_id = $2 "
                "AND er.status = 'completed' AND ar.is_correct = true",
                user_name, d["id"],
            )
            done = count_row["cnt"] if count_row else 0
            d["done_count"] = done
            d["remaining_count"] = max(0, d["question_count"] - done)

        data.append(d)
    return data


async def find_by_id(db: asyncpg.Connection, paper_id: int) -> dict | None:
    row = await db.fetchrow("SELECT * FROM exam_papers WHERE id = $1", paper_id)
    return dict(row) if row else None


async def find_by_source_file(db: asyncpg.Connection, source_file: str) -> dict | None:
    row = await db.fetchrow("SELECT * FROM exam_papers WHERE source_file = $1", source_file)
    return dict(row) if row else None


async def create_paper(db: asyncpg.Connection, name: str, grade_id: int, source_file: str) -> dict:
    row = await db.fetchrow(
        "INSERT INTO exam_papers (name, grade_id, source_file, question_count) "
        "VALUES ($1, $2, $3, 0) RETURNING *",
        name, grade_id, source_file,
    )
    logger.info(f"创建试卷: {name}, 年级ID: {grade_id}")
    return dict(row)


async def update_paper_count(db: asyncpg.Connection, paper_id: int, count: int) -> None:
    result = await db.execute(
        "UPDATE exam_papers SET question_count = $1 WHERE id = $2",
        count, paper_id,
    )
    logger.info(f"更新试卷题目计数: 试卷ID={paper_id}, 题目数={count}")