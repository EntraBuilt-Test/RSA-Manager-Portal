const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// POST /api/auth/register  (admin-only in production; open here for first-run setup)
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    res.status(400);
    throw new Error('A user with this email already exists');
  }

  const user = await User.create({ name, email, password, role: role || 'staff' });
  res.status(201).json({
    success: true,
    data: { user: user.toSafeObject(), token: signToken(user) },
  });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: (email || '').toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  res.json({
    success: true,
    data: { user: user.toSafeObject(), token: signToken(user) },
  });
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user.toSafeObject() });
});

module.exports = { register, login, getMe };
