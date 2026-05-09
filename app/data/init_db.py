from __future__ import annotations
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.config.database import engine, AsyncSessionLocal
from app.config.settings import settings
from app.config.logger import logger
from app.models.grade import Grade
from app.models.question_type import QuestionType
from app.models.prize import Prize
from app.models.user import User
from app.models.exam_paper import ExamPaper
from app.models.question import Question
from app.models.answer_record import AnswerRecord
from app.models.exam_record import ExamRecord
from app.models.wrong_answer import WrongAnswer
from app.models.lottery_record import LotteryRecord
from sqlalchemy import text, select, func


async def init_tables():
    from app.config.database import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("数据库表创建/确认完成")


async def seed_grades(db):
    result = await db.execute(select(func.count()).select_from(Grade))
    if result.scalar() > 0:
        logger.info("年级数据已存在，跳过")
        return
    grades = [
        Grade(id=1, name="低年级（1-2年级）", level="low"),
        Grade(id=2, name="中年级（3-4年级）", level="middle"),
        Grade(id=3, name="高年级（5-6年级）", level="high"),
    ]
    db.add_all(grades)
    await db.commit()
    logger.info("年级数据初始化完成")


async def seed_question_types(db):
    result = await db.execute(select(func.count()).select_from(QuestionType))
    if result.scalar() > 0:
        logger.info("题型数据已存在，跳过")
        return
    types = [
        QuestionType(id=1, name="选择题"),
        QuestionType(id=2, name="填空题"),
        QuestionType(id=3, name="判断题"),
        QuestionType(id=4, name="计算题"),
    ]
    db.add_all(types)
    await db.commit()
    logger.info("题型数据初始化完成")


async def seed_prizes(db):
    result = await db.execute(select(func.count()).select_from(Prize))
    if result.scalar() > 0:
        logger.info("奖项数据已存在，跳过")
        return
    prizes = [
        Prize(name="2元钱", emoji="💰", color="#ef4444", base_probability=14.29, is_default=False),
        Prize(name="1元钱", emoji="💵", color="#f59e0b", base_probability=14.29, is_default=False),
        Prize(name="游乐场一次", emoji="🎡", color="#10b981", base_probability=14.29, is_default=False),
        Prize(name="火锅一次", emoji="🍲", color="#6366f1", base_probability=14.29, is_default=False),
        Prize(name="一个西瓜", emoji="🍉", color="#22c55e", base_probability=14.29, is_default=False),
        Prize(name="看爸爸手机0分钟", emoji="📱", color="#8b5cf6", base_probability=14.29, is_default=False),
        Prize(name="谢谢惠顾", emoji="🎁", color="#6b7280", base_probability=14.25, is_default=True),
    ]
    db.add_all(prizes)
    await db.commit()
    logger.info("奖项数据初始化完成（原始配置）")


async def seed_users(db):
    result = await db.execute(select(func.count()).select_from(User))
    if result.scalar() > 0:
        logger.info("用户数据已存在，跳过")
        return
    users = [
        User(username="张伟", role="admin"),
        User(username="张洛琳", role="examiner"),
        User(username="张洛晗", role="examiner"),
    ]
    db.add_all(users)
    await db.commit()
    logger.info("用户数据初始化完成")


async def main():
    logger.info("开始数据库初始化（PostgreSQL - kaoshiku）...")

    await init_tables()

    async with AsyncSessionLocal() as db:
        await seed_grades(db)
        await seed_question_types(db)
        await seed_prizes(db)
        await seed_users(db)

    logger.info("数据库初始化完成！已有数据不受影响。")


if __name__ == "__main__":
    asyncio.run(main())
