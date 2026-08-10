/**
 * ROUND 3 PARTICULAR VARIANTS CONSOLIDATION
 * -------------------------------------------
 * Collapses four more groups of near-duplicate particulars rows into one
 * row each with a variant dropdown, same pattern as the earlier Jacky/
 * Column Box/Core Cutting merge in migrateParticularVariants.js:
 *
 *   - Sheets/Centering (no. 1-8)   -> one "Sheets (Centering)" row (no. 1),
 *                                      8 size variants
 *   - Demolish Machine (no. 25-26) -> one "Demolish Machine" row (no. 25),
 *                                      Big/Small variants
 *   - Wood (no. 33-34)             -> one "Wood" row (no. 33),
 *                                      Cutting Machine/Router Machine variants
 *   - Steel (no. 36-41)            -> one "Steel" row (no. 36),
 *                                      6/8/10/12/16/20mm variants
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
 * items[].particularId), so you can spot-check that history still reads
 * correctly after the merge.
 *
 * Usage (from the backend/ folder):
 *   node scripts/migrateRound3Particulars.js            # dry run
 *   node scripts/migrateRound3Particulars.js --confirm   # actually writes
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Settings = require('../models/Settings');
const DeliveryNote = require('../models/DeliveryNote');

const GROUPS = [
  {
    name: 'Sheets (Centering)',
    no: '1',
    label: 'சீட்டு (சென்டரிங்)',
    labelEn: 'Sheets (Centering)',
    variantNos: ['1', '2', '3', '4', '5', '6', '7', '8'],
    variantLabels: {
      '1': '3\'9" x 2\'0"',
      '2': '3\'0" x 2\'0"',
      '3': '3\'9" x 1\'6"',
      '4': '3\'0" x 1\'6"',
      '5': '3\'9" x 1\'3"',
      '6': '3\'0" x 1\'3"',
      '7': '3\'9" x 1\'0"',
      '8': '3\'0" x 1\'0"',
    },
  },
  {
    name: 'Demolish Machine',
    no: '25',
    label: 'டெமாலிஷ் மெஷின்',
    labelEn: 'Demolish Machine',
    variantNos: ['25', '26'],
    variantLabels: { '25': 'Big', '26': 'Small' },
  },
  {
    name: 'Wood',
    no: '33',
    label: 'வுட்',
    labelEn: 'Wood',
    variantNos: ['33', '34'],
    variantLabels: { '33': 'Cutting Machine', '34': 'Router Machine' },
  },
  {
    name: 'Steel',
    no: '36',
    label: 'ஸ்டீல்',
    labelEn: 'Steel',
    variantNos: ['36', '37', '38', '39', '40', '41'],
    variantLabels: {
      '36': '6mm',
      '37': '8mm',
      '38': '10mm',
      '39': '12mm',
      '40': '16mm',
      '41': '20mm',
    },
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
  console.log('Round 3 Particular Variants Consolidation');
  console.log('--------------------------------------------------');

  const plans = [];
  for (const group of GROUPS) {
    const matched = settings.particulars.filter((p) => group.variantNos.includes(p.no));
    // A row that already carries variants is either the already-merged
    // result of a previous run, or has none of the sibling rows present -
    // either way there's nothing left to merge.
    const alreadyMerged = matched.some((p) => p.variants && p.variants.length > 0);
    if (matched.length === 0 || alreadyMerged || (matched.length === 1 && matched[0].no === group.no)) {
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
    plans.push({ group, matched, variants });
  }

  if (plans.length === 0) {
    console.log('Nothing to do - no matching rows found for any group.');
    await mongoose.disconnect();
    return;
  }

  for (const { group, matched, variants } of plans) {
    console.log(`\n"${group.name}" -> one row (no. ${group.no}): merging ${matched.length} row(s) into variants:`);
    variants.forEach((v) => console.log(`   ${v.label}: rate=${v.rate} perDayRate=${v.perDayRate}`));

    const oldIds = matched.filter((p) => p.no !== group.no).map((p) => String(p._id));
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
    console.log('  node scripts/migrateRound3Particulars.js --confirm');
    await mongoose.disconnect();
    return;
  }

  for (const { group, matched, variants } of plans) {
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
  settings.markModified('particulars');
  await settings.save();

  console.log(`Done. Merged ${plans.length} group(s) into variant rows.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
