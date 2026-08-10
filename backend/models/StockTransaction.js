const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema(
  {
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
    type: { type: String, enum: ['IN', 'OUT'], required: true },
    quantity: { type: Number, required: [true, 'Quantity is required'], min: [0.001, 'Quantity must be greater than 0'] },
    rate: { type: Number, default: 0, min: 0 },
    brand: { type: String, trim: true, default: '' }, // brand/make purchased this time (Purchase entries only)
    // How a Purchase entry was paid for - same field/enum shape as
    // Voucher/DeliveryNote's paymentMode+upiRefNumber. Meaningless for OUT
    // (usage) transactions, left at the schema default there.
    paymentMode: { type: String, enum: ['GPay/UPI', 'IMPS', 'RTGS', 'NEFT', 'Cash'], default: 'Cash' },
    upiRefNumber: { type: String, default: '', trim: true },
    balanceAfter: { type: Number, required: true }, // remaining stock snapshot after this txn
    reference: { type: String, default: '' }, // e.g. Delivery Note number, Supplier invoice, "Manual Adjustment"
    referenceType: { type: String, enum: ['DeliveryNote', 'Purchase', 'Manual'], default: 'Manual' },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    date: { type: Date, default: Date.now },
    remarks: { type: String, default: '' },
  },
  { timestamps: true }
);

stockTransactionSchema.index({ materialId: 1, date: -1 });

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);
