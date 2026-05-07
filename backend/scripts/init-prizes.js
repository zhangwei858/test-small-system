const { query } = require('../config/database');

async function createPrizesTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS prizes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        emoji VARCHAR(20) NOT NULL,
        color VARCHAR(20) NOT NULL,
        base_probability DECIMAL(5,2) NOT NULL CHECK (base_probability >= 0 AND base_probability <= 100),
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    const existing = await query('SELECT COUNT(*) as count FROM prizes');
    console.log('现有奖项数:', existing.rows[0].count);
    
    if (existing.rows[0].count === '0') {
      await query(`
        INSERT INTO prizes (name, emoji, color, base_probability, is_default) VALUES
        ('2元钱', '💰', '#ef4444', 14.29, false),
        ('1元钱', '💵', '#f59e0b', 14.29, false),
        ('游乐场一次', '🎡', '#10b981', 14.29, false),
        ('火锅一次', '🍲', '#6366f1', 14.29, false),
        ('一个西瓜', '🍉', '#22c55e', 14.29, false),
        ('看爸爸手机0分钟', '📱', '#8b5cf6', 14.29, false),
        ('谢谢惠顾', '🎁', '#6b7280', 14.25, true);
      `);
      console.log('默认奖项数据初始化成功');
    } else {
      console.log('奖项表已有数据');
    }
    
    const result = await query('SELECT * FROM prizes');
    console.log('奖项数据:', result.rows);
    process.exit(0);
  } catch (error) {
    console.error('创建奖项表失败:', error.message);
    process.exit(1);
  }
}

createPrizesTable();