const Settings = require('../models/Settings');
const Module = require('../models/Module');
const User = require('../models/User');
const { logAudit } = require('../utils/audit');
const { slugifyKey, validateFieldKey, validateModuleKey } = require('../utils/fieldKey');

/**
 * ASSISTANT ACTION LAYER
 * ----------------------
 * A fixed, whitelisted set of things the chat assistant is allowed to do on a
 * superadmin's behalf. Three properties matter here, and they are enforced by
 * the shape of this module rather than by good intentions:
 *
 *  1. WHITELIST ONLY. The assistant cannot call an arbitrary endpoint, run a
 *     query, or write code. It can only name one of the actions in ACTIONS
 *     below. Anything else is refused before any database work happens.
 *
 *  2. CONFIRMATION IS SERVER-SIDE. Proposing and executing are two separate
 *     HTTP requests (see assistantController). The propose step never writes -
 *     it only returns a description of what would happen. Nothing can be
 *     mutated by a chat message alone, even if the UI were bypassed entirely.
 *
 *  3. EVERY ACTION IS AUDITED, with source: 'assistant', into the same
 *     AuditLog as manual changes. There is no separate, quieter trail for
 *     things the bot did.
 *
 * Note what is deliberately absent: nothing here deletes business records,
 * edits a delivery note, or changes money. The assistant configures the app;
 * it does not operate it.
 */

