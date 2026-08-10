/**
 * MODULE REGISTRY MIGRATION
 * -------------------------
 * One-time (idempotent) script that seeds the seven tabs that are currently
 * hardcoded in `frontend/src/components/Layout/Layout.jsx` into the new
 * `Modules` collection, so the sidebar can switch from a hardcoded array to a
 * database-driven one without anything disappearing on cutover.
 *
 * Written in the same shape as scripts/goLive.js and scripts/seedSettingsOnly.js:
 * dry run by default, real write only with --confirm.
 *
 *   node scripts/seedModules.js            # dry run - prints what it would do
 *   node scripts/seedModules.js --confirm  # actually writes
 *
 * Safe to re-run. Existing modules are matched by `key` and are NOT
 * overwritten - a Superadmin who has already renamed "Voucher" to "Cash
 * Vouchers" or reordered the nav keeps their changes. Only genuinely missing
 * modules are inserted.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Module = require('../models/Module');
const AuditLog = require('../models/AuditLog');
const { SYSTEM_MODULES } = require('../config/systemModules');

async function seedModules() {
  const confirmed = process.argv.includes('--confirm');

  await connectDB();

  const existing = await Module.find({}).select('key label isSystem order');
  const existingKeys = existing.map((m) => m.key);
  const missing = SYSTEM_MODULES.filter((m) => !existingKeys.includes(m.key));

  console.log('--------------------------------------------------');
  console.log('RSA Construction - Module Registry Migration');
  console.log('--------------------------------------------------');
  console.log(`Modules already in the database: ${existing.length}`);
  existing.forEach((m) => console.log(`  kept   ${m.key.padEnd(12)} "${m.label}"`));
  console.log(`Modules to insert:               ${missing.length}`);
  missing.forEach((m) => console.log(`  insert ${m.key.padEnd(12)} "${m.label}"  -> ${m.path}`));
  console.log('--------------------------------------------------');

  if (missing.length === 0) {
    console.log('Nothing to do - every system module is already registered.');
    await mongoose.disconnect();
    return;
  }

  if (!confirmed) {
    console.log('DRY RUN - nothing was written.');
    console.log('Re-run with --confirm to insert the modules above:');
    console.log('  node scripts/seedModules.js --confirm');
    await mongoose.disconnect();
    return;
  }

  // `fields: []` on purpose: these seven modules start with no EXTRA fields.
  // Their real columns stay where they already are, owned by their existing
  // Mongoose models and screens. A Superadmin adds extras on top from the
  // Field Manager, and those land in each document's `extra` map.
  const created = await Module.insertMany(
    missing.map((m) => ({ ...m, isSystem: true, isActive: true, fields: [] }))
  );

  await AuditLog.create({
    user: null,
    userName: 'migration script',
    action: 'create',
    entity: 'module',
    entityKey: created.map((m) => m.key).join(', '),
    summary: `Seeded ${created.length} system module(s) into the module registry`,
    after: created.map((m) => ({ key: m.key, label: m.label, order: m.order })),
    source: 'script',
  });

  console.log(`Inserted ${created.length} system module(s).`);
  console.log('The sidebar will now render from the database on the next page load.');
  console.log('Existing Delivery Note item columns are untouched and still live in Settings.itemColumns.');

  await mongoose.disconnect();
}

seedModules().catch((err) => {
  console.error('Module registry migration failed:', err);
  process.exit(1);
});
