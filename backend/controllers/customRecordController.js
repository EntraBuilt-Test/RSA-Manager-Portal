const Module = require('../models/Module');
const CustomRecord = require('../models/CustomRecord');
const asyncHandler = require('../utils/asyncHandler');
const { logAudit } = require('../utils/audit');
const { buildFieldData } = require('../utils/fieldValues');
const { isCloudinaryConfigured, uploadBufferToCloudinary } = require('../config/cloudinary');

/**
 * Generic CRUD for every Superadmin-created module.
 *
 * There is exactly one controller here no matter how many custom tabs exist,
 * because the behavior is entirely derived from the module's FieldDefinition[]
 * at request time. Creating "Equipment Rentals" from the Module Builder needs
 * no new file, no new route and no restart - it is served by these same five
 * handlers the moment the module document exists.
 *
 * Reads are open to any authenticated user (a custom tab is a normal tab for
 * Admin/Manager/Staff); writes follow the same rule as the built-in modules -
 * any logged-in user can add rows, and only a Superadmin can restructure the
 * columns via moduleController.
 */

async function getCustomModuleOr404(res, key) {
  const mod = await Module.findOne({ key: String(key).toLowerCase() });
  if (!mod) {
    res.status(404);
    throw new Error(`Module "${key}" not found`);
  }
  if (mod.isSystem) {
    // Built-in modules have their own controllers and their own audited
    // business logic; routing their rows through the generic store would
    // bypass stock deduction, note numbering and everything else.
    res.status(400);
    throw new Error(`"${mod.label}" is a built-in module - use its own screen and API`);
  }
  return mod;
}

