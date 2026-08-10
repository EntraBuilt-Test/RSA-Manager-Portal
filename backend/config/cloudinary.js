const cloudinary = require('cloudinary').v2;

// Vehicle photos are stored on Cloudinary (not the server's local disk) because
// this app is deployed on Render, whose free-tier filesystem is ephemeral -
// anything written to disk is wiped on every restart/redeploy. Cloudinary's
// free tier gives persistent, publicly-viewable image storage with no cost for
// the volumes this app will see.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// True once real Cloudinary credentials are present, so callers can give a
// clear setup error instead of a confusing failure deep inside the SDK.
const isCloudinaryConfigured = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

// Uploads a buffer (from multer memoryStorage) to Cloudinary without ever
// touching the local filesystem. Shared by every controller that accepts an
// upload (delivery note photos/signature, custom-module file fields, ...) so
// there is exactly one place that talks to the Cloudinary SDK.
function uploadBufferToCloudinary(buffer, folder, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', ...options },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

module.exports = { cloudinary, isCloudinaryConfigured, uploadBufferToCloudinary };
