/**
 * Frontend mirror of backend/utils/calc.js's computeItemAmount, so the
 * Create/Edit Delivery Note form can show a live Amount preview (including
 * any Superadmin-defined extra columns like Discount, and rental per-day
 * pricing) without a round trip to the server. The backend recomputes the
 * authoritative amount the same way when the note is actually saved - this
 * is purely for the live UI.
 */
export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Days to bill for a rented item: dateTaken through dateReturned (or through
 * today if not yet returned). Always at least 1 day, even same-day.
 */
export function daysBetween(dateTaken, dateReturned) {
  if (!dateTaken) return 1;
  const start = new Date(dateTaken);
  const end = dateReturned ? new Date(dateReturned) : new Date();
  const ms = end.getTime() - start.getTime();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

/**
 * item: { quantity, rate, extra, perDayRate?, dateTaken?, dateReturned? }
 * itemColumns: [{ key, type: 'number'|'percent'|'text', effect: 'add'|'subtract'|'none' }]
 */
export function computeItemAmount(item, itemColumns) {
  const it = item && typeof item === 'object' ? item : {};
  const q = Number(it.quantity) || 0;
  const r = Number(it.rate) || 0;
  const perDayRate = Number(it.perDayRate) || 0;
  const monthlyRate = Number(it.monthlyRate) || 0;

  let base;
  if (monthlyRate > 0) {
    const days = daysBetween(it.dateTaken, it.dateReturned);
    base = monthlyRate * q * (days / 30);
  } else if (perDayRate > 0) {
    const days = daysBetween(it.dateTaken, it.dateReturned);
    base = perDayRate * q * days;
  } else {
    base = q * r;
  }

  let amount = base;
  const cols = Array.isArray(itemColumns) ? itemColumns : [];
  const values = it.extra && typeof it.extra === 'object' ? it.extra : {};

  for (const col of cols) {
    if (!col || col.type === 'text' || col.effect === 'none') continue;
    const raw = values[col.key];
    const val = Number(raw);
    if (!raw || Number.isNaN(val)) continue;
    const delta = col.type === 'percent' ? base * (val / 100) : val;
    amount += col.effect === 'add' ? delta : -delta;
  }

  return round2(Math.max(0, amount));
}
