const express = require('express');
const router = express.Router();
const lotteryController = require('../controllers/lotteryController');

router.post('/draw', lotteryController.drawLottery);

router.post('/demo', lotteryController.demoDraw);

router.get('/records', lotteryController.getUserLotteryRecords);

router.get('/records/all', lotteryController.getAllLotteryRecords);

router.put('/redeem', lotteryController.updateRedeemStatus);

router.get('/prizes', lotteryController.getPrizes);

module.exports = router;