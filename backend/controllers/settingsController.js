const Settings = require('../models/Settings');
const asyncHandler = require('../utils/asyncHandler');

// Ensures exactly one Settings document exists and returns it.
async function getOrCreateSettings() {
  let settings = await Settings.findOne({ singleton: 'default' });
  if (!settings) {
    settings = await Settings.create({
      singleton: 'default',
      particulars: [],
      materialCategories: [],
      materialUnits: [],
      itemColumns: [],
      sites: [],
      materialBrands: [],
      workerRoles: [],
      sheetSizeOptions: [],
    });
  }
  return settings;
}

// Turns a human label ("Discount %") into a safe, unique object key
// ("discountPercent", "discountPercent2", ...) used inside each delivery
// note item's `extra` object. Generated once at creation time and never
// changed afterward, so existing notes' stored values always stay readable.
function slugifyColumnKey(label, existingKeys) {
  let base = String(label || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
  if (!base) base = 'column';
  base = base.charAt(0).toLowerCase() + base.slice(1);
  if (/^[0-9]/.test(base)) base = `c${base}`;

  let key = base;
  let i = 2;
  while (existingKeys.includes(key)) {
    key = `${base}${i}`;
    i += 1;
  }
  return key;
}

// GET /api/settings - readable by any authenticated user (drives the Delivery Note
// form/print and the Material Entry dropdowns), only mutable by a superadmin.
const getSettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  res.json({
    success: true,
    data: {
      particulars: settings.particulars.sort((a, b) => a.order - b.order),
      materialCategories: settings.materialCategories,
      materialUnits: settings.materialUnits,
      itemColumns: settings.itemColumns.sort((a, b) => a.order - b.order),
      sites: settings.sites || [],
      materialBrands: settings.materialBrands || [],
      workerRoles: settings.workerRoles || [],
      sheetSizeOptions: settings.sheetSizeOptions || [],
    },
  });
});

// Cleans a raw variants array from the client into the subdocument shape,
// dropping any variant with no label (an empty add-row still in progress).
function sanitizeVariants(variants) {
  if (!Array.isArray(variants)) return undefined;
  return variants
    .filter((v) => v && String(v.label || '').trim())
    .map((v) => ({
      label: String(v.label).trim(),
      rate: Number(v.rate) || 0,
      perDayRate: Number(v.perDayRate) || 0,
    }));
}

// POST /api/settings/particulars  { no, label, labelEn, defaultRate, defaultPerDayRate, defaultMonthlyRate, variants, variantSizeSource }
const addParticular = asyncHandler(async (req, res) => {
  const { no, label, labelEn, defaultRate, defaultPerDayRate, defaultMonthlyRate, variants, variantSizeSource } = req.body;
  if (!label || !label.trim()) {
    res.status(400);
    throw new Error('Label is required');
  }
  const settings = await getOrCreateSettings();
  const maxOrder = settings.particulars.reduce((m, p) => Math.max(m, p.order), 0);
  settings.particulars.push({
    no: no || '',
    label: label.trim(),
    labelEn: (labelEn || '').trim(),
    defaultRate: Number(defaultRate) || 0,
    defaultPerDayRate: Number(defaultPerDayRate) || 0,
    defaultMonthlyRate: Number(defaultMonthlyRate) || 0,
    order: maxOrder + 1,
    variants: sanitizeVariants(variants) || [],
    variantSizeSource: String(variantSizeSource || '').trim(),
  });
  await settings.save();
  res.status(201).json({ success: true, data: settings.particulars });
});

// PUT /api/settings/particulars/:id  { no, label, labelEn, defaultRate, defaultPerDayRate, defaultMonthlyRate, variants, variantSizeSource }
const updateParticular = asyncHandler(async (req, res) => {
  const { no, label, labelEn, defaultRate, defaultPerDayRate, defaultMonthlyRate, variants, variantSizeSource } = req.body;
  const settings = await getOrCreateSettings();
  const item = settings.particulars.id(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error('Particular not found');
  }
  if (no !== undefined) item.no = no;
  if (label !== undefined) item.label = label;
  if (labelEn !== undefined) item.labelEn = labelEn;
  if (defaultRate !== undefined) item.defaultRate = Number(defaultRate) || 0;
  if (defaultPerDayRate !== undefined) item.defaultPerDayRate = Number(defaultPerDayRate) || 0;
  if (defaultMonthlyRate !== undefined) item.defaultMonthlyRate = Number(defaultMonthlyRate) || 0;
  const sanitized = sanitizeVariants(variants);
  if (sanitized !== undefined) item.variants = sanitized;
  if (variantSizeSource !== undefined) item.variantSizeSource = String(variantSizeSource || '').trim();
  await settings.save();
  res.json({ success: true, data: settings.particulars });
});

