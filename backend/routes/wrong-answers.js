const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

router.get('/user/:userName', async (req, res) => {
  try {
    const { userName } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(`
      SELECT 
        wa.id,
        q.content,
        q.options,
        q.answer as correct_answer,
        wa.user_answer,
        qt.name as type_name,
        q.points,
        wa.created_at
      FROM wrong_answers wa
      JOIN questions q ON wa.question_id = q.id
      LEFT JOIN question_types qt ON q.type_id = qt.id
      WHERE wa.user_name = $1
      ORDER BY wa.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userName, parseInt(limit), parseInt(offset)]);

    const countResult = await query(
      'SELECT COUNT(*) FROM wrong_answers WHERE user_name = $1',
      [userName]
    );

    res.json({
      code: 200,
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('查询错题失败:', error);
    res.status(500).json({
      code: 500,
      message: '查询错题失败'
    });
  }
});

router.get('/user/:userName/count', async (req, res) => {
  try {
    const { userName } = req.params;

    const result = await query(
      'SELECT COUNT(*) FROM wrong_answers WHERE user_name = $1',
      [userName]
    );

    res.json({
      code: 200,
      data: {
        count: parseInt(result.rows[0].count)
      }
    });
  } catch (error) {
    console.error('查询错题数量失败:', error);
    res.status(500).json({
      code: 500,
      message: '查询错题数量失败'
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM wrong_answers WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '错题记录不存在'
      });
    }

    res.json({
      code: 200,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除错题失败:', error);
    res.status(500).json({
      code: 500,
      message: '删除错题失败'
    });
  }
});

router.delete('/user/:userName', async (req, res) => {
  try {
    const { userName } = req.params;

    await query(
      'DELETE FROM wrong_answers WHERE user_name = $1',
      [userName]
    );

    res.json({
      code: 200,
      message: '清空错题本成功'
    });
  } catch (error) {
    console.error('清空错题本失败:', error);
    res.status(500).json({
      code: 500,
      message: '清空错题本失败'
    });
  }
});

router.post('/practice', async (req, res) => {
  try {
    const { userName, questionIds } = req.body;

    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({
        code: 400,
        message: '请选择要练习的题目'
      });
    }

    const questions = await query(`
      SELECT 
        q.id,
        q.grade_id,
        q.type_id,
        q.content,
        q.options,
        q.answer,
        q.points,
        gt.name as grade_name,
        qt.name as type_name
      FROM questions q
      JOIN grades gt ON q.grade_id = gt.id
      JOIN question_types qt ON q.type_id = qt.id
      WHERE q.id = ANY($1)
      ORDER BY random()
    `, [questionIds]);

    res.json({
      code: 200,
      data: {
        questions: questions.rows,
        total_questions: questions.rows.length
      }
    });
  } catch (error) {
    console.error('获取练习题目失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取练习题目失败'
    });
  }
});

module.exports = router;