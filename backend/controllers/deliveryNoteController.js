const mongoose = require('mongoose');
const DeliveryNote = require('../models/DeliveryNote');
const Customer = require('../models/Customer');
const Material = require('../models/Material');
const StockTransaction = require('../models/StockTransaction');
const Settings = require('../models/Settings');
const asyncHandler = require('../utils/asyncHandler');
const generateNoteNumber = require('../utils/generateNoteNumber');
const { computeDeliveryNoteTotals, remainingStock } = require('../utils/calc');
const { cloudinary, isCloudinaryConfigured, uploadBufferToCloudinary } = require('../config/cloudinary');

// Staff may add a vehicle photo once (when the note has none yet). Once a
// photo exists, only Admin or Superadmin may replace/remove it - matching the
// "admin/superadmin can edit vehicle photos anytime" requirement.
const PAYMENT_MODES = ['GPay/UPI', 'IMPS', 'RTGS', 'NEFT', 'Cash'];

function canEditVehiclePhoto(user, note) {
  const hasExistingPhoto = Boolean(note.vehiclePhoto && note.vehiclePhoto.url);
  if (!hasExistingPhoto) return true;
  return user.role === 'admin' || user.isSuperAdmin === true;
}

// Same rule as canEditVehiclePhoto, applied to the second ("receiver") photo.
function canEditReceiverPhoto(user, note) {
  const hasExistingPhoto = Boolean(note.receiverPhoto && note.receiverPhoto.url);
  if (!hasExistingPhoto) return true;
  return user.role === 'admin' || user.isSuperAdmin === true;
}

// Fetches the Superadmin-defined extra item columns (Discount, etc.), or an
// empty array if none have been configured - keeps behavior identical to the
// original paper-exact Qty x Rate math unless someone explicitly adds a column.
async function getActiveItemColumns(session) {
  const settings = await Settings.findOne({ singleton: 'default' }).session(session || null);
  return settings ? settings.itemColumns : [];
}

/**
 * Core module connection (per spec "CONNECTION BETWEEN MODULES"):
 * When a Delivery Note is saved, matching materials in stock are reduced automatically.
 * Items are matched to the Material master by explicit materialId first, falling back
 * to a case-insensitive materialName match. Items with no match in the Material master
 * are still billed normally but simply don't move stock (e.g. one-off/custom items).
 *
 * direction: 1 to deduct stock (note created), -1 to restore stock (note deleted/edited away)
 */
async function adjustStockForItems(items, direction, session, reference) {
  for (const item of items) {
    let material = null;
    if (item.materialId) {
      material = await Material.findById(item.materialId).session(session);
    }
    if (!material) {
      material = await Material.findOne({ materialName: new RegExp(`^${escapeRegex(item.itemName)}$`, 'i') }).session(
        session
      );
    }
    if (!material) continue; // not a tracked material - no stock movement

    const deltaUsed = direction * Number(item.quantity);
    material.quantityUsed = Math.max(0, roundQty(material.quantityUsed + deltaUsed));
    material.remainingStock = remainingStock(material.openingStock, material.quantityPurchased, material.quantityUsed);
    await material.save({ session });

    await StockTransaction.create(
      [
        {
          materialId: material._id,
          type: direction === 1 ? 'OUT' : 'IN',
          quantity: Math.abs(item.quantity),
          rate: item.rate,
          balanceAfter: material.remainingStock,
          reference,
          referenceType: 'DeliveryNote',
          date: new Date(),
          remarks: direction === 1 ? 'Auto-deducted on delivery note creation' : 'Auto-restored on delivery note edit/delete',
        },
      ],
      { session }
    );
  }
}

