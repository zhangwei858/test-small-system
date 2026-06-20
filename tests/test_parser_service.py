"""parser_service 的 TDD 测试。

按照 TDD 原则：先写测试，看测试失败，再修复代码。
这些测试复现了用户报告的 bug：
1. 计算题/填空题有的不能输入答案（答案解析丢失）
2. 无题号的计算题被跳过
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from app.services import parser_service


# ===== Bug 1: 填空题括号不在末尾时答案丢失 =====

def test_fill_blank_with_trailing_text_after_paren():
    """填空题括号后有文字时，答案应被正确提取。

    题库原文: `1. 3年 = ( 36 )个月`
    期望: answer == "36"
    """
    content = "一、填空题。\n\n1. 3年 = ( 36 )个月\n"
    questions = parser_service.parse(content, grade_id=2, type_id=2)
    assert len(questions) == 1
    assert questions[0].answer == "36", f"期望答案 '36'，实际 '{questions[0].answer}'"


def test_fill_blank_with_text_after_paren_2():
    """另一个括号后有文字的填空题。

    题库原文: `2. 2平方米 = ( 200 )平方分米`
    期望: answer == "200"
    """
    content = "一、填空题。\n\n2. 2平方米 = ( 200 )平方分米\n"
    questions = parser_service.parse(content, grade_id=2, type_id=2)
    assert len(questions) == 1
    assert questions[0].answer == "200"


def test_fill_blank_with_arrow_answer_format():
    """带 `→ 答案：X` 格式的填空题。

    题库原文: `1. 4 + ( 5 ) = 9    → 答案：5`
    期望: answer == "5"
    """
    content = "四、填空题。\n\n1. 4 + ( 5 ) = 9    → 答案：5\n"
    questions = parser_service.parse(content, grade_id=1, type_id=2)
    assert len(questions) == 1
    assert questions[0].answer == "5", f"期望答案 '5'，实际 '{questions[0].answer}'"


def test_fill_blank_multiple_blanks():
    """多空填空题应至少提取第一个答案。

    题库原文: `6. 一个长方形的长是8米，宽是4米，面积是 ( 32 )平方米，周长是 ( 24 )米`
    期望: answer 包含 "32"（至少提取第一个空）
    """
    content = "四、填空题。\n\n6. 一个长方形的长是8米，宽是4米，面积是 ( 32 )平方米，周长是 ( 24 )米\n"
    questions = parser_service.parse(content, grade_id=2, type_id=2)
    assert len(questions) == 1
    assert "32" in questions[0].answer, f"期望答案包含 '32'，实际 '{questions[0].answer}'"


# ===== Bug 2: 无题号的计算题被跳过 =====

def test_calc_questions_without_number_prefix():
    """无题号的计算题应被正确解析。

    题库原文（三年级考试3.txt）:
    ```
    一、口算。（每题1分，共20分）

    25 × 2 = 50
    25 × 4 = 100
    ```
    期望: 解析出 2 道题，答案分别是 "50" 和 "100"
    """
    content = """数学计算练习卷

一、口算。（每题1分，共20分）

25 × 2 = 50
25 × 4 = 100
"""
    questions = parser_service.parse(content, grade_id=2)
    assert len(questions) == 2, f"期望 2 道题，实际 {len(questions)} 道"
    assert questions[0].answer == "50", f"第1题答案期望 '50'，实际 '{questions[0].answer}'"
    assert questions[1].answer == "100", f"第2题答案期望 '100'，实际 '{questions[1].answer}'"


# ===== 回归测试：确保原有功能不被破坏 =====

def test_calc_question_with_paren_answer():
    """计算题括号在末尾的格式应继续工作。

    题库原文: `1. 125 + 25 × 6 = ( 275 )`
    期望: answer == "275"
    """
    content = "一、脱式计算。\n\n1. 125 + 25 × 6 = ( 275 )\n"
    questions = parser_service.parse(content, grade_id=2, type_id=7)
    assert len(questions) == 1
    assert questions[0].answer == "275"


def test_calc_question_with_equals_answer():
    """计算题 `= 答案` 格式应继续工作。

    题库原文: `1. 25 × 16 = 400`
    期望: answer == "400"
    """
    content = "一、直接写得数。\n\n1. 25 × 16 = 400\n"
    questions = parser_service.parse(content, grade_id=2, type_id=7)
    assert len(questions) == 1
    assert questions[0].answer == "400"


def test_choice_question_still_works():
    """选择题应继续正常解析。"""
    content = """一、选择题。

