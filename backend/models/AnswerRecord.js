const { query } = require('../config/database');

class AnswerRecord {
  static async findByExamId(examId) {
    const result = await query(
      'SELECT ar.*, q.content, q.options, q.answer, q.points ' +
      'FROM answer_records ar ' +
      'JOIN questions q ON ar.question_id = q.id ' +
      'WHERE ar.exam_id = $1 ORDER BY ar.id',
      [examId]
    );
    return result.rows;
  }

  static async submitAnswer(examId, questionId, userAnswer) {
    const questionResult = await query('SELECT * FROM questions WHERE id = $1', [questionId]);
    const question = questionResult.rows[0];

    if (!question) {
      throw new Error('题目不存在');
    }

    let isCorrect = false;
    let pointsEarned = 0;

    // 判断答案
    const correctAnswer = question.answer.trim().toUpperCase();
    const userAnswerUpper = userAnswer ? userAnswer.trim().toUpperCase() : '';

    if (correctAnswer === '正确' || correctAnswer === '错误') {
      // 判断题 - 用户提交的是 A/B，需要转换
      let expectedAnswer = '';
      if (correctAnswer === '正确') {
        expectedAnswer = 'A';
      } else if (correctAnswer === '错误') {
        expectedAnswer = 'B';
      }
      isCorrect = expectedAnswer === userAnswerUpper;
    } else if (/^[A-D]$/.test(correctAnswer)) {
      // 选择题 - 答案是字母 A-D
      isCorrect = correctAnswer === userAnswerUpper;
    } else {
      // 填空题 - 答案是具体内容
      isCorrect = correctAnswer === userAnswerUpper;
    }

    // 计算得分
    if (isCorrect) {
      pointsEarned = question.points;
    }

    const result = await query(
      'INSERT INTO answer_records (exam_id, question_id, user_answer, is_correct, points_earned) ' +
      'VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [examId, questionId, userAnswer, isCorrect, pointsEarned]
    );

    return {
      answerRecord: result.rows[0],
      is_correct: isCorrect,
      points_earned: pointsEarned,
      total_points: question.points
    };
  }
}

module.exports = AnswerRecord;