const Prize = require('../models/Prize');

exports.getAllPrizes = async (req, res) => {
  try {
    const prizes = await Prize.findAll();
    const totalProbability = await Prize.getTotalProbability();
    
    res.json({
      code: 200,
      message: 'success',
      data: {
        prizes,
        totalProbability: totalProbability.toFixed(2)
      }
    });
  } catch (error) {
    console.error('获取奖项列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取奖项列表失败',
      error: error.message
    });
  }
};

exports.getPrizeById = async (req, res) => {
  try {
    const { id } = req.params;
    const prize = await Prize.findById(id);
    
    if (!prize) {
      return res.status(404).json({
        code: 404,
        message: '奖项不存在'
      });
    }
    
    res.json({
      code: 200,
      message: 'success',
      data: prize
    });
  } catch (error) {
    console.error('获取奖项失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取奖项失败',
      error: error.message
    });
  }
};

exports.createPrize = async (req, res) => {
  try {
    const { name, emoji, color, base_probability } = req.body;
    
    if (!name || !emoji || !color || base_probability === undefined) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数'
      });
    }
    
    if (base_probability < 0 || base_probability > 100) {
      return res.status(400).json({
        code: 400,
        message: '概率值必须在0-100之间'
      });
    }
    
    const totalProbability = await Prize.getTotalProbability();
    if (totalProbability + parseFloat(base_probability) > 100) {
      return res.status(400).json({
        code: 400,
        message: `概率总和超过100%，当前总和: ${totalProbability.toFixed(2)}%`
      });
    }
    
    const prize = await Prize.create({
      name,
      emoji,
      color,
      base_probability: parseFloat(base_probability),
      is_default: false
    });
    
    res.json({
      code: 200,
      message: '奖项创建成功',
      data: prize
    });
  } catch (error) {
    console.error('创建奖项失败:', error);
    res.status(500).json({
      code: 500,
      message: '创建奖项失败',
      error: error.message
    });
  }
};

exports.updatePrize = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, emoji, color, base_probability } = req.body;
    
    const existingPrize = await Prize.findById(id);
    if (!existingPrize) {
      return res.status(404).json({
        code: 404,
        message: '奖项不存在'
      });
    }
    
    if (base_probability !== undefined) {
      if (base_probability < 0 || base_probability > 100) {
        return res.status(400).json({
          code: 400,
          message: '概率值必须在0-100之间'
        });
      }
      
      const totalProbability = await Prize.getTotalProbability();
      const diff = parseFloat(base_probability) - existingPrize.base_probability;
      
      if (totalProbability + diff > 100) {
        return res.status(400).json({
          code: 400,
          message: `概率总和超过100%`
        });
      }
    }
    
    const updateData = {};
    if (name) updateData.name = name;
    if (emoji) updateData.emoji = emoji;
    if (color) updateData.color = color;
    if (base_probability !== undefined) updateData.base_probability = parseFloat(base_probability);
    
    const prize = await Prize.update(id, updateData);
    
    res.json({
      code: 200,
      message: '奖项更新成功',
      data: prize
    });
  } catch (error) {
    console.error('更新奖项失败:', error);
    res.status(500).json({
      code: 500,
      message: '更新奖项失败',
      error: error.message
    });
  }
};

exports.deletePrize = async (req, res) => {
  try {
    const { id } = req.params;
    
    const prize = await Prize.delete(id);
    if (!prize) {
      return res.status(400).json({
        code: 400,
        message: '无法删除默认奖项或奖项不存在'
      });
    }
    
    res.json({
      code: 200,
      message: '奖项删除成功',
      data: prize
    });
  } catch (error) {
    console.error('删除奖项失败:', error);
    res.status(500).json({
      code: 500,
      message: '删除奖项失败',
      error: error.message
    });
  }
};

exports.getDynamicProbabilities = async (req, res) => {
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
    console.error('获取动态概率失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取动态概率失败',
      error: error.message
    });
  }
};