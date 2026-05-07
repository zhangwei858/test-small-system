const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

const createTables = `
-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'examiner' CHECK (role IN ('admin', 'examiner')),
  allowed_grades JSONB DEFAULT '["low", "middle", "high"]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建年级表
CREATE TABLE IF NOT EXISTS grades (
  id SERIAL PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE,
  level VARCHAR(10) NOT NULL CHECK (level IN ('low', 'middle', 'high'))
);

-- 创建题型表
CREATE TABLE IF NOT EXISTS question_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(200)
);

-- 创建题目表
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  grade_id INT NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  type_id INT NOT NULL REFERENCES question_types(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  options JSONB,
  answer VARCHAR(500) NOT NULL,
  points INT DEFAULT 10 CHECK (points > 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建考试记录表
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

-- 创建答题记录表
CREATE TABLE IF NOT EXISTS answer_records (
  id SERIAL PRIMARY KEY,
  exam_id INT NOT NULL REFERENCES exam_records(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_answer VARCHAR(500),
  is_correct BOOLEAN NOT NULL,
  points_earned INT NOT NULL CHECK (points_earned >= 0)
);

-- 创建试卷表
CREATE TABLE IF NOT EXISTS exam_papers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  grade_id INT REFERENCES grades(id) ON DELETE CASCADE,
  source_file VARCHAR(255) UNIQUE,
  question_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建错题本表
CREATE TABLE IF NOT EXISTS wrong_answers (
  id SERIAL PRIMARY KEY,
  user_name VARCHAR(100) NOT NULL,
  question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_answer VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exam_papers_source_file ON exam_papers(source_file);
CREATE INDEX IF NOT EXISTS idx_exam_papers_grade_id ON exam_papers(grade_id);
CREATE INDEX IF NOT EXISTS idx_questions_grade_type ON questions(grade_id, type_id);
CREATE INDEX IF NOT EXISTS idx_questions_content ON questions(content);
CREATE INDEX IF NOT EXISTS idx_exam_records_user_time ON exam_records(user_name, start_time);
CREATE INDEX IF NOT EXISTS idx_exam_records_status ON exam_records(status);
CREATE INDEX IF NOT EXISTS idx_exam_records_end_time ON exam_records(end_time);
CREATE INDEX IF NOT EXISTS idx_answer_records_exam ON answer_records(exam_id);
CREATE INDEX IF NOT EXISTS idx_answer_records_question ON answer_records(question_id);
CREATE INDEX IF NOT EXISTS idx_answer_records_is_correct ON answer_records(is_correct);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_wrong_answers_user ON wrong_answers(user_name);
CREATE INDEX IF NOT EXISTS idx_wrong_answers_question ON wrong_answers(question_id);

INSERT INTO grades (name, level) VALUES
('低年级', 'low'),
('中年级', 'middle'),
('高年级', 'high')
ON CONFLICT (name) DO NOTHING;

INSERT INTO question_types (name, description) VALUES
('选择题', '四选一的选择题'),
('填空题', '需要填写答案的填空题'),
('判断题', '判断对错的选择题'),
('计算题', '需要计算的题目')
ON CONFLICT (name) DO NOTHING;

INSERT INTO users (username, role, allowed_grades) VALUES
('张伟', 'admin', '["low", "middle", "high"]'),
('张洛琳', 'examiner', '["middle"]'),
('张洛晗', 'examiner', '["low"]')
ON CONFLICT (username) DO NOTHING;
`;

const sampleQuestions = [
  {
    grade_id: 1,
    type_id: 1,
    content: '1+1=？',
    options: JSON.stringify(['A. 1', 'B. 2', 'C. 3', 'D. 4']),
    answer: 'B',
    points: 10
  },
  {
    grade_id: 1,
    type_id: 2,
    content: '中国的首都是_______。',
    answer: '北京',
    points: 10
  },
  {
    grade_id: 1,
    type_id: 3,
    content: '太阳从东边升起。',
    answer: '正确',
    points: 10
  }
];

async function initDatabase() {
  try {
    console.log('开始初始化数据库...');

    await query(createTables);
    console.log('数据表创建成功');

    for (const question of sampleQuestions) {
      const exists = await query('SELECT id FROM questions WHERE content = $1', [question.content]);
      if (exists.rows.length === 0) {
        await query(
          `INSERT INTO questions (grade_id, type_id, content, options, answer, points)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [question.grade_id, question.type_id, question.content,
           question.options, question.answer, question.points]
        );
      }
    }
    console.log('示例题目插入成功');

    const sampleContent = `=== 题目开始 ===
题目编号：Q001
年级：低年级
题型：选择题
分值：10
题目：1+1=？
选项：
A. 1
B. 2
C. 3
D. 4
正确答案：B
=== 题目结束 ===

=== 题目开始 ===
题目编号：Q002
年级：中年级
题型：填空题
分值：10
题目：中国的首都是_______。
正确答案：北京
=== 题目结束 ===

=== 题目开始 ===
题目编号：Q003
年级：高年级
题型：判断题
分值：10
题目：地球是圆的。
正确答案：正确
=== 题目结束 ===`;

    fs.writeFileSync(path.join(__dirname, '../data/sample-questions.txt'), sampleContent);
    console.log('示例题目文件创建成功');

    console.log('数据库初始化完成！');
  } catch (error) {
    console.error('初始化数据库失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

initDatabase();