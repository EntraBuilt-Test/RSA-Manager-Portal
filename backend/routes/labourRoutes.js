const express = require('express');
const { protect } = require('../middleware/auth');
const { uploadSiteLogPhotos: uploadSiteLogPhotosMiddleware } = require('../middleware/upload');
const {
  createEntry,
  getEntries,
  deleteEntry,
  getSiteSheet,
  getConsolidatedSheet,
  getMonthlySalary,
  uploadSiteLogPhotos,
  getSiteLogs,
} = require('../controllers/labourController');

// Wraps multer so its errors (file too large, too few/many files, etc.) come
// back as a normal JSON error response instead of an unhandled exception.
const handleSiteLogPhotosUpload = (req, res, next) => {
  uploadSiteLogPhotosMiddleware(req, res, (err) => {
    if (err) {
      res.status(400);
      return next(new Error(err.message || 'Photo upload failed'));
    }
    next();
  });
};

const router = express.Router();
router.use(protect);

router.get('/entries', getEntries);
router.post('/entries', createEntry);
router.delete('/entries/:id', deleteEntry);
router.get('/site-sheet', getSiteSheet);
router.get('/consolidated', getConsolidatedSheet);
router.get('/monthly-salary', getMonthlySalary);
router.get('/site-log', getSiteLogs);
router.post('/site-log/photos', handleSiteLogPhotosUpload, uploadSiteLogPhotos);

module.exports = router;
