const express = require('express');
const { protect } = require('../middleware/auth');
const { createVoucher, getVouchers, getVoucher, deleteVoucher } = require('../controllers/voucherController');

const router = express.Router();
router.use(protect);

router.get('/', getVouchers);
router.post('/', createVoucher);
router.get('/:id', getVoucher);
router.delete('/:id', deleteVoucher);

module.exports = router;