// Actions flagged `destructive` get a stronger confirmation prompt in the UI
// and are described in terms of their consequence, not their mechanism.
const ACTIONS = {
  addMaterialCategory: {
    destructive: false,
    describe: (a) => `Add "${a.value}" to the material categories list`,
    parameters: {
      type: 'object',
      properties: { value: { type: 'string', description: 'The category name, e.g. "Bricks"' } },
      required: ['value'],
    },
    async run(req, args) {
      return addToList(req, 'materialCategories', 'category', args.value);
    },
  },

  addMaterialUnit: {
    destructive: false,
    describe: (a) => `Add "${a.value}" to the units list`,
    parameters: {
      type: 'object',
      properties: { value: { type: 'string', description: 'The unit name, e.g. "Bags"' } },
      required: ['value'],
    },
    async run(req, args) {
      return addToList(req, 'materialUnits', 'unit', args.value);
    },
  },

  addLabourSite: {
    destructive: false,
    describe: (a) => `Add "${a.value}" to the construction sites list`,
    parameters: {
      type: 'object',
      properties: { value: { type: 'string', description: 'The site name' } },
      required: ['value'],
    },
    async run(req, args) {
      return addToList(req, 'sites', 'site', args.value);
    },
  },

  addColumn: {
    destructive: false,
    describe: (a) => `Add a "${a.label}" column to the ${a.moduleKey} module`,
    parameters: {
      type: 'object',
      properties: {
        moduleKey: { type: 'string', description: 'Which module, e.g. materials, labour, voucher, billing' },
        label: { type: 'string', description: 'The column name shown to users, e.g. "Discount %"' },
        type: {
          type: 'string',
          enum: ['text', 'number', 'percent', 'date', 'select', 'boolean'],
          description: 'What kind of value the column holds',
        },
        required: { type: 'boolean', description: 'Whether the column must be filled in' },
      },
      required: ['moduleKey', 'label'],
    },
    async run(req, args) {
      const mod = await Module.findOne({ key: String(args.moduleKey).toLowerCase() });
      if (!mod) throw new Error(`There is no module called "${args.moduleKey}"`);

      const existingKeys = mod.fields.map((f) => f.key);
      const key = slugifyKey(args.label, existingKeys);
      const keyError = validateFieldKey(key, { moduleKey: mod.key, existingKeys });
      if (keyError) throw new Error(keyError);

      const type = ['text', 'number', 'percent', 'date', 'select', 'boolean'].includes(args.type) ? args.type : 'text';
      const position = mod.fields.reduce((m, f) => Math.max(m, f.position), 0) + 1;

      mod.fields.push({
        key,
        label: String(args.label).trim(),
        type,
        position,
        effect: 'none',
        required: Boolean(args.required),
        options: [],
        showInTable: true,
        showInForm: true,
        showInPrint: false,
        isActive: true,
      });
      mod.updatedBy = req.user._id;
      await mod.save();

      await logAudit(req, {
        action: 'create',
        entity: 'field',
        entityKey: `${mod.key}.${key}`,
        summary: `Added "${args.label}" column to ${mod.label} (via assistant)`,
        after: { key, label: args.label, type },
        source: 'assistant',
      });

      return `Added the "${args.label}" column to ${mod.label}. It's already showing on that module's form and table.`;
    },
  },

  createModule: {
    destructive: false,
    describe: (a) =>
      `Create a new tab called "${a.label}" with ${(a.fields || []).length} column(s): ${(a.fields || [])
        .map((f) => f.label)
        .join(', ')}`,
    parameters: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'The tab name, e.g. "Equipment Rentals"' },
        fields: {
          type: 'array',
          description: 'The columns this tab should record',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              type: { type: 'string', enum: ['text', 'number', 'percent', 'date', 'select', 'boolean'] },
            },
            required: ['label'],
          },
        },
      },
      required: ['label', 'fields'],
    },
    async run(req, args) {
      const all = await Module.find({}).select('key order');
      const key = slugifyKey(args.label).toLowerCase().replace(/[^a-z0-9]/g, '');
      const keyError = validateModuleKey(key, all.map((m) => m.key));
      if (keyError) throw new Error(keyError);

      const seen = [];
      const fields = (args.fields || []).map((f, i) => {
        const fieldKey = slugifyKey(f.label, seen);
        seen.push(fieldKey);
        return {
          key: fieldKey,
          label: String(f.label).trim(),
          type: ['text', 'number', 'percent', 'date', 'select', 'boolean'].includes(f.type) ? f.type : 'text',
          position: i + 1,
          effect: 'none',
          required: false,
          options: [],
          showInTable: true,
          showInForm: true,
          showInPrint: false,
          isActive: true,
        };
      });
      if (fields.length === 0) throw new Error('A new tab needs at least one column');

      const mod = await Module.create({
        key,
        label: String(args.label).trim(),
        icon: '📄',
        short: String(args.label).trim().slice(0, 2).toUpperCase(),
        path: `/m/${key}`,
        order: all.reduce((m, x) => Math.max(m, x.order || 0), 0) + 1,
        isSystem: false,
        isActive: true,
        fields,
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });

      await logAudit(req, {
        action: 'create',
        entity: 'module',
        entityKey: mod.key,
        entityId: mod._id,
        summary: `Created module "${mod.label}" with ${fields.length} field(s) (via assistant)`,
        after: { key: mod.key, label: mod.label, fields: fields.map((f) => f.key) },
        source: 'assistant',
      });

      return `Created the "${mod.label}" tab with ${fields.length} column(s). It's in the sidebar now.`;
    },
  },

  renameModule: {
    destructive: false,
    describe: (a) => `Rename the "${a.moduleKey}" tab to "${a.label}"`,
    parameters: {
      type: 'object',
      properties: {
        moduleKey: { type: 'string' },
        label: { type: 'string', description: 'The new name' },
      },
      required: ['moduleKey', 'label'],
    },
    async run(req, args) {
      const mod = await Module.findOne({ key: String(args.moduleKey).toLowerCase() });
      if (!mod) throw new Error(`There is no module called "${args.moduleKey}"`);
      const before = mod.label;
      mod.label = String(args.label).trim();
      mod.updatedBy = req.user._id;
      await mod.save();

      await logAudit(req, {
        action: 'update',
        entity: 'module',
        entityKey: mod.key,
        entityId: mod._id,
        summary: `Renamed module "${before}" to "${mod.label}" (via assistant)`,
        before: { label: before },
        after: { label: mod.label },
        source: 'assistant',
      });

      return `Renamed "${before}" to "${mod.label}". Everyone will see the new name on their next page load.`;
    },
  },

  hideModule: {
    destructive: true,
    describe: (a) => `Hide the "${a.moduleKey}" tab from the sidebar for everyone (records are kept)`,
    parameters: {
      type: 'object',
      properties: { moduleKey: { type: 'string' } },
      required: ['moduleKey'],
    },
    async run(req, args) {
      const mod = await Module.findOne({ key: String(args.moduleKey).toLowerCase() });
      if (!mod) throw new Error(`There is no module called "${args.moduleKey}"`);
      mod.isActive = false;
      mod.updatedBy = req.user._id;
      await mod.save();

      await logAudit(req, {
        action: 'delete',
        entity: 'module',
        entityKey: mod.key,
        entityId: mod._id,
        summary: `Hid module "${mod.label}" from the sidebar (via assistant)`,
        before: { isActive: true },
        after: { isActive: false },
        source: 'assistant',
      });

      return `"${mod.label}" is hidden from the sidebar. Nothing was deleted - you can show it again from the Module Builder.`;
    },
  },

  removeColumn: {
    destructive: true,
    describe: (a) => `Remove the "${a.fieldKey}" column from the ${a.moduleKey} module (recorded values are kept)`,
    parameters: {
      type: 'object',
      properties: {
        moduleKey: { type: 'string' },
        fieldKey: { type: 'string', description: 'The key of the column to remove' },
      },
      required: ['moduleKey', 'fieldKey'],
    },
    async run(req, args) {
      const mod = await Module.findOne({ key: String(args.moduleKey).toLowerCase() });
      if (!mod) throw new Error(`There is no module called "${args.moduleKey}"`);
      const field = mod.fields.find((f) => f.key === args.fieldKey && f.isActive);
      if (!field) throw new Error(`"${args.moduleKey}" has no active column called "${args.fieldKey}"`);

      // Soft delete only. The assistant is never given the permanent-delete
      // path - dropping a column definition for good is a decision that should
      // take a deliberate click in the Field Manager, not a sentence of chat.
      field.isActive = false;
      mod.updatedBy = req.user._id;
      await mod.save();

      await logAudit(req, {
        action: 'delete',
        entity: 'field',
        entityKey: `${mod.key}.${field.key}`,
        summary: `Removed "${field.label}" column from ${mod.label} (via assistant)`,
        before: { isActive: true },
        after: { isActive: false },
        source: 'assistant',
      });

      return `Removed the "${field.label}" column from ${mod.label}. The values already entered are kept, and you can restore it from the Field Manager.`;
    },
  },

  deactivateUser: {
    destructive: true,
    describe: (a) => `Revoke superadmin access for the account ${a.email}`,
    parameters: {
      type: 'object',
      properties: { email: { type: 'string', description: "The account's email address" } },
      required: ['email'],
    },
    async run(req, args) {
      const target = await User.findOne({ email: String(args.email).toLowerCase().trim() });
      if (!target) throw new Error(`There is no account with the email ${args.email}`);
      if (!target.isSuperAdmin) return `${target.name} does not have superadmin access, so there was nothing to revoke.`;

      const superAdminCount = await User.countDocuments({ isSuperAdmin: true });
      if (superAdminCount <= 1) throw new Error('That is the only superadmin account - grant it to someone else first');

      target.isSuperAdmin = false;
      await target.save();

      await logAudit(req, {
        action: 'update',
        entity: 'user',
        entityKey: target.email,
        entityId: target._id,
        summary: `Revoked superadmin for ${target.name} (via assistant)`,
        before: { isSuperAdmin: true },
        after: { isSuperAdmin: false },
        source: 'assistant',
      });

      return `${target.name} no longer has superadmin access. Their normal ${target.role} login still works.`;
    },
  },
};

