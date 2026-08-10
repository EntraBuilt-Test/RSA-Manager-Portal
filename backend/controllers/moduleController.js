const Module = require('../models/Module');
const CustomRecord = require('../models/CustomRecord');
const asyncHandler = require('../utils/asyncHandler');
const { logAudit } = require('../utils/audit');
const { slugifyKey, validateFieldKey, validateModuleKey } = require('../utils/fieldKey');
const { SYSTEM_MODULES } = require('../config/systemModules');

const FIELD_TYPES = ['text', 'number', 'percent', 'date', 'select', 'boolean', 'reference', 'file'];
const FIELD_EFFECTS = ['add', 'subtract', 'none'];

/**
 * Inserts any system module that isn't in the database yet.
 *
 * Called on every module read. It makes the migration script a convenience
 * rather than a hard prerequisite: a fresh database, a restored backup, or an
 * operator who simply forgot to run `npm run seed-modules` still gets a
 * complete sidebar instead of an empty one. Already-present modules are never
 * touched, so a Superadmin's renames and reordering survive.
 */
async function ensureSystemModules() {
  const existing = await Module.find({ key: { $in: SYSTEM_MODULES.map((m) => m.key) } }).select('key');
  const have = existing.map((m) => m.key);
  const missing = SYSTEM_MODULES.filter((m) => !have.includes(m.key));
  if (missing.length === 0) return;
  try {
    await Module.insertMany(
      missing.map((m) => ({ ...m, isSystem: true, isActive: true, fields: [] })),
      { ordered: false }
    );
  } catch (err) {
    // A concurrent request may have inserted the same keys first; the unique
    // index on `key` rejects the duplicate, which is the correct outcome.
    if (err.code !== 11000) throw err;
  }
}

// Shapes a module for the client. Inactive fields are stripped from the
// default (non-superadmin) view so the generic renderer never has to know
// about soft-deleted columns.
function serializeModule(mod, { includeInactiveFields = false } = {}) {
  const fields = (includeInactiveFields ? mod.fields : mod.fields.filter((f) => f.isActive))
    .slice()
    .sort((a, b) => a.position - b.position);
  return {
    id: mod._id,
    key: mod.key,
    label: mod.label,
    labelTa: mod.labelTa,
    icon: mod.icon,
    short: mod.short,
    path: mod.path,
    description: mod.description,
    order: mod.order,
    isSystem: mod.isSystem,
    isActive: mod.isActive,
    fields: fields.map((f) => ({
      id: f._id,
      key: f.key,
      label: f.label,
      type: f.type,
      position: f.position,
      effect: f.effect,
      required: f.required,
      options: f.options,
      optionsSource: f.optionsSource,
      referenceModule: f.referenceModule,
      showInTable: f.showInTable,
      showInForm: f.showInForm,
      showInPrint: f.showInPrint,
      helpText: f.helpText,
      isActive: f.isActive,
    })),
    updatedAt: mod.updatedAt,
  };
}

async function findModuleOr404(res, key) {
  const mod = await Module.findOne({ key: String(key).toLowerCase() });
  if (!mod) {
    res.status(404);
    throw new Error(`Module "${key}" not found`);
  }
  return mod;
}

// Renumbers positions to 1..n after any insert/reorder/delete, so `position`
// stays dense and predictable for drag-and-drop in the Field Manager.
function normalizePositions(mod) {
  mod.fields
    .slice()
    .sort((a, b) => a.position - b.position)
    .forEach((f, i) => {
      f.position = i + 1;
    });
}

// ---------------------------------------------------------------------------
// Reads - available to every authenticated user, because this metadata is what
// drives the sidebar and the tables that Admin/Manager/Staff see. A Superadmin
// change lands here and every other role picks it up on their next load; that
// is the entire "changes fall through to admin" mechanism.
// ---------------------------------------------------------------------------

