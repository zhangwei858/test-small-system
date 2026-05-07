const { query, transaction } = require('../config/database');

class ExamRecord {
  static async create({ user_name, grade_id, questions, total_points }) {
    const questions_array = Array.isArray(questions) ? questions : [questions];
    const total_questions = questions_array.length;

    const result = await query(
      'INSERT INTO exam_records (user_name, grade_id, total_questions, total_score) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_name, grade_id, total_questions, total_points || 0]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await query(
      'SELECT er.*, g.name as grade_name FROM exam_records er ' +
      'LEFT JOIN grades g ON er.grade_id = g.id WHERE er.id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async findByUserName(userName) {
    const result = await query(
      'SELECT er.*, g.name as grade_name, ' +
      'CASE WHEN er.total_questions > 0 THEN ROUND((er.correct_count::FLOAT / er.total_questions::FLOAT) * 100) ELSE 0 END as accuracy ' +
      'FROM exam_records er ' +
      'LEFT JOIN grades g ON er.grade_id = g.id ' +
      'WHERE er.user_name = $1 ORDER BY er.start_time DESC',
      [userName]
    );
    return result.rows;
  }

  static async findAll() {
    const result = await query(
      'SELECT er.*, g.name as grade_name, ' +
      'CASE WHEN er.total_questions > 0 THEN ROUND((er.correct_count::FLOAT / er.total_questions::FLOAT) * 100) ELSE 0 END as accuracy ' +
      'FROM exam_records er ' +
      'LEFT JOIN grades g ON er.grade_id = g.id ' +
      'WHERE er.status = $1 ORDER BY er.start_time DESC',
      ['completed']
    );
    return result.rows;
  }

  static async update(id, { total_score, correct_count, end_time, status }) {
    const result = await query(
      'UPDATE exam_records SET total_score = $1, correct_count = $2, ' +
      'end_time = $3, status = $4 WHERE id = $5 RETURNING *',
      [total_score, correct_count, end_time, status, id]
    );
    return result.rows[0];
  }

  static async completeExam(examId, { total_score, correct_count }) {
    const result = await query(
      'UPDATE exam_records SET total_score = $1, correct_count = $2, end_time = CURRENT_TIMESTAMP, status = $3 WHERE id = $4 RETURNING *',
      [total_score, correct_count, 'completed', examId]
    );
    return result.rows[0];
  }
}

module.exports = ExamRecord;
