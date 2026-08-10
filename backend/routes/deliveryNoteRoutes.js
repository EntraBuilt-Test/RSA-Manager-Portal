const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  uploadVehiclePhoto: uploadVehiclePhotoMiddleware,
  uploadReceiverPhoto: uploadReceiverPhotoMiddleware,
} = require('../middleware/upload');
const {
  getDeliveryNotes,
  getDeliveryNote,
  createDeliveryNote,
  updateDeliveryNote,
  deleteDeliveryNote,
  setPaymentStatus,
  uploadVehiclePhoto,
  removeVehiclePhoto,
  uploadReceiverPhoto,
  removeReceiverPhoto,
  saveSignature,
  recordAdvance,
} = require('../controllers/deliveryNoteController');

// Wraps multer so its errors (file too large, wrong type, etc.) come back as
// a normal JSON error response instead of an unhandled exception.
const handleVehiclePhotoUpload = (req, res, next) => {
  uploadVehiclePhotoMiddleware(req, res, (err) => {
    if (err) {
      res.status(400);
      return next(new Error(err.message || 'Photo upload failed'));
    }
    next();
  });
};

const handleReceiverPhotoUpload = (req, res, next) => {
  uploadReceiverPhotoMiddleware(req, res, (err) => {
    if (err) {
      res.status(400);
      return next(new Error(err.message || 'Photo upload failed'));
    }
    next();
  });
};

const router = express.Router();
router.use(protect);

const itemsValidation = [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.itemName').trim().notEmpty().withMessage('Item name is required'),
  body('items.*.quantity').isFloat({ gt: 0 }).withMessage('Quantity must be greater than 0'),
  body('items.*.rate').isFloat({ min: 0 }).withMessage('Rate cannot be negative'),
];

router.get('/', getDeliveryNotes);
router.get('/:id', getDeliveryNote);
router.post('/', itemsValidation, validate, createDeliveryNote);
router.put('/:id', updateDeliveryNote);
router.delete('/:id', deleteDeliveryNote);
router.patch('/:id/payment-status', setPaymentStatus);
router.post('/:id/vehicle-photo', handleVehiclePhotoUpload, uploadVehiclePhoto);
router.delete('/:id/vehicle-photo', removeVehiclePhoto);
router.post('/:id/receiver-photo', handleReceiverPhotoUpload, uploadReceiverPhoto);
router.delete('/:id/receiver-photo', removeReceiverPhoto);
router.post('/:id/signature', saveSignature);
router.patch('/:id/advance', recordAdvance);

module.exports = router;
