const mongoose = require('mongoose');

/**
 * Singleton configuration document, editable only via the Superadmin panel.
 * Holds the value-lists that used to be hardcoded in the frontend:
 * - particulars: the Delivery Note's pre-printed Particulars rows (No./label)
 * - materialCategories / materialUnits: dropdown option lists for Material Entry
 * - itemColumns: extra, admin-defined columns for the Delivery Note items table
 *   (e.g. "Discount", "Discount %") - fully generic, not hardcoded to discount
 *   specifically, so future columns can be added the same way without a
 *   code change (per the "evolve this system over time" direction).
 * - sites: construction site names used by the Labour module.
 *
 * Kept separate from business-data collections (customers, deliveryNotes, etc.)
 * so the "go-live" cleanup script never touches configuration by mistake.
 */
// One size/rating option for a particular that comes in several variants
// (e.g. Column Box 15a-15f, Welding Machine by amperage). Each variant has
// its own rate/perDayRate, independent of the parent row's defaultRate/
// defaultPerDayRate (which stay meaningful as a fallback for a variant-less
// selection, though in practice a variant-bearing row is always billed via
// one of its variants).
const particularVariantSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true }, // e.g. "1 inch", "15a", "250A"
    rate: { type: Number, default: 0 },
    perDayRate: { type: Number, default: 0 },
  },
  { _id: true }
);

const particularSchema = new mongoose.Schema(
  {
    no: { type: String, default: '' }, // e.g. "1", "16", "16a" - blank for unnumbered rows
    label: { type: String, required: true, trim: true }, // Tamil text (shown when UI language = Tamil)
    labelEn: { type: String, default: '', trim: true }, // English text (shown when UI language = English).
    // Falls back to `label` on the frontend if left blank, so existing/older
    // rows created before this field existed keep working without a migration.
    defaultRate: { type: Number, default: 0 },
    defaultPerDayRate: { type: Number, default: 0 },
    defaultMonthlyRate: { type: Number, default: 0 },
    order: { type: Number, required: true },
    // Optional size/rating variants (e.g. Column Box 15a-15f, Welding Machine
    // by amperage). An empty array (the default) means this row behaves
    // exactly as before - fully backward compatible with every existing read
    // path, which only look at defaultRate/defaultPerDayRate unless a variant
    // is explicitly selected on a Delivery Note line.
    variants: { type: [particularVariantSchema], default: [] },
    // When set (e.g. "settings.sheetSizeOptions"), this row's variant LABELS
    // come live from the referenced Settings list instead of from `variants`
    // directly - same "settings.<listName>" convention as a custom module's
    // optionsSource select field. `variants` is still where each label's own
    // rate/perDayRate live (looked up by label); a label present in the
    // shared list but with no matching `variants` entry yet just shows a
    // blank/0 rate until someone fills it in. This is what lets two
    // particulars (e.g. "Column Box" and "Sheets") share one synced list of
    // sizes while still billing each size at its own, independent rate.
    variantSizeSource: { type: String, default: '', trim: true },
  },
  { _id: true }
);

// A single extra column on the items table. `key` is the field name used
// inside each item's `extra` object (e.g. { discount: 50 }); `type` controls
// how the value is entered and interpreted; `effect` controls how it changes
// the line's Amount: 'subtract' (e.g. Discount), 'add' (e.g. a surcharge),
// or 'none' (purely informational, e.g. a free-text remark column).
const itemColumnSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: ['number', 'percent', 'text'], default: 'number' },
    effect: { type: String, enum: ['add', 'subtract', 'none'], default: 'subtract' },
    order: { type: Number, required: true },
  },
  { _id: true }
);

const settingsSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'default', unique: true },
    particulars: { type: [particularSchema], default: [] },
    materialCategories: { type: [String], default: [] },
    materialUnits: { type: [String], default: [] },
    itemColumns: { type: [itemColumnSchema], default: [] },
    // Construction site names, managed the same way as Material Categories/Units -
    // used as the site list for the Labour module (worker assignment, site sheets).
    sites: { type: [String], default: [] },
    // Suggested brand names for the Material Entry form's Brand field, managed
    // the same way as materialCategories/materialUnits.
    materialBrands: { type: [String], default: [] },
    // Role options for the Labour module's Worker Role field, managed the same
    // way as materialCategories/materialUnits/sites.
    workerRoles: { type: [String], default: [] },
    // Shared size labels for particulars whose variants should stay in sync
    // with each other (e.g. "Column Box" and "Sheets" both billing the same
    // 9"x9"/1'0"x9"/... sizes, just at different rates) - see
    // particularSchema.variantSizeSource. Managed the same way as
    // materialCategories/materialUnits/sites.
    sheetSizeOptions: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
