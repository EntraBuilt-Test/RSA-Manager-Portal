const mongoose = require('mongoose');

/**
 * Labour master record (per "Manager - labour should be handled" / Labour tab
 * spec): one row per worker, mirrors the Material master pattern - a running
 * currentBalance is kept in sync as daily LabourEntry vouchers are posted
 * (wage earned increases it, advance/paid reduce it), so "Balance" is always
 * an up-to-date number rather than something recomputed by hand each time.
 */
const workerSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Worker name is required'], trim: true },
    site: { type: String, trim: true, default: '' },
    role: { type: String, trim: true, default: 'Labour' }, // e.g. Mason, Labour, Helper
    dailyWage: { type: Number, default: 0, min: 0 },
    openingBalance: { type: Number, default: 0 }, // old balance carried in when the worker was first added
    currentBalance: { type: Number, default: 0 }, // running due amount - kept in sync via LabourEntry postings
    vehicle: { type: String, trim: true, default: '' }, // e.g. "Own bike", "TN49AB1234"
    whatsappNumber: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
    remarks: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

workerSchema.index({ site: 1, active: 1 });

module.exports = mongoose.model('Worker', workerSchema);
