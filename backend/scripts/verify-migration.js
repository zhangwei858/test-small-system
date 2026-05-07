const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'kaoshiku',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

const tablesToCheck = [
  { name: 'users', expectedMinRows: 0 },
  { name: 'grades', expectedMinRows: 3 },
  { name: 'question_types', expectedMinRows: 4 },
  { name: 'questions', expectedMinRows: 0 },
  { name: 'exam_papers', expectedMinRows: 0 },
  { name: 'exam_records', expectedMinRows: 0 },
  { name: 'answer_records', expectedMinRows: 0 },
  { name: 'prizes', expectedMinRows: 0 },
  { name: 'lottery_records', expectedMinRows: 0 },
];

async function verifyDatabase() {
  console.log('========== 数据库迁移验证开始 ==========');
  
  let allPassed = true;
  
  try {
    await pool.connect();
    console.log('✓ 数据库连接成功');
    
    for (const table of tablesToCheck) {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table.name}`);
      const count = parseInt(result.rows[0].count);
      
      if (count >= table.expectedMinRows) {
        console.log(`✓ 表 ${table.name} 验证通过，记录数: ${count}`);
      } else {
        console.log(`✗ 表 ${table.name} 验证失败，期望至少 ${table.expectedMinRows} 条记录，实际: ${count}`);
        allPassed = false;
      }
    }
    
    const gradeCheck = await pool.query("SELECT * FROM grades");
    if (gradeCheck.rows.length >= 3) {
      console.log('✓ 年级数据验证通过:', gradeCheck.rows.map(g => `${g.name}(${g.level})`).join(', '));
    } else {
      console.log('✗ 年级数据验证失败');
      allPassed = false;
    }
    
    const typeCheck = await pool.query("SELECT name FROM question_types");
    if (typeCheck.rows.length >= 4) {
      console.log('✓ 题型数据验证通过:', typeCheck.rows.map(t => t.name).join(', '));
    } else {
      console.log('✗ 题型数据验证失败');
      allPassed = false;
    }
    
    const configCheck = await pool.query("SHOW server_version");
    console.log(`✓ 数据库版本: ${configCheck.rows[0].server_version}`);
    
    console.log('========== 数据库迁移验证完成 ==========');
    
    if (allPassed) {
      console.log('\n✅ 所有验证通过！数据库迁移成功。');
      process.exit(0);
    } else {
      console.log('\n❌ 部分验证失败，请检查迁移日志。');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyDatabase();