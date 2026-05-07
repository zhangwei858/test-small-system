const express = require('express');
const router = express.Router();
const ExamPaper = require('../models/ExamPaper');

router.get('/', async (req, res) => {
  try {
    const papers = await ExamPaper.findAll();
    res.json({
      code: 200,
      message: 'success',
      data: papers
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取试卷列表失败',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const paper = await ExamPaper.findById(req.params.id);
    if (!paper) {
      return res.status(404).json({
        code: 404,
        message: '试卷不存在'
      });
    }
    res.json({
      code: 200,
      message: 'success',
      data: paper
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取试卷失败',
      error: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const paper = await ExamPaper.delete(req.params.id);
    if (!paper) {
      return res.status(404).json({
        code: 404,
        message: '试卷不存在'
      });
    }
    res.json({
      code: 200,
      message: '试卷删除成功',
      data: paper
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '删除试卷失败',
      error: error.message
    });
  }
});

module.exports = router;
