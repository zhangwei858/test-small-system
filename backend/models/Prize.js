const { query } = require('../config/database');

class Prize {
  static async create({ name, emoji, color, base_probability, is_default = false }) {
    const result = await query(
      'INSERT INTO prizes (name, emoji, color, base_probability, is_default, updated_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING *',
      [name, emoji, color, base_probability, is_default]
    );
    return result.rows[0];
  }

  static async findAll() {
    const result = await query('SELECT * FROM prizes ORDER BY id');
    return result.rows;
  }

  static async findById(id) {
    const result = await query('SELECT * FROM prizes WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async update(id, { name, emoji, color, base_probability }) {
    const result = await query(
      'UPDATE prizes SET name = $1, emoji = $2, color = $3, base_probability = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [name, emoji, color, base_probability, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await query(
      'DELETE FROM prizes WHERE id = $1 AND is_default = false RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  static async getTotalProbability() {
    const result = await query('SELECT SUM(base_probability) as total FROM prizes');
    return parseFloat(result.rows[0].total) || 0;
  }

  static async getPrizeByName(name) {
    const result = await query('SELECT * FROM prizes WHERE name = $1', [name]);
    return result.rows[0];
  }

  static async getDefaultPrize() {
    const result = await query('SELECT * FROM prizes WHERE is_default = true');
    return result.rows[0];
  }

  static async calculateDynamicProbabilities(questionCount) {
    const prizes = await this.findAll();
    const defaultPrize = prizes.find(p => p.is_default);
    
    if (!defaultPrize) {
      return prizes;
    }

    let bonusProbability = 0;
    if (questionCount < 10) {
      bonusProbability = Math.min((10 - questionCount) * 5, 30);
    }

    const adjustedPrizes = prizes.map(prize => {
      if (prize.is_default) {
        return {
          ...prize,
          dynamic_probability: Math.min(prize.base_probability + bonusProbability, 95)
        };
      }
      return {
        ...prize,
        dynamic_probability: prize.base_probability
      };
    });

    const totalWithoutDefault = adjustedPrizes
      .filter(p => !p.is_default)
      .reduce((sum, p) => sum + p.dynamic_probability, 0);
    
    const remaining = 100 - totalWithoutDefault;
    const defaultIndex = adjustedPrizes.findIndex(p => p.is_default);
    if (defaultIndex !== -1) {
      adjustedPrizes[defaultIndex].dynamic_probability = Math.max(remaining, 0);
    }

    return adjustedPrizes;
  }

  static async draw(questionCount) {
    const prizes = await this.calculateDynamicProbabilities(questionCount);
    
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (const prize of prizes) {
      cumulative += prize.dynamic_probability || prize.base_probability;
      if (random <= cumulative) {
        return prize;
      }
    }
    
    return prizes[prizes.length - 1];
  }
}

module.exports = Prize;