// PATCH /api/settings/particulars/:id/move  { direction: 'up' | 'down' }
const moveParticular = asyncHandler(async (req, res) => {
  const { direction } = req.body;
  const settings = await getOrCreateSettings();
  const sorted = [...settings.particulars].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((p) => String(p._id) === req.params.id);
  if (idx === -1) {
    res.status(404);
    throw new Error('Particular not found');
  }
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= sorted.length) {
    return res.json({ success: true, data: settings.particulars });
  }
  const a = sorted[idx];
  const b = sorted[swapWith];
  const tempOrder = a.order;
  a.order = b.order;
  b.order = tempOrder;
  await settings.save();
  res.json({ success: true, data: settings.particulars });
});

// DELETE /api/settings/particulars/:id
const deleteParticular = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  const item = settings.particulars.id(req.params.id);
  if (!item) {
    res.status(404);
    throw new Error('Particular not found');
  }
  item.deleteOne();
  await settings.save();
  res.json({ success: true, data: settings.particulars });
});

// ---------------------------------------------------------------------------
// Generic ordered-value-list operations, used for Material Categories,
// Material Units, and Labour Sites. These three used to only support
// add/remove-by-value (plain string arrays with no stable identity or
// ordering). They now get the same full CRUD + reordering capability as
// Delivery Note Particulars and Item Columns: add, edit-in-place, move
// up/down, and delete - addressed by array index, which IS the row's
// display/print order (no separate `order` field needed for a flat list).
// One factory keeps the three otherwise-identical route handlers in sync.
function makeOrderedListOps(fieldName, itemLabel) {
  const add = asyncHandler(async (req, res) => {
    const { value } = req.body;
    if (!value || !String(value).trim()) {
      res.status(400);
      throw new Error(`${itemLabel} value is required`);
    }
    const settings = await getOrCreateSettings();
    const trimmed = String(value).trim();
    if (!settings[fieldName].includes(trimmed)) {
      settings[fieldName].push(trimmed);
      settings.markModified(fieldName);
      await settings.save();
    }
    res.status(201).json({ success: true, data: settings[fieldName] });
  });

  // PUT /:index  { value } - rename the value at this position in place
  // (keeps its position, unlike delete-then-add-at-the-end).
  const update = asyncHandler(async (req, res) => {
    const idx = Number(req.params.index);
    const { value } = req.body;
    if (!value || !String(value).trim()) {
      res.status(400);
      throw new Error(`${itemLabel} value is required`);
    }
    const settings = await getOrCreateSettings();
    const list = settings[fieldName];
    if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) {
      res.status(404);
      throw new Error(`${itemLabel} not found`);
    }
    list[idx] = String(value).trim();
    settings.markModified(fieldName);
    await settings.save();
    res.json({ success: true, data: settings[fieldName] });
  });

  // PATCH /:index/move  { direction: 'up' | 'down' } - swap with the
  // neighboring row, same semantics as moveParticular/moveColumn above.
  const move = asyncHandler(async (req, res) => {
    const idx = Number(req.params.index);
    const { direction } = req.body;
    const settings = await getOrCreateSettings();
    const list = settings[fieldName];
    if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) {
      res.status(404);
      throw new Error(`${itemLabel} not found`);
    }
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= list.length) {
      return res.json({ success: true, data: list });
    }
    const tmp = list[idx];
    list[idx] = list[swapWith];
    list[swapWith] = tmp;
    settings.markModified(fieldName);
    await settings.save();
    res.json({ success: true, data: settings[fieldName] });
  });

  // DELETE /:index - preferred (stable even with duplicate-looking values).
  // Also accepts the legacy `{ value }` body form for backward compatibility
  // with any older frontend build still calling DELETE /categories etc.
  const remove = asyncHandler(async (req, res) => {
    const settings = await getOrCreateSettings();
    const list = settings[fieldName];
    if (req.params.index !== undefined) {
      const idx = Number(req.params.index);
      if (Number.isInteger(idx) && idx >= 0 && idx < list.length) {
        list.splice(idx, 1);
      }
    } else if (req.body && req.body.value !== undefined) {
      settings[fieldName] = list.filter((v) => v !== req.body.value);
    }
    settings.markModified(fieldName);
    await settings.save();
    res.json({ success: true, data: settings[fieldName] });
  });

  return { add, update, move, remove };
}

