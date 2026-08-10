const express = require('express');
const { protect, requireSuperAdmin } = require('../middleware/auth');
const {
  getSettings,
  addParticular,
  updateParticular,
  moveParticular,
  deleteParticular,
  addCategory,
  updateCategory,
  moveCategory,
  deleteCategory,
  addUnit,
  updateUnit,
  moveUnit,
  deleteUnit,
  addSite,
  updateSite,
  moveSite,
  deleteSite,
  addBrand,
  updateBrand,
  moveBrand,
  deleteBrand,
  addRole,
  updateRole,
  moveRole,
  deleteRole,
  addSheetSize,
  updateSheetSize,
  moveSheetSize,
  deleteSheetSize,
  addColumn,
  updateColumn,
  moveColumn,
  deleteColumn,
} = require('../controllers/settingsController');

const router = express.Router();
router.use(protect);

router.get('/', getSettings);

router.post('/particulars', requireSuperAdmin, addParticular);
router.put('/particulars/:id', requireSuperAdmin, updateParticular);
router.patch('/particulars/:id/move', requireSuperAdmin, moveParticular);
router.delete('/particulars/:id', requireSuperAdmin, deleteParticular);

router.post('/categories', requireSuperAdmin, addCategory);
router.put('/categories/:index', requireSuperAdmin, updateCategory);
router.patch('/categories/:index/move', requireSuperAdmin, moveCategory);
router.delete('/categories/:index', requireSuperAdmin, deleteCategory);
router.delete('/categories', requireSuperAdmin, deleteCategory); // legacy { value } body form

router.post('/units', requireSuperAdmin, addUnit);
router.put('/units/:index', requireSuperAdmin, updateUnit);
router.patch('/units/:index/move', requireSuperAdmin, moveUnit);
router.delete('/units/:index', requireSuperAdmin, deleteUnit);
router.delete('/units', requireSuperAdmin, deleteUnit); // legacy { value } body form

router.post('/sites', requireSuperAdmin, addSite);
router.put('/sites/:index', requireSuperAdmin, updateSite);
router.patch('/sites/:index/move', requireSuperAdmin, moveSite);
router.delete('/sites/:index', requireSuperAdmin, deleteSite);
router.delete('/sites', requireSuperAdmin, deleteSite); // legacy { value } body form

router.post('/brands', requireSuperAdmin, addBrand);
router.put('/brands/:index', requireSuperAdmin, updateBrand);
router.patch('/brands/:index/move', requireSuperAdmin, moveBrand);
router.delete('/brands/:index', requireSuperAdmin, deleteBrand);
router.delete('/brands', requireSuperAdmin, deleteBrand); // legacy { value } body form

router.post('/roles', requireSuperAdmin, addRole);
router.put('/roles/:index', requireSuperAdmin, updateRole);
router.patch('/roles/:index/move', requireSuperAdmin, moveRole);
router.delete('/roles/:index', requireSuperAdmin, deleteRole);
router.delete('/roles', requireSuperAdmin, deleteRole); // legacy { value } body form

router.post('/sheet-sizes', requireSuperAdmin, addSheetSize);
router.put('/sheet-sizes/:index', requireSuperAdmin, updateSheetSize);
router.patch('/sheet-sizes/:index/move', requireSuperAdmin, moveSheetSize);
router.delete('/sheet-sizes/:index', requireSuperAdmin, deleteSheetSize);
router.delete('/sheet-sizes', requireSuperAdmin, deleteSheetSize); // legacy { value } body form

router.post('/columns', requireSuperAdmin, addColumn);
router.put('/columns/:id', requireSuperAdmin, updateColumn);
router.patch('/columns/:id/move', requireSuperAdmin, moveColumn);
router.delete('/columns/:id', requireSuperAdmin, deleteColumn);

module.exports = router;
