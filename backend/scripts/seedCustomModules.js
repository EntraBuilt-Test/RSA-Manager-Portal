/**
 * CUSTOM MODULE SEEDING
 * ----------------------
 * Seeds the founder-requested custom tabs (Outsourcing Material, Client
 * Material, Site Visits, ...) as real `Module` documents with their field
 * definitions, so they exist as usable tabs out of the box instead of
 * requiring a Superadmin to click through the Module Builder by hand after
 * every fresh deploy/seed.
 *
 * Written in the same shape as scripts/seedModules.js: dry run by default,
 * real write only with --confirm. Safe to re-run - existing modules are
 * matched by `key` and left untouched (a Superadmin's edits survive).
 *
 *   node scripts/seedCustomModules.js            # dry run
 *   node scripts/seedCustomModules.js --confirm  # actually writes
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Module = require('../models/Module');
const { slugifyKey, validateModuleKey } = require('../utils/fieldKey');

// One entry per founder-requested custom module. `fields` uses the same
// shape the Module Builder UI posts (label/type/options/optionsSource/...);
// keys and positions are derived the same way moduleController.createModule
// derives them, so a module seeded here is indistinguishable from one a
// Superadmin built by hand.
const CUSTOM_MODULES = [
  {
    label: 'Outsourcing Material',
    icon: '🚜',
    description: 'Equipment/material rented in from an outside vendor for a site.',
    fields: [
      { label: 'Date', type: 'date', required: true },
      { label: 'Equipment/Material Name', type: 'text', required: true },
      { label: 'Vendor Name', type: 'text' },
      { label: 'Rent Amount', type: 'number' },
      { label: 'Date Taken', type: 'date' },
      { label: 'Date Given/Returned', type: 'date' },
      { label: 'Advance Payment', type: 'number' },
      { label: 'Site/Location', type: 'select', optionsSource: 'settings.sites' },
    ],
  },
  {
    label: 'Site Visits',
    icon: '🏗️',
    description: 'Client site visit log, with the approval drawing and 3D elevation on file.',
    fields: [
      { label: 'Date', type: 'date', required: true },
      { label: 'Client Name', type: 'text', required: true },
      { label: 'Site', type: 'select', optionsSource: 'settings.sites' },
      { label: 'Notes', type: 'text' },
      { label: 'Approval Drawing', type: 'file' },
      { label: '3D Elevation', type: 'file' },
    ],
  },
  {
    label: 'Client Material',
    icon: '📦',
    description: 'Material a client has supplied directly to a site.',
    fields: [
      { label: 'Date', type: 'date', required: true },
      { label: 'Client Name', type: 'text', required: true },
      { label: 'Site', type: 'select', optionsSource: 'settings.sites' },
      { label: 'Material Name', type: 'text', required: true },
      { label: 'Quantity', type: 'number' },
      { label: 'Unit', type: 'text' },
      { label: 'Remarks', type: 'text' },
    ],
  },
];

function buildFields(defs) {
  const seenKeys = [];
  return defs.map((f, i) => {
    const key = slugifyKey(f.label, seenKeys);
    seenKeys.push(key);
    return {
      key,
      label: f.label,
      type: f.type || 'text',
      position: i + 1,
      effect: 'none',
      required: Boolean(f.required),
      options: f.options || [],
      optionsSource: f.type === 'select' ? f.optionsSource || '' : '',
      referenceModule: f.type === 'reference' ? f.referenceModule || '' : '',
      showInTable: f.showInTable !== false,
      showInForm: f.showInForm !== false,
      showInPrint: Boolean(f.showInPrint),
      helpText: f.helpText || '',
      isActive: true,
    };
  });
}

async function run() {
  const confirmed = process.argv.includes('--confirm');
  await connectDB();

  const existing = await Module.find({}).select('key order');
  const existingKeys = existing.map((m) => m.key);
  let maxOrder = existing.reduce((m, x) => Math.max(m, x.order || 0), 0);

  const toCreate = [];
  for (const def of CUSTOM_MODULES) {
    const candidateKey = slugifyKey(def.label).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (validateModuleKey(candidateKey, existingKeys)) continue; // already exists
    maxOrder += 1;
    toCreate.push({
      key: candidateKey,
      label: def.label,
      labelTa: def.labelTa || '',
      icon: def.icon || '📄',
      short: def.label.trim().slice(0, 2).toUpperCase(),
      path: `/m/${candidateKey}`,
      description: def.description || '',
      order: maxOrder,
      isSystem: false,
      isActive: true,
      fields: buildFields(def.fields),
    });
  }

  console.log('--------------------------------------------------');
  console.log('RSA Construction - Custom Module Seeding');
  console.log('--------------------------------------------------');
  console.log(`Modules already in the database: ${existing.length}`);
  console.log(`Modules to insert:               ${toCreate.length}`);
  toCreate.forEach((m) => console.log(`  insert ${m.key.padEnd(20)} "${m.label}" (${m.fields.length} field(s))`));
  console.log('--------------------------------------------------');

  if (toCreate.length === 0) {
    console.log('Nothing to do - every listed custom module already exists.');
    await mongoose.disconnect();
    return;
  }

  if (!confirmed) {
    console.log('DRY RUN - nothing was written.');
    console.log('Re-run with --confirm to insert the modules above:');
    console.log('  node scripts/seedCustomModules.js --confirm');
    await mongoose.disconnect();
    return;
  }

  await Module.insertMany(toCreate);
  console.log(`Inserted ${toCreate.length} custom module(s). They'll appear in the sidebar on next page load.`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Custom module seeding failed:', err);
  process.exit(1);
});
