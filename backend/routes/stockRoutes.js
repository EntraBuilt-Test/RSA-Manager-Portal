const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getStockSummary,
  getLowStock,
  getMaterialTransactions,
  getLedger,
  manualAdjustment,
} = require('../controllers/stockController');

const router = express.Router();
router.use(protect);

router.get('/', getStockSummary);
router.get('/low-stock', getLowStock);
router.get('/ledger', getLedger);
router.get('/:materialId/transactions', getMaterialTransactions);
router.post('/adjust', manualAdjustment);

module.exports = router;
