const mongoose = require('mongoose');
const Module = require('../models/Module');
const CustomRecord = require('../models/CustomRecord');
const AuditLog = require('../models/AuditLog');
const AutomationRule = require('../models/AutomationRule');
const User = require('../models/User');
const DeliveryNote = require('../models/DeliveryNote');
const Material = require('../models/Material');
const asyncHandler = require('../utils/asyncHandler');
const { logAudit } = require('../utils/audit');
const { buildFieldData } = require('../utils/fieldValues');
const { MODULE_DATA_SOURCES } = require('../config/moduleDataSources');
const { isLowStock } = require('../utils/calc');

/**
 * The Superadmin Portal's own endpoints: the Overview dashboard, the generic
 * "All Data" browser, and the Automation rule configuration.
 *
 * Everything here is behind protect + requireSuperAdmin at the route layer.
 */

// ---------------------------------------------------------------------------
// Automation rules
// ---------------------------------------------------------------------------

/**
 * The fixed catalogue of rules. Each one pairs a description the owner reads
 * with an evaluator that runs against live data - so what the toggle promises
 * and what the code does can't drift apart.
 */
const AUTOMATION_RULES = [
  {
    key: 'flagOverduePayments',
    label: 'Flag overdue payments',
    description:
      'Highlight delivery notes still marked Pending after a set number of days, so nothing quietly ages past its due date.',
    defaultParams: { days: 30 },
    paramSchema: [{ key: 'days', label: 'Days before a pending note is flagged', type: 'number', min: 1, max: 365 }],
    async evaluate(params) {
      const days = Math.min(Math.max(Number(params.days) || 30, 1), 365);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const notes = await DeliveryNote.find({ paymentStatus: 'Pending', date: { $lte: cutoff } })
        .sort({ date: 1 })
        .limit(50)
        .select('noteNumber date customerNameSnapshot totalAmount');
      const total = notes.reduce((sum, n) => sum + (n.totalAmount || 0), 0);
      return {
        count: notes.length,
        headline:
          notes.length === 0
            ? `No pending delivery notes older than ${days} days`
            : `${notes.length} delivery note(s) pending for more than ${days} days (₹${total.toLocaleString('en-IN')})`,
        items: notes.map((n) => ({
          id: n._id,
          label: `${n.noteNumber} - ${n.customerNameSnapshot}`,
          value: n.totalAmount,
          date: n.date,
        })),
      };
    },
  },
  {
    key: 'lowStockAlert',
    label: 'Flag stock below reorder level',
    description:
      "Surface any material whose remaining stock has fallen to or below the reorder level set on its record.",
    defaultParams: {},
    paramSchema: [],
    async evaluate() {
      const materials = await Material.find({}).select('materialName unit remainingStock reorderLevel');
      const low = materials.filter((m) => isLowStock(m.remainingStock, m.reorderLevel));
      return {
        count: low.length,
        headline: low.length === 0 ? 'All materials are above their reorder level' : `${low.length} material(s) at or below reorder level`,
        items: low.slice(0, 50).map((m) => ({
          id: m._id,
          label: m.materialName,
          value: `${m.remainingStock} ${m.unit}`,
          date: null,
        })),
      };
    },
  },
];

async function getRuleConfigs() {
  const saved = await AutomationRule.find({});
  const byKey = new Map(saved.map((r) => [r.key, r]));
  return AUTOMATION_RULES.map((rule) => {
    const stored = byKey.get(rule.key);
    return {
      key: rule.key,
      label: rule.label,
      description: rule.description,
      paramSchema: rule.paramSchema,
      enabled: stored ? stored.enabled : false,
      params: { ...rule.defaultParams, ...(stored && stored.params ? stored.params : {}) },
      updatedAt: stored ? stored.updatedAt : null,
    };
  });
}

// GET /api/superadmin/automation
const getAutomation = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getRuleConfigs() });
});

