const { query } = require('../config/database');

class ExamPaper {
  static async create({ name, grade_id, source_file }) {
    const result = await query(
      'INSERT INTO exam_papers (name, grade_id, source_file) VALUES ($1, $2, $3) RETURNING *',
      [name, grade_id, source_file]
    );
    return result.rows[0];
  }

  static async findAll() {
    const result = await query(
      'SELECT ep.*, g.name as grade_name FROM exam_papers ep ' +
      'LEFT JOIN grades g ON ep.grade_id = g.id ORDER BY ep.created_at DESC'
    );
    return result.rows;
  }

  static async findById(id) {
    const result = await query(
      'SELECT ep.*, g.name as grade_name FROM exam_papers ep ' +
      'LEFT JOIN grades g ON ep.grade_id = g.id WHERE ep.id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await query('DELETE FROM exam_papers WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
}

module.exports = ExamPaper;
