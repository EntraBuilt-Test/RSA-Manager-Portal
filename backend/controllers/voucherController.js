const Voucher = require('../models/Voucher');
const asyncHandler = require('../utils/asyncHandler');
const generateVoucherNumber = require('../utils/generateVoucherNumber');
const { round2 } = require('../utils/calc');

const PAYMENT_MODES = ['GPay/UPI', 'IMPS', 'RTGS', 'NEFT', 'Cash'];

// POST /api/vouchers
const createVoucher = asyncHandler(async (req, res) => {
  const { date, receivedFrom, receivedBy, purpose, paymentType, paymentMode, upiRefNumber, amount, remarks } = req.body;

  if (!receivedBy || !String(receivedBy).trim()) {
    res.status(400);
    throw new Error('Received By (name) is required');
  }
  if (!purpose || !String(purpose).trim()) {
    res.status(400);
    throw new Error('Purpose is required');
  }
  const amt = round2(Number(amount));
  if (!amt || amt <= 0) {
    res.status(400);
    throw new Error('Amount must be greater than 0');
  }

  const voucherDate = date ? new Date(date) : new Date();
  const voucherNumber = await generateVoucherNumber(voucherDate);

  const voucher = await Voucher.create({
    voucherNumber,
    date: voucherDate,
    receivedFrom: (receivedFrom && String(receivedFrom).trim()) || 'R.S.A CONSTRUCTION',
    receivedBy: String(receivedBy).trim(),
    purpose: String(purpose).trim(),
    paymentType: ['Advance', 'Part', 'Full'].includes(paymentType) ? paymentType : 'Advance',
    paymentMode: PAYMENT_MODES.includes(paymentMode) ? paymentMode : 'Cash',
    upiRefNumber: (upiRefNumber && String(upiRefNumber).trim()) || '',
    amount: amt,
    remarks: remarks || '',
    createdBy: req.user?._id,
  });

  res.status(201).json({ success: true, data: voucher });
});

// GET /api/vouchers?search=&from=&to=
const getVouchers = asyncHandler(async (req, res) => {
  const { search, from, to } = req.query;
  const filter = {};
  if (search) {
    filter.$or = [
      { voucherNumber: new RegExp(search, 'i') },
      { receivedBy: new RegExp(search, 'i') },
      { purpose: new RegExp(search, 'i') },
    ];
  }
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  const vouchers = await Voucher.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, count: vouchers.length, data: vouchers });
});

// GET /api/vouchers/:id
const getVoucher = asyncHandler(async (req, res) => {
  const voucher = await Voucher.findById(req.params.id);
  if (!voucher) {
    res.status(404);
    throw new Error('Voucher not found');
  }
  res.json({ success: true, data: voucher });
});

// DELETE /api/vouchers/:id
const deleteVoucher = asyncHandler(async (req, res) => {
  const voucher = await Voucher.findById(req.params.id);
  if (!voucher) {
    res.status(404);
    throw new Error('Voucher not found');
  }
  await Voucher.deleteOne({ _id: voucher._id });
  res.json({ success: true, data: {} });
});

module.exports = { createVoucher, getVouchers, getVoucher, deleteVoucher };
