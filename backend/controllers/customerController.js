const Customer = require('../models/Customer');
const DeliveryNote = require('../models/DeliveryNote');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/customers?search=
const getCustomers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = search
    ? { $or: [{ name: new RegExp(search, 'i') }, { phone: new RegExp(search, 'i') }] }
    : {};
  const customers = await Customer.find(filter).sort({ name: 1 });
  res.json({ success: true, count: customers.length, data: customers });
});

// GET /api/customers/:id
const getCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }
  const notes = await DeliveryNote.find({ customer: customer._id }).sort({ date: -1 });
  res.json({ success: true, data: { customer, deliveryNotes: notes } });
});

// POST /api/customers
const createCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.create(req.body);
  res.status(201).json({ success: true, data: customer });
});

// PUT /api/customers/:id
const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }
  res.json({ success: true, data: customer });
});

// DELETE /api/customers/:id
const deleteCustomer = asyncHandler(async (req, res) => {
  const inUse = await DeliveryNote.exists({ customer: req.params.id });
  if (inUse) {
    res.status(400);
    throw new Error('Cannot delete a customer that has delivery notes on record');
  }
  const customer = await Customer.findByIdAndDelete(req.params.id);
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }
  res.json({ success: true, data: {} });
});

module.exports = { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer };
