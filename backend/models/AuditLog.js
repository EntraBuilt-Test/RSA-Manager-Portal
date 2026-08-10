const mongoose = require('mongoose');

/**
 * Append-only record of every Superadmin mutation - who changed what, when,
 * and what the value was before and after.
 *
 * Two reasons this exists rather than being optional logging:
 *  1. A non-technical owner is being handed the power to restructure the app's
 *     data model from a UI. A visible "Recent Changes" feed is what makes that
 *     safe to use, because any change can be traced and reversed by hand.
 *  2. The chat assistant can perform the same mutations (assistantActions.js).
 *     Those land in this same collection with source: 'assistant', so there is
 *     no blind spot between what a human did and what the bot did.
 */
const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Snapshotted so the log still reads correctly if the account is renamed
    // or deleted later - same reasoning as the customer/worker name snapshots
    // elsewhere in this codebase.
    userName: { type: String, default: '' },
    userEmail: { type: String, default: '' },
    action: {
      type: String,
      required: true,
      enum: ['create', 'update', 'delete', 'restore', 'reorder', 'login', 'other'],
    },
    // What kind of thing was touched: 'module', 'field', 'record', 'user',
    // 'setting', 'automation'.
    entity: { type: String, required: true, trim: true },
    // Human-readable target, e.g. "materials" or "materials.discountPercent".
    entityKey: { type: String, default: '', trim: true },
    entityId: { type: String, default: '' },
    // One-line plain-English description, shown directly in the Recent Changes
    // feed so the owner never has to read a JSON diff to understand a row.
    summary: { type: String, required: true, trim: true },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    // 'ui' for a click in the Superadmin Portal, 'assistant' for a chat-driven
    // action, 'script' for a migration/seed run.
    source: { type: String, enum: ['ui', 'assistant', 'script'], default: 'ui' },
    ip: { type: String, default: '' },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, entityKey: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