// PUT /api/superadmin/automation/:key  { enabled, params }
const updateAutomation = asyncHandler(async (req, res) => {
  const definition = AUTOMATION_RULES.find((r) => r.key === req.params.key);
  if (!definition) {
    res.status(404);
    throw new Error('Unknown automation rule');
  }

  const { enabled, params } = req.body;
  const existing = await AutomationRule.findOne({ key: definition.key });
  const before = existing ? { enabled: existing.enabled, params: existing.params } : { enabled: false, params: {} };

  // Only accept parameters the rule actually declares, clamped to their stated
  // range - a rule's evaluator should never see a value it wasn't built for.
  const cleanParams = { ...definition.defaultParams };
  if (params && typeof params === 'object') {
    definition.paramSchema.forEach((p) => {
      if (params[p.key] === undefined) return;
      if (p.type === 'number') {
        const n = Number(params[p.key]);
        if (Number.isFinite(n)) cleanParams[p.key] = Math.min(Math.max(n, p.min ?? -Infinity), p.max ?? Infinity);
      } else {
        cleanParams[p.key] = String(params[p.key]).trim();
      }
    });
  }

  const rule = await AutomationRule.findOneAndUpdate(
    { key: definition.key },
    {
      key: definition.key,
      enabled: enabled === undefined ? before.enabled : Boolean(enabled),
      params: cleanParams,
      updatedBy: req.user._id,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await logAudit(req, {
    action: 'update',
    entity: 'automation',
    entityKey: rule.key,
    entityId: rule._id,
    summary: `${rule.enabled ? 'Enabled' : 'Disabled'} automation rule "${definition.label}"`,
    before,
    after: { enabled: rule.enabled, params: rule.params },
    source: req.auditSource,
  });

  res.json({ success: true, data: await getRuleConfigs() });
});

// GET /api/superadmin/automation/results - evaluates every ENABLED rule now
const evaluateAutomation = asyncHandler(async (req, res) => {
  const configs = await getRuleConfigs();
  const enabled = configs.filter((c) => c.enabled);

  const results = await Promise.all(
    enabled.map(async (config) => {
      const definition = AUTOMATION_RULES.find((r) => r.key === config.key);
      try {
        const outcome = await definition.evaluate(config.params);
        return { key: config.key, label: config.label, ...outcome };
      } catch (err) {
        // One misbehaving rule must not take the whole Overview down with it.
        console.error(`Automation rule ${config.key} failed:`, err.message);
        return { key: config.key, label: config.label, count: 0, headline: 'Could not evaluate this rule', items: [] };
      }
    })
  );

  res.json({ success: true, data: results });
});

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

// GET /api/superadmin/overview
const getOverview = asyncHandler(async (req, res) => {
  const modules = await Module.find({}).sort({ order: 1 });

  // Row counts per module: system modules from their real collection, custom
  // modules from the shared CustomRecord store.
  const counts = await Promise.all(
    modules.map(async (mod) => {
      const source = MODULE_DATA_SOURCES[mod.key];
      let recordCount = null;
      if (source) {
        recordCount = await source.model.countDocuments({});
      } else if (!mod.isSystem) {
        recordCount = await CustomRecord.countDocuments({ moduleKey: mod.key, isActive: true });
      }
      return {
        key: mod.key,
        label: mod.label,
        icon: mod.icon,
        path: mod.path,
        isSystem: mod.isSystem,
        isActive: mod.isActive,
        // null means "this tab renders other modules' data and owns no rows of
        // its own" (Dashboard, Reports) - shown as a dash, not as zero.
        recordCount,
        extraFieldCount: mod.fields.filter((f) => f.isActive).length,
      };
    })
  );

  const [userCount, superAdminCount, recentChanges, lastChange] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ isSuperAdmin: true }),
    AuditLog.find({}).sort({ createdAt: -1 }).limit(8).select('action entity entityKey summary userName source createdAt'),
    AuditLog.findOne({}).sort({ createdAt: -1 }).select('createdAt'),
  ]);

  res.json({
    success: true,
    data: {
      modules: counts,
      totals: {
        modules: modules.length,
        activeModules: modules.filter((m) => m.isActive).length,
        customModules: modules.filter((m) => !m.isSystem).length,
        users: userCount,
        superAdmins: superAdminCount,
      },
      health: {
        // Mongoose readyState 1 === connected.
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        databaseName: mongoose.connection.name || '',
        lastChangeAt: lastChange ? lastChange.createdAt : null,
        serverTime: new Date().toISOString(),
        // Stated plainly rather than faked: this app has no backup service
        // wired up, so the Portal reports that instead of showing a
        // reassuring-but-meaningless timestamp.
        backup: { configured: false, lastBackupAt: null, note: 'No automated backup service is configured for this deployment.' },
      },
      recentChanges,
    },
  });
});

