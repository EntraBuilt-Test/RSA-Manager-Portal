const mongoose = require('mongoose');

/**
 * One daily voucher line per worker (per "Labour ku Vouchers.. daily sheet"
 * spec): site name, worker name, days worked, salary, old balance (implicit
 * via balanceAfter/worker running balance), advance, total, paid. Mirrors the
 * StockTransaction pattern - name/site/role/wage are snapshotted at posting
 * time so a later change to the Worker master doesn't rewrite history.
 */
const labourEntrySchema = new mongoose.Schema(
  {
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    workerName: { type: String, required: true },
    site: { type: String, trim: true, default: '' },
    role: { type: String, trim: true, default: '' },
    date: { type: Date, required: true, default: Date.now },
    daysWorked: { type: Number, default: 1, min: 0 },
    wageRate: { type: Number, default: 0, min: 0 }, // snapshot of Worker.dailyWage at posting time
    wageEarned: { type: Number, default: 0, min: 0 }, // wageRate x daysWorked
    balanceBefore: { type: Number, default: 0 }, // worker's running balance snapshot BEFORE this entry
    totalDue: { type: Number, default: 0 }, // balanceBefore + wageEarned, before advance/paid are deducted
    advance: { type: Number, default: 0, min: 0 },
    paid: { type: Number, default: 0, min: 0 },
    balanceAfter: { type: Number, required: true }, // worker's running balance snapshot after this entry
    remarks: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

labourEntrySchema.index({ site: 1, date: -1 });
labourEntrySchema.index({ workerId: 1, date: -1 });

module.exports = mongoose.model('LabourEntry', labourEntrySchema);
