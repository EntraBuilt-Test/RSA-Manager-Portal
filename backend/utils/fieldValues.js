/**
 * Type coercion and validation for values written against a runtime
 * FieldDefinition[].
 *
 * Mongoose can't do this for us: the shape lives in another document
 * (`Module.fields`), not in the schema of the collection being written. So the
 * same guarantees a normal schema would give - required, correct type, select
 * value actually in the option list - are enforced here instead, and this
 * module is the single place that happens for BOTH custom-module rows
 * (`CustomRecord.data`) and system-module extras (`extra` on Material,
 * Voucher, LabourEntry, Worker).
 */

function coerceValue(field, raw) {
  if (raw === undefined || raw === null || raw === '') return null;

  switch (field.type) {
    case 'number':
    case 'percent': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : NaN;
    }
    case 'boolean':
      return raw === true || raw === 'true' || raw === 1 || raw === '1';
    case 'date': {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? NaN : d;
    }
    case 'select':
    case 'reference':
    case 'text':
    // A `file` field stores the Cloudinary URL returned by the upload
    // endpoint (backend/routes/customRecordRoutes.js POST /upload) - the
    // actual file bytes never pass through here, only the string URL, so it
    // is coerced exactly like `text`.
    case 'file':
    default:
      return String(raw).trim();
  }
}

/**
 * Validates `input` against `fields` and returns { data, errors }.
 *
 * `partial: true` (used by PUT/PATCH) only touches keys actually present in
 * the input, so editing one column can't blank the others or trip a `required`
 * check on a field the user never opened.
 *
 * Values for keys with no matching active field are dropped rather than
 * stored - that stops a stale form or a hand-written API call from writing
 * junk into `data`/`extra` under keys nothing will ever render.
 */
function buildFieldData(fields, input, { partial = false, existing = {} } = {}) {
  const errors = [];
  const data = partial ? { ...existing } : {};
  const source = input && typeof input === 'object' ? input : {};

  fields.forEach((field) => {
    const provided = Object.prototype.hasOwnProperty.call(source, field.key);
    if (partial && !provided) return;

    const coerced = coerceValue(field, source[field.key]);

    if (Number.isNaN(coerced)) {
      errors.push(`"${field.label}" must be a valid ${field.type === 'date' ? 'date' : 'number'}`);
      return;
    }

    if (coerced === null) {
      if (field.required) errors.push(`"${field.label}" is required`);
      data[field.key] = null;
      return;
    }

    if (field.type === 'select' && field.options.length > 0 && !field.options.includes(coerced)) {
      errors.push(`"${field.label}" must be one of: ${field.options.join(', ')}`);
      return;
    }

    data[field.key] = coerced;
  });

  return { data, errors };
}

/**
 * Total contributed by numeric fields flagged add/subtract - the generalization
 * of the Discount behavior that already exists for Delivery Note item columns
 * (see utils/calc.js). Percent fields are applied against `base`; plain numbers
 * are applied as flat amounts.
 */
function computeFieldEffects(fields, data, base = 0) {
  return fields.reduce((sum, field) => {
    if (field.effect !== 'add' && field.effect !== 'subtract') return sum;
    const value = Number(data ? data[field.key] : 0);
    if (!Number.isFinite(value) || value === 0) return sum;
    const amount = field.type === 'percent' ? (base * value) / 100 : value;
    return field.effect === 'add' ? sum + amount : sum - amount;
  }, 0);
}

module.exports = { coerceValue, buildFieldData, computeFieldEffects };
