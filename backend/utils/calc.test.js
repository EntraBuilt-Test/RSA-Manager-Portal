/**
 * Zero-dependency sanity tests for calc.js - run with: node utils/calc.test.js
 * Not a replacement for a real test runner (jest/mocha); just a fast smoke test
 * that doesn't require npm install, so the core math can be verified anywhere.
 */
const assert = require('assert');
const {
  lineAmount,
  daysBetween,
  computeItemAmount,
  computeDeliveryNoteTotals,
  remainingStock,
  isLowStock,
  applyStockIn,
  applyStockOut,
} = require('./calc');

// Amount = Quantity x Rate
assert.strictEqual(lineAmount(20, 350), 7000, 'lineAmount basic multiply failed');
assert.strictEqual(lineAmount(3.5, 100), 350, 'lineAmount decimal qty failed');

// Delivery note totals (mirrors the "Particulars / Qty / Amount / Total" section of the paper form)
const dn = computeDeliveryNoteTotals([
  { itemName: 'Cement', quantity: 20, rate: 350 },
  { itemName: 'Steel 10mm', quantity: 85, rate: 68 },
  { itemName: '7 Adi Jack', quantity: 2, rate: 3270 },
]);
assert.strictEqual(dn.items[0].amount, 7000);
assert.strictEqual(dn.items[1].amount, 5780);
assert.strictEqual(dn.items[2].amount, 6540);
assert.strictEqual(dn.totalAmount, 7000 + 5780 + 6540, 'grand total mismatch');

// computeDeliveryNoteTotals with NO itemColumns configured must be identical to
// plain Qty x Rate (this is the default/paper-exact behavior - adding the
// Superadmin item-column feature must never change existing notes' math).
const dnNoColumns = computeDeliveryNoteTotals(
  [{ itemName: 'Cement', quantity: 20, rate: 350, extra: { discount: 999 } }],
  []
);
assert.strictEqual(dnNoColumns.items[0].amount, 7000, 'extra values must be ignored when no itemColumns are configured');

// Superadmin item columns: flat "Discount" (number, subtract)
const discountCol = { key: 'discount', type: 'number', effect: 'subtract' };
assert.strictEqual(
  computeItemAmount({ quantity: 20, rate: 350, extra: { discount: 500 } }, [discountCol]),
  6500,
  'flat discount should subtract from Qty x Rate'
);
assert.strictEqual(
  computeItemAmount({ quantity: 20, rate: 350, extra: {} }, [discountCol]),
  7000,
  'missing discount value should not change the amount'
);

// Superadmin item columns: "Discount %" (percent, subtract)
const discountPercentCol = { key: 'discountPercent', type: 'percent', effect: 'subtract' };
assert.strictEqual(
  computeItemAmount({ quantity: 20, rate: 350, extra: { discountPercent: 10 } }, [discountPercentCol]),
  6300,
  '10% discount on 7000 should give 6300'
);

// Surcharge-style column (number, add)
const surchargeCol = { key: 'surcharge', type: 'number', effect: 'add' };
assert.strictEqual(
  computeItemAmount({ quantity: 20, rate: 350, extra: { surcharge: 200 } }, [surchargeCol]),
  7200,
  'add-effect column should increase the amount'
);

// A text-type column must never affect the amount, even if it holds a numeric-looking string
const remarkCol = { key: 'remark', type: 'text', effect: 'none' };
assert.strictEqual(
  computeItemAmount({ quantity: 20, rate: 350, extra: { remark: '999' } }, [remarkCol]),
  7000,
  'text columns must never affect the calculated amount'
);

// Amount can never go negative (e.g. a discount larger than the line total)
assert.strictEqual(
  computeItemAmount({ quantity: 1, rate: 10, extra: { discount: 500 } }, [discountCol]),
  0,
  'amount should floor at 0, not go negative'
);

// Multiple columns combine (discount and percent discount both applied)
assert.strictEqual(
  computeItemAmount(
    { quantity: 20, rate: 350, extra: { discount: 200, discountPercent: 10 } },
    [discountCol, discountPercentCol]
  ),
  6100,
  '7000 - 200 flat - 700 (10%) = 6100'
);

// ---- Rental billing (Return Date / Per-Day Rate) ----

// 3-day rental: 2 pipes at Rs.50/day/pipe, taken Jul 1 returned Jul 4 -> 3 days
assert.strictEqual(daysBetween('2026-07-01', '2026-07-04'), 3, 'daysBetween should count 3 days Jul1->Jul4');
assert.strictEqual(
  computeItemAmount(
    { quantity: 2, rate: 0, perDayRate: 50, dateTaken: '2026-07-01', dateReturned: '2026-07-04' },
    []
  ),
  300,
  'rental amount should be perDayRate x quantity x days (50 x 2 x 3 = 300)'
);

// Same-day taken/returned still bills a minimum of 1 day
assert.strictEqual(daysBetween('2026-07-01', '2026-07-01'), 1, 'same-day rental should bill at least 1 day');
assert.strictEqual(
  computeItemAmount(
    { quantity: 1, rate: 0, perDayRate: 100, dateTaken: '2026-07-01', dateReturned: '2026-07-01' },
    []
  ),
  100,
  'same-day rental should bill exactly 1 day'
);

// perDayRate left blank (0/undefined) must fall back to plain Qty x Rate, unchanged
assert.strictEqual(
  computeItemAmount({ quantity: 20, rate: 350, dateTaken: '2026-07-01' }, []),
  7000,
  'items without a perDayRate must use plain Qty x Rate even if a date is present'
);

// Rental items still combine with Superadmin item columns (discount applies on the rental base)
assert.strictEqual(
  computeItemAmount(
    { quantity: 2, rate: 0, perDayRate: 50, dateTaken: '2026-07-01', dateReturned: '2026-07-04', extra: { discount: 50 } },
    [discountCol]
  ),
  250,
  'discount should apply on top of the rental base (300 - 50 = 250)'
);

// Stock: remaining = opening + purchased - used (per spec example: 500 - 85 = 415)
assert.strictEqual(remainingStock(500, 0, 85), 415, 'steel example from spec failed');

// Cement example from spec: 100 bags - 20 delivered = 80 remaining
const cementAfterOut = applyStockOut({ openingStock: 100, quantityPurchased: 0, quantityUsed: 0 }, 20);
assert.strictEqual(cementAfterOut.remainingStock, 80, 'cement delivery deduction example failed');

// Purchase increases stock
const afterPurchase = applyStockIn({ openingStock: 100, quantityPurchased: 0, quantityUsed: 0 }, 50, 45);
assert.strictEqual(afterPurchase.remainingStock, 150);
assert.strictEqual(afterPurchase.totalAmount, 2250);

// Low stock alert
assert.strictEqual(isLowStock(15, 20), true, 'should flag low stock at/under reorder level');
assert.strictEqual(isLowStock(50, 20), false, 'should not flag when well above reorder level');
assert.strictEqual(isLowStock(15, 0), false, 'reorderLevel of 0 disables the alert');

console.log('All calc.js smoke tests passed.');
