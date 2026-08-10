const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { logAudit } = require('../utils/audit');

/**
 * Users & Roles management for the Superadmin Portal.
 *
 * Separate from authController on purpose: that one handles self-service
 * login/register for ordinary users, this one is the administrative surface
 * (create accounts for staff, change someone's role, grant or revoke the
 * superadmin flag) and every route here is behind requireSuperAdmin.
 */

const ROLES = ['admin', 'manager', 'staff'];

// GET /api/admin/users
const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).sort({ createdAt: -1 });
  res.json({ success: true, count: users.length, data: users.map((u) => u.toSafeObject()) });
});

// POST /api/admin/users  { name, email, password, role, isSuperAdmin }
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, isSuperAdmin } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email and password are all required');
  }
  if (String(password).length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters');
  }

  const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (exists) {
    res.status(400);
    throw new Error('An account with that email already exists');
  }

  const user = await User.create({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    password,
    role: ROLES.includes(role) ? role : 'staff',
    isSuperAdmin: Boolean(isSuperAdmin),
  });

  await logAudit(req, {
    action: 'create',
    entity: 'user',
    entityKey: user.email,
    entityId: user._id,
    summary: `Created ${user.role} account for ${user.name}${user.isSuperAdmin ? ' (superadmin)' : ''}`,
    // Never log the password, hashed or otherwise.
    after: { name: user.name, email: user.email, role: user.role, isSuperAdmin: user.isSuperAdmin },
    source: req.auditSource,
  });

  res.status(201).json({ success: true, data: user.toSafeObject() });
});

// PUT /api/admin/users/:id  { name, role, isSuperAdmin, password? }
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('+password');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const { name, role, isSuperAdmin, password } = req.body;
  const before = { name: user.name, role: user.role, isSuperAdmin: user.isSuperAdmin };

  // Guard against a superadmin removing their own last route back in. Losing
  // the flag on the only superadmin account would make the portal permanently
  // unreachable without direct database access.
  if (isSuperAdmin === false && user.isSuperAdmin) {
    const superAdminCount = await User.countDocuments({ isSuperAdmin: true });
    if (superAdminCount <= 1) {
      res.status(400);
      throw new Error('This is the only superadmin account - grant superadmin to someone else first');
    }
  }

  if (name !== undefined && String(name).trim()) user.name = String(name).trim();
  if (role !== undefined && ROLES.includes(role)) user.role = role;
  if (isSuperAdmin !== undefined) user.isSuperAdmin = Boolean(isSuperAdmin);
  if (password) {
    if (String(password).length < 6) {
      res.status(400);
      throw new Error('Password must be at least 6 characters');
    }
    user.password = password; // re-hashed by the pre-save hook on User
  }
  await user.save();

  const after = { name: user.name, role: user.role, isSuperAdmin: user.isSuperAdmin };
  const changedSuper = before.isSuperAdmin !== after.isSuperAdmin;
  await logAudit(req, {
    action: 'update',
    entity: 'user',
    entityKey: user.email,
    entityId: user._id,
    summary: changedSuper
      ? `${after.isSuperAdmin ? 'Granted' : 'Revoked'} superadmin for ${user.name}`
      : password
      ? `Reset the password for ${user.name}`
      : `Updated ${user.name} (${after.role})`,
    before,
    after,
    source: req.auditSource,
  });

  res.json({ success: true, data: user.toSafeObject() });
});

// DELETE /api/admin/users/:id
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  if (String(user._id) === String(req.user._id)) {
    res.status(400);
    throw new Error('You cannot delete the account you are signed in with');
  }
  if (user.isSuperAdmin) {
    const superAdminCount = await User.countDocuments({ isSuperAdmin: true });
    if (superAdminCount <= 1) {
      res.status(400);
      throw new Error('This is the only superadmin account and cannot be deleted');
    }
  }

  const snapshot = { name: user.name, email: user.email, role: user.role, isSuperAdmin: user.isSuperAdmin };
  await user.deleteOne();

  await logAudit(req, {
    action: 'delete',
    entity: 'user',
    entityKey: snapshot.email,
    entityId: req.params.id,
    summary: `Deleted the ${snapshot.role} account for ${snapshot.name}`,
    before: snapshot,
    source: req.auditSource,
  });

  res.json({ success: true, data: {} });
});

module.exports = { listUsers, createUser, updateUser, deleteUser };
