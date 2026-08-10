const Material = require('../models/Material');
const StockTransaction = require('../models/StockTransaction');
const asyncHandler = require('../utils/asyncHandler');
const { applyStockIn, remainingStock, isLowStock } = require('../utils/calc');

// GET /api/materials?search=&category=&lowStock=true
const getMaterials = asyncHandler(async (req, res) => {
  const { search, category, lowStock } = req.query;
  const filter = {};
  if (search) filter.materialName = new RegExp(search, 'i');
  if (category) filter.category = category;

  let materials = await Material.find(filter).sort({ materialName: 1 });
  if (lowStock === 'true') {
    materials = materials.filter((m) => isLowStock(m.remainingStock, m.reorderLevel));
  }
  res.json({ success: true, count: materials.length, data: materials });
});

// GET /api/materials/:id  (includes its stock transaction history - the "ledger")
const getMaterial = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) {
    res.status(404);
    throw new Error('Material not found');
  }
  const transactions = await StockTransaction.find({ materialId: material._id }).sort({ date: -1 });
  res.json({ success: true, data: { material, transactions } });
});

/**
 * POST /api/materials
 * Creates a Material Entry (per "MATERIAL LEDGER FEATURES"): Date, Material Name, Category,
 * Quantity, Unit, Purchase Rate, Supplier, Remarks - with Total Amount = Quantity x Rate,
 * and records the purchase as an IN stock transaction.
 */
const createMaterial = asyncHandler(async (req, res) => {
  const {
    date,
    materialName,
    category,
    quantity,
    unit,
    purchaseRate,
    brand,
    supplier,
    remarks,
    openingStock,
    reorderLevel,
    paymentMode,
    upiRefNumber,
  } = req.body;

  let material = await Material.findOne({ materialName: new RegExp(`^${materialName}$`, 'i') });

  if (!material) {
    // First time this material is entered - establish it in the master with an opening stock
    material = new Material({
      materialName,
      category: category || 'General',
      unit,
      openingStock: Number(openingStock) || 0,
      quantityPurchased: 0,
      quantityUsed: 0,
      remainingStock: Number(openingStock) || 0,
      brand: brand || '',
      supplier: supplier || '',
      remarks: remarks || '',
      reorderLevel: Number(reorderLevel) || 0,
    });
  }

  const applied = applyStockIn(material, quantity, purchaseRate);
  material.quantityPurchased = applied.quantityPurchased;
  material.remainingStock = applied.remainingStock;
  material.purchaseRate = applied.purchaseRate;
  material.totalAmount = applied.totalAmount;
  if (brand) material.brand = brand;
  if (supplier) material.supplier = supplier;
  if (remarks) material.remarks = remarks;
  await material.save();

  const txn = await StockTransaction.create({
    materialId: material._id,
    type: 'IN',
    quantity,
    rate: purchaseRate,
    brand: brand || '',
    paymentMode: paymentMode || 'Cash',
    upiRefNumber: paymentMode === 'GPay/UPI' ? upiRefNumber || '' : '',
    balanceAfter: material.remainingStock,
    reference: supplier || 'Purchase entry',
    referenceType: 'Purchase',
    date: date || new Date(),
    remarks: remarks || '',
  });

  res.status(201).json({ success: true, data: { material, transaction: txn } });
});

// PUT /api/materials/:id  (edits master fields - does not re-run stock math; use stock routes for that)
const updateMaterial = asyncHandler(async (req, res) => {
  const { materialName, category, unit, brand, supplier, remarks, reorderLevel } = req.body;
  const material = await Material.findById(req.params.id);
  if (!material) {
    res.status(404);
    throw new Error('Material not found');
  }
  if (materialName) material.materialName = materialName;
  if (category) material.category = category;
  if (unit) material.unit = unit;
  if (brand !== undefined) material.brand = brand;
  if (supplier !== undefined) material.supplier = supplier;
  if (remarks !== undefined) material.remarks = remarks;
  if (reorderLevel !== undefined) material.reorderLevel = Number(reorderLevel);
  await material.save();
  res.json({ success: true, data: material });
});

// DELETE /api/materials/:id
const deleteMaterial = asyncHandler(async (req, res) => {
  const inUse = await StockTransaction.exists({ materialId: req.params.id });
  if (inUse) {
    res.status(400);
    throw new Error('Cannot delete a material with existing stock transactions. Consider editing it instead.');
  }
  const material = await Material.findByIdAndDelete(req.params.id);
  if (!material) {
    res.status(404);
    throw new Error('Material not found');
  }
  res.json({ success: true, data: {} });
});

module.exports = { getMaterials, getMaterial, createMaterial, updateMaterial, deleteMaterial };