function roundQty(n) {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/delivery-notes?status=&from=&to=&search=&page=&limit=
const getDeliveryNotes = asyncHandler(async (req, res) => {
  const { status, from, to, search, page = 1, limit = 25 } = req.query;
  const filter = {};
  if (status) filter.paymentStatus = status;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  if (search) {
    filter.$or = [
      { noteNumber: new RegExp(search, 'i') },
      { customerNameSnapshot: new RegExp(search, 'i') },
      { vehicleNumber: new RegExp(search, 'i') },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [notes, total] = await Promise.all([
    DeliveryNote.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(Number(limit)),
    DeliveryNote.countDocuments(filter),
  ]);

  res.json({ success: true, count: notes.length, total, page: Number(page), data: notes });
});

// GET /api/delivery-notes/:id  (full detail, used for both edit form and print view)
const getDeliveryNote = asyncHandler(async (req, res) => {
  const note = await DeliveryNote.findById(req.params.id).populate('customer');
  if (!note) {
    res.status(404);
    throw new Error('Delivery note not found');
  }
  res.json({ success: true, data: note });
});

// POST /api/delivery-notes
const createDeliveryNote = asyncHandler(async (req, res) => {
  const { date, customerId, newCustomer, vehicleNumber, items, paymentStatus, paymentMode, upiRefNumber } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('At least one item is required');
  }
  if (!vehicleNumber || !String(vehicleNumber).trim()) {
    res.status(400);
    throw new Error('Vehicle number is required');
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      // Resolve customer: either an existing customerId, or create one inline (newCustomer)
      let customer;
      if (customerId) {
        customer = await Customer.findById(customerId).session(session);
        if (!customer) {
          throw new Error('Selected customer does not exist');
        }
      } else if (newCustomer && newCustomer.name && newCustomer.phone) {
        const created = await Customer.create([newCustomer], { session });
        customer = created[0];
      } else {
        throw new Error('Customer details are required (existing customerId or newCustomer)');
      }

      const itemColumns = await getActiveItemColumns(session);
      const { items: computedItems, totalAmount } = computeDeliveryNoteTotals(items, itemColumns);
      const noteNumber = await generateNoteNumber(date || new Date(), session);

      const created = await DeliveryNote.create(
        [
          {
            noteNumber,
            date: date || new Date(),
            customer: customer._id,
            customerNameSnapshot: customer.name,
            customerPhoneSnapshot: customer.phone,
            customerAddressSnapshot: customer.address,
            vehicleNumber: vehicleNumber || '',
            items: computedItems,
            totalAmount,
            paymentStatus: paymentStatus === 'Paid' ? 'Paid' : 'Pending',
            paymentMode: PAYMENT_MODES.includes(paymentMode) ? paymentMode : 'Cash',
            upiRefNumber: (upiRefNumber && String(upiRefNumber).trim()) || '',
            stockDeducted: true,
            createdBy: req.user ? req.user._id : undefined,
          },
        ],
        { session }
      );
      const note = created[0];

      await adjustStockForItems(computedItems, 1, session, note.noteNumber);

      result = note;
    });

    const populated = await DeliveryNote.findById(result._id).populate('customer');
    res.status(201).json({ success: true, data: populated });
  } finally {
    session.endSession();
  }
});

// PUT /api/delivery-notes/:id  (reverses old stock impact, applies new one)
const updateDeliveryNote = asyncHandler(async (req, res) => {
  const { date, vehicleNumber, items, paymentStatus, paymentMode, upiRefNumber } = req.body;

  if (vehicleNumber !== undefined && !String(vehicleNumber).trim()) {
    res.status(400);
    throw new Error('Vehicle number is required');
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const note = await DeliveryNote.findById(req.params.id).session(session);
      if (!note) {
        throw new Error('Delivery note not found');
      }

      // Reverse previous stock deduction before applying the new item set
      if (note.stockDeducted) {
        await adjustStockForItems(note.items, -1, session, `${note.noteNumber} (revised)`);
      }

      let computedItems = note.items;
      let totalAmount = note.totalAmount;
      if (items && Array.isArray(items) && items.length > 0) {
        const itemColumns = await getActiveItemColumns(session);
        const computed = computeDeliveryNoteTotals(items, itemColumns);
        computedItems = computed.items;
        totalAmount = computed.totalAmount;
      }

      note.date = date || note.date;
      note.vehicleNumber = vehicleNumber !== undefined ? vehicleNumber : note.vehicleNumber;
      note.items = computedItems;
      note.totalAmount = totalAmount;
      note.paymentStatus = paymentStatus || note.paymentStatus;
      note.paymentMode = PAYMENT_MODES.includes(paymentMode) ? paymentMode : note.paymentMode;
      note.upiRefNumber = upiRefNumber !== undefined ? String(upiRefNumber).trim() : note.upiRefNumber;
      note.stockDeducted = true;
      await note.save({ session });

      await adjustStockForItems(computedItems, 1, session, note.noteNumber);

      result = note;
    });

    const populated = await DeliveryNote.findById(result._id).populate('customer');
    res.json({ success: true, data: populated });
  } finally {
    session.endSession();
  }
});

