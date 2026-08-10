const Material = require('../models/Material');
const StockTransaction = require('../models/StockTransaction');
const asyncHandler = require('../utils/asyncHandler');
const { isLowStock, remainingStock } = require('../utils/calc');

// GET /api/stock  - snapshot of every material's Opening / Purchased / Used / Remaining
const getStockSummary = asyncHandler(async (req, res) => {
  const materials = await Material.find().sort({ materialName: 1 });
  const data = materials.map((m) => ({
    id: m._id,
    materialName: m.materialName,
    category: m.category,
    unit: m.unit,
    openingStock: m.openingStock,
    quantityPurchased: m.quantityPurchased,
    quantityUsed: m.quantityUsed,
    remainingStock: m.remainingStock,
    reorderLevel: m.reorderLevel,
    lowStock: isLowStock(m.remainingStock, m.reorderLevel),
  }));
  res.json({ success: true, count: data.length, data });
});

// GET /api/stock/low-stock
const getLowStock = asyncHandler(async (req, res) => {
  const materials = await Material.find();
  const low = materials
    .filter((m) => isLowStock(m.remainingStock, m.reorderLevel))
    .map((m) => ({
      id: m._id,
      materialName: m.materialName,
      unit: m.unit,
      remainingStock: m.remainingStock,
      reorderLevel: m.reorderLevel,
    }));
  res.json({ success: true, count: low.length, data: low });
});

// GET /api/stock/:materialId/transactions
const getMaterialTransactions = asyncHandler(async (req, res) => {
  const transactions = await StockTransaction.find({ materialId: req.params.materialId }).sort({ date: -1 });
  res.json({ success: true, count: transactions.length, data: transactions });
});

/**
 * GET /api/stock/ledger?from=&to=&materialId=
 * The manual-ledger-style view (mirrors "MATERIAL TABLE" in the spec: S.No, Date,
 * Material Name, Quantity, Rate, Amount, Stock Balance, Remarks) - one row per stock
 * movement (purchase or delivery-driven usage), chronological, running balance shown.
 */
const getLedger = asyncHandler(async (req, res) => {
  const { from, to, materialId } = req.query;
  const filter = {};
  if (materialId) filter.materialId = materialId;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  const transactions = await StockTransaction.find(filter)
    .populate('materialId', 'materialName unit')
    .sort({ date: 1, createdAt: 1 });

  const data = transactions.map((t, idx) => ({
    sNo: idx + 1,
    id: t._id,
    date: t.date,
    materialName: t.materialId ? t.materialId.materialName : 'Deleted Material',
    unit: t.materialId ? t.materialId.unit : '',
    type: t.type,
    referenceType: t.referenceType,
    quantity: t.quantity,
    rate: t.rate,
    brand: t.brand || '',
    amount: Math.round(t.quantity * t.rate * 100) / 100,
    stockBalance: t.balanceAfter,
    reference: t.reference,
    remarks: t.remarks,
    paymentMode: t.type === 'IN' ? t.paymentMode || 'Cash' : '',
    upiRefNumber: t.type === 'IN' ? t.upiRefNumber || '' : '',
  }));

  res.json({ success: true, count: data.length, data });
});

// POST /api/stock/adjust  - manual correction (e.g. wastage, stock count correction)
const manualAdjustment = asyncHandler(async (req, res) => {
  const { materialId, type, quantity, remarks } = req.body;
  if (!['IN', 'OUT'].includes(type)) {
    res.status(400);
    throw new Error("type must be 'IN' or 'OUT'");
  }
  const material = await Material.findById(materialId);
  if (!material) {
    res.status(404);
    throw new Error('Material not found');
  }

  if (type === 'IN') {
    material.quantityPurchased += Number(quantity);
  } else {
    if (Number(quantity) > material.remainingStock) {
      res.status(400);
      throw new Error('Cannot deduct more than the remaining stock');
    }
    material.quantityUsed += Number(quantity);
  }
  material.remainingStock = remainingStock(material.openingStock, material.quantityPurchased, material.quantityUsed);
  await material.save();

  const txn = await StockTransaction.create({
    materialId: material._id,
    type,
    quantity,
    balanceAfter: material.remainingStock,
    reference: 'Manual Adjustment',
    referenceType: 'Manual',
    remarks: remarks || '',
  });

  res.status(201).json({ success: true, data: { material, transaction: txn } });
});

module.exports = { getStockSummary, getLowStock, getMaterialTransactions, getLedger, manualAdjustment };
