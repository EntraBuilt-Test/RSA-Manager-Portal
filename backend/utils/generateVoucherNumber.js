const Counter = require('../models/Counter');

/**
 * Generates the next Voucher serial number for the given year, e.g. VCH-2026-0001.
 * Same atomic-counter approach as generateNoteNumber.js (see that file for why
 * counting existing documents would be unsafe) - just a separate counter key
 * ("voucher-<year>") so voucher numbering and delivery-note numbering never collide.
 */
async function generateVoucherNumber(date = new Date(), session = null) {
  const year = new Date(date).getFullYear();
  const key = `voucher-${year}`;

  const options = { new: true, upsert: true };
  if (session) options.session = session;

  const counter = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, options);
  const seq = String(counter.seq).padStart(4, '0');
  return `VCH-${year}-${seq}`;
}

module.exports = generateVoucherNumber;
