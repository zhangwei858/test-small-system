from __future__ import annotations
import json
import logging
import re

from app.schemas.question import QuestionCreate

logger = logging.getLogger("exam_system")


def parse(content: str, grade_id: int | None = None, type_id: int | None = None) -> list[QuestionCreate]:
    logger.info(f"[parse] 内容长度: {len(content)}, 指定年级ID: {grade_id}, 指定题型ID: {type_id}")
    if "=== 题目开始 ===" in content:
        logger.info("[parse] 使用结构化格式解析")
        return _parse_structured(content, grade_id, type_id)
    if _is_reading_comprehension(content):
        logger.info("[parse] 检测到阅读理解格式")
        return _parse_reading(content, grade_id, type_id)
    logger.info("[parse] 使用自然格式解析")
    return _parse_natural(content, grade_id, type_id)


def _clean_answer(raw: str) -> str:
    text = raw.strip()
    before_paren = re.split(r'[（(]', text)[0].strip()
    if before_paren:
        return before_paren
    letter_match = re.search(r'[A-Da-d]+', text)
    if letter_match:
        return letter_match.group(0).upper()
    return text


def _detect_grade_id(content: str, specified: int | None = None) -> int:
    if specified:
        return specified
    if any(kw in content for kw in ["幼儿园", "幼升小", "低年级"]):
        return 1
    if any(kw in content for kw in ["三年级", "中年级"]):
        return 2
    if any(kw in content for kw in ["高年级", "五年级", "六年级"]):
        return 3
    return 2


def _is_reading_comprehension(content: str) -> bool:
    has_long_sep = bool(re.search(r"_{10,}", content))
    has_reading_kw = "阅读" in content and ("短文" in content or "回答问题" in content or "阅读理解" in content)
    has_choice = "选择题" in content
    return has_long_sep and has_reading_kw and has_choice


def _parse_structured(content: str, grade_id: int | None = None, type_id: int | None = None) -> list[QuestionCreate]:
    questions = []
    blocks = re.split(r"=== 题目开始 ===", content)

    for block in blocks[1:]:
        if "=== 题目结束 ===" not in block:
            continue
        block_content = block.split("=== 题目结束 ===")[0]

        q_grade_id = grade_id
        q_type_id = type_id
        q_content = ""
        q_options = None
        q_answer = ""
        q_points = 10

        grade_match = re.search(r"年级[：:]\s*(.+)", block_content)
        if grade_match and not grade_id:
            grade_text = grade_match.group(1).strip()
            if any(kw in grade_text for kw in ["幼儿园", "幼升小", "低年级"]):
                q_grade_id = 1
            elif any(kw in grade_text for kw in ["三年级", "中年级"]):
                q_grade_id = 2
            elif any(kw in grade_text for kw in ["高年级", "五年级", "六年级"]):
                q_grade_id = 3
            else:
                q_grade_id = 2

        type_match = re.search(r"题型[：:]\s*(.+)", block_content)
        if type_match and not type_id:
            type_text = type_match.group(1).strip()
            type_map = {"选择题": 1, "填空题": 2, "判断题": 3, "计算题": 7}
            q_type_id = type_map.get(type_text, 1)

        points_match = re.search(r"分值[：:]\s*(\d+)", block_content)
        if points_match:
            q_points = int(points_match.group(1))

        content_match = re.search(r"题目[：:]\s*(.+?)(?=\n(?:选项|正确答案|题型|年级|分值|题目编号)|$)", block_content, re.DOTALL)
        if content_match:
            q_content = content_match.group(1).strip()

        options_section = re.search(r"选项[：:]\s*\n(.+?)(?=\n正确答案|\n题型|\n题目编号|$)", block_content, re.DOTALL)
        if options_section:
            opt_lines = [l.strip() for l in options_section.group(1).strip().split("\n") if l.strip()]
            q_options = opt_lines

        answer_match = re.search(r"正确答案[：:]\s*(.+)", block_content)
        if answer_match:
            q_answer = answer_match.group(1).strip()

        if q_content and q_answer:
            questions.append(QuestionCreate(
                grade_id=q_grade_id or 2,
                type_id=q_type_id or 1,
                content=q_content,
                options=q_options,
                answer=q_answer,
                points=q_points,
            ))

    return questions


