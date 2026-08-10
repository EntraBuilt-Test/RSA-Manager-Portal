/**
 * Pure calculation helpers - no external dependencies.
 * Kept separate from Mongoose models so the core business math
 * (the numbers on the paper forms) can be unit-tested in isolation.
 */

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** Amount = Quantity x Rate, per delivery note line item */
function lineAmount(quantity, rate) {
  const q = Number(quantity);
  const r = Number(rate);
  if (Number.isNaN(q) || Number.isNaN(r)) throw new Error('Quantity and rate must be numbers');
  return round2(q * r);
}

/**
 * Number of days to bill for a rented item: from dateTaken through dateReturned
 * (or through today, if it hasn't been returned yet - an in-progress rental
 * still accrues rent). Always at least 1 day, even for a same-day rental.
 */
function daysBetween(dateTaken, dateReturned) {
  if (!dateTaken) return 1;
  const start = new Date(dateTaken);
  const end = dateReturned ? new Date(dateReturned) : new Date();
  const ms = end.getTime() - start.getTime();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

/**
 * Amount for one delivery note line, including any Superadmin-defined extra
 * columns (Settings.itemColumns) such as a per-row Discount or Discount %,
 * and optional per-day rental pricing (Return Date feature).
 *
 * item: { quantity, rate, extra, perDayRate?, dateTaken?, dateReturned? }
 *   - Normal item: perDayRate left blank/0 -> base = quantity x rate (unchanged
 *     paper-exact behavior, the default for every item unless set otherwise).
 *   - Rental item: perDayRate > 0 -> base = perDayRate x quantity x days,
 *     where days is computed from dateTaken/dateReturned (see daysBetween).
 * itemColumns: [{ key, type: 'number'|'percent'|'text', effect: 'add'|'subtract'|'none' }]
 *   still applies on top of whichever base was used above, unchanged.
 */
function computeItemAmount(item, itemColumns) {
  const it = item && typeof item === 'object' ? item : {};
  const q = Number(it.quantity);
  const r = Number(it.rate);
  if (Number.isNaN(q) || Number.isNaN(r)) throw new Error('Quantity and rate must be numbers');

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

/**
 * Computes each item's amount + the delivery note grand total.
 * itemColumns is optional - omit it (or pass []) for plain Qty x Rate behavior.
 */
function computeDeliveryNoteTotals(items, itemColumns = []) {
  const computedItems = items.map((it) => ({
    ...it,
    amount: computeItemAmount(it, itemColumns),
  }));
  const totalAmount = round2(computedItems.reduce((sum, it) => sum + it.amount, 0));
  return { items: computedItems, totalAmount };
}

/** Material purchase line: Total Amount = Quantity x Rate */
function purchaseAmount(quantity, rate) {
  return lineAmount(quantity, rate);
}

/** remaining = opening + purchased - used */
function remainingStock(openingStock, quantityPurchased, quantityUsed) {
  return round2(Number(openingStock) + Number(quantityPurchased) - Number(quantityUsed));
}

/** true if remaining stock is at/below the reorder level (low-stock alert) */
function isLowStock(remaining, reorderLevel) {
  if (!reorderLevel || reorderLevel <= 0) return false;
  return remaining <= reorderLevel;
}

/** Applies an IN (purchase) transaction to a material's running totals */
function applyStockIn(material, quantity, rate) {
  const quantityPurchased = round2(material.quantityPurchased + Number(quantity));
  const remaining = remainingStock(material.openingStock, quantityPurchased, material.quantityUsed);
  return {
    quantityPurchased,
    remainingStock: remaining,
    purchaseRate: Number(rate),
    totalAmount: purchaseAmount(quantity, rate),
  };
}

/** Applies an OUT (delivery/usage) transaction to a material's running totals */
function applyStockOut(material, quantity) {
  const quantityUsed = round2(material.quantityUsed + Number(quantity));
  const remaining = remainingStock(material.openingStock, material.quantityPurchased, quantityUsed);
  return { quantityUsed, remainingStock: remaining };
}

module.exports = {
  round2,
  lineAmount,
  daysBetween,
  computeItemAmount,
  computeDeliveryNoteTotals,
  purchaseAmount,
  remainingStock,
  isLowStock,
  applyStockIn,
  applyStockOut,
};