// Shared implementation for the three Settings value lists.
async function addToList(req, fieldName, label, value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) throw new Error(`Tell me what ${label} to add`);

  let settings = await Settings.findOne({ singleton: 'default' });
  if (!settings) settings = await Settings.create({ singleton: 'default' });

  if (settings[fieldName].includes(trimmed)) {
    return `"${trimmed}" is already in the ${label} list, so nothing changed.`;
  }

  settings[fieldName].push(trimmed);
  settings.markModified(fieldName);
  await settings.save();

  await logAudit(req, {
    action: 'create',
    entity: 'setting',
    entityKey: fieldName,
    summary: `Added ${label} "${trimmed}" (via assistant)`,
    after: { value: trimmed },
    source: 'assistant',
  });

  return `Added "${trimmed}" to the ${label} list. It will show up as a suggestion in the relevant form straight away.`;
}

/** OpenAI/Groq-compatible tool definitions, generated from ACTIONS. */
function toolDefinitions() {
  return Object.entries(ACTIONS).map(([name, def]) => ({
    type: 'function',
    function: {
      name,
      description: def.describe({ value: '...', label: '...', moduleKey: '...', fields: [] }),
      parameters: def.parameters,
    },
  }));
}

/** Human-readable description of a proposed action, shown before executing. */
function describeAction(name, args) {
  const def = ACTIONS[name];
  if (!def) return null;
  try {
    return def.describe(args || {});
  } catch (err) {
    return `Run "${name}"`;
  }
}

function isDestructive(name) {
  return Boolean(ACTIONS[name] && ACTIONS[name].destructive);
}

/**
 * Executes a whitelisted action. Throws for anything not in the whitelist -
 * which is also the guard against an LLM inventing a plausible-sounding
 * function name that was never implemented.
 */
async function runAction(req, name, args) {
  const def = ACTIONS[name];
  if (!def) throw new Error(`"${name}" is not something I'm allowed to do.`);
  return def.run(req, args || {});
}

module.exports = { ACTIONS, toolDefinitions, describeAction, isDestructive, runAction };
