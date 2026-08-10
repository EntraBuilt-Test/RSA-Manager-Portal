const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema(
  {
    materialName: { type: String, required: [true, 'Material name is required'], trim: true },
    category: { type: String, trim: true, default: 'General' },
    brand: { type: String, trim: true, default: '' }, // most recently purchased brand/make
    unit: { type: String, required: [true, 'Unit is required'], trim: true }, // Bags, Tons, Nos, Ft, etc.
    openingStock: { type: Number, default: 0, min: 0 },
    quantityPurchased: { type: Number, default: 0, min: 0 }, // running total purchased
    quantityUsed: { type: Number, default: 0, min: 0 }, // running total used (delivered)
    remainingStock: { type: Number, default: 0 }, // opening + purchased - used, kept in sync
    purchaseRate: { type: Number, default: 0, min: 0 }, // most recent rate
    totalAmount: { type: Number, default: 0, min: 0 }, // most recent purchase amount (qty*rate)
    supplier: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    reorderLevel: { type: Number, default: 0, min: 0 }, // threshold for low-stock alert
  },
  { timestamps: true }
);

materialSchema.index({ materialName: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

module.exports = mongoose.model('Material', materialSchema);
