const { query } = require('../config/database');

async function updateDatabase() {
  try {
    console.log('开始更新数据库结构...');

    await query(`
      CREATE TABLE IF NOT EXISTS exam_papers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        grade_id INT REFERENCES grades(id) ON DELETE CASCADE,
        source_file VARCHAR(255) UNIQUE,
        question_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('exam_papers 表创建成功');

    await query(`
      CREATE INDEX IF NOT EXISTS idx_exam_papers_source_file ON exam_papers(source_file);
    `);
    console.log('exam_papers 索引创建成功');

    await query(`
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS paper_id INT;
    `);
    console.log('questions 表添加 paper_id 字段成功');

    await query(`
      ALTER TABLE questions ADD CONSTRAINT fk_questions_paper FOREIGN KEY (paper_id) REFERENCES exam_papers(id) ON DELETE CASCADE;
    `);
    console.log('questions 表添加外键约束成功');

    await query(`
      INSERT INTO question_types (name, description) VALUES
      ('计算题', '需要计算的题目')
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log('计算题题型添加成功');

    await query(`
      INSERT INTO question_types (name, description) VALUES
      ('识字题', '拼音与汉字识字选择题'),
      ('阅读题', '阅读理解选择题')
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log('识字题、阅读题题型添加成功');

    await query(`
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS passage TEXT;
    `);
    console.log('questions 表添加 passage 字段成功');

    console.log('数据库更新完成！');
  } catch (error) {
    console.error('更新数据库失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

updateDatabase();