function serializeRecord(record, fields) {
  const data = {};
  fields.forEach((f) => {
    data[f.key] = record.data ? record.data[f.key] ?? null : null;
  });
  return {
    id: record._id,
    moduleKey: record.moduleKey,
    data,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

// Builds a one-line description of a row for the audit feed, using the first
// couple of visible columns - "Added row (Excavator, 2026-07-30) to Equipment
// Rentals" reads far better in Recent Changes than a record id.
function describeRecord(fields, data) {
  const parts = fields
    .slice(0, 2)
    .map((f) => data[f.key])
    .filter((v) => v !== null && v !== undefined && v !== '');
  return parts.length ? `(${parts.join(', ')})` : '';
}

// GET /api/records/:moduleKey?search=&includeInactive=
const listRecords = asyncHandler(async (req, res) => {
  const mod = await getCustomModuleOr404(res, req.params.moduleKey);
  const fields = mod.activeFields();

  const filter = { moduleKey: mod.key };
  if (String(req.query.includeInactive) !== 'true') filter.isActive = true;

  let records = await CustomRecord.find(filter).sort({ createdAt: -1 });

  // Free-text search across every stored value - simple and predictable for a
  // schema that isn't known ahead of time (no per-field indexes to rely on).
  const search = String(req.query.search || '').trim().toLowerCase();
  if (search) {
    records = records.filter((r) =>
      fields.some((f) => String(r.data && r.data[f.key] !== undefined ? r.data[f.key] : '').toLowerCase().includes(search))
    );
  }

  res.json({
    success: true,
    count: records.length,
    data: {
      module: { key: mod.key, label: mod.label, icon: mod.icon, fields },
      records: records.map((r) => serializeRecord(r, fields)),
    },
  });
});

// GET /api/records/:moduleKey/:id
const getRecord = asyncHandler(async (req, res) => {
  const mod = await getCustomModuleOr404(res, req.params.moduleKey);
  const record = await CustomRecord.findOne({ _id: req.params.id, moduleKey: mod.key });
  if (!record) {
    res.status(404);
    throw new Error('Record not found');
  }
  res.json({ success: true, data: serializeRecord(record, mod.activeFields()) });
});

// POST /api/records/:moduleKey  { data: { <fieldKey>: value, ... } }
const createRecord = asyncHandler(async (req, res) => {
  const mod = await getCustomModuleOr404(res, req.params.moduleKey);
  const fields = mod.activeFields();

  if (fields.length === 0) {
    res.status(400);
    throw new Error(`"${mod.label}" has no fields yet - add at least one column in the Superadmin Portal first`);
  }

  const { data, errors } = buildFieldData(fields, req.body.data || req.body);
  if (errors.length) {
    res.status(400);
    throw new Error(errors.join('; '));
  }

  const record = await CustomRecord.create({
    moduleKey: mod.key,
    data,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  await logAudit(req, {
    action: 'create',
    entity: 'record',
    entityKey: mod.key,
    entityId: record._id,
    summary: `Added row ${describeRecord(fields, data)} to ${mod.label}`.replace(/\s+/g, ' ').trim(),
    after: data,
    source: req.auditSource,
  });

  res.status(201).json({ success: true, data: serializeRecord(record, fields) });
});

// PUT /api/records/:moduleKey/:id  { data: { ... } } - partial update
const updateRecord = asyncHandler(async (req, res) => {
  const mod = await getCustomModuleOr404(res, req.params.moduleKey);
  const fields = mod.activeFields();

  const record = await CustomRecord.findOne({ _id: req.params.id, moduleKey: mod.key });
  if (!record) {
    res.status(404);
    throw new Error('Record not found');
  }

  const before = { ...(record.data || {}) };
  const { data, errors } = buildFieldData(fields, req.body.data || req.body, {
    partial: true,
    existing: before,
  });
  if (errors.length) {
    res.status(400);
    throw new Error(errors.join('; '));
  }

  record.data = data;
  record.markModified('data');
  record.updatedBy = req.user._id;
  await record.save();

  await logAudit(req, {
    action: 'update',
    entity: 'record',
    entityKey: mod.key,
    entityId: record._id,
    summary: `Edited row ${describeRecord(fields, data)} in ${mod.label}`.replace(/\s+/g, ' ').trim(),
    before,
    after: data,
    source: req.auditSource,
  });

  res.json({ success: true, data: serializeRecord(record, fields) });
});

// DELETE /api/records/:moduleKey/:id[?permanent=true]
// Same two-step policy as modules and fields: hide first, purge only on an
// explicit second confirmation.
const deleteRecord = asyncHandler(async (req, res) => {
  const mod = await getCustomModuleOr404(res, req.params.moduleKey);
  const fields = mod.activeFields();

  const record = await CustomRecord.findOne({ _id: req.params.id, moduleKey: mod.key });
  if (!record) {
    res.status(404);
    throw new Error('Record not found');
  }

  const permanent = String(req.query.permanent) === 'true';
  const label = describeRecord(fields, record.data || {});

  if (permanent) {
    await record.deleteOne();
  } else {
    record.isActive = false;
    record.updatedBy = req.user._id;
    await record.save();
  }

  await logAudit(req, {
    action: 'delete',
    entity: 'record',
    entityKey: mod.key,
    entityId: record._id,
    summary: `${permanent ? 'Permanently deleted' : 'Deleted'} row ${label} from ${mod.label}`
      .replace(/\s+/g, ' ')
      .trim(),
    before: record.data,
    source: req.auditSource,
  });

  res.json({ success: true, data: {} });
});

/**
 * POST /api/records/:moduleKey/bulk-delete  { ids: [...] , permanent? }
 * Superadmin-only bulk action behind the "All Data" screen. Kept as its own
 * endpoint (rather than N deletes from the browser) so the whole batch lands
 * as ONE audit entry - a hundred separate rows would bury the Recent Changes
 * feed and make the trail harder to read, not easier.
 */
const bulkDeleteRecords = asyncHandler(async (req, res) => {
  const mod = await getCustomModuleOr404(res, req.params.moduleKey);
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400);
    throw new Error('ids must be a non-empty array');
  }

  const permanent = String(req.body.permanent) === 'true' || req.body.permanent === true;
  const filter = { _id: { $in: ids }, moduleKey: mod.key };

  let affected;
  if (permanent) {
    const result = await CustomRecord.deleteMany(filter);
    affected = result.deletedCount;
  } else {
    const result = await CustomRecord.updateMany(filter, { isActive: false, updatedBy: req.user._id });
    affected = result.modifiedCount;
  }

  await logAudit(req, {
    action: 'delete',
    entity: 'record',
    entityKey: mod.key,
    summary: `${permanent ? 'Permanently deleted' : 'Deleted'} ${affected} row(s) from ${mod.label} in bulk`,
    before: { ids },
    source: req.auditSource,
  });

  res.json({ success: true, data: { affected } });
});

// POST /api/records/upload  (multipart, field name "file")
// Generic upload for any custom module's `file`-type field. Not tied to a
// specific module/record/field - the frontend uploads first and gets a
// Cloudinary URL back, then includes that URL as the field's value in the
// normal create/update record call, same as any other field value flowing
// through buildFieldData.
const uploadRecordFile = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured()) {
    res.status(500);
    throw new Error('File storage is not set up yet - CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set in the backend environment variables.');
  }
  if (!req.file) {
    res.status(400);
    throw new Error('No file was received. Attach one under the "file" field.');
  }
  const result = await uploadBufferToCloudinary(req.file.buffer, 'rsa-construction/module-files', {
    resource_type: 'auto',
  });
  res.status(201).json({ success: true, data: { url: result.secure_url, publicId: result.public_id } });
});

module.exports = {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  bulkDeleteRecords,
  uploadRecordFile,
};
