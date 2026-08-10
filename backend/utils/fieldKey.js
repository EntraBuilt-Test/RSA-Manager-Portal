/**
 * Field/module key generation and validation.
 *
 * Keys are generated once from a human label and then frozen, because stored
 * values live under them (`extra.discountPercent`, `data.siteName`). This is
 * the same slug algorithm settingsController already uses for Delivery Note
 * item columns, lifted here so modules, fields and item columns all produce
 * identical keys for identical labels.
 *
 * Validation runs SERVER-SIDE on every write, not just in the Superadmin UI:
 * a bad key (a duplicate, or one that shadows a real column or a Mongoose
 * internal) would silently corrupt reads for every user of that module.
 */

// Keys that would collide with Mongoose/Object internals or with the
// envelope fields the generic controllers manage themselves.
const RESERVED_KEYS = [
  '_id', 'id', '__v', '__proto__', 'constructor', 'prototype',
  'createdat', 'updatedat', 'createdby', 'updatedby',
  'extra', 'data', 'modulekey', 'isactive', 'isystem', 'issystem',
  'save', 'toobject', 'tojson', 'schema', 'model', 'collection', 'db', 'populate',
];

// Core columns already owned by each system module's real Mongoose model.
// A Superadmin-added extra field must not shadow one of these, or the generic
// renderer would show two columns claiming to be the same thing while only the
// hand-built one actually drives the business logic.
const SYSTEM_CORE_FIELDS = {
  billing: [
    'notenumber', 'date', 'customer', 'customernamesnapshot', 'customerphonesnapshot',
    'customeraddresssnapshot', 'vehiclenumber', 'vehiclephoto', 'items', 'totalamount',
    'paymentstatus', 'stockdeducted',
  ],
  materials: [
    'materialname', 'category', 'brand', 'unit', 'openingstock', 'quantitypurchased',
    'quantityused', 'remainingstock', 'purchaserate', 'totalamount', 'supplier',
    'remarks', 'reorderlevel',
  ],
  labour: [
    'workerid', 'workername', 'site', 'role', 'date', 'daysworked', 'wagerate',
    'wageearned', 'advance', 'paid', 'balanceafter', 'remarks',
  ],
  voucher: [
    'vouchernumber', 'date', 'receivedfrom', 'receivedby', 'purpose', 'paymenttype',
    'amount', 'remarks',
  ],
  stock: ['materialid', 'type', 'quantity', 'rate', 'brand', 'balanceafter', 'reference', 'referencetype', 'date', 'remarks'],
  dashboard: [],
  reports: [],
};

/**
 * "Discount %" -> "discountPercent"; collisions get a numeric suffix
 * ("discountPercent2") so a label can be reused without breaking the
 * already-stored values under the original key.
 */
function slugifyKey(label, existingKeys = []) {
  let base = String(label || '')
    .trim()
    .replace(/%/g, ' percent ')
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
  if (!base) base = 'field';
  base = base.charAt(0).toLowerCase() + base.slice(1);
  if (/^[0-9]/.test(base)) base = `f${base}`;

  const taken = existingKeys.map((k) => String(k).toLowerCase());
  let key = base;
  let i = 2;
  while (taken.includes(key.toLowerCase())) {
    key = `${base}${i}`;
    i += 1;
  }
  return key;
}

/**
 * Returns an error string, or null when the key is usable.
 * `moduleKey` is optional - pass it to also reject core-column shadowing.
 */
function validateFieldKey(key, { moduleKey, existingKeys = [] } = {}) {
  const raw = String(key || '').trim();
  if (!raw) return 'Field key is required';
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(raw)) {
    return 'Field key must start with a letter and contain only letters, numbers or underscores';
  }
  if (raw.length > 40) return 'Field key must be 40 characters or fewer';

  const lower = raw.toLowerCase();
  if (RESERVED_KEYS.includes(lower)) return `"${raw}" is a reserved name - please use a different label`;

  if (moduleKey) {
    const core = SYSTEM_CORE_FIELDS[String(moduleKey).toLowerCase()] || [];
    if (core.includes(lower)) {
      return `"${raw}" is already a built-in column on this module - please use a different label`;
    }
  }

  if (existingKeys.map((k) => String(k).toLowerCase()).includes(lower)) {
    return `A field with the key "${raw}" already exists on this module`;
  }

  return null;
}

/** Same rules as a field key, plus the reserved route slugs the app owns. */
const RESERVED_MODULE_KEYS = ['login', 'superadmin', 'api', 'm', 'new', 'edit', 'print', 'settings'];

function validateModuleKey(key, existingKeys = []) {
  const raw = String(key || '').trim();
  if (!raw) return 'Module key is required';
  if (!/^[a-z][a-z0-9]*$/.test(raw)) {
    return 'Module key must be lowercase letters and numbers only, starting with a letter';
  }
  if (RESERVED_MODULE_KEYS.includes(raw)) return `"${raw}" is a reserved route name - please use a different name`;
  if (existingKeys.map((k) => String(k).toLowerCase()).includes(raw)) {
    return `A module with the key "${raw}" already exists`;
  }
  return null;
}

module.exports = {
  slugifyKey,
  validateFieldKey,
  validateModuleKey,
  RESERVED_KEYS,
  RESERVED_MODULE_KEYS,
  SYSTEM_CORE_FIELDS,
};
