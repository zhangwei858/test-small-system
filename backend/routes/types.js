const express = require('express');
const router = express.Router();
const typesController = require('../controllers/typesController');

// 获取所有题型
router.get('/', typesController.getTypes);

// 获取单个题型
router.get('/:id', typesController.getType);

module.exports = router;