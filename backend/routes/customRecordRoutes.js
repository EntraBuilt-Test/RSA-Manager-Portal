const express = require('express');
const { protect, requireSuperAdmin } = require('../middleware/auth');
const { uploadModuleFile: uploadModuleFileMiddleware } = require('../middleware/upload');
const {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  bulkDeleteRecords,
  uploadRecordFile,
} = require('../controllers/customRecordController');

// Wraps multer so its errors (file too large, wrong type, etc.) come back as
// a normal JSON error response instead of an unhandled exception - same
// pattern as deliveryNoteRoutes' handleVehiclePhotoUpload.
const handleModuleFileUpload = (req, res, next) => {
  uploadModuleFileMiddleware(req, res, (err) => {
    if (err) {
      res.status(400);
      return next(new Error(err.message || 'File upload failed'));
    }
    next();
  });
};

const router = express.Router();
router.use(protect);

// Rows of a Superadmin-created tab behave like rows of any other tab: any
// signed-in user can read and enter them. Only the STRUCTURE (which columns
// exist) is superadmin-gated, over in moduleRoutes.
// Declared before '/:moduleKey' so the literal path isn't swallowed by the param.
router.post('/upload', handleModuleFileUpload, uploadRecordFile);
router.get('/:moduleKey', listRecords);
router.post('/:moduleKey', createRecord);
router.post('/:moduleKey/bulk-delete', requireSuperAdmin, bulkDeleteRecords);
router.get('/:moduleKey/:id', getRecord);
router.put('/:moduleKey/:id', updateRecord);
router.delete('/:moduleKey/:id', deleteRecord);

module.exports = router;
