const express = require('express');
const { protect, requireSuperAdmin } = require('../middleware/auth');
const {
  getOverview,
  listModuleData,
  updateModuleRecordExtra,
  exportModuleData,
  getAutomation,
  updateAutomation,
  evaluateAutomation,
} = require('../controllers/superadminController');
const { listAuditLogs, recentChanges } = require('../controllers/auditController');
const { listUsers, createUser, updateUser, deleteUser } = require('../controllers/userAdminController');

const router = express.Router();

// Every route on this router is superadmin-only, without exception - applied
// once here rather than per-route so a future addition can't be added without
// the gate by accident.
router.use(protect, requireSuperAdmin);

router.get('/overview', getOverview);

router.get('/automation', getAutomation);
router.get('/automation/results', evaluateAutomation);
router.put('/automation/:key', updateAutomation);

router.get('/audit', listAuditLogs);
router.get('/audit/recent', recentChanges);

router.get('/users', listUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// '/export' before '/:id' so the literal segment wins over the param route.
router.get('/data/:moduleKey/export', exportModuleData);
router.get('/data/:moduleKey', listModuleData);
router.put('/data/:moduleKey/:id', updateModuleRecordExtra);

module.exports = router;
