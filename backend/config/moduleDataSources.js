const DeliveryNote = require('../models/DeliveryNote');
const Material = require('../models/Material');
const LabourEntry = require('../models/LabourEntry');
const Voucher = require('../models/Voucher');
const StockTransaction = require('../models/StockTransaction');

/**
 * Maps each system module key to the real collection behind it, plus the
 * columns the "All Data" screen should show for it.
 *
 * Why a lookup table instead of generic reflection: these six collections have
 * genuinely different shapes and genuinely different business rules, and the
 * Superadmin Portal needs to show them side by side without pretending they're
 * interchangeable. Listing the columns explicitly also means All Data shows
 * exactly the fields an Admin sees on the real screen - no internal bookkeeping
 * fields like `stockDeducted` leaking into a business view.
 *
 * `dashboard` and `reports` are absent on purpose: they render other modules'
 * data and own no collection of their own.
 */
const MODULE_DATA_SOURCES = {
  billing: {
    model: DeliveryNote,
    label: 'Delivery Notes',
    sort: { date: -1 },
    // Editing a delivery note's core fields has to go through
    // deliveryNoteController, which owns the stock-deduction transaction.
    // A generic write here would silently skip it.
    coreEditable: false,
    editRoute: '/billing',
    columns: [
      { key: 'noteNumber', label: 'Note No.', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'customerNameSnapshot', label: 'Customer', type: 'text' },
      { key: 'vehicleNumber', label: 'Vehicle', type: 'text' },
      { key: 'totalAmount', label: 'Total', type: 'number' },
      { key: 'paymentStatus', label: 'Payment', type: 'text' },
    ],
  },
  materials: {
    model: Material,
    label: 'Materials',
    sort: { materialName: 1 },
    coreEditable: false,
    editRoute: '/materials',
    columns: [
      { key: 'materialName', label: 'Material', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'unit', label: 'Unit', type: 'text' },
      { key: 'remainingStock', label: 'Remaining', type: 'number' },
      { key: 'purchaseRate', label: 'Rate', type: 'number' },
      { key: 'supplier', label: 'Supplier', type: 'text' },
      { key: 'reorderLevel', label: 'Reorder Level', type: 'number' },
    ],
  },
  labour: {
    model: LabourEntry,
    label: 'Labour Entries',
    sort: { date: -1 },
    coreEditable: false,
    editRoute: '/labour',
    columns: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'workerName', label: 'Worker', type: 'text' },
      { key: 'site', label: 'Site', type: 'text' },
      { key: 'daysWorked', label: 'Days', type: 'number' },
      { key: 'wageEarned', label: 'Wage', type: 'number' },
      { key: 'advance', label: 'Advance', type: 'number' },
      { key: 'paid', label: 'Paid', type: 'number' },
      { key: 'balanceAfter', label: 'Balance', type: 'number' },
    ],
  },
  voucher: {
    model: Voucher,
    label: 'Vouchers',
    sort: { date: -1 },
    coreEditable: false,
    editRoute: '/voucher',
    columns: [
      { key: 'voucherNumber', label: 'Voucher No.', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'receivedBy', label: 'Received By', type: 'text' },
      { key: 'purpose', label: 'Purpose', type: 'text' },
      { key: 'paymentType', label: 'Type', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'number' },
    ],
  },
  stock: {
    model: StockTransaction,
    label: 'Stock Transactions',
    sort: { date: -1 },
    coreEditable: false,
    editRoute: '/stock',
    columns: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'type', label: 'Type', type: 'text' },
      { key: 'quantity', label: 'Qty', type: 'number' },
      { key: 'rate', label: 'Rate', type: 'number' },
      { key: 'balanceAfter', label: 'Balance', type: 'number' },
      { key: 'reference', label: 'Reference', type: 'text' },
    ],
  },
};

module.exports = { MODULE_DATA_SOURCES };
