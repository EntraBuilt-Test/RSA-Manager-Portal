/**
 * CREATE / RESET THE MANAGER PORTAL LOGIN
 * ----------------------------------------
 * The Manager Portal (frontend/) is a separate, cut-down frontend deployment
 * that talks to this SAME backend/database as the Admin Portal - no backend
 * or schema changes were needed for it (role: 'manager' already existed on
 * the User model). This script just creates (or, if it already exists,
 * resets the password on) the one login the Manager Portal uses:
 *
 *   email:    Manager@Rsaconstruction.com
 *   password: Manager@123
 *   role:     manager
 *
 * Run this ONCE against the live database (the same MONGODB_URI the Render
 * backend uses), from the backend/ folder:
 *
 *   node scripts/createManagerUser.js
 *
 * On Render: Dashboard -> your backend service -> Shell tab -> run the
 * command above (MONGODB_URI is already set in that shell's environment).
 *
 * This does NOT touch the existing admin@rsaconstruction.com account or any
 * other data - it only creates/updates this one manager user.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

const MANAGER_EMAIL = 'manager@rsaconstruction.com'; // stored lowercase (schema normalizes it)
const MANAGER_NAME = 'RSA Manager';
const MANAGER_PASSWORD = 'Manager@123';

async function createManagerUser() {
  await connectDB();

  const existing = await User.findOne({ email: MANAGER_EMAIL }).select('+password');

  if (existing) {
    existing.name = MANAGER_NAME;
    existing.role = 'manager';
    existing.password = MANAGER_PASSWORD; // re-hashed by the User model's pre-save hook
    await existing.save();
    console.log(`Updated existing account - reset password and role for ${MANAGER_EMAIL}.`);
  } else {
    await User.create({
      name: MANAGER_NAME,
      email: MANAGER_EMAIL,
      password: MANAGER_PASSWORD,
      role: 'manager',
      isSuperAdmin: false,
    });
    console.log(`Created manager account: ${MANAGER_EMAIL}.`);
  }

  console.log('Login with: Manager@Rsaconstruction.com / Manager@123');
  await mongoose.disconnect();
}

createManagerUser().catch((err) => {
  console.error('Failed to create/update the manager user:', err);
  process.exit(1);
});
