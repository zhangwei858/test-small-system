const ExamRecord = require('../models/ExamRecord');
const AnswerRecord = require('../models/AnswerRecord');
const Question = require('../models/Question');
const { query } = require('../config/database');

exports.startExam = async (req, res) => {
  try {
    const { grade_id, user_name = '匿名用户', paper_id = null, type_ids = null } = req.body;

    if (!grade_id) {
      return res.status(400).json({
        code: 400,
        message: '请选择年级'
      });
    }

    const filters = { grade_id, limit: 100 };
    if (paper_id) {
      filters.paper_id = paper_id;
    }
    if (type_ids && type_ids.length > 0) {
      filters.type_ids = type_ids;
    }

    const questions = await Question.findAll(filters);

    if (questions.length === 0) {
      return res.status(400).json({
        code: 400,
        message: '该年级暂无符合条件的题目，请先导入题目'
      });
    }

    const total_points = questions.reduce((sum, q) => sum + (q.points || 10), 0);

    const exam = await ExamRecord.create({
      user_name,
      grade_id,
      questions,
      total_points
    });

    res.json({
      code: 200,
      message: '考试开始成功',
      data: {
        exam_id: exam.id,
        user_name,
        grade_id,
        total_questions: questions.length,
        total_points: total_points,
        questions
      }
    });
  } catch (error) {
    console.error('开始考试失败:', error);
    res.status(500).json({
      code: 500,
      message: '开始考试失败',
      error: error.message
    });
  }
};

exports.getExamStatus = async (req, res) => {
  try {
    const examId = req.params.examId;
    const exam = await ExamRecord.findById(examId);

    if (!exam) {
      return res.status(404).json({
        code: 404,
        message: '考试不存在'
      });
    }

    const answers = await AnswerRecord.findByExamId(examId);

    res.json({
      code: 200,
      message: 'success',
      data: {
        exam,
        answers,
        answered_count: answers.length
      }
    });
  } catch (error) {
    console.error('获取考试状态失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取考试状态失败',
      error: error.message
    });
  }
};

exports.submitAnswer = async (req, res) => {
  try {
    const examId = req.params.examId;
    const { question_id, user_answer } = req.body;

    if (!question_id || user_answer === undefined) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数'
      });
    }

    const result = await AnswerRecord.submitAnswer(examId, question_id, user_answer);

    res.json({
      code: 200,
      message: '答案提交成功',
      data: result
    });
  } catch (error) {
    console.error('提交答案失败:', error);
    res.status(500).json({
      code: 500,
      message: '提交答案失败',
      error: error.message
    });
  }
};

exports.getAnswer = async (req, res) => {
  try {
    const examId = req.params.examId;
    const questionId = req.params.questionId;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({
        code: 404,
        message: '题目不存在'
      });
    }

    const answers = await AnswerRecord.findByExamId(examId);
    const userAnswer = answers.find(a => a.question_id == questionId);

    res.json({
      code: 200,
      message: 'success',
      data: {
        question,
        user_answer: userAnswer ? userAnswer.user_answer : null,
        is_correct: userAnswer ? userAnswer.is_correct : null,
        points_earned: userAnswer ? userAnswer.points_earned : 0
      }
    });
  } catch (error) {
    console.error('获取答案失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取答案失败',
      error: error.message
    });
  }
};

exports.submitAllAnswers = async (req, res) => {
  try {
    const examId = req.params.examId;
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        code: 400,
        message: '缺少答案数据'
      });
    }

    const exam = await ExamRecord.findById(examId);
    if (!exam) {
      return res.status(404).json({
        code: 404,
        message: '考试不存在'
      });
    }

    let correctCount = 0;
    const wrongAnswers = [];

    for (const item of answers) {
      const result = await AnswerRecord.submitAnswer(examId, item.question_id, item.answer);
      if (result.is_correct) {
        correctCount++;
      } else {
        const question = await Question.findById(item.question_id);
        if (question) {
          wrongAnswers.push({
            question_id: item.question_id,
            content: question.content,
            user_answer: item.answer,
            answer: question.answer,
            points: question.points
          });

          await query(
            'INSERT INTO wrong_answers (user_name, question_id, user_answer) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [exam.user_name, item.question_id, item.answer]
          );
        }
      }
    }

    const accuracy = exam.total_questions > 0 ? Math.round((correctCount / exam.total_questions) * 100) : 0;
    const totalScore = accuracy;
    const celebration = totalScore === 100;

    const completedExam = await ExamRecord.completeExam(examId, {
      total_score: totalScore,
      correct_count: correctCount
    });

    res.json({
      code: 200,
      message: '答案提交成功',
      data: {
        exam: completedExam,
        total_score: totalScore,
        correct_count: correctCount,
        accuracy: accuracy,
        wrong_answers: wrongAnswers,
        celebration,
        grade_name: exam.grade_name
      }
    });
  } catch (error) {
    console.error('批量提交答案失败:', error);
    res.status(500).json({
      code: 500,
      message: '批量提交答案失败',
      error: error.message
    });
  }
};

