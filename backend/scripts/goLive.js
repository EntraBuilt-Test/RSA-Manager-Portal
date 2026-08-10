/**
 * GO-LIVE CLEANUP SCRIPT
 * -----------------------
 * Wipes all demo/dummy business data (customers, delivery notes, materials,
 * stock transactions) from the database while KEEPING:
 *   - Users (so nobody gets locked out of their own login)
 *   - Settings (the Superadmin-managed Particulars/Category/Unit lists -
 *     losing those would mean re-typing the whole pre-printed pad by hand)
 *
 * Run this ONCE, right before a business starts using the app for real,
 * after everyone is done testing/exploring with the seeded demo data.
 *
 * Usage (from the backend/ folder, with a working MONGODB_URI in .env
 * or exported in the shell):
 *
 *   node scripts/goLive.js --confirm
 *
 * The --confirm flag is required on purpose - running this without it
 * only prints what WOULD be deleted (a dry run), so there's no way to
 * trigger the real deletion by accident.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Customer = require('../models/Customer');
const DeliveryNote = require('../models/DeliveryNote');
const Material = require('../models/Material');
const StockTransaction = require('../models/StockTransaction');
const User = require('../models/User');
const Settings = require('../models/Settings');
const Counter = require('../models/Counter');

async function goLive() {
  const confirmed = process.argv.includes('--confirm');

  await connectDB();

  const [customerCount, noteCount, materialCount, txnCount, userCount] = await Promise.all([
    Customer.countDocuments({}),
    DeliveryNote.countDocuments({}),
    Material.countDocuments({}),
    StockTransaction.countDocuments({}),
    User.countDocuments({}),
  ]);

  console.log('--------------------------------------------------');
  console.log('RSA Construction Management System - Go-Live Cleanup');
  console.log('--------------------------------------------------');
  console.log(`Customers to delete:            ${customerCount}`);
  console.log(`Delivery notes to delete:       ${noteCount}`);
  console.log(`Materials to delete:            ${materialCount}`);
  console.log(`Stock transactions to delete:   ${txnCount}`);
  console.log('--------------------------------------------------');
  console.log(`Users KEPT (not touched):       ${userCount}`);
  console.log('Superadmin-managed Settings KEPT (particulars/category/unit lists).');
  console.log('--------------------------------------------------');

  if (!confirmed) {
    console.log('DRY RUN - nothing was deleted.');
    console.log('Re-run with --confirm to actually delete the data above:');
    console.log('  node scripts/goLive.js --confirm');
    await mongoose.disconnect();
    return;
  }

  console.log('Deleting demo/business data (customers, delivery notes, materials, stock transactions)...');
  await Promise.all([
    Customer.deleteMany({}),
    DeliveryNote.deleteMany({}),
    Material.deleteMany({}),
    StockTransaction.deleteMany({}),
    Counter.deleteMany({}),
  ]);

  console.log('Done. The database is now empty of demo business data.');
  console.log('Delivery note numbering (DN-<year>-0001) will restart fresh from here.');
  console.log('Logins and the Superadmin particulars/category/unit lists were left untouched.');
  console.log('');
  console.log('Recommended next step: change the seeded admin password from a real login');
  console.log('session (Admin@123 should not remain the production password).');

  await mongoose.disconnect();
}

goLive().catch((err) => {
  console.error('Go-live cleanup failed:', err);
  process.exit(1);
});
