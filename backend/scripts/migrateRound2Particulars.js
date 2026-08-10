/**
 * Targeted, one-off migration for Round 2 particulars changes - deliberately
 * NOT a full reseed (seedSettingsOnly.js / seed.js) because those REPLACE the
 * entire particulars array, which would wipe out any rate edits the founder
 * has since made directly in the Superadmin panel on rows this migration
 * doesn't touch (Jacky, Sheets, Welding Machine, etc.). This script only
 * touches the two rows the founder actually asked to change:
 *
 * 1. Core Cutting (no. 29): drop the 3"/4" variants, keep only 1"/2", and
 *    move each kept variant's existing perDayRate value into `rate` (flat
 *    pricing instead of per-day) rather than overwriting with fresh numbers
 *    - preserves whatever the founder may have already edited for 1"/2".
 * 2. Column Box (no. 14): clear its variants/variantSizeSource entirely so
 *    it goes back to a plain Quantity/Rate row - the size dropdown now lives
 *    only on Sheets (no. 15), which this script does not touch.
 *
 * Usage:
 *   node scripts/migrateRound2Particulars.js          (dry run - reports what it would change)
 *   node scripts/migrateRound2Particulars.js --confirm (applies the change)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Settings = require('../models/Settings');

const CONFIRM = process.argv.includes('--confirm');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log(`Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const settings = await Settings.findOne({ singleton: 'default' });
  if (!settings) {
    console.log('No Settings document exists yet - nothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  const coreCutting = settings.particulars.find(
    (p) => p.no === '29' || /core cutting/i.test(p.labelEn || '') || /கோர் கட்டிங்/.test(p.label || '')
  );
  const columnBox = settings.particulars.find(
    (p) => p.no === '14' || /column box/i.test(p.labelEn || '') || /காலம் பாக்ஸ்/.test(p.label || '')
  );

  if (!coreCutting) console.log('Core Cutting particular not found - skipping.');
  if (!columnBox) console.log('Column Box particular not found - skipping.');

  if (coreCutting) {
    const wanted = ['1 inch', '2 inch'];
    const before = coreCutting.variants.map((v) => ({ label: v.label, rate: v.rate, perDayRate: v.perDayRate }));
    const kept = wanted.map((label) => {
      const existing = coreCutting.variants.find((v) => v.label.trim().toLowerCase() === label.toLowerCase());
      const carriedRate = existing ? existing.perDayRate || existing.rate || 0 : 0;
      return { label, rate: carriedRate, perDayRate: 0 };
    });
    console.log('Core Cutting variants BEFORE:', JSON.stringify(before));
    console.log('Core Cutting variants AFTER: ', JSON.stringify(kept));
    if (CONFIRM) coreCutting.variants = kept;
  }

  if (columnBox) {
    console.log(
      `Column Box BEFORE: variantSizeSource=${JSON.stringify(columnBox.variantSizeSource)}, variants=${JSON.stringify(
        columnBox.variants.map((v) => v.label)
      )}`
    );
    console.log('Column Box AFTER:  variantSizeSource="", variants=[]');
    if (CONFIRM) {
      columnBox.variantSizeSource = '';
      columnBox.variants = [];
    }
  }

  if (!CONFIRM) {
    console.log('\nDRY RUN - nothing was changed. Re-run with --confirm to apply.');
  } else {
    await settings.save();
    console.log('\nDone - Settings document updated.');
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
