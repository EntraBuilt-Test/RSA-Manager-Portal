/**
 * "TESTING 3.0" CLEANUP
 * ----------------------
 * The founder flagged stray "Testing 3.0" text left in some Voucher and
 * Delivery Note records (likely typed in during a demo/testing pass). This
 * scans both collections for any string field containing that literal text
 * (case-insensitive) and blanks just that field - it does not delete the
 * record itself.
 *
 * Idempotent: re-running after a cleanup finds zero matches and changes
 * nothing, so it's safe to run again to double check.
 *
 * Usage (from the backend/ folder):
 *   node scripts/cleanTestingData.js            # dry run - lists what would change
 *   node scripts/cleanTestingData.js --confirm   # actually blanks the matched fields
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Voucher = require('../models/Voucher');
const DeliveryNote = require('../models/DeliveryNote');

const NEEDLE = 'testing 3.0';

// Walks a plain object/array (as returned by .toObject()) and returns a list
// of { path, value } for every string leaf that contains the needle -
// covers top-level fields (Voucher.remarks, DeliveryNote.vehicleNumber, ...)
// and nested ones (DeliveryNote.items[].itemName, .extra{}) alike, so a
// one-off typed note anywhere in the document is still caught.
function findMatches(value, path = '') {
  const matches = [];
  if (typeof value === 'string') {
    if (value.toLowerCase().includes(NEEDLE)) matches.push({ path, value });
    return matches;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => matches.push(...findMatches(v, `${path}[${i}]`)));
    return matches;
  }
  if (value && typeof value === 'object') {
    Object.keys(value).forEach((key) => {
      if (key === '_id' || key === '__v') return;
      matches.push(...findMatches(value[key], path ? `${path}.${key}` : key));
    });
  }
  return matches;
}

// Blanks every matched path on a live Mongoose document (not the plain
// object findMatches walked - that copy is read-only).
function blankPath(doc, path) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let target = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    target = target[parts[i]];
    if (target === undefined || target === null) return;
  }
  target[parts[parts.length - 1]] = '';
}

async function scanCollection(Model, label) {
  const docs = await Model.find({});
  const results = [];
  docs.forEach((doc) => {
    const matches = findMatches(doc.toObject());
    if (matches.length) results.push({ doc, matches });
  });
  console.log(`${label}: ${results.length} record(s) with "Testing 3.0" found (out of ${docs.length} total)`);
  results.forEach(({ doc, matches }) => {
    matches.forEach((m) => console.log(`  ${label} ${doc._id} :: ${m.path} = "${m.value}"`));
  });
  return results;
}

async function run() {
  const confirmed = process.argv.includes('--confirm');
  await connectDB();

  console.log('--------------------------------------------------');
  console.log('"Testing 3.0" cleanup scan (Voucher + DeliveryNote)');
  console.log('--------------------------------------------------');

  const voucherResults = await scanCollection(Voucher, 'Voucher');
  const noteResults = await scanCollection(DeliveryNote, 'DeliveryNote');
  const totalMatches = voucherResults.length + noteResults.length;

  console.log('--------------------------------------------------');
  if (totalMatches === 0) {
    console.log('Nothing to clean up - no "Testing 3.0" text found.');
    await mongoose.disconnect();
    return;
  }

  if (!confirmed) {
    console.log(`DRY RUN - ${totalMatches} record(s) would be updated. Nothing was changed.`);
    console.log('Re-run with --confirm to blank the fields listed above:');
    console.log('  node scripts/cleanTestingData.js --confirm');
    await mongoose.disconnect();
    return;
  }

  let saved = 0;
  for (const { doc, matches } of [...voucherResults, ...noteResults]) {
    matches.forEach((m) => blankPath(doc, m.path));
    try {
      await doc.save();
      saved += 1;
    } catch (err) {
      // A required field (e.g. vehicleNumber) can't be saved blank - report
      // it instead of silently skipping, so it can be fixed by hand.
      console.error(`  Could not save ${doc._id}: ${err.message}`);
    }
  }

  console.log(`Done. Blanked the fields listed above on ${saved}/${totalMatches} record(s).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
