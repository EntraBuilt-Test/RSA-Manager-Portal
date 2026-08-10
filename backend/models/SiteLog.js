const mongoose = require('mongoose');

/**
 * One record per site per day (see item 7's build note): a daily-progress
 * photo set + GPS location for a construction site. Deliberately NOT
 * per-worker/per-LabourEntry - a site has one crew working the same spot on
 * a given day, so attaching the same 2-7 photos to every worker's entry for
 * that site/day would duplicate the same images many times over for no
 * benefit. Re-capturing the same site/day upserts this one record instead of
 * creating a duplicate.
 */
const siteLogSchema = new mongoose.Schema(
  {
    site: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    photos: {
      type: [
        {
          url: { type: String, required: true },
          publicId: { type: String, required: true },
          uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      // Human-readable place name resolved client-side (reverse geocoding) at
      // capture time - stored alongside the raw coordinates (never instead of
      // them) so the UI can show a readable location while lat/lng stay
      // available as the source of truth. Blank if reverse geocoding failed
      // or wasn't reachable at capture time - the UI falls back to lat/lng.
      address: { type: String, default: '' },
      // GPS accuracy radius in meters (navigator.geolocation's
      // coords.accuracy) at capture time - a desktop/laptop browser has no
      // GPS chip and falls back to Wi-Fi/IP positioning, which can be off by
      // kilometers, so this is kept alongside lat/lng to show when a reading
      // shouldn't be trusted.
      accuracy: { type: Number, default: null },
    },
    // Manual fallback when GPS is unavailable/inaccurate on the capturing
    // device (e.g. a desktop browser with no GPS chip) - lets staff type a
    // plain-text location instead of the entry being blocked on a bad fix.
    note: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

siteLogSchema.index({ site: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('SiteLog', siteLogSchema);
