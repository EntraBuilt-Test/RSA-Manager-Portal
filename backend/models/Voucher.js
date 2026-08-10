const mongoose = require('mongoose');

/**
 * Cash Voucher - mirrors the paper "வவுச்சர்" pad (blue bordered receipt slip)
 * used whenever cash is handed to someone (advance / part / full payment) and
 * they sign to confirm they received it. Printed bilingually (English + Tamil)
 * from VoucherPrint.jsx, same pattern as the Delivery Note pad.
 */
const voucherSchema = new mongoose.Schema(
  {
    voucherNumber: { type: String, required: true, unique: true }, // auto-generated e.g. VCH-2026-0001
    date: { type: Date, required: [true, 'Date is required'], default: Date.now },
    receivedFrom: { type: String, required: [true, 'Received From is required'], trim: true, default: 'R.S.A CONSTRUCTION' },
    receivedBy: { type: String, required: [true, 'Received By (name) is required'], trim: true },
    purpose: { type: String, required: [true, 'Purpose is required'], trim: true },
    paymentType: { type: String, enum: ['Advance', 'Part', 'Full'], default: 'Advance' },
    amount: { type: Number, required: [true, 'Amount is required'], min: [0.01, 'Amount must be greater than 0'] },
    // How the payment moved (not to be confused with paymentType above, which
    // is Advance/Part/Full against the total owed).
    paymentMode: { type: String, enum: ['GPay/UPI', 'IMPS', 'RTGS', 'NEFT', 'Cash'], default: 'Cash' },
    upiRefNumber: { type: String, default: '', trim: true },
    remarks: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

voucherSchema.index({ date: -1 });

module.exports = mongoose.model('Voucher', voucherSchema);
