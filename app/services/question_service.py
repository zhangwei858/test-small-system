from __future__ import annotations
import logging
import os

from sqlalchemy import select, delete, text, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question import Question
from app.models.exam_paper import ExamPaper
from app.models.answer_record import AnswerRecord
from app.models.exam_record import ExamRecord
from app.schemas.question import QuestionCreate, QuestionUpdate
from app.services import parser_service, paper_service

logger = logging.getLogger("exam_system")


async def find_all(db: AsyncSession, filters: dict = None) -> list[dict]:
    filters = filters or {}
    sql = text(
        "SELECT q.*, g.name as grade_name, t.name as type_name, ep.name as paper_name "
        "FROM questions q "
        "LEFT JOIN grades g ON q.grade_id = g.id "
        "LEFT JOIN question_types t ON q.type_id = t.id "
        "LEFT JOIN exam_papers ep ON q.paper_id = ep.id WHERE 1=1"
    )
    params = {}
    param_idx = 0

    if filters.get("grade_id"):
        param_idx += 1
        sql = text(str(sql) + f" AND q.grade_id = :p{param_idx}")
        params[f"p{param_idx}"] = filters["grade_id"]

    if filters.get("type_id"):
        param_idx += 1
        sql = text(str(sql) + f" AND q.type_id = :p{param_idx}")
        params[f"p{param_idx}"] = filters["type_id"]

    if filters.get("type_ids") and len(filters["type_ids"]) > 0:
        placeholders = []
        for tid in filters["type_ids"]:
            param_idx += 1
            placeholders.append(f":p{param_idx}")
            params[f"p{param_idx}"] = tid
        sql = text(str(sql) + f" AND q.type_id IN ({','.join(placeholders)})")

    if filters.get("paper_id"):
        param_idx += 1
        sql = text(str(sql) + f" AND q.paper_id = :p{param_idx}")
        params[f"p{param_idx}"] = filters["paper_id"]

    sql = text(str(sql) + " ORDER BY q.id")

    if filters.get("limit"):
        param_idx += 1
        sql = text(str(sql) + f" LIMIT :p{param_idx}")
        params[f"p{param_idx}"] = filters["limit"]

    if filters.get("offset"):
        param_idx += 1
        sql = text(str(sql) + f" OFFSET :p{param_idx}")
        params[f"p{param_idx}"] = filters["offset"]

    result = await db.execute(sql, params)
    rows = result.mappings().all()
    return [dict(row) for row in rows]


async def find_by_id(db: AsyncSession, question_id: int) -> dict | None:
    sql = text(
        "SELECT q.*, g.name as grade_name, t.name as type_name "
        "FROM questions q "
        "LEFT JOIN grades g ON q.grade_id = g.id "
        "LEFT JOIN question_types t ON q.type_id = t.id "
        "WHERE q.id = :qid"
    )
    result = await db.execute(sql, {"qid": question_id})
    row = result.mappings().first()
    return dict(row) if row else None


async def create_question(db: AsyncSession, data: QuestionCreate) -> Question:
    q = Question(
        grade_id=data.grade_id,
        type_id=data.type_id,
        content=data.content,
        options=data.options,
        answer=data.answer,
        points=data.points,
        paper_id=data.paper_id,
        reading_content=data.reading_content,
        reading_title=data.reading_title,
    )
    db.add(q)
    await db.commit()
    await db.refresh(q)
    logger.info(f"创建题目: ID={q.id}, 内容={q.content[:30]}")
    return q


async def update_question(db: AsyncSession, question_id: int, data: QuestionUpdate) -> Question | None:
    q = await db.get(Question, question_id)
    if not q:
        return None
    update_data = data.model_dump(exclude_unset=True)
    if "options" in update_data and update_data["options"] is not None:
        update_data["options"] = update_data["options"]
    for key, value in update_data.items():
        setattr(q, key, value)
    await db.commit()
    await db.refresh(q)
    return q


