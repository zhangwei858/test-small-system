from __future__ import annotations
import logging
from datetime import datetime

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exam_record import ExamRecord
from app.models.answer_record import AnswerRecord
from app.models.question import Question
from app.models.wrong_answer import WrongAnswer
from app.schemas.exam import ExamStart, AnswerSubmit
from app.services import question_service

logger = logging.getLogger("exam_system")


async def start_exam(db: AsyncSession, data: ExamStart) -> dict:
    if not data.grade_id:
        return None

    filters = {"grade_id": data.grade_id, "limit": 100}
    if data.paper_id:
        filters["paper_id"] = data.paper_id
    if data.type_ids and len(data.type_ids) > 0:
        filters["type_ids"] = data.type_ids

    questions = await question_service.find_all(db, filters)
    if not questions:
        return None

    total_points = sum(q.get("points", 10) for q in questions)

    exam = ExamRecord(
        user_name=data.user_name,
        grade_id=data.grade_id,
        paper_id=data.paper_id,
        total_questions=len(questions),
        total_score=0,
    )
    db.add(exam)
    await db.commit()
    await db.refresh(exam)

    logger.info(f"开始考试: ID={exam.id}, 用户={data.user_name}, 年级={data.grade_id}, 题目数={len(questions)}")

    return {
        "exam_id": exam.id,
        "user_name": data.user_name,
        "grade_id": data.grade_id,
        "total_questions": len(questions),
        "total_points": total_points,
        "questions": questions,
    }


async def get_exam_status(db: AsyncSession, exam_id: int) -> dict | None:
    exam = await _find_exam_by_id(db, exam_id)
    if not exam:
        return None

    answers = await _find_answers_by_exam_id(db, exam_id)

    return {
        "exam": exam,
        "answers": answers,
        "answered_count": len(answers),
    }


