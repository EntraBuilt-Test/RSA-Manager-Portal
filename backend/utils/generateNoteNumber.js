const Counter = require('../models/Counter');

/**
 * Generates the next Delivery Note serial number for the given year, e.g. DN-2026-0001.
 * Mirrors the "S.No" field on the paper delivery note book, scoped per-year.
 *
 * IMPORTANT: this uses an atomic MongoDB counter (Counter model), NOT a count of
 * existing documents. Counting is unsafe: if a note is ever deleted, or two notes
 * are created at nearly the same instant, counting produces the same "next" number
 * twice and the second save fails with a duplicate-key error. $inc on a single
 * counter document is atomic, so two concurrent requests always get different,
 * strictly increasing numbers.
 *
 * `session` is optional - pass the delivery note's Mongo transaction session so the
 * counter increment rolls back together with the note if the transaction aborts
 * (keeps numbering gap-free on failure, not just collision-free).
 */
async function generateNoteNumber(date = new Date(), session = null) {
  const year = new Date(date).getFullYear();
  const key = `deliveryNote-${year}`;

  const options = { new: true, upsert: true };
  if (session) options.session = session;

  const counter = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, options);
  const seq = String(counter.seq).padStart(4, '0');
  return `DN-${year}-${seq}`;
}

module.exports = generateNoteNumber;