def _parse_reading(content: str, specified_grade_id: int | None = None, specified_type_id: int | None = None) -> list[QuestionCreate]:
    questions = []
    grade_id = _detect_grade_id(content, specified_grade_id)

    points_match = re.search(r"每题(\d+)分", content)
    section_points = int(points_match.group(1)) if points_match else 20

    lines = content.split("\n")
    long_sep_lines = []
    for i, line in enumerate(lines):
        if re.match(r"^_{10,}$", line.strip()):
            long_sep_lines.append(i)

    reading_content = ""
    reading_title = ""

    if len(long_sep_lines) >= 2:
        start_line = long_sep_lines[0]
        end_line = long_sep_lines[1]
        passage_lines = lines[start_line + 1:end_line]

        for pl in passage_lines:
            trimmed = pl.strip()
            if trimmed and not trimmed.startswith("　") and not trimmed.startswith(" ") and len(trimmed) < 20 and "。" not in trimmed and "，" not in trimmed:
                reading_title = trimmed
                break

        reading_content = "\n".join(passage_lines).strip()
        reading_content = re.sub(r"\n{3,}", "\n\n", reading_content)
        logger.info(f"[阅读理解] 提取标题: '{reading_title}', 内容长度: {len(reading_content)}")

    choice_idx = content.find("选择题")
    if choice_idx == -1:
        logger.info("[阅读理解] 未找到选择题部分")
        return questions

    choice_content = content[choice_idx:]
    choice_lines = choice_content.split("\n")

    pending_question = None
    pending_options = []
    pending_answer = None

    for line in choice_lines:
        line = line.strip()
        if not line or line.startswith('——'):
            continue
        if line.startswith("选择题") or line.startswith("——"):
            continue

        num_match = re.match(r"^(\d+)\s*[.、．]\s*(.+)", line)
        if num_match:
            if pending_question:
                answer = pending_answer or ""
                questions.append(QuestionCreate(
                    grade_id=grade_id,
                    type_id=specified_type_id or 1,
                    content=pending_question,
                    options=pending_options if pending_options else None,
                    answer=answer,
                    points=section_points,
                    reading_content=reading_content,
                    reading_title=reading_title,
                ))
            pending_question = num_match.group(2).strip()
            pending_options = []
            pending_answer = None
            continue

        opt_match = re.match(r"^([A-Da-d])\s*[.、．:：]\s*(.+)", line)
        if opt_match:
            opt_positions = [(m.start(), m.group(1).upper()) for m in re.finditer(r'([A-Da-d])\s*[.、．:：]', line)]
            if len(opt_positions) >= 2:
                for i, (pos, letter) in enumerate(opt_positions):
                    end = opt_positions[i + 1][0] if i + 1 < len(opt_positions) else len(line)
                    text = line[pos:end]
                    text = re.sub(r'^[A-Da-d]\s*[.、．:：]\s*', '', text).strip()
                    pending_options.append(f"{letter}. {text}")
            else:
                pending_options.append(f"{opt_match.group(1).upper()}. {opt_match.group(2).strip()}")
            continue

        ans_match = re.match(r"^(?:答案|正确答案)[：:]\s*(.+)", line)
        if ans_match:
            pending_answer = _clean_answer(ans_match.group(1))
            continue

        if pending_question and not pending_options:
            pending_question += " " + line

    if pending_question:
        questions.append(QuestionCreate(
            grade_id=grade_id,
            type_id=specified_type_id or 1,
            content=pending_question,
            options=pending_options if pending_options else None,
            answer=pending_answer or "",
            points=section_points,
            reading_content=reading_content,
            reading_title=reading_title,
        ))

    return questions


