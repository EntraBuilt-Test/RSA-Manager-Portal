const mongoose = require('mongoose');

/**
 * Storage for every row of every Superadmin-created custom module.
 *
 * One shared collection rather than one collection per module: a new tab must
 * be creatable at runtime from the UI, and creating real Mongoose models on
 * the fly would mean a server restart (and a migration) every time - exactly
 * the developer round-trip this whole feature exists to remove.
 *
 * `data` is an untyped map keyed by the module's FieldDefinition[].key. It is
 * validated on write against that module's field definitions (types, required
 * flags, select options) in customRecordController - Mongoose can't enforce a
 * shape that only exists in another document.
 */
const customRecordSchema = new mongoose.Schema(
  {
    moduleKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Soft delete, consistent with the module/field deletion policy: rows are
    // hidden first and only purged by an explicit permanent delete.
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

customRecordSchema.index({ moduleKey: 1, createdAt: -1 });

module.exports = mongoose.model('CustomRecord', customRecordSchema);