// DELETE /api/delivery-notes/:id  (restores stock that was deducted)
const deleteDeliveryNote = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const note = await DeliveryNote.findById(req.params.id).session(session);
      if (!note) {
        throw new Error('Delivery note not found');
      }
      if (note.stockDeducted) {
        await adjustStockForItems(note.items, -1, session, `${note.noteNumber} (deleted)`);
      }
      await DeliveryNote.deleteOne({ _id: note._id }).session(session);
    });
    res.json({ success: true, data: {} });
  } finally {
    session.endSession();
  }
});

// PATCH /api/delivery-notes/:id/payment-status
const setPaymentStatus = asyncHandler(async (req, res) => {
  const { paymentStatus } = req.body;
  if (!['Paid', 'Pending'].includes(paymentStatus)) {
    res.status(400);
    throw new Error("paymentStatus must be 'Paid' or 'Pending'");
  }
  const note = await DeliveryNote.findByIdAndUpdate(req.params.id, { paymentStatus }, { new: true });
  if (!note) {
    res.status(404);
    throw new Error('Delivery note not found');
  }
  res.json({ success: true, data: note });
});

// POST /api/delivery-notes/:id/vehicle-photo  (multipart, field name "vehiclePhoto")
// Staff: allowed only if this note has no photo yet.
// Admin / Superadmin: allowed anytime, replaces any existing photo.
const uploadVehiclePhoto = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured()) {
    res.status(500);
    throw new Error(
      'Photo storage is not set up yet - CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set in the backend environment variables.'
    );
  }
  if (!req.file) {
    res.status(400);
    throw new Error('No photo file was received. Attach one under the "vehiclePhoto" field.');
  }

  const note = await DeliveryNote.findById(req.params.id);
  if (!note) {
    res.status(404);
    throw new Error('Delivery note not found');
  }

  if (!canEditVehiclePhoto(req.user, note)) {
    res.status(403);
    throw new Error('This note already has a vehicle photo. Only Admin or Superadmin can replace it.');
  }

  const previousPublicId = note.vehiclePhoto ? note.vehiclePhoto.publicId : null;

  const result = await uploadBufferToCloudinary(req.file.buffer, 'rsa-construction/vehicle-photos');

  note.vehiclePhoto = {
    url: result.secure_url,
    publicId: result.public_id,
    uploadedBy: req.user._id,
    uploadedAt: new Date(),
  };
  await note.save();

  // Best-effort cleanup of the old image so replaced photos don't pile up in
  // the Cloudinary account. Failure here must not fail the request - the new
  // photo has already saved successfully.
  if (previousPublicId) {
    cloudinary.uploader.destroy(previousPublicId).catch(() => {});
  }

  res.json({ success: true, data: note });
});

// DELETE /api/delivery-notes/:id/vehicle-photo
// Only Admin / Superadmin may remove a photo outright (same rule as replacing it).
const removeVehiclePhoto = asyncHandler(async (req, res) => {
  const note = await DeliveryNote.findById(req.params.id);
  if (!note) {
    res.status(404);
    throw new Error('Delivery note not found');
  }

  if (!note.vehiclePhoto || !note.vehiclePhoto.url) {
    res.status(400);
    throw new Error('This note has no vehicle photo to remove');
  }

  if (req.user.role !== 'admin' && req.user.isSuperAdmin !== true) {
    res.status(403);
    throw new Error('Only Admin or Superadmin can remove a vehicle photo');
  }

  const publicId = note.vehiclePhoto.publicId;
  note.vehiclePhoto = { url: null, publicId: null, uploadedBy: null, uploadedAt: null };
  await note.save();

  if (publicId) {
    cloudinary.uploader.destroy(publicId).catch(() => {});
  }

  res.json({ success: true, data: note });
});