def _parse_natural(content: str, specified_grade_id: int | None = None, specified_type_id: int | None = None) -> list[QuestionCreate]:
    questions = []
    grade_id = _detect_grade_id(content, specified_grade_id)

    lines = content.split("\n")
    pending_question = None
    pending_options = []
    pending_answer = None
    pending_type_id = specified_type_id or 1
    pending_points = 10

    for line in lines:
        line = line.strip()
        if not line or line.startswith('——'):
            continue

        points_match = re.match(r"^每题(\d+)分", line)
        if points_match:
            pending_points = int(points_match.group(1))
            continue

        section_match = re.match(r'^[一二三四五六七八九十]+[、.．]\s*(.+)', line)
        if section_match:
            section_title = section_match.group(1)
            if any(kw in section_title for kw in ['计算', '口算', '写得数', '竖式', '脱式', '直接']):
                pending_type_id = specified_type_id or 7
            elif '选择' in section_title:
                pending_type_id = specified_type_id or 1
            elif '判断' in section_title:
                pending_type_id = specified_type_id or 3
            elif any(kw in section_title for kw in ['填空', '填一填']):
                pending_type_id = specified_type_id or 2
            sp_match = re.search(r'每题(\d+)分', section_title)
            if sp_match:
                pending_points = int(sp_match.group(1))
            continue

        num_match = re.match(r"^(\d+)\s*[.、．]\s*(.+)", line)
        if num_match:
            if pending_question:
                questions.append(QuestionCreate(
                    grade_id=grade_id,
                    type_id=pending_type_id,
                    content=pending_question,
                    options=pending_options if pending_options else None,
                    answer=pending_answer or "",
                    points=pending_points,
                ))

            question_text = num_match.group(2).strip()
            pending_answer = None

            line_ans = re.search(r'[（(]\s*([^）)]+?)\s*[）)]\s*$', question_text)
            if line_ans:
                pending_answer = line_ans.group(1).strip()
                question_text = question_text[:line_ans.start()].strip()

            opt_matches = list(re.finditer(
                r'\b([A-D])\.\s*([^A-D]+?)(?=\s+[A-D]\.|\s*[（(]|$)',
                question_text
            ))
            if opt_matches:
                pending_options = [f"{m.group(1).upper()}. {m.group(2).strip()}" for m in opt_matches]
                question_text = question_text[:opt_matches[0].start()].strip()
            else:
                pending_options = []

            if "____" in question_text or "＿＿" in question_text or "___" in question_text:
                pending_type_id = specified_type_id or 2
            elif opt_matches:
                pending_type_id = specified_type_id or 1
            elif "（  ）" in question_text or "（）" in question_text or "(  )" in question_text or "()" in question_text:
                pending_type_id = specified_type_id or 2

            if not pending_answer and pending_type_id == 7:
                eq_match = re.search(r'=\s*(\S+)', question_text)
                if eq_match:
                    pending_answer = eq_match.group(1).strip()
                    question_text = re.sub(r'\s*=\s*\S+$', ' = ______', question_text).strip()

            pending_question = question_text
            continue

        opt_match = re.match(r"^([A-Da-d])\s*[.、．:：]\s*(.+)", line)
        if opt_match:
            opt_positions = [(m.start(), m.group(1).upper()) for m in re.finditer(r'([A-Da-d])\s*[.、．:：]', line)]
            if len(opt_positions) >= 2:
                for i, (pos, letter) in enumerate(opt_positions):
                    end = opt_positions[i + 1][0] if i + 1 < len(opt_positions) else len(line)
                    text = line[pos:end]
                    text = re.sub(r'^[A-Da-d]\s*[.、．:：]\s*', '', text).strip()
                    pending_options.append(f"{letter}. {text}")
            else:
                pending_options.append(f"{opt_match.group(1).upper()}. {opt_match.group(2).strip()}")
            continue

        ans_match = re.match(r"^(?:答案|正确答案)[：:]\s*(.+)", line)
        if ans_match:
            pending_answer = _clean_answer(ans_match.group(1))
            continue

        if pending_question and not pending_options and not re.match(r"^[A-Da-d]\s*[.、．]", line):
            if not pending_answer:
                pending_question += " " + line

    if pending_question:
        questions.append(QuestionCreate(
            grade_id=grade_id,
            type_id=pending_type_id,
            content=pending_question,
            options=pending_options if pending_options else None,
            answer=pending_answer or "",
            points=pending_points,
        ))

    return questions