// ---------------------------------------------------------------------------
// All Data - one generic browser over every module
// ---------------------------------------------------------------------------

function resolveExtra(doc) {
  const extra = doc.extra && typeof doc.extra === 'object' ? doc.extra : {};
  return extra;
}

// GET /api/superadmin/data/:moduleKey?search=&limit=&page=
const listModuleData = asyncHandler(async (req, res) => {
  const key = String(req.params.moduleKey).toLowerCase();
  const mod = await Module.findOne({ key });
  if (!mod) {
    res.status(404);
    throw new Error(`Module "${key}" not found`);
  }

  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const search = String(req.query.search || '').trim();

  const extraFields = mod.activeFields();
  const source = MODULE_DATA_SOURCES[key];

  // Modules with no collection of their own (Dashboard, Reports).
  if (!source && mod.isSystem) {
    return res.json({
      success: true,
      data: {
        module: { key: mod.key, label: mod.label, icon: mod.icon, isSystem: true, coreEditable: false, editRoute: mod.path },
        columns: [],
        rows: [],
        total: 0,
        page: 1,
        pages: 1,
        note: `${mod.label} presents data from the other modules and stores no records of its own.`,
      },
    });
  }

  if (source) {
    const filter = {};
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const textCols = source.columns.filter((c) => c.type === 'text').map((c) => ({ [c.key]: rx }));
      if (textCols.length) filter.$or = textCols;
    }

    const [total, docs] = await Promise.all([
      source.model.countDocuments(filter),
      source.model
        .find(filter)
        .sort(source.sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    // Core columns first (as an Admin sees them), then any Superadmin-added
    // extra columns in their configured left-to-right order.
    const columns = [
      ...source.columns.map((c) => ({ ...c, isCore: true })),
      ...extraFields.map((f) => ({ key: f.key, label: f.label, type: f.type, isCore: false })),
    ];

    const rows = docs.map((doc) => {
      const values = {};
      source.columns.forEach((c) => {
        values[c.key] = doc[c.key] ?? null;
      });
      const extra = resolveExtra(doc);
      extraFields.forEach((f) => {
        values[f.key] = extra[f.key] ?? null;
      });
      return { id: doc._id, values, updatedAt: doc.updatedAt };
    });

    return res.json({
      success: true,
      data: {
        module: {
          key: mod.key,
          label: mod.label,
          icon: mod.icon,
          isSystem: true,
          // Core business fields are edited on the module's own screen, where
          // the stock/numbering/balance logic lives. The Portal can still edit
          // the Superadmin-added extra columns inline, since nothing computes
          // off them.
          coreEditable: source.coreEditable,
          editRoute: source.editRoute,
        },
        columns,
        rows,
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  }

  // Custom module - fully generic, fully editable.
  const filter = { moduleKey: mod.key, isActive: true };
  const allRecords = await CustomRecord.find(filter).sort({ createdAt: -1 });
  const lower = search.toLowerCase();
  const matched = lower
    ? allRecords.filter((r) =>
        extraFields.some((f) => String(r.data && r.data[f.key] !== undefined ? r.data[f.key] : '').toLowerCase().includes(lower))
      )
    : allRecords;
  const paged = matched.slice((page - 1) * limit, page * limit);

  res.json({
    success: true,
    data: {
      module: { key: mod.key, label: mod.label, icon: mod.icon, isSystem: false, coreEditable: true, editRoute: mod.path },
      columns: extraFields.map((f) => ({ key: f.key, label: f.label, type: f.type, isCore: false })),
      rows: paged.map((r) => ({
        id: r._id,
        values: extraFields.reduce((acc, f) => {
          acc[f.key] = r.data ? r.data[f.key] ?? null : null;
          return acc;
        }, {}),
        updatedAt: r.updatedAt,
      })),
      total: matched.length,
      page,
      pages: Math.ceil(matched.length / limit) || 1,
    },
  });
});

/**
 * PUT /api/superadmin/data/:moduleKey/:id  { extra: { fieldKey: value } }
 *
 * Edits ONLY the Superadmin-added extra columns on a system module's record.
 * Core fields are deliberately not writable here - deliveryNoteController owns
 * the stock-deduction transaction, labourController owns running balances, and
 * bypassing them from a generic table editor would corrupt exactly the numbers
 * the business relies on. The Portal links to the real screen for those.
 */
const updateModuleRecordExtra = asyncHandler(async (req, res) => {
  const key = String(req.params.moduleKey).toLowerCase();
  const mod = await Module.findOne({ key });
  if (!mod) {
    res.status(404);
    throw new Error(`Module "${key}" not found`);
  }

  const source = MODULE_DATA_SOURCES[key];
  if (!source) {
    res.status(400);
    throw new Error(`"${mod.label}" has no editable records of its own`);
  }

  const doc = await source.model.findById(req.params.id);
  if (!doc) {
    res.status(404);
    throw new Error('Record not found');
  }

  const fields = mod.activeFields();
  if (fields.length === 0) {
    res.status(400);
    throw new Error(`${mod.label} has no extra columns to edit`);
  }

  const before = { ...(doc.extra && typeof doc.extra === 'object' ? doc.extra : {}) };
  const { data, errors } = buildFieldData(fields, req.body.extra || {}, { partial: true, existing: before });
  if (errors.length) {
    res.status(400);
    throw new Error(errors.join('; '));
  }

  doc.extra = data;
  doc.markModified('extra');
  await doc.save();

  await logAudit(req, {
    action: 'update',
    entity: 'record',
    entityKey: mod.key,
    entityId: doc._id,
    summary: `Updated extra column values on a ${mod.label} record`,
    before,
    after: data,
    source: req.auditSource,
  });

  res.json({ success: true, data: { id: doc._id, extra: data } });
});

/**
 * GET /api/superadmin/data/:moduleKey/export  - CSV of the current view.
 *
 * CSV rather than xlsx: the existing exceljs export in exportController covers
 * the formatted delivery-note report, and this one only needs to be a faithful
 * dump of whatever columns the module happens to have right now, including
 * columns that were created minutes ago.
 */
const exportModuleData = asyncHandler(async (req, res) => {
  const key = String(req.params.moduleKey).toLowerCase();
  const mod = await Module.findOne({ key });
  if (!mod) {
    res.status(404);
    throw new Error(`Module "${key}" not found`);
  }

  const extraFields = mod.activeFields();
  const source = MODULE_DATA_SOURCES[key];

  let columns = [];
  let rows = [];

  if (source) {
    columns = [...source.columns, ...extraFields.map((f) => ({ key: f.key, label: f.label, type: f.type }))];
    const docs = await source.model.find({}).sort(source.sort).lean();
    rows = docs.map((doc) => {
      const extra = resolveExtra(doc);
      return columns.map((c) => (doc[c.key] !== undefined ? doc[c.key] : extra[c.key] ?? ''));
    });
  } else if (!mod.isSystem) {
    columns = extraFields.map((f) => ({ key: f.key, label: f.label, type: f.type }));
    const records = await CustomRecord.find({ moduleKey: mod.key, isActive: true }).sort({ createdAt: -1 });
    rows = records.map((r) => columns.map((c) => (r.data && r.data[c.key] !== undefined && r.data[c.key] !== null ? r.data[c.key] : '')));
  }

  const escape = (value) => {
    if (value === null || value === undefined) return '';
    const str = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const csv = [columns.map((c) => escape(c.label)).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');

  await logAudit(req, {
    action: 'other',
    entity: 'record',
    entityKey: mod.key,
    summary: `Exported ${rows.length} row(s) from ${mod.label} as CSV`,
    source: req.auditSource,
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${mod.key}-export.csv"`);
  // BOM so Excel opens the Tamil labels/values in the right encoding.
  res.send(`﻿${csv}`);
});

module.exports = {
  getOverview,
  listModuleData,
  updateModuleRecordExtra,
  exportModuleData,
  getAutomation,
  updateAutomation,
  evaluateAutomation,
  AUTOMATION_RULES,
};
