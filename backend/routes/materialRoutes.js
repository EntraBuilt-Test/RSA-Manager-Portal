const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  getMaterials,
  getMaterial,
  createMaterial,
  updateMaterial,
  deleteMaterial,
} = require('../controllers/materialController');

const router = express.Router();
router.use(protect);

router.get('/', getMaterials);
router.get('/:id', getMaterial);
router.post(
  '/',
  [
    body('materialName').trim().notEmpty().withMessage('Material name is required'),
    body('unit').trim().notEmpty().withMessage('Unit is required'),
    body('quantity').isFloat({ gt: 0 }).withMessage('Quantity must be greater than 0'),
    body('purchaseRate').isFloat({ min: 0 }).withMessage('Purchase rate cannot be negative'),
  ],
  validate,
  createMaterial
);
router.put('/:id', updateMaterial);
router.delete('/:id', deleteMaterial);

module.exports = router;
