const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Read-only access to the audit trail. There is deliberately no create/update/
 * delete endpoint here - the log is append-only and is written exclusively by
 * utils/audit.js from inside the mutation handlers themselves. If it could be
 * edited from the API it would stop being evidence.
 */

// GET /api/audit?entity=&action=&search=&user=&limit=&page=
const listAuditLogs = asyncHandler(async (req, res) => {
  const { entity, action, search, user } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const filter = {};
  if (entity) filter.entity = entity;
  if (action) filter.action = action;
  if (user) filter.user = user;
  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ summary: rx }, { entityKey: rx }, { userName: rx }];
  }

  const [total, logs] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  res.json({
    success: true,
    count: logs.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    data: logs,
  });
});

// GET /api/audit/recent?limit=  - the "Recent Changes" feed on the Overview screen
const recentChanges = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const logs = await AuditLog.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('action entity entityKey summary userName source createdAt');
  res.json({ success: true, count: logs.length, data: logs });
});

module.exports = { listAuditLogs, recentChanges };
