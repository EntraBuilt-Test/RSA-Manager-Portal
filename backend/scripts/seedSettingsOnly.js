/**
 * ONE-TIME SETTINGS SEEDER
 * -------------------------
 * Populates the Superadmin-managed Settings document (Delivery Note
 * particulars list + Material category/unit suggestion lists) with the
 * original 19-row pad list - WITHOUT touching any other collection
 * (customers, delivery notes, materials, stock transactions, users are
 * completely untouched).
 *
 * Why this exists: the very first production seed (before the Superadmin
 * feature was built) never created a Settings document, so the Delivery
 * Note form was quietly falling back to a hardcoded 19-row list baked into
 * the frontend. The moment a real Superadmin edit was made (e.g. adding a
 * custom row), the database's particulars list became the ONLY source of
 * truth again and it was empty except for that one new row - so the form
 * showed just the one custom row instead of 19 + custom.
 *
 * This script fixes that by writing the real 19-row list (plus default
 * Material categories/units) into the database once, so Superadmin is
 * managing the actual full list from here on.
 *
 * WARNING: this OVERWRITES whatever is currently in the Settings document
 * (so any custom particulars/categories/units added through the Superadmin
 * panel before running this will be replaced by the standard list below).
 * If you've already made real customizations you want to keep, note them
 * down before running this with --confirm, then re-add them afterward.
 *
 * Usage (from the backend/ folder):
 *   node scripts/seedSettingsOnly.js            # dry run - shows what's there now, changes nothing
 *   node scripts/seedSettingsOnly.js --confirm   # actually overwrite Settings with the standard list
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Settings = require('../models/Settings');

// Same list as backend/seed/seed.js - kept in sync manually since the two
// scripts serve different purposes (full demo seed vs. settings-only fix).
// Row order: Clamp/Jacky/Column Pin/Column Box(+sizes)/Generator/Earth Wire/
// Supporting come first (9-18), Adjustment Sheet and Lifting/Vibrator Machine
// moved to the end (19-20). Each row now also carries an English label
// (`labelEn`) so the Create Delivery Note form can switch wording with the
// language toggle instead of always showing Tamil.
const SEED_PARTICULARS = [
  // Sheets (Centering): was 8 separate rows (1-8), now one row with 8 size
  // variants - same "one row, many variants" pattern as Jacky/Welding
  // Machine below. Named "(Centering)" to stay distinct from row 15
  // "Sheets" (the smaller Column Box sizes).
  {
    no: '1',
    label: 'சீட்டு (சென்டரிங்)',
    labelEn: 'Sheets (Centering)',
    variants: [
      { label: '3\'9" x 2\'0"', rate: 0, perDayRate: 0 },
      { label: '3\'0" x 2\'0"', rate: 0, perDayRate: 0 },
      { label: '3\'9" x 1\'6"', rate: 0, perDayRate: 0 },
      { label: '3\'0" x 1\'6"', rate: 0, perDayRate: 0 },
      { label: '3\'9" x 1\'3"', rate: 0, perDayRate: 0 },
      { label: '3\'0" x 1\'3"', rate: 0, perDayRate: 0 },
      { label: '3\'9" x 1\'0"', rate: 0, perDayRate: 0 },
      { label: '3\'0" x 1\'0"', rate: 0, perDayRate: 0 },
    ],
  },
  { no: '9', label: 'கிளாம்பு', labelEn: 'Clamp' },
  // Jacky: was 3 separate rows (7/10/20 Feet), now one row with 3 variants.
  {
    no: '10',
    label: 'ஜாக்கி',
    labelEn: 'Jacky',
    variants: [
      { label: '7 Feet', rate: 0, perDayRate: 0 },
      { label: '10 Feet', rate: 0, perDayRate: 0 },
      { label: '20 Feet', rate: 0, perDayRate: 0 },
    ],
  },
  { no: '13', label: 'காலம் ஆணி', labelEn: 'Column Pin/Nail' },
  // Column Box: plain row, no variant dropdown - the 6 sheet-size options
  // moved exclusively to "Sheets" below (round 2 direction: Column Box and
  // Sheets should NOT both show the size dropdown).
  { no: '14', label: 'காலம் பாக்ஸ் (போல்ட் நட் உள்பட)', labelEn: 'Column Box (incl. bolt & nut)' },
  // Sheets: shares Column Box's size options (via sheetSizeOptions) but
  // bills each size at its own, independent rate - rates below are
  // PLACEHOLDERS, flag to the founder to confirm real per-size Sheet rates.
  {
    no: '15',
    label: 'சீட்டு',
    labelEn: 'Sheets',
    variantSizeSource: 'settings.sheetSizeOptions',
    variants: [
      { label: '9" x 9"', rate: 0, perDayRate: 0 },
      { label: '1\'0" x 9"', rate: 0, perDayRate: 0 },
      { label: '1\'3" x 9"', rate: 0, perDayRate: 0 },
      { label: '1\'6" x 9"', rate: 0, perDayRate: 0 },
      { label: '1\'3" x 1\'0"', rate: 0, perDayRate: 0 },
      { label: '1\'6" x 1\'0"', rate: 0, perDayRate: 0 },
    ],
  },
  { no: '16', label: 'ஜெனரேட்டர்', labelEn: 'Generator', defaultPerDayRate: 1000 },
  { no: '17', label: 'எர்த் வயர்', labelEn: 'Earth Wire' },
  { no: '18', label: 'சப்போர்ட்டிங் (சாரம் போட்டு தரப்படும்)', labelEn: 'Supporting (Scaffolding - provided with support)' },
  { no: '19', label: 'அட்ஜஸ்ட்மெண்ட் சீட்டு', labelEn: 'Adjustment Sheet' },
  { no: '20', label: 'லிப்டிங் மெஷின் / வைப்ரேட்டர் மெஷின்', labelEn: 'Lifting Machine / Vibrator Machine' },
  { no: '21', label: 'லிப்ட் மெஷின்', labelEn: 'Lift Machine', defaultPerDayRate: 1500, defaultMonthlyRate: 15000 },
  { no: '22', label: 'சுவர் வெட்டும் இயந்திரம் 16 இன்ச்', labelEn: 'Wall Cutter Machine 16inch', defaultPerDayRate: 1500 },
  { no: '23', label: 'எர்த் ரேம்மர்', labelEn: 'Earth Rammer', defaultPerDayRate: 1500 },
  { no: '24', label: 'சாரக்கட்டு', labelEn: 'Sucff holding', defaultRate: 2 },
  // Demolish Machine: was 2 separate rows (25-26), now one row with a
  // Big/Small variant dropdown.
  {
    no: '25',
    label: 'டெமாலிஷ் மெஷின்',
    labelEn: 'Demolish Machine',
    variants: [
      { label: 'Big', rate: 0, perDayRate: 800 },
      { label: 'Small', rate: 0, perDayRate: 500 },
    ],
  },
  // Welding Machine: founder's literal rating->price numbers, UNCONFIRMED -
  // flag to the founder before these go live (see final report).
  {
    no: '27',
    label: 'வெல்டிங் மெஷின்',
    labelEn: 'Welding Machine',
    defaultPerDayRate: 500,
    variants: [
      { label: '200A', rate: 0, perDayRate: 500 },
      { label: '250A', rate: 0, perDayRate: 600 },
      { label: '350A', rate: 0, perDayRate: 800 },
    ],
  },
  { no: '28', label: 'ஹேண்ட் கட்டர்', labelEn: 'Hand Cutter', defaultPerDayRate: 150 },
  // Core Cutting: flat per-variant Rate (not Per-Day Rate), only 1"/2"
  // offered per founder direction (3"/4" removed).
  {
    no: '29',
    label: 'கோர் கட்டிங்',
    labelEn: 'Core Cutting',
    variants: [
      { label: '1 inch', rate: 600, perDayRate: 0 },
      { label: '2 inch', rate: 800, perDayRate: 0 },
    ],
  },
  // Wood: was 2 separate rows (33-34), now one row with a Cutting
  // Machine/Router Machine variant dropdown.
  {
    no: '33',
    label: 'வுட்',
    labelEn: 'Wood',
    variants: [
      { label: 'Cutting Machine', rate: 0, perDayRate: 650 },
      { label: 'Router Machine', rate: 0, perDayRate: 650 },
    ],
  },
  // Jacket Span: founder-confirmed per-day rates (10 Feet = Rs5/day, 14 Feet = Rs8/day).
  {
    no: '35',
    label: 'ஜாக்கெட் ஸ்பேன்',
    labelEn: 'Jacket Span',
    variants: [
      { label: '10 Feet', rate: 0, perDayRate: 5 },
      { label: '14 Feet', rate: 0, perDayRate: 8 },
    ],
  },
  // Steel: was 6 separate rows (36-41), now one row with a mm-size variant
  // dropdown.
  {
    no: '36',
    label: 'ஸ்டீல்',
    labelEn: 'Steel',
    variants: [
      { label: '6mm', rate: 0, perDayRate: 0 },
      { label: '8mm', rate: 0, perDayRate: 0 },
      { label: '10mm', rate: 0, perDayRate: 0 },
      { label: '12mm', rate: 0, perDayRate: 0 },
      { label: '16mm', rate: 0, perDayRate: 0 },
      { label: '20mm', rate: 0, perDayRate: 0 },
    ],
  },
  { no: '42', label: 'பைண்டிங் வயர்', labelEn: 'Binding Wire' },
];
const SEED_MATERIAL_CATEGORIES = ['General', 'Structural', 'Equipment Rental', 'Electrical', 'Plumbing'];
const SEED_MATERIAL_UNITS = ['Bags', 'Tons', 'Nos', 'Ft', 'Kg', 'Ltr'];
const SEED_MATERIAL_BRANDS = ['Tata', 'Amman', 'Aditya', 'Shyam', 'Dalmia', 'UltraTech', 'Arasu', 'JSW'];
// Shared size list for Column Box + Sheets (see variantSizeSource on both rows above).
const SEED_SHEET_SIZE_OPTIONS = [
  '9" x 9"',
  '1\'0" x 9"',
  '1\'3" x 9"',
  '1\'6" x 9"',
  '1\'3" x 1\'0"',
  '1\'6" x 1\'0"',
];
const SEED_WORKER_ROLES = [
  'Labour (Male)',
  'Labour (Female)',
  'Carpenter',
  'Electrical',
  'Tiles Layer',
  'False Ceiling Labour',
  'Mason',
  'Centering – Fitter',
  'Centering – Helper',
  'Welder',
  'Electrician',
  'Plumber',
  'Vendor',
  'Kamatchi Concrete',
  'Other',
];

async function run() {
  const confirmed = process.argv.includes('--confirm');
  await connectDB();

  const existing = await Settings.findOne({ singleton: 'default' });

  console.log('--------------------------------------------------');
  console.log('Settings-only seed (Delivery Note particulars + Material categories/units)');
  console.log('--------------------------------------------------');
  if (existing) {
    console.log(`Current particulars in database: ${existing.particulars.length}`);
    console.log(`  ${existing.particulars.map((p) => `${p.no || '(no no.)'} ${p.label}`).join('\n  ')}`);
    console.log(`Current material categories: ${existing.materialCategories.join(', ') || '(none)'}`);
    console.log(`Current material units: ${existing.materialUnits.join(', ') || '(none)'}`);
    console.log(`Current material brands: ${(existing.materialBrands || []).join(', ') || '(none)'}`);
    console.log(`Current worker roles: ${(existing.workerRoles || []).join(', ') || '(none)'}`);
    console.log(`Current sheet sizes: ${(existing.sheetSizeOptions || []).join(', ') || '(none)'}`);
  } else {
    console.log('No Settings document exists yet in the database.');
  }
  console.log('--------------------------------------------------');
  console.log(`Will be REPLACED with: ${SEED_PARTICULARS.length} standard particulars, `);
  console.log(`  categories [${SEED_MATERIAL_CATEGORIES.join(', ')}], units [${SEED_MATERIAL_UNITS.join(', ')}]`);
  console.log(`  brands [${SEED_MATERIAL_BRANDS.join(', ')}], roles [${SEED_WORKER_ROLES.join(', ')}]`);
  console.log(`  sheet sizes [${SEED_SHEET_SIZE_OPTIONS.join(', ')}]`);
  console.log('--------------------------------------------------');
  console.log('This script does NOT touch users, customers, delivery notes, materials, or stock transactions.');

  if (!confirmed) {
    console.log('DRY RUN - nothing was changed.');
    console.log('Re-run with --confirm to apply the standard list above:');
    console.log('  node scripts/seedSettingsOnly.js --confirm');
    await mongoose.disconnect();
    return;
  }

  const particulars = SEED_PARTICULARS.map((p, idx) => ({
    no: p.no,
    label: p.label,
    labelEn: p.labelEn,
    defaultRate: p.defaultRate || 0,
    defaultPerDayRate: p.defaultPerDayRate || 0,
    defaultMonthlyRate: p.defaultMonthlyRate || 0,
    order: idx,
    variants: p.variants || [],
    variantSizeSource: p.variantSizeSource || '',
  }));

  await Settings.findOneAndUpdate(
    { singleton: 'default' },
    {
      singleton: 'default',
      particulars,
      materialCategories: SEED_MATERIAL_CATEGORIES,
      materialUnits: SEED_MATERIAL_UNITS,
      materialBrands: SEED_MATERIAL_BRANDS,
      workerRoles: SEED_WORKER_ROLES,
      sheetSizeOptions: SEED_SHEET_SIZE_OPTIONS,
    },
    { upsert: true, new: true }
  );

  console.log('Done. The Settings document now has the standard 20-row particulars list');
  console.log('and default Material categories/units. Refresh the app - the Create Delivery');
  console.log('Note form and the Superadmin panel will now show the full list.');
  console.log('Any custom rows/categories/units added before this (e.g. a test entry) were');
  console.log('replaced - re-add them through the Superadmin panel if you still want them.');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Settings seed failed:', err);
  process.exit(1);
});
