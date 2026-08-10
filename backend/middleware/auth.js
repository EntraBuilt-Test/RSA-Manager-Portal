const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// Verifies the Bearer JWT and attaches req.user
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;

  if (!token) {
    res.status(401);
    throw new Error('Not authorized - no token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized - invalid or expired token');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    res.status(401);
    throw new Error('Not authorized - user no longer exists');
  }

  req.user = user;
  next();
});

// Role-based access, e.g. authorize('admin', 'manager')
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403);
    throw new Error(`Role '${req.user ? req.user.role : 'unknown'}' is not permitted to perform this action`);
  }
  next();
};

// Gates the Superadmin panel and its mutation endpoints (particulars/category/unit config).
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || !req.user.isSuperAdmin) {
    res.status(403);
    throw new Error('Superadmin access required');
  }
  next();
};

module.exports = { protect, authorize, requireSuperAdmin };
