/**
 * ITEM A - FRESH HANDOVER RESET
 * -----------------------------
 * Clears every transactional record from a portal database so the client
 * receives an empty, ready-to-use system: delivery notes, vouchers, labour
 * entries, workers, materials, stock movements, site logs, customers, custom
 * records and the audit trail.
 *
 * Deliberately KEPT:
 *   - Users (you would lock yourself out otherwise)
 *   - Settings (the particulars catalogue, item columns, roles, sites list)
 *   - Modules (Superadmin-defined custom modules)
 *
 * Counters are reset too, so the first note the client creates is
 * DN-<year>-0001 and the first voucher VCH-<year>-0001 rather than continuing
 * from the demo numbering.
 *
 * Usage (from the backend/ folder):
 *   node scripts/resetAllData.js             # dry run - prints what WOULD be deleted
 *   node scripts/resetAllData.js --confirm   # actually deletes
 *
 * Run this against BOTH the Admin and the Manager database before handover.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const CONFIRM = process.argv.includes('--confirm');

// Loaded defensively - the Manager portal does not ship every model.
function tryModel(name) {
  try {
    return require(`../models/${name}`);
  } catch {
    return null;
  }
}

const TRANSACTIONAL = [
  'DeliveryNote',
  'Voucher',
  'LabourEntry',
  'Worker',
  'Material',
  'StockTransaction',
  'SiteLog',
  'Customer',
  'CustomRecord',
  'AuditLog',
];

async function main() {
  await connectDB();
  console.log(CONFIRM ? '\n== RESET (writing) ==\n' : '\n== DRY RUN - nothing will be deleted ==\n');

  let total = 0;
  for (const name of TRANSACTIONAL) {
    const Model = tryModel(name);
    if (!Model) {
      console.log(`  ${name.padEnd(18)} (not present in this portal - skipped)`);
      continue;
    }
    const count = await Model.countDocuments();
    total += count;
    if (CONFIRM && count > 0) await Model.deleteMany({});
    console.log(`  ${name.padEnd(18)} ${String(count).padStart(6)} ${CONFIRM ? 'deleted' : 'would be deleted'}`);
  }

  // Numbering restarts from 0001 for the client's first real document.
  const Counter = tryModel('Counter');
  if (Counter) {
    const counters = await Counter.countDocuments();
    if (CONFIRM && counters > 0) await Counter.deleteMany({});
    console.log(`  ${'Counter'.padEnd(18)} ${String(counters).padStart(6)} ${CONFIRM ? 'reset' : 'would be reset'}`);
  }

  console.log(`\n  ${total} transactional record(s) in total.`);
  console.log('  Kept: Users, Settings, Modules.\n');
  if (!CONFIRM) console.log('  Re-run with --confirm to apply.\n');

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
