const { query } = require('../config/database');

class LotteryRecord {
  static async create({ exam_id, user_name, prize_name, prize_emoji, is_redeemed = false }) {
    const result = await query(
      'INSERT INTO lottery_records (exam_id, user_name, prize_name, prize_emoji, is_redeemed) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [exam_id, user_name, prize_name, prize_emoji, is_redeemed]
    );
    return result.rows[0];
  }

  static async findByUserId(userId) {
    const result = await query(
      'SELECT lr.*, er.total_score, er.grade_id, g.name as grade_name FROM lottery_records lr ' +
      'LEFT JOIN exam_records er ON lr.exam_id = er.id ' +
      'LEFT JOIN grades g ON er.grade_id = g.id ' +
      'WHERE lr.user_name = $1 ORDER BY lr.created_at DESC',
      [userId]
    );
    return result.rows;
  }

  static async findByExamId(examId) {
    const result = await query(
      'SELECT * FROM lottery_records WHERE exam_id = $1',
      [examId]
    );
    return result.rows;
  }

  static async findAll() {
    const result = await query(
      'SELECT lr.*, er.total_score, er.grade_id, g.name as grade_name, er.user_name as exam_user_name FROM lottery_records lr ' +
      'LEFT JOIN exam_records er ON lr.exam_id = er.id ' +
      'LEFT JOIN grades g ON er.grade_id = g.id ' +
      'ORDER BY lr.created_at DESC'
    );
    return result.rows;
  }

  static async updateRedeemStatus(id, is_redeemed) {
    const result = await query(
      'UPDATE lottery_records SET is_redeemed = $1, redeemed_at = $2 WHERE id = $3 RETURNING *',
      [is_redeemed, is_redeemed ? new Date() : null, id]
    );
    return result.rows[0];
  }

  static async checkCanDraw(user_name, grade_id) {
    const result = await query(
      'SELECT COUNT(*) as count FROM lottery_records lr ' +
      'JOIN exam_records er ON lr.exam_id = er.id ' +
      'WHERE lr.user_name = $1 AND er.grade_id = $2',
      [user_name, grade_id]
    );
    return result.rows[0].count === '0';
  }

  static async findById(id) {
    const result = await query(
      'SELECT * FROM lottery_records WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }
}

module.exports = LotteryRecord;