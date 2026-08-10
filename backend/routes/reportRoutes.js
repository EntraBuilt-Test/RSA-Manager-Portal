const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getDashboard,
  dailyBillingReport,
  dailyMaterialMovement,
  monthlyRevenueReport,
  monthlyMaterialCostReport,
  yearlySummaryReport,
} = require('../controllers/reportController');
const { exportDeliveryNotesExcel, exportDeliveryNotePDF } = require('../controllers/exportController');

const router = express.Router();
router.use(protect);

router.get('/dashboard', getDashboard);
router.get('/daily-billing', dailyBillingReport);
router.get('/daily-material-movement', dailyMaterialMovement);
router.get('/monthly-revenue', monthlyRevenueReport);
router.get('/monthly-material-cost', monthlyMaterialCostReport);
router.get('/yearly-summary', yearlySummaryReport);
router.get('/export/delivery-notes.xlsx', exportDeliveryNotesExcel);
router.get('/export/delivery-note/:id.pdf', exportDeliveryNotePDF);

module.exports = router;
