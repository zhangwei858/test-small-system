const QuestionType = require('../models/QuestionType');

// 获取所有题型
exports.getTypes = async (req, res) => {
  try {
    const types = await QuestionType.findAll();
    res.json({
      code: 200,
      message: 'success',
      data: types
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取题型列表失败',
      error: error.message
    });
  }
};

// 获取单个题型
exports.getType = async (req, res) => {
  try {
    const type = await QuestionType.findById(req.params.id);

    if (!type) {
      return res.status(404).json({
        code: 404,
        message: '题型不存在'
      });
    }

    res.json({
      code: 200,
      message: 'success',
      data: type
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取题型信息失败',
      error: error.message
    });
  }
};