const { query } = require('../config/database');

class Question {
  static async findAll(filters = {}) {
    let sql = 'SELECT q.*, g.name as grade_name, t.name as type_name, ep.name as paper_name FROM questions q ' +
               'LEFT JOIN grades g ON q.grade_id = g.id ' +
               'LEFT JOIN question_types t ON q.type_id = t.id ' +
               'LEFT JOIN exam_papers ep ON q.paper_id = ep.id WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.grade_id) {
      sql += ` AND q.grade_id = $${paramIndex}`;
      params.push(filters.grade_id);
      paramIndex++;
    }

    if (filters.type_id) {
      sql += ` AND q.type_id = $${paramIndex}`;
      params.push(filters.type_id);
      paramIndex++;
    }

    if (filters.type_ids && Array.isArray(filters.type_ids) && filters.type_ids.length > 0) {
      const placeholders = filters.type_ids.map(() => `$${paramIndex++}`).join(',');
      sql += ` AND q.type_id IN (${placeholders})`;
      params.push(...filters.type_ids);
    }

    if (filters.paper_id) {
      sql += ` AND q.paper_id = $${paramIndex}`;
      params.push(filters.paper_id);
      paramIndex++;
    }

    sql += ' ORDER BY q.id';

    if (filters.limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }

    if (filters.offset) {
      sql += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
      paramIndex++;
    }

    const result = await query(sql, params);
    return result.rows;
  }

  static async findById(id) {
    const result = await query(
      'SELECT q.*, g.name as grade_name, t.name as type_name FROM questions q ' +
      'LEFT JOIN grades g ON q.grade_id = g.id ' +
      'LEFT JOIN question_types t ON q.type_id = t.id WHERE q.id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async create({ grade_id, type_id, content, options, answer, points = 10, paper_id = null, reading_content = null, reading_title = null }) {
    const result = await query(
      'INSERT INTO questions (grade_id, type_id, content, options, answer, points, paper_id, reading_content, reading_title) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [grade_id, type_id, content, options, answer, points, paper_id, reading_content, reading_title]
    );
    return result.rows[0];
  }

  static async update(id, { grade_id, type_id, content, options, answer, points, reading_content = null, reading_title = null }) {
    const result = await query(
      'UPDATE questions SET grade_id = $1, type_id = $2, content = $3, ' +
      'options = $4, answer = $5, points = $6, reading_content = $7, reading_title = $8 WHERE id = $9 RETURNING *',
      [grade_id, type_id, content, options, answer, points, reading_content, reading_title, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await query('DELETE FROM questions WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }

  static async count(filters = {}) {
    let sql = 'SELECT COUNT(*) as total FROM questions WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.grade_id) {
      sql += ` AND grade_id = $${paramIndex}`;
      params.push(filters.grade_id);
      paramIndex++;
    }

    if (filters.type_id) {
      sql += ` AND type_id = $${paramIndex}`;
      params.push(filters.type_id);
      paramIndex++;
    }

    const result = await query(sql, params);
    return parseInt(result.rows[0].total);
  }
}

module.exports = Question;