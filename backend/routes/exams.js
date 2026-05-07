const express = require('express');
const router = express.Router();
const examsController = require('../controllers/examsController');

router.get('/history', examsController.getExamHistory);
router.get('/history/all', examsController.getAllExamHistory);

router.post('/start', examsController.startExam);

router.get('/:examId/result', examsController.completeExam);

router.get('/:examId/answer/:questionId', examsController.getAnswer);

router.post('/:examId/submit', examsController.submitAnswer);

router.post('/:examId/submit-all', examsController.submitAllAnswers);

router.get('/:examId', examsController.getExamStatus);

router.get('/:examId/details', examsController.getExamDetails);

module.exports = router;