const categoryOps = makeOrderedListOps('materialCategories', 'Category');
const unitOps = makeOrderedListOps('materialUnits', 'Unit');
const siteOps = makeOrderedListOps('sites', 'Site');
const brandOps = makeOrderedListOps('materialBrands', 'Brand');
const roleOps = makeOrderedListOps('workerRoles', 'Role');
// Shared size list a particular can point its variant labels at via
// variantSizeSource: "settings.sheetSizeOptions" - see particularSchema.
const sheetSizeOps = makeOrderedListOps('sheetSizeOptions', 'Sheet Size');

// POST /api/settings/columns  { label, type, effect }
// Generic extra-column builder for the Delivery Note items table (e.g.
// "Discount", "Discount %", or any future field) - not hardcoded to discount.
const addColumn = asyncHandler(async (req, res) => {
  const { label, type, effect } = req.body;
  if (!label || !label.trim()) {
    res.status(400);
    throw new Error('Label is required');
  }
  const allowedTypes = ['number', 'percent', 'text'];
  const allowedEffects = ['add', 'subtract', 'none'];
  const resolvedType = allowedTypes.includes(type) ? type : 'number';
  const resolvedEffect = resolvedType === 'text' ? 'none' : allowedEffects.includes(effect) ? effect : 'subtract';

  const settings = await getOrCreateSettings();
  const existingKeys = settings.itemColumns.map((c) => c.key);
  const key = slugifyColumnKey(label, existingKeys);
  const maxOrder = settings.itemColumns.reduce((m, c) => Math.max(m, c.order), 0);

  settings.itemColumns.push({
    key,
    label: label.trim(),
    type: resolvedType,
    effect: resolvedEffect,
    order: maxOrder + 1,
  });
  await settings.save();
  res.status(201).json({ success: true, data: settings.itemColumns });
});

// PUT /api/settings/columns/:id  { label, type, effect }  (key is immutable once created)
const updateColumn = asyncHandler(async (req, res) => {
  const { label, type, effect } = req.body;
  const settings = await getOrCreateSettings();
  const col = settings.itemColumns.id(req.params.id);
  if (!col) {
    res.status(404);
    throw new Error('Column not found');
  }
  const allowedTypes = ['number', 'percent', 'text'];
  const allowedEffects = ['add', 'subtract', 'none'];
  if (label !== undefined && label.trim()) col.label = label.trim();
  if (type !== undefined && allowedTypes.includes(type)) col.type = type;
  if (col.type === 'text') {
    col.effect = 'none';
  } else if (effect !== undefined && allowedEffects.includes(effect)) {
    col.effect = effect;
  }
  await settings.save();
  res.json({ success: true, data: settings.itemColumns });
});

// PATCH /api/settings/columns/:id/move  { direction: 'up' | 'down' }
const moveColumn = asyncHandler(async (req, res) => {
  const { direction } = req.body;
  const settings = await getOrCreateSettings();
  const sorted = [...settings.itemColumns].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((c) => String(c._id) === req.params.id);
  if (idx === -1) {
    res.status(404);
    throw new Error('Column not found');
  }
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= sorted.length) {
    return res.json({ success: true, data: settings.itemColumns });
  }
  const a = sorted[idx];
  const b = sorted[swapWith];
  const tempOrder = a.order;
  a.order = b.order;
  b.order = tempOrder;
  await settings.save();
  res.json({ success: true, data: settings.itemColumns });
});

// DELETE /api/settings/columns/:id
const deleteColumn = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  const col = settings.itemColumns.id(req.params.id);
  if (!col) {
    res.status(404);
    throw new Error('Column not found');
  }
  col.deleteOne();
  await settings.save();
  res.json({ success: true, data: settings.itemColumns });
});

module.exports = {
  getSettings,
  addParticular,
  updateParticular,
  moveParticular,
  deleteParticular,
  addCategory: categoryOps.add,
  updateCategory: categoryOps.update,
  moveCategory: categoryOps.move,
  deleteCategory: categoryOps.remove,
  addUnit: unitOps.add,
  updateUnit: unitOps.update,
  moveUnit: unitOps.move,
  deleteUnit: unitOps.remove,
  addSite: siteOps.add,
  updateSite: siteOps.update,
  moveSite: siteOps.move,
  deleteSite: siteOps.remove,
  addBrand: brandOps.add,
  updateBrand: brandOps.update,
  moveBrand: brandOps.move,
  deleteBrand: brandOps.remove,
  addRole: roleOps.add,
  updateRole: roleOps.update,
  moveRole: roleOps.move,
  deleteRole: roleOps.remove,
  addSheetSize: sheetSizeOps.add,
  updateSheetSize: sheetSizeOps.update,
  moveSheetSize: sheetSizeOps.move,
  deleteSheetSize: sheetSizeOps.remove,
  addColumn,
  updateColumn,
  moveColumn,
  deleteColumn,
};
