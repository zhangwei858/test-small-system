const { query } = require('../config/database');

class QuestionType {
  static async findAll() {
    const result = await query('SELECT * FROM question_types ORDER BY id');
    return result.rows;
  }

  static async findById(id) {
    const result = await query('SELECT * FROM question_types WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async create({ name, description }) {
    const result = await query(
      'INSERT INTO question_types (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    return result.rows[0];
  }
}

module.exports = QuestionType;