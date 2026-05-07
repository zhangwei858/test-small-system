const { query } = require('../config/database');

class User {
  static async findByUsername(username) {
    const result = await query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0];
  }

  static async create({ username, role = 'examiner', allowedGrades = ['low', 'middle', 'high'] }) {
    const result = await query(
      'INSERT INTO users (username, role, allowed_grades) VALUES ($1, $2, $3) RETURNING *',
      [username, role, JSON.stringify(allowedGrades)]
    );
    return result.rows[0];
  }

  static async findAll() {
    const result = await query('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows;
  }

  static async update(id, { role, allowedGrades }) {
    const result = await query(
      'UPDATE users SET role = $1, allowed_grades = $2 WHERE id = $3 RETURNING *',
      [role, JSON.stringify(allowedGrades), id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }

  static async isAdmin(username) {
    const user = await this.findByUsername(username);
    return user && user.role === 'admin';
  }

  static async getAllowedGrades(username) {
    const user = await this.findByUsername(username);
    if (!user) return ['low', 'middle', 'high'];
    return user.allowed_grades || ['low', 'middle', 'high'];
  }
}

module.exports = User;