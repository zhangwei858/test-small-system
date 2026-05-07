const Grade = require('../models/Grade');
const { query } = require('../config/database');

// 获取所有年级
exports.getGrades = async (req, res) => {
  try {
    const result = await query(
      'SELECT g.*, COALESCE(SUM(ep.question_count), 0) as total_questions FROM grades g LEFT JOIN exam_papers ep ON g.id = ep.grade_id GROUP BY g.id ORDER BY g.id'
    );
    res.json({
      code: 200,
      message: 'success',
      data: result.rows
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取年级列表失败',
      error: error.message
    });
  }
};

// 获取单个年级
exports.getGrade = async (req, res) => {
  try {
    const grade = await Grade.findById(req.params.id);

    if (!grade) {
      return res.status(404).json({
        code: 404,
        message: '年级不存在'
      });
    }

    res.json({
      code: 200,
      message: 'success',
      data: grade
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取年级信息失败',
      error: error.message
    });
  }
};