1. 下面哪个算式正确？
   A. 1+1=3
   B. 2+2=4
   C. 3+3=5
   答案：B
"""
    questions = parser_service.parse(content, grade_id=1)
    assert len(questions) == 1
    assert questions[0].answer == "B"
    assert questions[0].options is not None
    assert len(questions[0].options) == 3


def test_judge_question_still_works():
    """判断题应继续正常解析。"""
    content = """三、判断题。

1. 太阳从西边升起。（ × ）
2. 3 + 6 = 9。（ √ ）
"""
    questions = parser_service.parse(content, grade_id=1)
    assert len(questions) == 2
    assert questions[0].answer == "×"
    assert questions[1].answer == "√"


# ===== 真实题库文件测试 =====

def test_real_file_sanjiniankaoshi1_fill_blanks():
    """三年级考试题1.txt 的填空题部分应正确解析答案。"""
    bank_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "题库")
    file_path = os.path.join(bank_dir, "三年级考试题1.txt")
    if not os.path.exists(file_path):
        pytest.skip("题库文件不存在")

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    questions = parser_service.parse(content, grade_id=2)
    fill_blank_questions = [q for q in questions if q.type_id == 2]

    # 填空题应该有答案（不是空字符串）
    empty_answer_count = sum(1 for q in fill_blank_questions if not q.answer)
    assert empty_answer_count == 0, (
        f"有 {empty_answer_count} 道填空题答案为空，"
        f"空答案题目: {[(q.content[:30], q.answer) for q in fill_blank_questions if not q.answer]}"
    )


def test_real_file_sanjiniankaoshi3_questions_not_empty():
    """三年级考试3.txt 应解析出题目（不是 0 道）。"""
    bank_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "题库")
    file_path = os.path.join(bank_dir, "三年级考试3.txt")
    if not os.path.exists(file_path):
        pytest.skip("题库文件不存在")

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    questions = parser_service.parse(content, grade_id=2)
    assert len(questions) > 0, "三年级考试3.txt 应解析出题目，但实际为 0 道"
    # 每道题都应该有答案
    for i, q in enumerate(questions):
        assert q.answer, f"第 {i+1} 题答案为空: {q.content[:30]}"


# ===== Bug 4: 章节标题"数学部分：连加"未被识别为计算题 =====

def test_math_section_with_lianjia_detected_as_calc():
    """章节标题包含'连加'应识别为计算题，且括号答案应被提取。

    题库原文: `一、数学部分：20以内三个数连加（每题5分，共50分）`
    题目: `1. 2 + 3 + 4 = ( 9 )`
    期望: type_id == 7, answer == "9"
    """
    content = """一、数学部分：20以内三个数连加（每题5分，共50分）

1. 2 + 3 + 4 = ( 9 )
2. 1 + 2 + 5 = ( 8 )
"""
    questions = parser_service.parse(content, grade_id=1)
    assert len(questions) == 2
    assert questions[0].type_id == 7, f"应为计算题(7)，实际为 {questions[0].type_id}"
    assert questions[0].answer == "9", f"答案应为'9'，实际为 '{questions[0].answer}'"
    assert questions[1].answer == "8"


def test_real_file_youer_yuan_kaoshi2_calc_questions():
    """幼儿园考试题2.txt 的数学部分应正确解析为计算题且有答案。"""
    bank_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "题库")
    file_path = os.path.join(bank_dir, "幼儿园考试题2.txt")
    if not os.path.exists(file_path):
        pytest.skip("题库文件不存在")

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    questions = parser_service.parse(content, grade_id=1)
    # 应该解析出数学计算题（type_id=7）
    calc_questions = [q for q in questions if q.type_id == 7]
    assert len(calc_questions) >= 10, f"应至少有 10 道计算题，实际 {len(calc_questions)} 道"

    # 所有计算题都应该有答案
    for i, q in enumerate(calc_questions):
        assert q.answer, f"第 {i+1} 道计算题答案为空: {q.content[:30]}"
