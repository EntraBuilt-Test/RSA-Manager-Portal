const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { uploadAadhaar } = require('../middleware/upload');
const { scanAadhaar } = require('../controllers/aadhaarController');
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} = require('../controllers/customerController');

// Wraps multer so its errors (file too large, wrong type, etc.) come back as
// a normal JSON error response instead of an unhandled exception.
const handleAadhaarUpload = (req, res, next) => {
  uploadAadhaar(req, res, (err) => {
    if (err) {
      res.status(400);
      return next(new Error(err.message || 'Upload failed'));
    }
    next();
  });
};

const router = express.Router();
router.use(protect);

// Must come before the /:id param route below so "scan-aadhaar" isn't
// swallowed as an :id lookup.
router.post('/scan-aadhaar', handleAadhaarUpload, scanAadhaar);

router.get('/', getCustomers);
router.get('/:id', getCustomer);
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Customer name is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
  ],
  validate,
  createCustomer
);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;
