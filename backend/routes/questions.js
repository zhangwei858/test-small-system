const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const iconv = require('iconv-lite');
const questionsController = require('../controllers/questionsController');

function decodeFileName(originalname) {
  try {
    const buffer = Buffer.from(originalname, 'latin1');
    const decoded = iconv.decode(buffer, 'utf-8');
    if (decoded && /[\u4e00-\u9fa5]/.test(decoded)) {
      return decoded;
    }
    return originalname;
  } catch (e) {
    return originalname;
  }
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const decodedName = decodeFileName(file.originalname);
    cb(null, 'questions-' + uniqueSuffix + path.extname(decodedName));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持TXT文件'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

router.get('/', questionsController.getQuestions);

router.post('/import', upload.single('file'), (req, res, next) => {
  if (req.file) {
    req.file.decodedName = decodeFileName(req.file.originalname);
  }
  questionsController.importQuestions(req, res, next);
});

router.post('/scan-bank', questionsController.scanQuestionBank);

router.post('/clear', questionsController.clearQuestionBank);

router.post('/reset', questionsController.resetAndRescan);

router.get('/:id', questionsController.getQuestion);

router.post('/', questionsController.createQuestion);

router.put('/:id', questionsController.updateQuestion);

router.delete('/:id', questionsController.deleteQuestion);

module.exports = router;
