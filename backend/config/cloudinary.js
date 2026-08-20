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

/**
 * Item U: Site Progress Photos was a dead screen on any deployment where the
 * three CLOUDINARY_* variables were not set - it refused the upload outright
 * with a setup error, so the feature simply did not work for the client.
 *
 * Cloudinary is still the right primary store (Render's disk is ephemeral),
 * but a missing key should not stop a foreman on site from saving today's
 * photos. When Cloudinary is not configured - or the upload to it fails - the
 * image is written under backend/uploads/ and served from /uploads, so the
 * feature degrades instead of breaking. The response shape is identical
 * either way, so callers do not care which path was taken.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOCAL_ROOT = path.join(__dirname, '..', 'uploads');

function storeLocally(buffer, folder, originalName = '') {
  const dir = path.join(LOCAL_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });
  const ext = (path.extname(originalName) || '.jpg').toLowerCase();
  const id = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(dir, id), buffer);
  const rel = `${folder}/${id}`.replace(/\\/g, '/');
  return {
    secure_url: `/uploads/${rel}`,
    public_id: `local:${rel}`,
    storage: 'local',
  };
}

/**
 * Stores an image buffer and returns { secure_url, public_id, storage }.
 * Prefers Cloudinary, falls back to local disk. Never throws for a missing
 * Cloudinary configuration.
 */
async function storeImageBuffer(buffer, folder, options = {}, originalName = '') {
  if (isCloudinaryConfigured()) {
    try {
      const result = await uploadBufferToCloudinary(buffer, folder, options);
      return { ...result, storage: 'cloudinary' };
    } catch (err) {
      // Network blip, quota, bad key - still better to keep the photo than
      // to lose the site visit.
      console.warn('[storeImageBuffer] Cloudinary upload failed, falling back to local disk:', err.message);
    }
  }
  return storeLocally(buffer, folder, originalName);
}

module.exports = { cloudinary, isCloudinaryConfigured, uploadBufferToCloudinary, storeImageBuffer, LOCAL_ROOT };
