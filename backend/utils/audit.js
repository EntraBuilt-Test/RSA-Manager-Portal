const AuditLog = require('../models/AuditLog');

/**
 * Writes one AuditLog entry for a Superadmin mutation.
 *
 * Deliberately never throws: an audit write failing must not roll back or
 * 500 a business action the user already completed successfully. A failure
 * here is logged to the server console instead, where it shows up in the same
 * morgan/stderr stream as everything else.
 */
async function logAudit(req, entry) {
  try {
    const user = req && req.user ? req.user : null;
    await AuditLog.create({
      user: user ? user._id : null,
      userName: user ? user.name : 'system',
      userEmail: user ? user.email : '',
      action: entry.action || 'other',
      entity: entry.entity,
      entityKey: entry.entityKey || '',
      entityId: entry.entityId ? String(entry.entityId) : '',
      summary: entry.summary,
      before: entry.before === undefined ? null : entry.before,
      after: entry.after === undefined ? null : entry.after,
      source: entry.source || 'ui',
      ip: req && (req.ip || req.headers['x-forwarded-for']) ? String(req.ip || req.headers['x-forwarded-for']) : '',
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

module.exports = { logAudit };