// GET /api/modules  - active modules only, for the nav and generic renderer
const getModules = asyncHandler(async (req, res) => {
  await ensureSystemModules();
  const modules = await Module.find({ isActive: true }).sort({ order: 1 });
  res.json({ success: true, count: modules.length, data: modules.map((m) => serializeModule(m)) });
});

// GET /api/modules/all  - superadmin view: includes hidden modules and
// soft-deleted fields, which the Field Manager needs in order to restore them
const getAllModules = asyncHandler(async (req, res) => {
  await ensureSystemModules();
  const modules = await Module.find({}).sort({ order: 1 });
  res.json({
    success: true,
    count: modules.length,
    data: modules.map((m) => serializeModule(m, { includeInactiveFields: true })),
  });
});

// GET /api/modules/:key
const getModule = asyncHandler(async (req, res) => {
  const mod = await findModuleOr404(res, req.params.key);
  const includeInactiveFields = Boolean(req.user && req.user.isSuperAdmin);
  res.json({ success: true, data: serializeModule(mod, { includeInactiveFields }) });
});

// ---------------------------------------------------------------------------
// Module mutations (superadmin only)
// ---------------------------------------------------------------------------

// POST /api/modules  { label, labelTa, icon, short, description, key?, fields? }
const createModule = asyncHandler(async (req, res) => {
  const { label, labelTa, icon, short, description, fields } = req.body;
  if (!label || !String(label).trim()) {
    res.status(400);
    throw new Error('Module name is required');
  }

  const all = await Module.find({}).select('key order');
  const requestedKey = req.body.key ? String(req.body.key).trim().toLowerCase() : slugifyKey(label).toLowerCase();
  // slugifyKey can emit camelCase; module keys are the stricter lowercase-only
  // form because they become URL segments.
  const candidateKey = requestedKey.replace(/[^a-z0-9]/g, '');
  const keyError = validateModuleKey(candidateKey, all.map((m) => m.key));
  if (keyError) {
    res.status(400);
    throw new Error(keyError);
  }

  // Validate the initial field set before creating anything, so a bad field
  // definition doesn't leave a half-built module behind.
  const seenKeys = [];
  const preparedFields = (Array.isArray(fields) ? fields : []).map((f, i) => {
    const fieldLabel = String(f.label || '').trim();
    if (!fieldLabel) {
      res.status(400);
      throw new Error(`Field ${i + 1} needs a name`);
    }
    const fieldKey = f.key ? String(f.key).trim() : slugifyKey(fieldLabel, seenKeys);
    const err = validateFieldKey(fieldKey, { moduleKey: candidateKey, existingKeys: seenKeys });
    if (err) {
      res.status(400);
      throw new Error(err);
    }
    seenKeys.push(fieldKey);
    const type = FIELD_TYPES.includes(f.type) ? f.type : 'text';
    return {
      key: fieldKey,
      label: fieldLabel,
      type,
      position: i + 1,
      effect: type === 'number' || type === 'percent' ? (FIELD_EFFECTS.includes(f.effect) ? f.effect : 'none') : 'none',
      required: Boolean(f.required),
      options: Array.isArray(f.options) ? f.options.map((o) => String(o).trim()).filter(Boolean) : [],
      optionsSource: type === 'select' ? String(f.optionsSource || '').trim() : '',
      referenceModule: type === 'reference' ? String(f.referenceModule || '').trim() : '',
      showInTable: f.showInTable !== false,
      showInForm: f.showInForm !== false,
      showInPrint: Boolean(f.showInPrint),
      helpText: String(f.helpText || '').trim(),
      isActive: true,
    };
  });

  const maxOrder = all.reduce((m, x) => Math.max(m, x.order || 0), 0);

  const mod = await Module.create({
    key: candidateKey,
    label: String(label).trim(),
    labelTa: String(labelTa || '').trim(),
    icon: String(icon || '📄').trim(),
    short: String(short || label).trim().slice(0, 2).toUpperCase(),
    // Custom modules are all served by the one generic renderer route.
    path: `/m/${candidateKey}`,
    description: String(description || '').trim(),
    order: maxOrder + 1,
    isSystem: false,
    isActive: true,
    fields: preparedFields,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  await logAudit(req, {
    action: 'create',
    entity: 'module',
    entityKey: mod.key,
    entityId: mod._id,
    summary: `Created module "${mod.label}" with ${preparedFields.length} field(s)`,
    after: { key: mod.key, label: mod.label, fields: preparedFields.map((f) => f.key) },
    source: req.auditSource,
  });

  res.status(201).json({ success: true, data: serializeModule(mod, { includeInactiveFields: true }) });
});

// PUT /api/modules/:key  { label, labelTa, icon, short, description, isActive }
// `key` and `path` are intentionally immutable - records, routes and audit
// history all reference them.
const updateModule = asyncHandler(async (req, res) => {
  const mod = await findModuleOr404(res, req.params.key);
  const { label, labelTa, icon, short, description, isActive } = req.body;

  const before = { label: mod.label, icon: mod.icon, short: mod.short, isActive: mod.isActive };

  if (label !== undefined && String(label).trim()) mod.label = String(label).trim();
  if (labelTa !== undefined) mod.labelTa = String(labelTa).trim();
  if (icon !== undefined) mod.icon = String(icon).trim();
  if (short !== undefined) mod.short = String(short).trim().slice(0, 2).toUpperCase();
  if (description !== undefined) mod.description = String(description).trim();
  if (isActive !== undefined) mod.isActive = Boolean(isActive);
  mod.updatedBy = req.user._id;
  await mod.save();

  const after = { label: mod.label, icon: mod.icon, short: mod.short, isActive: mod.isActive };
  await logAudit(req, {
    action: 'update',
    entity: 'module',
    entityKey: mod.key,
    entityId: mod._id,
    summary:
      before.label !== after.label
        ? `Renamed module "${before.label}" to "${after.label}"`
        : before.isActive !== after.isActive
        ? `${after.isActive ? 'Showed' : 'Hid'} module "${mod.label}" in the sidebar`
        : `Updated module "${mod.label}"`,
    before,
    after,
    source: req.auditSource,
  });

  res.json({ success: true, data: serializeModule(mod, { includeInactiveFields: true }) });
});

// PATCH /api/modules/reorder  { keys: ['dashboard', 'materials', ...] }
// The whole nav order in one call - that is what a drag-and-drop list produces,
// and doing it atomically avoids the intermediate half-sorted states that
// repeated up/down swaps would write.
const reorderModules = asyncHandler(async (req, res) => {
  const { keys } = req.body;
  if (!Array.isArray(keys) || keys.length === 0) {
    res.status(400);
    throw new Error('keys must be a non-empty array of module keys');
  }

  const modules = await Module.find({ key: { $in: keys.map((k) => String(k).toLowerCase()) } });
  const byKey = new Map(modules.map((m) => [m.key, m]));
  const before = modules.slice().sort((a, b) => a.order - b.order).map((m) => m.key);

  let position = 1;
  const writes = [];
  keys.forEach((k) => {
    const mod = byKey.get(String(k).toLowerCase());
    if (!mod) return;
    mod.order = position;
    position += 1;
    writes.push(mod.save());
  });
  await Promise.all(writes);

  await logAudit(req, {
    action: 'reorder',
    entity: 'module',
    entityKey: keys.join(', '),
    summary: 'Reordered the sidebar tabs',
    before,
    after: keys,
    source: req.auditSource,
  });

  const updated = await Module.find({}).sort({ order: 1 });
  res.json({ success: true, data: updated.map((m) => serializeModule(m, { includeInactiveFields: true })) });
});

// DELETE /api/modules/:key[?permanent=true]
// Soft delete by default (hides the tab, keeps every row). `permanent=true` is
// the deliberate second step and also purges the module's CustomRecords.
const deleteModule = asyncHandler(async (req, res) => {
  const mod = await findModuleOr404(res, req.params.key);

  // The seven built-in tabs are backed by real controllers, print layouts and
  // business logic. Deleting one would break code that still references it, so
  // it is refused outright - hiding it (isActive: false) is the supported way
  // to get it off the sidebar.
  if (mod.isSystem) {
    res.status(400);
    throw new Error(
      `"${mod.label}" is a built-in module and cannot be deleted. You can hide it from the sidebar instead.`
    );
  }

  const permanent = String(req.query.permanent) === 'true';

  if (!permanent) {
    mod.isActive = false;
    mod.updatedBy = req.user._id;
    await mod.save();
    await logAudit(req, {
      action: 'delete',
      entity: 'module',
      entityKey: mod.key,
      entityId: mod._id,
      summary: `Hid module "${mod.label}" (data kept - can be restored)`,
      before: { isActive: true },
      after: { isActive: false },
      source: req.auditSource,
    });
    return res.json({ success: true, data: serializeModule(mod, { includeInactiveFields: true }) });
  }

  const recordCount = await CustomRecord.countDocuments({ moduleKey: mod.key });
  await CustomRecord.deleteMany({ moduleKey: mod.key });
  await mod.deleteOne();

  await logAudit(req, {
    action: 'delete',
    entity: 'module',
    entityKey: mod.key,
    entityId: mod._id,
    summary: `Permanently deleted module "${mod.label}" and its ${recordCount} record(s)`,
    before: { key: mod.key, label: mod.label, recordCount },
    source: req.auditSource,
  });

  res.json({ success: true, data: { key: mod.key, deletedRecords: recordCount } });
});

// ---------------------------------------------------------------------------
// Field mutations (superadmin only) - the generalized Item Columns editor
// ---------------------------------------------------------------------------

// POST /api/modules/:key/fields  { label, type, effect, required, options, ... , position? }
const addField = asyncHandler(async (req, res) => {
  const mod = await findModuleOr404(res, req.params.key);
  const {
    label,
    type,
    effect,
    required,
    options,
    optionsSource,
    referenceModule,
    showInTable,
    showInForm,
    showInPrint,
    helpText,
  } = req.body;

  if (!label || !String(label).trim()) {
    res.status(400);
    throw new Error('Field name is required');
  }

  const existingKeys = mod.fields.map((f) => f.key);
  const fieldKey = req.body.key ? String(req.body.key).trim() : slugifyKey(label, existingKeys);
  const keyError = validateFieldKey(fieldKey, { moduleKey: mod.key, existingKeys });
  if (keyError) {
    res.status(400);
    throw new Error(keyError);
  }

  const resolvedType = FIELD_TYPES.includes(type) ? type : 'text';
  const resolvedOptionsSource = resolvedType === 'select' ? String(optionsSource || '').trim() : '';
  // A dropdown needs SOME source of choices - either a static options list or
  // a live Settings list (optionsSource) - but not necessarily both.
  if (
    resolvedType === 'select' &&
    !resolvedOptionsSource &&
    (!Array.isArray(options) || options.filter((o) => String(o).trim()).length === 0)
  ) {
    res.status(400);
    throw new Error('A dropdown field needs at least one option, or an options source');
  }
  if (resolvedType === 'reference' && !String(referenceModule || '').trim()) {
    res.status(400);
    throw new Error('A reference field needs a module to pull its options from');
  }

  // Insert at an explicit position when the Module Builder asks for one,
  // otherwise append. Either way positions are renormalized to 1..n below,
  // which is what makes "put this column third from the left" work rather
  // than only ever appending at the end.
  const requestedPosition = Number(req.body.position);
  const appendPosition = mod.fields.reduce((m, f) => Math.max(m, f.position), 0) + 1;
  const position =
    Number.isFinite(requestedPosition) && requestedPosition > 0 ? requestedPosition : appendPosition;

  if (position < appendPosition) {
    mod.fields.forEach((f) => {
      if (f.position >= position) f.position += 1;
    });
  }

  mod.fields.push({
    key: fieldKey,
    label: String(label).trim(),
    type: resolvedType,
    position,
    effect:
      resolvedType === 'number' || resolvedType === 'percent'
        ? FIELD_EFFECTS.includes(effect)
          ? effect
          : 'none'
        : 'none',
    required: Boolean(required),
    options: Array.isArray(options) ? options.map((o) => String(o).trim()).filter(Boolean) : [],
    optionsSource: resolvedOptionsSource,
    referenceModule: resolvedType === 'reference' ? String(referenceModule).trim() : '',
    showInTable: showInTable !== false,
    showInForm: showInForm !== false,
    showInPrint: Boolean(showInPrint),
    helpText: String(helpText || '').trim(),
    isActive: true,
  });

  normalizePositions(mod);
  mod.updatedBy = req.user._id;
  await mod.save();

  const created = mod.fields.find((f) => f.key === fieldKey);
  await logAudit(req, {
    action: 'create',
    entity: 'field',
    entityKey: `${mod.key}.${fieldKey}`,
    entityId: created._id,
    summary: `Added "${created.label}" column to ${mod.label} at position ${created.position}`,
    after: { key: fieldKey, label: created.label, type: created.type, position: created.position },
    source: req.auditSource,
  });

  res.status(201).json({ success: true, data: serializeModule(mod, { includeInactiveFields: true }) });
});

// PUT /api/modules/:key/fields/:fieldId  (key stays immutable, as for item columns)
const updateField = asyncHandler(async (req, res) => {
  const mod = await findModuleOr404(res, req.params.key);
  const field = mod.fields.id(req.params.fieldId);
  if (!field) {
    res.status(404);
    throw new Error('Field not found');
  }

  const before = {
    label: field.label,
    type: field.type,
    effect: field.effect,
    required: field.required,
    showInTable: field.showInTable,
    showInForm: field.showInForm,
    showInPrint: field.showInPrint,
  };

  const {
    label,
    type,
    effect,
    required,
    options,
    optionsSource,
    referenceModule,
    showInTable,
    showInForm,
    showInPrint,
    helpText,
  } = req.body;

  if (label !== undefined && String(label).trim()) field.label = String(label).trim();
  if (type !== undefined && FIELD_TYPES.includes(type)) field.type = type;
  if (field.type === 'number' || field.type === 'percent') {
    if (effect !== undefined && FIELD_EFFECTS.includes(effect)) field.effect = effect;
  } else {
    field.effect = 'none';
  }
  if (required !== undefined) field.required = Boolean(required);
  if (options !== undefined && Array.isArray(options)) {
    field.options = options.map((o) => String(o).trim()).filter(Boolean);
  }
  if (optionsSource !== undefined) {
    field.optionsSource = field.type === 'select' ? String(optionsSource).trim() : '';
  }
  if (field.type !== 'select') field.optionsSource = '';
  if (referenceModule !== undefined) {
    field.referenceModule = field.type === 'reference' ? String(referenceModule).trim() : '';
  }
  if (showInTable !== undefined) field.showInTable = Boolean(showInTable);
  if (showInForm !== undefined) field.showInForm = Boolean(showInForm);
  if (showInPrint !== undefined) field.showInPrint = Boolean(showInPrint);
  if (helpText !== undefined) field.helpText = String(helpText).trim();

  if (field.type === 'select' && field.options.length === 0 && !field.optionsSource) {
    res.status(400);
    throw new Error('A dropdown field needs at least one option, or an options source');
  }

  mod.updatedBy = req.user._id;
  await mod.save();

  await logAudit(req, {
    action: 'update',
    entity: 'field',
    entityKey: `${mod.key}.${field.key}`,
    entityId: field._id,
    summary: `Updated "${field.label}" column on ${mod.label}`,
    before,
    after: {
      label: field.label,
      type: field.type,
      effect: field.effect,
      required: field.required,
      showInTable: field.showInTable,
      showInForm: field.showInForm,
      showInPrint: field.showInPrint,
    },
    source: req.auditSource,
  });

  res.json({ success: true, data: serializeModule(mod, { includeInactiveFields: true }) });
});

// PATCH /api/modules/:key/fields/reorder  { fieldIds: [...] in new left-to-right order }
const reorderFields = asyncHandler(async (req, res) => {
  const mod = await findModuleOr404(res, req.params.key);
  const { fieldIds } = req.body;
  if (!Array.isArray(fieldIds) || fieldIds.length === 0) {
    res.status(400);
    throw new Error('fieldIds must be a non-empty array');
  }

  const before = mod.fields
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((f) => f.key);

  let position = 1;
  fieldIds.forEach((id) => {
    const field = mod.fields.id(id);
    if (!field) return;
    field.position = position;
    position += 1;
  });
  // Anything the client didn't mention (e.g. a soft-deleted field the Field
  // Manager filtered out) keeps a stable order after the listed ones.
  mod.fields
    .filter((f) => !fieldIds.includes(String(f._id)))
    .sort((a, b) => a.position - b.position)
    .forEach((f) => {
      f.position = position;
      position += 1;
    });

  mod.updatedBy = req.user._id;
  await mod.save();

  await logAudit(req, {
    action: 'reorder',
    entity: 'field',
    entityKey: mod.key,
    entityId: mod._id,
    summary: `Reordered columns on ${mod.label}`,
    before,
    after: mod.fields.slice().sort((a, b) => a.position - b.position).map((f) => f.key),
    source: req.auditSource,
  });

  res.json({ success: true, data: serializeModule(mod, { includeInactiveFields: true }) });
});

// DELETE /api/modules/:key/fields/:fieldId[?permanent=true]
const deleteField = asyncHandler(async (req, res) => {
  const mod = await findModuleOr404(res, req.params.key);
  const field = mod.fields.id(req.params.fieldId);
  if (!field) {
    res.status(404);
    throw new Error('Field not found');
  }

  const permanent = String(req.query.permanent) === 'true';
  const label = field.label;
  const key = field.key;

  if (!permanent) {
    // Default path: hide the column but keep every value already recorded
    // against it, since real notes/entries may reference it.
    field.isActive = false;
    mod.updatedBy = req.user._id;
    await mod.save();
    await logAudit(req, {
      action: 'delete',
      entity: 'field',
      entityKey: `${mod.key}.${key}`,
      entityId: field._id,
      summary: `Removed "${label}" column from ${mod.label} (existing values kept - can be restored)`,
      before: { isActive: true },
      after: { isActive: false },
      source: req.auditSource,
    });
  } else {
    field.deleteOne();
    normalizePositions(mod);
    mod.updatedBy = req.user._id;
    await mod.save();
    await logAudit(req, {
      action: 'delete',
      entity: 'field',
      entityKey: `${mod.key}.${key}`,
      summary: `Permanently deleted the "${label}" column definition from ${mod.label}`,
      before: { key, label },
      source: req.auditSource,
    });
  }

  res.json({ success: true, data: serializeModule(mod, { includeInactiveFields: true }) });
});

// PATCH /api/modules/:key/fields/:fieldId/restore  - undo a soft delete
const restoreField = asyncHandler(async (req, res) => {
  const mod = await findModuleOr404(res, req.params.key);
  const field = mod.fields.id(req.params.fieldId);
  if (!field) {
    res.status(404);
    throw new Error('Field not found');
  }
  field.isActive = true;
  mod.updatedBy = req.user._id;
  await mod.save();

  await logAudit(req, {
    action: 'restore',
    entity: 'field',
    entityKey: `${mod.key}.${field.key}`,
    entityId: field._id,
    summary: `Restored the "${field.label}" column on ${mod.label}`,
    after: { isActive: true },
    source: req.auditSource,
  });

  res.json({ success: true, data: serializeModule(mod, { includeInactiveFields: true }) });
});

module.exports = {
  getModules,
  getAllModules,
  getModule,
  createModule,
  updateModule,
  reorderModules,
  deleteModule,
  addField,
  updateField,
  reorderFields,
  deleteField,
  restoreField,
  // exported for the assistant action layer and the generic record controller
  ensureSystemModules,
  serializeModule,
};
