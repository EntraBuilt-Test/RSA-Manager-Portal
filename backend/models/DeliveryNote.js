const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: [true, 'Item name is required'], trim: true },
    // Stable link back to Settings.particulars[]._id for the 19 fixed pad rows
    // (16a-16f included). This is what keeps a row's data glued to its correct
    // serial number even if the Superadmin panel later edits/reorders the
    // particulars list - matching happens by this id (or itemName as a
    // fallback for notes saved before this field existed), never by array
    // position. Left null for custom/one-off rows added via "+ Add Custom Item".
    particularId: { type: mongoose.Schema.Types.ObjectId, default: null },
    // The fixed row's serial number ("1".."19", "16a".."16f") at the time this
    // note was saved - kept as a plain snapshot so numbering still displays
    // correctly even offline / before settings load.
    no: { type: String, default: '' },
    quantity: { type: Number, required: [true, 'Quantity is required'], min: [0.001, 'Quantity must be greater than 0'] },
    rate: { type: Number, default: 0, min: [0, 'Rate cannot be negative'] }, // ignored when perDayRate is set (rental item)
    amount: { type: Number, required: true, min: 0 }, // quantity * rate (+/- any extra columns), computed server-side
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', default: null }, // optional link to stock
    // Values for any Superadmin-defined extra columns (e.g. { discount: 50, discountPercent: 5 }),
    // keyed by Settings.itemColumns[].key. Purely additive - if no extra columns are
    // configured, this stays an empty object and nothing about the paper-exact
    // billing behavior changes.
    extra: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Rental billing (Return Date feature): leave perDayRate at 0 for a normal
    // Qty x Rate item. Set it to bill by day instead - amount becomes
    // perDayRate x quantity x days-between(dateTaken, dateReturned or today).
    perDayRate: { type: Number, default: 0, min: 0 },
    monthlyRate: { type: Number, default: 0, min: 0 },
    dateTaken: { type: Date, default: null },
    dateReturned: { type: Date, default: null },
    // The chosen size/rating (e.g. "15a", "250A") when this line's particular
    // has variants. Stored as the label, not an id, so a saved note always
    // shows exactly what was billed even if the variant list is edited later -
    // the same snapshot approach already used for `no`/`itemName`.
    selectedVariant: { type: String, default: '' },
  },
  { _id: false }
);

const deliveryNoteSchema = new mongoose.Schema(
  {
    noteNumber: { type: String, required: true, unique: true }, // auto-generated e.g. DN-2026-0001
    date: { type: Date, required: [true, 'Date is required'], default: Date.now },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: [true, 'Customer is required'] },
    customerNameSnapshot: { type: String, required: true }, // preserved even if customer record changes later
    customerPhoneSnapshot: { type: String, default: '' },
    customerAddressSnapshot: { type: String, default: '' },
    // Indian vehicle registration format, e.g. TN49CH8736 (spaces/hyphens allowed
    // while typing - stripped before matching). Now a required field: every
    // delivery note must record which vehicle carried the material.
    vehicleNumber: {
      type: String,
      required: [true, 'Vehicle number is required'],
      trim: true,
      uppercase: true,
      validate: {
        validator: (v) => {
          if (!v) return false;
          const compact = String(v).replace(/[\s-]/g, '');
          return /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/.test(compact);
        },
        message: 'Vehicle number must be a valid registration number (e.g. TN49CH8736)',
      },
    },
    // Optional photo of the vehicle for this delivery, stored on Cloudinary (not
    // local disk - see backend/config/cloudinary.js for why). Staff can add this
    // once when creating a note; only Admin/Superadmin can replace it afterward
    // (enforced in deliveryNoteController.uploadVehiclePhoto, not here).
    vehiclePhoto: {
      url: { type: String, default: null }, // public HTTPS URL to display/print
      publicId: { type: String, default: null }, // Cloudinary asset id, needed to delete/replace it
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      uploadedAt: { type: Date, default: null },
    },
    // Second photo of whoever received the delivery (the "next person"), same
    // shape and edit rules as vehiclePhoto - see deliveryNoteController's
    // uploadReceiverPhoto/removeReceiverPhoto/canEditReceiverPhoto.
    receiverPhoto: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      uploadedAt: { type: Date, default: null },
    },
    // Drawn signature captured from the print screen's canvas signature pad,
    // uploaded through the same Cloudinary pipeline as the photos above.
    receiverSignature: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
      uploadedAt: { type: Date, default: null },
    },
    // Recorded only through the explicit PATCH /:id/advance action (not part
    // of the general update), so it stays a deliberate, auditable step rather
    // than something that can be silently overwritten by an unrelated edit.
    advanceReceived: { type: Number, default: 0, min: 0 },
    items: {
      type: [itemSchema],
      validate: [(arr) => arr.length > 0, 'At least one item is required'],
    },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
    paymentMode: { type: String, enum: ['GPay/UPI', 'IMPS', 'RTGS', 'NEFT', 'Cash'], default: 'Cash' },
    upiRefNumber: { type: String, default: '', trim: true },
    stockDeducted: { type: Boolean, default: false }, // guards against double-deduction
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

deliveryNoteSchema.index({ date: -1 });
deliveryNoteSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model('DeliveryNote', deliveryNoteSchema);
