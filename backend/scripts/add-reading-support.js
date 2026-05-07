const { query } = require('../config/database');

async function updateDatabase() {
  try {
    console.log('开始更新数据库 - 添加阅读理解支持...');

    await query(`
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS reading_content TEXT;
    `);
    console.log('questions 表添加 reading_content 字段成功');

    await query(`
      ALTER TABLE questions ADD COLUMN IF NOT EXISTS reading_title VARCHAR(200);
    `);
    console.log('questions 表添加 reading_title 字段成功');

    await query(`
      INSERT INTO question_types (name, description) VALUES
      ('阅读题', '阅读理解选择题，包含阅读材料和问题')
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log('阅读题题型添加成功');

    console.log('数据库更新完成 - 阅读理解支持已添加！');
  } catch (error) {
    console.error('更新数据库失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

updateDatabase();
