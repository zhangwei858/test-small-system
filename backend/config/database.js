const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 测试连接
pool.connect()
  .then(client => {
    console.log('数据库连接成功');
    client.release();
  })
  .catch(err => {
    console.error('数据库连接失败:', err.stack);
  });

// 查询执行函数
const query = (text, params) => {
  return pool.query(text, params);
};

// 事务执行函数
const transaction = async (queries) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const query of queries) {
      await client.query(query.text, query.params);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  query,
  transaction,
  pool
};