const express = require('express');
const { protect, requireSuperAdmin } = require('../middleware/auth');
const {
  getModules,
  getAllModules,
  getModule,
  createModule,
  updateModule,
  reorderModules,
  deleteModule,
  addField,
  updateField,
  reorderFields,
  deleteField,
  restoreField,
} = require('../controllers/moduleController');

const router = express.Router();
router.use(protect);

// Readable by every authenticated user: this metadata drives the sidebar and
// the tables Admin/Manager/Staff see, which is how a Superadmin change reaches
// them with no separate sync step. Mutations stay superadmin-only, matching
// the existing settingsRoutes pattern exactly.
router.get('/', getModules);
router.get('/all', requireSuperAdmin, getAllModules);

// Declared before '/:key' so the literal path isn't swallowed by the param.
router.patch('/reorder', requireSuperAdmin, reorderModules);

router.post('/', requireSuperAdmin, createModule);
router.get('/:key', getModule);
router.put('/:key', requireSuperAdmin, updateModule);
router.delete('/:key', requireSuperAdmin, deleteModule);

router.patch('/:key/fields/reorder', requireSuperAdmin, reorderFields);
router.post('/:key/fields', requireSuperAdmin, addField);
router.put('/:key/fields/:fieldId', requireSuperAdmin, updateField);
router.patch('/:key/fields/:fieldId/restore', requireSuperAdmin, restoreField);
router.delete('/:key/fields/:fieldId', requireSuperAdmin, deleteField);

module.exports = router;
