const express = require('express');
const router = express.Router();
const prizesController = require('../controllers/prizesController');

router.get('/', prizesController.getAllPrizes);

router.get('/:id', prizesController.getPrizeById);

router.post('/', prizesController.createPrize);

router.put('/:id', prizesController.updatePrize);

router.delete('/:id', prizesController.deletePrize);

router.get('/probability/dynamic', prizesController.getDynamicProbabilities);

module.exports = router;