const { query } = require('../config/database');

class Grade {
  static async findAll() {
    const result = await query('SELECT * FROM grades ORDER BY id');
    return result.rows;
  }

  static async findById(id) {
    const result = await query('SELECT * FROM grades WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async create({ name, level }) {
    const result = await query(
      'INSERT INTO grades (name, level) VALUES ($1, $2) RETURNING *',
      [name, level]
    );
    return result.rows[0];
  }
}

module.exports = Grade;