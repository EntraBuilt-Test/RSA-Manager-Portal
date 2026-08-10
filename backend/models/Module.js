const mongoose = require('mongoose');

/**
 * MODULE REGISTRY
 * ---------------
 * One document per tab/module in the app - both the built-in ones (Dashboard,
 * Billing, Materials, Labour, Voucher, Stock, Reports) and any new tab a
 * Superadmin creates later from the Module Builder.
 *
 * This generalizes what `Settings.itemColumns` already did for the Delivery
 * Note items table: instead of one hardcoded list of extra columns for one
 * screen, every module now carries its own `fields[]` metadata, and the
 * frontend renders tables/forms/print views from that metadata at runtime.
 * That is the whole mechanism behind "add a column or a tab and it just
 * appears" - no code change, no redeploy.
 *
 * Two flavours, distinguished by `isSystem`:
 *
 *  - System modules (isSystem: true) keep their existing Mongoose models,
 *    controllers and hand-built screens for their CORE fields. The audited
 *    business logic (stock deduction, note numbering, wage balances) is
 *    untouched. `fields[]` here describes only the EXTRA columns a Superadmin
 *    has added on top, stored in each business document's `extra: {}` map.
 *
 *  - Custom modules (isSystem: false) have no dedicated model at all. Their
 *    rows live in the shared `CustomRecord` collection and `fields[]` is the
 *    complete definition of the module - it drives storage, form, table and
 *    print alike.
 */

// A single field/column definition. This is the generalized form of the old
// `itemColumnSchema` in Settings.js - same idea (key + label + type + effect
// + order), extended with the extra type/visibility metadata the generic
// renderer needs to build a form and a table without any bespoke code.
const fieldDefinitionSchema = new mongoose.Schema(
  {
    // Stable machine name, generated once from the label and never changed
    // afterwards - stored values in `extra`/`data` are keyed by it, so
    // renaming it would orphan every existing record's value.
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['text', 'number', 'percent', 'date', 'select', 'boolean', 'reference', 'file'],
      default: 'text',
    },
    // Left-to-right column order in tables and top-to-bottom order in forms.
    // Kept as a sparse integer so a field can be inserted between two others
    // without rewriting every sibling (normalized on reorder).
    position: { type: Number, required: true },
    // For numeric fields that feed a computed line total, mirroring the
    // Discount behavior that already exists on Delivery Note items.
    effect: { type: String, enum: ['add', 'subtract', 'none'], default: 'none' },
    required: { type: Boolean, default: false },
    // Dropdown choices, only meaningful when type === 'select'. Ignored when
    // `optionsSource` is set - the two are mutually exclusive ways of
    // supplying a select field's choices.
    options: { type: [String], default: [] },
    // Lets a `select` field pull its choices live from a Superadmin Settings
    // list instead of a fixed manually-typed `options` array, e.g.
    // "settings.sites" resolves to Settings.sites at render time. Empty
    // string means "use the static `options` array" (the default/original
    // behavior).
    optionsSource: { type: String, default: '', trim: true },
    // Module key whose records populate the dropdown, only meaningful when
    // type === 'reference' (e.g. a "Material" picker on a custom module).
    referenceModule: { type: String, default: '', trim: true },
    // Which surfaces this field shows up on. The generic renderer reads these
    // directly - unchecking `showInTable` hides the column from the list view
    // without deleting the stored data.
    showInTable: { type: Boolean, default: true },
    showInForm: { type: Boolean, default: true },
    showInPrint: { type: Boolean, default: false },
    // Optional hint rendered under the input in the generated form.
    helpText: { type: String, default: '', trim: true },
    // Soft delete. Real business records may already hold values for this
    // field, so "remove column" hides it by default and only a separate,
    // explicit "permanently delete" step drops it from the definition.
    isActive: { type: Boolean, default: true },
  },
  { _id: true, timestamps: true }
);

const moduleSchema = new mongoose.Schema(
  {
    // URL/API slug, e.g. "materials" or "equipmentRentals". Immutable once
    // created for the same reason field keys are.
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    // Tamil label, so a renamed/new tab can follow the same bilingual
    // convention the rest of the app already uses (LanguageContext).
    labelTa: { type: String, default: '', trim: true },
    icon: { type: String, default: '📄', trim: true },
    // Two-letter badge shown when the sidebar is collapsed, matching the
    // existing `short` values in Layout.jsx ('DB', 'BI', 'MA', ...).
    short: { type: String, default: '', trim: true },
    // Router path. System modules keep their existing hand-built routes
    // ('/billing', '/materials', ...); custom modules are served by the
    // generic renderer at '/m/<key>'.
    path: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    order: { type: Number, required: true },
    // Protects the seven built-in tabs from deletion - a Superadmin can
    // rename, reorder, hide or extend them, but never delete them, because
    // real controllers and print layouts are bound to them.
    isSystem: { type: Boolean, default: false },
    // Hide a module from the nav without destroying its data.
    isActive: { type: Boolean, default: true },
    fields: { type: [fieldDefinitionSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

moduleSchema.index({ order: 1 });

// Convenience: active fields in display order. Used by every generic renderer
// path (table, form, print) and by the CustomRecord validator, so the ordering
// rule lives in exactly one place.
moduleSchema.methods.activeFields = function activeFields() {
  return this.fields.filter((f) => f.isActive).sort((a, b) => a.position - b.position);
};

module.exports = mongoose.model('Module', moduleSchema);
