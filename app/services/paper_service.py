from __future__ import annotations
import logging

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exam_paper import ExamPaper

logger = logging.getLogger("exam_system")


async def get_all_papers(db: AsyncSession, user_name: str = None) -> list[dict]:
    sql = (
        select(
            ExamPaper,
        )
        .order_by(ExamPaper.created_at.desc())
    )
    result = await db.execute(sql)
    papers = result.scalars().all()

    data = []
    for p in papers:
        grade = await db.execute(
            select(
                __import__("app.models.grade", fromlist=["Grade"]).Grade.name
            ).where(
                __import__("app.models.grade", fromlist=["Grade"]).Grade.id == p.grade_id
            )
        )
        grade_name = grade.scalar()
        d = {
            "id": p.id,
            "name": p.name,
            "grade_id": p.grade_id,
            "source_file": p.source_file,
            "question_count": p.question_count,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "grade_name": grade_name,
            "done_count": 0,
            "remaining_count": p.question_count,
        }

        if user_name:
            count_sql = text(
                "SELECT COUNT(DISTINCT ar.question_id) FROM answer_records ar "
                "JOIN exam_records er ON ar.exam_id = er.id "
                "WHERE er.user_name = :uname AND er.paper_id = :pid "
                "AND er.status = 'completed' AND ar.is_correct = true"
            )
            count_result = await db.execute(count_sql, {"uname": user_name, "pid": p.id})
            done = count_result.scalar() or 0
            d["done_count"] = done
            d["remaining_count"] = max(0, p.question_count - done)

        data.append(d)
    return data


async def find_by_id(db: AsyncSession, paper_id: int) -> ExamPaper | None:
    return await db.get(ExamPaper, paper_id)


async def find_by_source_file(db: AsyncSession, source_file: str) -> ExamPaper | None:
    result = await db.execute(
        select(ExamPaper).where(ExamPaper.source_file == source_file)
    )
    return result.scalars().first()


async def create_paper(db: AsyncSession, name: str, grade_id: int, source_file: str) -> ExamPaper:
    paper = ExamPaper(name=name, grade_id=grade_id, source_file=source_file, question_count=0)
    db.add(paper)
    await db.commit()
    await db.refresh(paper)
    logger.info(f"创建试卷: {name}, 年级ID: {grade_id}")
    return paper


async def update_paper_count(db: AsyncSession, paper_id: int, count: int):
    paper = await db.get(ExamPaper, paper_id)
    if paper:
        paper.question_count = count
        await db.commit()