exports.completeExam = async (req, res) => {
  try {
    const examId = req.params.examId;
    const exam = await ExamRecord.findById(examId);

    if (!exam) {
      return res.status(404).json({
        code: 404,
        message: '考试不存在'
      });
    }

    const answers = await AnswerRecord.findByExamId(examId);
    const correctCount = answers.filter(a => a.is_correct).length;
    const accuracy = exam.total_questions > 0 ? Math.round((correctCount / exam.total_questions) * 100) : 0;
    const totalScore = accuracy;
    const wrongAnswers = answers.filter(a => !a.is_correct);

    if (exam.status === 'completed') {
      return res.json({
        code: 200,
        message: '考试已完成',
        data: {
          exam,
          total_score: totalScore,
          correct_count: correctCount,
          accuracy: accuracy,
          celebration: totalScore === 100,
          grade_name: exam.grade_name,
          wrong_answers: wrongAnswers
        }
      });
    }

    const completedExam = await ExamRecord.completeExam(examId, {
      total_score: totalScore,
      correct_count: correctCount
    });

    const celebration = totalScore === 100;

    res.json({
      code: 200,
      message: '考试完成',
      data: {
        exam: completedExam,
        total_score: totalScore,
        correct_count: correctCount,
        accuracy: accuracy,
        celebration,
        grade_name: exam.grade_name,
        wrong_answers: wrongAnswers
      }
    });
  } catch (error) {
    console.error('完成考试失败:', error);
    res.status(500).json({
      code: 500,
      message: '完成考试失败',
      error: error.message
    });
  }
};

exports.getExamHistory = async (req, res) => {
  try {
    const { user_name } = req.query;

    if (!user_name) {
      return res.status(400).json({
        code: 400,
        message: '请提供用户名'
      });
    }

    const exams = await ExamRecord.findByUserName(user_name);

    res.json({
      code: 200,
      message: 'success',
      data: exams
    });
  } catch (error) {
    console.error('获取考试历史失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取考试历史失败',
      error: error.message
    });
  }
};

exports.getAllExamHistory = async (req, res) => {
  try {
    const exams = await ExamRecord.findAll();

    res.json({
      code: 200,
      message: 'success',
      data: exams
    });
  } catch (error) {
    console.error('获取所有考试历史失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取所有考试历史失败',
      error: error.message
    });
  }
};

exports.getExamDetails = async (req, res) => {
  try {
    const examId = req.params.examId;
    
    const exam = await ExamRecord.findById(examId);
    if (!exam) {
      return res.status(404).json({
        code: 404,
        message: '考试记录不存在'
      });
    }

    const answers = await AnswerRecord.findByExamId(examId);
    
    const questions = await Question.find({ exam_id: examId });
    const questionsWithAnswers = questions.map(q => {
      const answer = answers.find(a => a.question_id.toString() === q._id.toString());
      return {
        ...q.toObject(),
        user_answer: answer ? answer.user_answer : null,
        is_correct: answer ? answer.is_correct : false
      };
    });

    const groupedQuestions = questionsWithAnswers.reduce((acc, q) => {
      const type = q.type || '其他';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(q);
      return acc;
    }, {});
    
    res.json({
      code: 200,
      message: 'success',
      data: {
        exam,
        answers: questionsWithAnswers,
        questions: questionsWithAnswers,
        grouped_questions: groupedQuestions
      }
    });
  } catch (error) {
    console.error('获取考试详情失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取考试详情失败',
      error: error.message
    });
  }
};
