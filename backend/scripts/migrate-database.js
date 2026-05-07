const { Pool } = require('pg');
require('dotenv').config();

const sourcePool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

const targetPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

const createTablesSql = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'examiner' CHECK (role IN ('admin', 'examiner')),
  allowed_grades JSONB DEFAULT '["low", "middle", "high"]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grades (
  id SERIAL PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE,
  level VARCHAR(10) NOT NULL CHECK (level IN ('low', 'middle', 'high'))
);

CREATE TABLE IF NOT EXISTS question_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  grade_id INT NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  type_id INT NOT NULL REFERENCES question_types(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  options JSONB,
  answer VARCHAR(500) NOT NULL,
  points INT DEFAULT 10 CHECK (points > 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paper_id INT
);

CREATE TABLE IF NOT EXISTS exam_records (
  id SERIAL PRIMARY KEY,
  user_name VARCHAR(100) NOT NULL,
  grade_id INT NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  total_score INT NOT NULL DEFAULT 0,
  total_questions INT NOT NULL,
  correct_count INT NOT NULL DEFAULT 0,
  start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed'))
);

CREATE TABLE IF NOT EXISTS answer_records (
  id SERIAL PRIMARY KEY,
  exam_id INT NOT NULL REFERENCES exam_records(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_answer VARCHAR(500),
  is_correct BOOLEAN NOT NULL,
  points_earned INT NOT NULL CHECK (points_earned >= 0)
);

CREATE TABLE IF NOT EXISTS exam_papers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  grade_id INT REFERENCES grades(id) ON DELETE CASCADE,
  source_file VARCHAR(255) UNIQUE,
  question_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prizes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  emoji VARCHAR(10),
  color VARCHAR(50),
  base_probability DECIMAL(5,2) NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lottery_records (
  id SERIAL PRIMARY KEY,
  exam_id INT NOT NULL REFERENCES exam_records(id) ON DELETE CASCADE,
  user_name VARCHAR(100) NOT NULL,
  prize_name VARCHAR(100) NOT NULL,
  prize_emoji VARCHAR(10),
  is_redeemed BOOLEAN NOT NULL DEFAULT false,
  redeemed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exam_papers_source_file ON exam_papers(source_file);
CREATE INDEX IF NOT EXISTS idx_questions_grade_type ON questions(grade_id, type_id);
CREATE INDEX IF NOT EXISTS idx_exam_records_user_time ON exam_records(user_name, start_time);
CREATE INDEX IF NOT EXISTS idx_answer_records_exam ON answer_records(exam_id);
CREATE INDEX IF NOT EXISTS idx_answer_records_question ON answer_records(question_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_lottery_records_user ON lottery_records(user_name);
CREATE INDEX IF NOT EXISTS idx_lottery_records_exam ON lottery_records(exam_id);
`;

async function createDatabase() {
  const client = await targetPool.connect();
  try {
    await client.query('CREATE DATABASE kaoshiku');
    console.log('数据库 kaoshiku 创建成功');
  } catch (error) {
    if (error.code !== '42P04') {
      console.error('创建数据库失败:', error);
      throw error;
    }
    console.log('数据库 kaoshiku 已存在');
  } finally {
    client.release();
  }
}

async function createTargetPool() {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'kaoshiku',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
  });
}

async function migrateUsers(sourcePool, targetPool) {
  console.log('开始迁移表: users');
  try {
    const sourceResult = await sourcePool.query('SELECT id, username, role, allowed_grades, created_at FROM users');
    const rows = sourceResult.rows;
    
    if (rows.length === 0) {
      console.log('表 users 无数据可迁移，使用默认数据');
      const defaultUsers = [
        { username: '张伟', role: 'admin', allowed_grades: JSON.stringify(['low', 'middle', 'high']) },
        { username: '张洛琳', role: 'examiner', allowed_grades: JSON.stringify(['middle']) },
        { username: '张洛晗', role: 'examiner', allowed_grades: JSON.stringify(['low']) },
      ];
      
      for (const user of defaultUsers) {
        await targetPool.query(
          'INSERT INTO users (username, role, allowed_grades) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING',
          [user.username, user.role, user.allowed_grades]
        );
      }
      console.log('表 users 使用默认数据初始化完成，共 3 条记录');
      return;
    }

    for (const row of rows) {
      const allowedGrades = typeof row.allowed_grades === 'string' 
        ? row.allowed_grades 
        : JSON.stringify(row.allowed_grades);
      
      await targetPool.query(
        'INSERT INTO users (id, username, role, allowed_grades, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [row.id, row.username, row.role, allowedGrades, row.created_at]
      );
    }
    console.log(`表 users 迁移完成，共迁移 ${rows.length} 条记录`);
  } catch (error) {
    console.log(`表 users 迁移失败，使用默认数据: ${error.message}`);
    const defaultUsers = [
      { username: '张伟', role: 'admin', allowed_grades: JSON.stringify(['low', 'middle', 'high']) },
      { username: '张洛琳', role: 'examiner', allowed_grades: JSON.stringify(['middle']) },
      { username: '张洛晗', role: 'examiner', allowed_grades: JSON.stringify(['low']) },
    ];
    
    for (const user of defaultUsers) {
      await targetPool.query(
        'INSERT INTO users (username, role, allowed_grades) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING',
        [user.username, user.role, user.allowed_grades]
      );
    }
    console.log('表 users 使用默认数据初始化完成，共 3 条记录');
  }
}

async function migrateQuestions(sourcePool, targetPool) {
  console.log('开始迁移表: questions');
  try {
    const sourceResult = await sourcePool.query('SELECT id, grade_id, type_id, content, options, answer, points, created_at, paper_id FROM questions');
    const rows = sourceResult.rows;
    
    if (rows.length === 0) {
      console.log('表 questions 无数据可迁移，使用默认数据');
      const defaultQuestions = [
        { grade_id: 1, type_id: 1, content: '1+1=？', options: JSON.stringify(['A. 1', 'B. 2', 'C. 3', 'D. 4']), answer: 'B', points: 10 },
        { grade_id: 1, type_id: 2, content: '中国的首都是_______。', options: null, answer: '北京', points: 10 },
        { grade_id: 1, type_id: 3, content: '太阳从东边升起。', options: null, answer: '正确', points: 10 },
        { grade_id: 2, type_id: 1, content: '2+3=？', options: JSON.stringify(['A. 4', 'B. 5', 'C. 6', 'D. 7']), answer: 'B', points: 10 },
        { grade_id: 2, type_id: 2, content: '世界上最大的海洋是_______洋。', options: null, answer: '太平', points: 10 },
        { grade_id: 3, type_id: 1, content: '5×6=？', options: JSON.stringify(['A. 25', 'B. 30', 'C. 35', 'D. 40']), answer: 'B', points: 10 },
        { grade_id: 3, type_id: 3, content: '地球是太阳系中最大的行星。', options: null, answer: '错误', points: 10 },
      ];
      
      for (const question of defaultQuestions) {
        await targetPool.query(
          'INSERT INTO questions (grade_id, type_id, content, options, answer, points) VALUES ($1, $2, $3, $4, $5, $6)',
          [question.grade_id, question.type_id, question.content, question.options, question.answer, question.points]
        );
      }
      console.log('表 questions 使用默认数据初始化完成，共 7 条记录');
      return;
    }

    for (const row of rows) {
      const options = row.options ? (typeof row.options === 'string' ? row.options : JSON.stringify(row.options)) : null;
      
      await targetPool.query(
        'INSERT INTO questions (id, grade_id, type_id, content, options, answer, points, created_at, paper_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING',
        [row.id, row.grade_id, row.type_id, row.content, options, row.answer, row.points, row.created_at, row.paper_id]
      );
    }
    console.log(`表 questions 迁移完成，共迁移 ${rows.length} 条记录`);
  } catch (error) {
    console.log(`表 questions 迁移失败，使用默认数据: ${error.message}`);
    const defaultQuestions = [
      { grade_id: 1, type_id: 1, content: '1+1=？', options: JSON.stringify(['A. 1', 'B. 2', 'C. 3', 'D. 4']), answer: 'B', points: 10 },
      { grade_id: 1, type_id: 2, content: '中国的首都是_______。', options: null, answer: '北京', points: 10 },
      { grade_id: 1, type_id: 3, content: '太阳从东边升起。', options: null, answer: '正确', points: 10 },
      { grade_id: 2, type_id: 1, content: '2+3=？', options: JSON.stringify(['A. 4', 'B. 5', 'C. 6', 'D. 7']), answer: 'B', points: 10 },
      { grade_id: 2, type_id: 2, content: '世界上最大的海洋是_______洋。', options: null, answer: '太平', points: 10 },
      { grade_id: 3, type_id: 1, content: '5×6=？', options: JSON.stringify(['A. 25', 'B. 30', 'C. 35', 'D. 40']), answer: 'B', points: 10 },
      { grade_id: 3, type_id: 3, content: '地球是太阳系中最大的行星。', options: null, answer: '错误', points: 10 },
    ];
    
    for (const question of defaultQuestions) {
      await targetPool.query(
        'INSERT INTO questions (grade_id, type_id, content, options, answer, points) VALUES ($1, $2, $3, $4, $5, $6)',
        [question.grade_id, question.type_id, question.content, question.options, question.answer, question.points]
      );
    }
    console.log('表 questions 使用默认数据初始化完成，共 7 条记录');
  }
}

async function migrateTable(sourcePool, targetPool, tableName, columns) {
  console.log(`开始迁移表: ${tableName}`);
  
  const sourceResult = await sourcePool.query(`SELECT ${columns} FROM ${tableName}`);
  const rows = sourceResult.rows;
  
  if (rows.length === 0) {
    console.log(`表 ${tableName} 无数据可迁移`);
    return;
  }

  const columnList = columns.split(',').map(c => c.trim());
  const placeholders = columnList.map((_, i) => `$${i + 1}`).join(',');
  const insertSql = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

  for (const row of rows) {
    const values = columnList.map(col => {
      const val = row[col];
      if (val instanceof Date) {
        return val.toISOString();
      }
      return val;
    });
    await targetPool.query(insertSql, values);
  }

  console.log(`表 ${tableName} 迁移完成，共迁移 ${rows.length} 条记录`);
}

async function main() {
  try {
    console.log('========== 数据库迁移开始 ==========');
    
    await createDatabase();
    
    const targetPoolClient = await createTargetPool();
    
    await targetPoolClient.query(createTablesSql);
    console.log('目标数据库表结构创建成功');
    
    const migrationConfig = [
      { table: 'grades', columns: 'id, name, level' },
      { table: 'question_types', columns: 'id, name, description' },
      { table: 'exam_papers', columns: 'id, name, grade_id, source_file, question_count, created_at' },
      { table: 'exam_records', columns: 'id, user_name, grade_id, total_score, total_questions, correct_count, start_time, end_time, status' },
      { table: 'answer_records', columns: 'id, exam_id, question_id, user_answer, is_correct, points_earned' },
      { table: 'prizes', columns: 'id, name, emoji, color, base_probability, is_default, updated_at' },
      { table: 'lottery_records', columns: 'id, exam_id, user_name, prize_name, prize_emoji, is_redeemed, redeemed_at, created_at' },
    ];

    for (const config of migrationConfig) {
      try {
        await migrateTable(sourcePool, targetPoolClient, config.table, config.columns);
      } catch (error) {
        console.warn(`迁移表 ${config.table} 时出错（可能表不存在）:`, error.message);
      }
    }
    
    await migrateUsers(sourcePool, targetPoolClient);
    await migrateQuestions(sourcePool, targetPoolClient);
    
    console.log('========== 数据库迁移完成 ==========');
    process.exit(0);
  } catch (error) {
    console.error('迁移过程中发生错误:', error);
    process.exit(1);
  }
}

main();