// POST /api/delivery-notes/:id/receiver-photo  (multipart, field name "receiverPhoto")
// Identical rules/shape to uploadVehiclePhoto, for the second ("next person") photo.
const uploadReceiverPhoto = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured()) {
    res.status(500);
    throw new Error(
      'Photo storage is not set up yet - CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set in the backend environment variables.'
    );
  }
  if (!req.file) {
    res.status(400);
    throw new Error('No photo file was received. Attach one under the "receiverPhoto" field.');
  }

  const note = await DeliveryNote.findById(req.params.id);
  if (!note) {
    res.status(404);
    throw new Error('Delivery note not found');
  }

  if (!canEditReceiverPhoto(req.user, note)) {
    res.status(403);
    throw new Error('This note already has a receiver photo. Only Admin or Superadmin can replace it.');
  }

  const previousPublicId = note.receiverPhoto ? note.receiverPhoto.publicId : null;

  const result = await uploadBufferToCloudinary(req.file.buffer, 'rsa-construction/receiver-photos');

  note.receiverPhoto = {
    url: result.secure_url,
    publicId: result.public_id,
    uploadedBy: req.user._id,
    uploadedAt: new Date(),
  };
  await note.save();

  if (previousPublicId) {
    cloudinary.uploader.destroy(previousPublicId).catch(() => {});
  }

  res.json({ success: true, data: note });
});

// DELETE /api/delivery-notes/:id/receiver-photo
const removeReceiverPhoto = asyncHandler(async (req, res) => {
  const note = await DeliveryNote.findById(req.params.id);
  if (!note) {
    res.status(404);
    throw new Error('Delivery note not found');
  }

  if (!note.receiverPhoto || !note.receiverPhoto.url) {
    res.status(400);
    throw new Error('This note has no receiver photo to remove');
  }

  if (req.user.role !== 'admin' && req.user.isSuperAdmin !== true) {
    res.status(403);
    throw new Error('Only Admin or Superadmin can remove a receiver photo');
  }

  const publicId = note.receiverPhoto.publicId;
  note.receiverPhoto = { url: null, publicId: null, uploadedBy: null, uploadedAt: null };
  await note.save();

  if (publicId) {
    cloudinary.uploader.destroy(publicId).catch(() => {});
  }

  res.json({ success: true, data: note });
});

// POST /api/delivery-notes/:id/signature  { dataUrl: "data:image/png;base64,..." }
// The signature pad on the print screen draws to a <canvas> and exports a data
// URL directly - there's no File object to send as multipart, so this takes
// JSON and converts the base64 payload to a Buffer before handing it to the
// same Cloudinary upload helper every other photo field uses.
const saveSignature = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured()) {
    res.status(500);
    throw new Error(
      'Photo storage is not set up yet - CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set in the backend environment variables.'
    );
  }
  const { dataUrl } = req.body;
  const match = typeof dataUrl === 'string' && dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  if (!match) {
    res.status(400);
    throw new Error('A signature image (PNG/JPEG data URL) is required');
  }

  const note = await DeliveryNote.findById(req.params.id);
  if (!note) {
    res.status(404);
    throw new Error('Delivery note not found');
  }

  const previousPublicId = note.receiverSignature ? note.receiverSignature.publicId : null;
  const buffer = Buffer.from(match[2], 'base64');
  const result = await uploadBufferToCloudinary(buffer, 'rsa-construction/signatures');

  note.receiverSignature = {
    url: result.secure_url,
    publicId: result.public_id,
    uploadedAt: new Date(),
  };
  await note.save();

  if (previousPublicId) {
    cloudinary.uploader.destroy(previousPublicId).catch(() => {});
  }

  res.json({ success: true, data: note });
});

// PATCH /api/delivery-notes/:id/advance  { advanceReceived }
// Deliberately separate from updateDeliveryNote so recording an advance is
// always an explicit, auditable action rather than something that can be
// silently overwritten by an unrelated field edit.
const recordAdvance = asyncHandler(async (req, res) => {
  const amount = Number(req.body.advanceReceived);
  if (!Number.isFinite(amount) || amount < 0) {
    res.status(400);
    throw new Error('advanceReceived must be a non-negative number');
  }
  const note = await DeliveryNote.findByIdAndUpdate(req.params.id, { advanceReceived: amount }, { new: true });
  if (!note) {
    res.status(404);
    throw new Error('Delivery note not found');
  }
  res.json({ success: true, data: note });
});

module.exports = {
  getDeliveryNotes,
  getDeliveryNote,
  createDeliveryNote,
  updateDeliveryNote,
  deleteDeliveryNote,
  setPaymentStatus,
  uploadVehiclePhoto,
  removeVehiclePhoto,
  uploadReceiverPhoto,
  removeReceiverPhoto,
  saveSignature,
  recordAdvance,
};
