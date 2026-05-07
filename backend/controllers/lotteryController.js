const LotteryRecord = require('../models/LotteryRecord');
const ExamRecord = require('../models/ExamRecord');
const Prize = require('../models/Prize');

exports.drawLottery = async (req, res) => {
  try {
    const { exam_id, user_name } = req.body;

    if (!exam_id || !user_name) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数'
      });
    }

    const exam = await ExamRecord.findById(exam_id);
    if (!exam) {
      return res.status(404).json({
        code: 404,
        message: '考试不存在'
      });
    }

    if (exam.total_score < 100) {
      return res.status(400).json({
        code: 400,
        message: '只有满分考试才能抽奖'
      });
    }

    const existingRecords = await LotteryRecord.findByExamId(exam_id);
    if (existingRecords.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '该考试已经抽过奖了'
      });
    }

    const canDraw = await LotteryRecord.checkCanDraw(user_name, exam.grade_id);
    if (!canDraw) {
      return res.status(400).json({
        code: 400,
        message: '您在此年级已经抽过奖了，每种题型只能抽取一次'
      });
    }

    const questionCount = exam.total_questions || 10;
    const prize = await Prize.draw(questionCount);

    const lotteryRecord = await LotteryRecord.create({
      exam_id,
      user_name,
      prize_name: prize.name,
      prize_emoji: prize.emoji
    });

    res.json({
      code: 200,
      message: '抽奖成功',
      data: {
        prize: { name: prize.name, emoji: prize.emoji, color: prize.color },
        record: lotteryRecord,
        questionCount
      }
    });
  } catch (error) {
    console.error('抽奖失败:', error);
    res.status(500).json({
      code: 500,
      message: '抽奖失败',
      error: error.message
    });
  }
};

exports.getUserLotteryRecords = async (req, res) => {
  try {
    const { user_name } = req.query;

    if (!user_name) {
      return res.status(400).json({
        code: 400,
        message: '请提供用户名'
      });
    }

    const records = await LotteryRecord.findByUserId(user_name);

    res.json({
      code: 200,
      message: 'success',
      data: records
    });
  } catch (error) {
    console.error('获取抽奖记录失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取抽奖记录失败',
      error: error.message
    });
  }
};

exports.getAllLotteryRecords = async (req, res) => {
  try {
    const records = await LotteryRecord.findAll();

    res.json({
      code: 200,
      message: 'success',
      data: records
    });
  } catch (error) {
    console.error('获取所有抽奖记录失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取所有抽奖记录失败',
      error: error.message
    });
  }
};

exports.updateRedeemStatus = async (req, res) => {
  try {
    const { id, is_redeemed } = req.body;

    if (!id || is_redeemed === undefined) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数'
      });
    }

    const record = await LotteryRecord.findById(id);
    if (!record) {
      return res.status(404).json({
        code: 404,
        message: '抽奖记录不存在'
      });
    }

    const updatedRecord = await LotteryRecord.updateRedeemStatus(id, is_redeemed);

    res.json({
      code: 200,
      message: '兑现状态更新成功',
      data: updatedRecord
    });
  } catch (error) {
    console.error('更新兑现状态失败:', error);
    res.status(500).json({
      code: 500,
      message: '更新兑现状态失败',
      error: error.message
    });
  }
};

exports.getPrizes = async (req, res) => {
  try {
    const { question_count } = req.query;
    const questionCount = parseInt(question_count) || 10;
    
    const prizes = await Prize.calculateDynamicProbabilities(questionCount);
    
    res.json({
      code: 200,
      message: 'success',
      data: prizes
    });
  } catch (error) {
    console.error('获取奖品列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取奖品列表失败',
      error: error.message
    });
  }
};

exports.demoDraw = async (req, res) => {
  try {
    const { user_name } = req.body;
    
    if (!user_name || user_name !== '张伟') {
      return res.status(403).json({
        code: 403,
        message: '只有管理员张伟可以使用演示功能'
      });
    }
    
    const prize = await Prize.draw(10);
    
    res.json({
      code: 200,
      message: '演示抽奖成功',
      data: {
        prize: { name: prize.name, emoji: prize.emoji, color: prize.color },
        is_demo: true
      }
    });
  } catch (error) {
    console.error('演示抽奖失败:', error);
    res.status(500).json({
      code: 500,
      message: '演示抽奖失败',
      error: error.message
    });
  }
};