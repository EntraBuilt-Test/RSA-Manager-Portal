/**
 * PARTICULAR VARIANTS CONSOLIDATION
 * -----------------------------------
 * Collapses three groups of near-duplicate particulars rows into one row
 * each with size/rating variants (see item 1 of the founder spec):
 *   - Column Box (no. 14) + its six indented size sub-rows (15a-15f) -> row
 *     14 keeps its no/label, gains 6 variants; rows 15a-15f are removed.
 *   - Jacky 7/10/20 Feet (no. 10-12)  -> one "Jacky" row (no. 10), 3 variants
 *   - Core Cutting 1-4in (no. 29-32)  -> one "Core Cutting" row (no. 29), 4 variants
 *
 * Reads each row's CURRENT rate/perDayRate from the live document (not the
 * original seed defaults), so any customization already made through the
 * Superadmin panel before running this is preserved as the variant's rate
 * rather than silently overwritten.
 *
 * Existing Delivery Notes are NOT rewritten - they keep their own `no`/
 * `itemName` snapshot (per DeliveryNote.itemSchema's existing backward-compat
 * design), so already-saved notes keep displaying correctly regardless of
 * what happens to the live particulars list. This script only prints which
 * saved notes reference the about-to-be-removed rows' old _ids (via
 * items[].particularId), so the founder can spot-check that history still
 * reads correctly after the merge.
 *
 * Usage (from the backend/ folder):
 *   node scripts/migrateParticularVariants.js            # dry run
 *   node scripts/migrateParticularVariants.js --confirm   # actually writes
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Settings = require('../models/Settings');
const DeliveryNote = require('../models/DeliveryNote');

// Each group either has a `parentNo` (a row that survives and gains
// variants, e.g. Column Box) or not (all matched rows collapse into one new
// row using `no`/`label`/`labelEn`, e.g. Jacky/Core Cutting - none of the
// individual siblings was "the general" row).
const GROUPS = [
  {
    name: 'Column Box',
    parentNo: '14',
    variantNos: ['15a', '15b', '15c', '15d', '15e', '15f'],
    variantLabels: {
      '15a': '9" x 9"',
      '15b': '1\'0" x 9"',
      '15c': '1\'3" x 9"',
      '15d': '1\'6" x 9"',
      '15e': '1\'3" x 1\'0"',
      '15f': '1\'6" x 1\'0"',
    },
  },
  {
    name: 'Jacky',
    no: '10',
    label: 'ஜாக்கி',
    labelEn: 'Jacky',
    variantNos: ['10', '11', '12'],
    variantLabels: { '10': '7 Feet', '11': '10 Feet', '12': '20 Feet' },
  },
  {
    name: 'Core Cutting',
    no: '29',
    label: 'கோர் கட்டிங்',
    labelEn: 'Core Cutting',
    variantNos: ['29', '30', '31', '32'],
    variantLabels: { '29': '1 inch', '30': '2 inch', '31': '3 inch', '32': '4 inch' },
  },
];

async function run() {
  const confirmed = process.argv.includes('--confirm');
  await connectDB();

  const settings = await Settings.findOne({ singleton: 'default' });
  if (!settings) {
    console.log('No Settings document found - nothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  console.log('--------------------------------------------------');
  console.log('Particular Variants Consolidation');
  console.log('--------------------------------------------------');

  const plans = [];
  for (const group of GROUPS) {
    const matched = settings.particulars.filter((p) => group.variantNos.includes(p.no));
    // A row that already carries variants is either the already-merged
    // result of a previous run, or (for the Column Box case) the parent row
    // itself before its children are folded in - either way it must not be
    // reinterpreted as one more sibling to merge.
    const alreadyMerged = matched.some((p) => p.variants && p.variants.length > 0 && p.no !== group.parentNo);
    if (matched.length === 0 || alreadyMerged || (matched.length === 1 && matched[0].no === group.parentNo)) {
      console.log(`Skip "${group.name}": already migrated (or no matching rows found)`);
      continue;
    }
    const variants = matched
      .slice()
      .sort((a, b) => group.variantNos.indexOf(a.no) - group.variantNos.indexOf(b.no))
      .map((p) => ({
        label: group.variantLabels[p.no] || p.labelEn || p.label,
        rate: p.defaultRate || 0,
        perDayRate: p.defaultPerDayRate || 0,
      }));
    const parent = group.parentNo ? settings.particulars.find((p) => p.no === group.parentNo) : null;
    if (group.parentNo && !parent) {
      console.log(`Skip "${group.name}": parent row no. ${group.parentNo} not found`);
      continue;
    }
    plans.push({ group, matched, parent, variants });
  }

  if (plans.length === 0) {
    console.log('Nothing to do - no matching rows found for any group.');
    await mongoose.disconnect();
    return;
  }

  for (const { group, matched, parent, variants } of plans) {
    const targetLabel = parent ? `${parent.labelEn || parent.label} (no. ${parent.no})` : `${group.labelEn} (no. ${group.no})`;
    console.log(`\n"${group.name}" -> ${targetLabel}: merging ${matched.length} row(s) into variants:`);
    variants.forEach((v) => console.log(`   ${v.label}: rate=${v.rate} perDayRate=${v.perDayRate}`));

    const oldIds = matched.filter((p) => p.no !== group.parentNo).map((p) => String(p._id));
    if (oldIds.length) {
      const referencingNotes = await DeliveryNote.find({ 'items.particularId': { $in: oldIds } }).select('noteNumber');
      if (referencingNotes.length) {
        console.log(`   Referenced by ${referencingNotes.length} existing delivery note(s) (unaffected - they keep their own no/itemName snapshot):`);
        referencingNotes.forEach((n) => console.log(`     - ${n.noteNumber}`));
      }
    }
  }

  console.log('--------------------------------------------------');

  if (!confirmed) {
    console.log('DRY RUN - nothing was changed.');
    console.log('Re-run with --confirm to apply the merge above:');
    console.log('  node scripts/migrateParticularVariants.js --confirm');
    await mongoose.disconnect();
    return;
  }

  for (const { group, matched, parent, variants } of plans) {
    if (parent) {
      // Column Box: row 14 survives (stays in the array, just gains
      // variants) - only the 15a-15f sub-rows are removed.
      const removeIds = matched.map((p) => String(p._id));
      settings.particulars = settings.particulars.filter((p) => !removeIds.includes(String(p._id)));
      const stillThere = settings.particulars.find((p) => String(p._id) === String(parent._id));
      stillThere.variants = variants;
    } else {
      // Jacky/Core Cutting: every matched row collapses into one brand-new row.
      const minOrder = Math.min(...matched.map((p) => p.order));
      const removeIds = matched.map((p) => String(p._id));
      settings.particulars = settings.particulars.filter((p) => !removeIds.includes(String(p._id)));
      settings.particulars.push({
        no: group.no,
        label: group.label,
        labelEn: group.labelEn,
        defaultRate: 0,
        defaultPerDayRate: 0,
        defaultMonthlyRate: 0,
        order: minOrder,
        variants,
      });
    }
  }
  settings.markModified('particulars');
  await settings.save();

  console.log(`Done. Merged ${plans.length} group(s) into variant rows.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