async def delete_question(db: AsyncSession, question_id: int) -> Question | None:
    q = await db.get(Question, question_id)
    if not q:
        return None
    await db.delete(q)
    await db.commit()
    return q


async def count_questions(db: AsyncSession, grade_id: int = None, type_id: int = None) -> int:
    sql = "SELECT COUNT(*) as total FROM questions WHERE 1=1"
    params = {}
    if grade_id:
        sql += " AND grade_id = :gid"
        params["gid"] = grade_id
    if type_id:
        sql += " AND type_id = :tid"
        params["tid"] = type_id
    result = await db.execute(text(sql), params)
    return result.scalar()


async def import_from_file(db: AsyncSession, file_path: str, grade_id: int, type_id: int | None, original_name: str) -> dict:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    questions_data = parser_service.parse(content, grade_id, type_id)
    if not questions_data:
        return {"success_count": 0, "fail_count": 0, "success_list": [], "fail_list": []}

    paper_name = os.path.splitext(original_name)[0]
    existing_paper = await paper_service.find_by_source_file(db, original_name)

    if existing_paper:
        logger.info(f"文件 {original_name} 已存在试卷记录，更新试卷 ID: {existing_paper.id}")
        await db.execute(delete(Question).where(Question.paper_id == existing_paper.id))
        existing_paper.question_count = 0
        await db.commit()
        paper = existing_paper
    else:
        logger.info(f"文件 {original_name} 不存在试卷记录，创建新试卷")
        paper = await paper_service.create_paper(db, paper_name, grade_id, original_name)

    success_list = []
    fail_list = []

    for qd in questions_data:
        qd.paper_id = paper.id
        try:
            q = await create_question(db, qd)
            success_list.append({"content": q.content, "type_name": None, "points": q.points})
        except Exception as e:
            fail_list.append({"content": qd.content, "error": str(e)})

    await paper_service.update_paper_count(db, paper.id, len(success_list))

    return {
        "success_count": len(success_list),
        "fail_count": len(fail_list),
        "success_list": success_list,
        "fail_list": fail_list,
    }


async def scan_question_bank(db: AsyncSession) -> dict:
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
            logger.info(f"文件 {file_name} 已存在，更新试卷 ID: {existing_paper.id}")
            await db.execute(delete(Question).where(Question.paper_id == existing_paper.id))
            existing_paper.question_count = 0
            await db.commit()
            paper = existing_paper
        else:
            logger.info(f"文件 {file_name} 不存在，创建新试卷")
            paper = await paper_service.create_paper(db, paper_name, grade_id, file_name)

        logger.info(f"[扫描题库] 文件 {file_name}，准备插入 {len(questions_data)} 道题目")
        file_success = 0
        for qd in questions_data:
            qd.paper_id = paper.id
            qd.grade_id = grade_id
            try:
                q = await create_question(db, qd)
                all_success.append({"content": q.content, "type_name": None, "points": q.points})
                file_success += 1
            except Exception as e:
                logger.info(f"[扫描题库] 插入题目失败: {e}")
                all_fail.append({"content": qd.content, "error": str(e)})

        logger.info(f"[扫描题库] 文件 {file_name}，成功插入 {file_success} 道题目")
        await paper_service.update_paper_count(db, paper.id, file_success)

    return {
        "success_count": len(all_success),
        "fail_count": len(all_fail),
        "success_list": all_success,
        "fail_list": all_fail,
    }


async def clear_question_bank(db: AsyncSession):
    logger.info("开始清空题库...")
    await db.execute(delete(AnswerRecord))
    logger.info("已删除答题记录")
    await db.execute(delete(ExamRecord))
    logger.info("已删除考试记录")
    await db.execute(delete(Question))
    logger.info("已删除题目")
    await db.execute(text("UPDATE exam_papers SET question_count = 0"))
    logger.info("已重置试卷题目计数")
    await db.commit()


async def reset_and_rescan(db: AsyncSession) -> dict:
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
