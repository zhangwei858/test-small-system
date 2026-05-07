const express = require('express');
const router = express.Router();
const gradesController = require('../controllers/gradesController');

// 获取所有年级
router.get('/', gradesController.getGrades);

// 获取单个年级
router.get('/:id', gradesController.getGrade);

module.exports = router;