const multer = require('multer');

// Files are held in memory (not written to local disk) and streamed straight
// to Cloudinary in the controller - this app has no persistent disk in
// production, so nothing should ever be saved to the local filesystem.
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, WEBP, or HEIC/HEIF image files are allowed for the vehicle photo'));
  }
};

const uploadVehiclePhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB max, one file per request
}).single('vehiclePhoto'); // must match the form field name used by the frontend

// Second delivery-note photo (the "next person"/receiver) - same limits and
// filter as the vehicle photo, just a different form field name.
const uploadReceiverPhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('receiverPhoto');

// Custom-module `file`-type fields (e.g. "Approval Drawing", "3D Elevation")
// can reasonably be a photo or a PDF, unlike the vehicle photo which is
// always a camera shot - so this filter is a superset of ALLOWED_MIME_TYPES.
const ALLOWED_MODULE_FILE_MIME_TYPES = new Set([...ALLOWED_MIME_TYPES, 'application/pdf']);
const moduleFileFilter = (req, file, cb) => {
  if (ALLOWED_MODULE_FILE_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, WEBP, HEIC/HEIF images or PDF files are allowed'));
  }
};

const uploadModuleFile = multer({
  storage,
  fileFilter: moduleFileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // 10MB max, one file per request
}).single('file');

// Daily site-log photos (item 7): 2-7 images per submission. The 2-photo
// minimum is enforced in the controller (multer's `files` limit is only a
// maximum), so a clearer message can be given than multer's generic one.
const uploadSiteLogPhotos = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 7 },
}).array('photos', 7);

// Aadhaar card photo scanned on the "New Customer" delivery-note form - same
// limits/filter as the vehicle photo.
const uploadAadhaar = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('aadhaar');

module.exports = {
  uploadVehiclePhoto,
  uploadReceiverPhoto,
  uploadModuleFile,
  uploadSiteLogPhotos,
  uploadAadhaar,
};