async def submit_answer(db: AsyncSession, exam_id: int, question_id: int, user_answer: str) -> dict | None:
    q = await question_service.find_by_id(db, question_id)
    if not q:
        return None

    correct_answer = q["answer"].strip().upper()
    user_answer_upper = user_answer.strip().upper() if user_answer else ""
    is_correct = False
    points_earned = 0

    if correct_answer in ("正确", "错误"):
        expected = "A" if correct_answer == "正确" else "B"
        is_correct = expected == user_answer_upper
    elif len(correct_answer) == 1 and correct_answer in "ABCD":
        is_correct = correct_answer == user_answer_upper
    else:
        is_correct = correct_answer == user_answer_upper

    if is_correct:
        points_earned = q.get("points", 10)

    record = AnswerRecord(
        exam_id=exam_id,
        question_id=question_id,
        user_answer=user_answer,
        is_correct=is_correct,
        points_earned=points_earned,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return {
        "answerRecord": {
            "id": record.id,
            "exam_id": record.exam_id,
            "question_id": record.question_id,
            "user_answer": record.user_answer,
            "is_correct": record.is_correct,
            "points_earned": record.points_earned,
        },
        "is_correct": is_correct,
        "points_earned": points_earned,
        "total_points": q.get("points", 10),
    }


async def check_paper_already_perfect(db: AsyncSession, user_name: str, paper_id: int) -> dict:
    """检查用户在该试卷是否已经考过100分"""
    sql = text(
        "SELECT id, total_score, start_time FROM exam_records "
        "WHERE user_name = :uname AND paper_id = :pid AND status = 'completed' AND total_score = 100 "
        "ORDER BY start_time DESC LIMIT 1"
    )
    result = await db.execute(sql, {"uname": user_name, "pid": paper_id})
    row = result.mappings().first()
    if row:
        return {"already_perfect": True, "record": dict(row)}
    return {"already_perfect": False, "record": None}


async def submit_all_answers(db: AsyncSession, exam_id: int, answers: list[AnswerSubmit]) -> dict | None:
    exam = await _find_exam_by_id(db, exam_id)
    if not exam:
        return None

    correct_count = 0
    wrong_answers = []

    for item in answers:
        result = await submit_answer(db, exam_id, item.question_id, item.user_answer)
        if result and result["is_correct"]:
            correct_count += 1
        else:
            q = await question_service.find_by_id(db, item.question_id)
            if q:
                wrong_answers.append({
                    "question_id": item.question_id,
                    "content": q["content"],
                    "user_answer": item.user_answer,
                    "answer": q["answer"],
                    "points": q.get("points", 10),
                })

                wa = WrongAnswer(
                    user_name=exam["user_name"],
                    question_id=item.question_id,
                    user_answer=item.user_answer,
                )
                try:
                    db.add(wa)
                except Exception:
                    pass

    await db.commit()

    total_questions = exam["total_questions"]
    accuracy = round((correct_count / total_questions) * 100) if total_questions > 0 else 0
    total_score = accuracy
    is_perfect = total_score == 100

    can_lottery = is_perfect
    lottery_blocked_reason = None

    if is_perfect and exam.get("paper_id"):
        check_result = await check_paper_already_perfect(db, exam["user_name"], exam["paper_id"])
        if check_result["already_perfect"]:
            can_lottery = False
            lottery_blocked_reason = "该试卷之前已考过100分，本次不再获得抽奖机会"

    celebration = can_lottery

    completed = await _complete_exam(db, exam_id, total_score, correct_count)

    return {
        "exam": completed,
        "total_score": total_score,
        "correct_count": correct_count,
        "accuracy": accuracy,
        "wrong_answers": wrong_answers,
        "celebration": celebration,
        "can_lottery": can_lottery,
        "lottery_blocked_reason": lottery_blocked_reason,
        "grade_name": exam.get("grade_name"),
    }


async def complete_exam(db: AsyncSession, exam_id: int) -> dict | None:
    exam = await _find_exam_by_id(db, exam_id)
    if not exam:
        return None

    answers = await _find_answers_by_exam_id(db, exam_id)
    correct_count = sum(1 for a in answers if a.get("is_correct"))
    total_questions = exam["total_questions"]
    accuracy = round((correct_count / total_questions) * 100) if total_questions > 0 else 0
    total_score = accuracy
    wrong_answers_list = [a for a in answers if not a.get("is_correct")]

    if exam["status"] == "completed":
        return {
            "exam": exam,
            "total_score": total_score,
            "correct_count": correct_count,
            "accuracy": accuracy,
            "celebration": total_score == 100,
            "grade_name": exam.get("grade_name"),
            "wrong_answers": wrong_answers_list,
        }

    completed = await _complete_exam(db, exam_id, total_score, correct_count)

    return {
        "exam": completed,
        "total_score": total_score,
        "correct_count": correct_count,
        "accuracy": accuracy,
        "celebration": total_score == 100,
        "grade_name": exam.get("grade_name"),
        "wrong_answers": wrong_answers_list,
    }


async def get_exam_history(db: AsyncSession, user_name: str) -> list[dict]:
    sql = text(
        "SELECT er.*, g.name as grade_name, "
        "CASE WHEN er.total_questions > 0 THEN ROUND((CAST(er.correct_count AS REAL) / CAST(er.total_questions AS REAL)) * 100) ELSE 0 END as accuracy "
        "FROM exam_records er LEFT JOIN grades g ON er.grade_id = g.id "
        "WHERE er.user_name = :uname ORDER BY er.start_time DESC"
    )
    result = await db.execute(sql, {"uname": user_name})
    return [dict(row) for row in result.mappings().all()]


async def get_all_exam_history(db: AsyncSession) -> list[dict]:
    sql = text(
        "SELECT er.*, g.name as grade_name, "
        "CASE WHEN er.total_questions > 0 THEN ROUND((CAST(er.correct_count AS REAL) / CAST(er.total_questions AS REAL)) * 100) ELSE 0 END as accuracy "
        "FROM exam_records er LEFT JOIN grades g ON er.grade_id = g.id "
        "WHERE er.status = 'completed' ORDER BY er.start_time DESC"
    )
    result = await db.execute(sql)
    return [dict(row) for row in result.mappings().all()]


async def get_exam_details(db: AsyncSession, exam_id: int) -> dict | None:
    exam = await _find_exam_by_id(db, exam_id)
    if not exam:
        return None

    answers = await _find_answers_by_exam_id(db, exam_id)

    grouped_questions = {}
    for a in answers:
        q = await question_service.find_by_id(db, a.get("question_id"))
        if q:
            type_name = q.get("type_name", "未分类")
            if type_name not in grouped_questions:
                grouped_questions[type_name] = []
            grouped_questions[type_name].append({
                **q,
                "is_correct": a.get("is_correct"),
                "user_answer": a.get("user_answer"),
            })

    return {
        "exam": exam,
        "answers": answers,
        "grouped_questions": grouped_questions,
    }


async def _find_exam_by_id(db: AsyncSession, exam_id: int) -> dict | None:
    sql = text(
        "SELECT er.*, g.name as grade_name FROM exam_records er "
        "LEFT JOIN grades g ON er.grade_id = g.id WHERE er.id = :eid"
    )
    result = await db.execute(sql, {"eid": exam_id})
    row = result.mappings().first()
    return dict(row) if row else None


async def _find_answers_by_exam_id(db: AsyncSession, exam_id: int) -> list[dict]:
    sql = text(
        "SELECT ar.*, q.content, q.options, q.answer, q.points "
        "FROM answer_records ar JOIN questions q ON ar.question_id = q.id "
        "WHERE ar.exam_id = :eid ORDER BY ar.id"
    )
    result = await db.execute(sql, {"eid": exam_id})
    return [dict(row) for row in result.mappings().all()]


async def _complete_exam(db: AsyncSession, exam_id: int, total_score: int, correct_count: int) -> dict:
    sql = text(
        "UPDATE exam_records SET total_score = :score, correct_count = :correct, "
        "end_time = CURRENT_TIMESTAMP, status = 'completed' WHERE id = :eid"
    )
    await db.execute(sql, {"score": total_score, "correct": correct_count, "eid": exam_id})
    await db.commit()
    return await _find_exam_by_id(db, exam_id)
