const DeliveryNote = require('../models/DeliveryNote');
const StockTransaction = require('../models/StockTransaction');
const Material = require('../models/Material');
const asyncHandler = require('../utils/asyncHandler');
const { isLowStock } = require('../utils/calc');

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfYear(d) {
  return new Date(d.getFullYear(), 0, 1);
}

// GET /api/reports/dashboard - powers the Dashboard tab
const getDashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  const [todayAgg, monthAgg, yearAgg, allTimeAgg, pendingAgg, materials, recentNotes] = await Promise.all([
    DeliveryNote.aggregate([
      { $match: { date: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
    DeliveryNote.aggregate([
      { $match: { date: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
    DeliveryNote.aggregate([
      { $match: { date: { $gte: yearStart } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
    DeliveryNote.aggregate([{ $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }]),
    DeliveryNote.aggregate([
      { $match: { paymentStatus: 'Pending' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
    Material.find(),
    DeliveryNote.find().sort({ createdAt: -1 }).limit(10),
  ]);

  const lowStockMaterials = materials.filter((m) => isLowStock(m.remainingStock, m.reorderLevel));

  res.json({
    success: true,
    data: {
      todaysBilling: todayAgg[0]?.total || 0,
      todaysBillingCount: todayAgg[0]?.count || 0,
      monthlyBilling: monthAgg[0]?.total || 0,
      monthlyBillingCount: monthAgg[0]?.count || 0,
      yearlyBilling: yearAgg[0]?.total || 0,
      yearlyBillingCount: yearAgg[0]?.count || 0,
      totalRevenue: allTimeAgg[0]?.total || 0,
      pendingPayments: pendingAgg[0]?.total || 0,
      pendingPaymentsCount: pendingAgg[0]?.count || 0,
      totalMaterials: materials.length,
      lowStockCount: lowStockMaterials.length,
      lowStockAlerts: lowStockMaterials.map((m) => ({
        id: m._id,
        materialName: m.materialName,
        remainingStock: m.remainingStock,
        unit: m.unit,
        reorderLevel: m.reorderLevel,
      })),
      recentTransactions: recentNotes,
    },
  });
});

// GET /api/reports/daily-billing?date=YYYY-MM-DD
const dailyBillingReport = asyncHandler(async (req, res) => {
  const date = req.query.date ? new Date(req.query.date) : new Date();
  const notes = await DeliveryNote.find({ date: { $gte: startOfDay(date), $lte: endOfDay(date) } }).sort({
    createdAt: 1,
  });
  const total = notes.reduce((s, n) => s + n.totalAmount, 0);
  res.json({ success: true, data: { date: startOfDay(date), notes, total, count: notes.length } });
});

// GET /api/reports/daily-material-movement?date=YYYY-MM-DD
const dailyMaterialMovement = asyncHandler(async (req, res) => {
  const date = req.query.date ? new Date(req.query.date) : new Date();
  const transactions = await StockTransaction.find({
    date: { $gte: startOfDay(date), $lte: endOfDay(date) },
  })
    .populate('materialId', 'materialName unit')
    .sort({ date: 1 });
  res.json({ success: true, data: { date: startOfDay(date), transactions, count: transactions.length } });
});

// GET /api/reports/monthly-revenue?year=&month=  (month is 1-12)
const monthlyRevenueReport = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) - 1 : new Date().getMonth();
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1);

  const notes = await DeliveryNote.find({ date: { $gte: from, $lt: to } }).sort({ date: 1 });
  const byDay = {};
  notes.forEach((n) => {
    const key = new Date(n.date).toISOString().slice(0, 10);
    byDay[key] = (byDay[key] || 0) + n.totalAmount;
  });
  const total = notes.reduce((s, n) => s + n.totalAmount, 0);
  const paid = notes.filter((n) => n.paymentStatus === 'Paid').reduce((s, n) => s + n.totalAmount, 0);
  const pending = total - paid;

  res.json({ success: true, data: { year, month: month + 1, total, paid, pending, byDay, count: notes.length } });
});

// GET /api/reports/monthly-material-cost?year=&month=
const monthlyMaterialCostReport = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) - 1 : new Date().getMonth();
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1);

  const transactions = await StockTransaction.find({ type: 'IN', date: { $gte: from, $lt: to } }).populate(
    'materialId',
    'materialName unit'
  );
  const byMaterial = {};
  transactions.forEach((t) => {
    const name = t.materialId ? t.materialId.materialName : 'Unknown';
    byMaterial[name] = (byMaterial[name] || 0) + t.quantity * t.rate;
  });
  const total = Object.values(byMaterial).reduce((s, v) => s + v, 0);

  res.json({ success: true, data: { year, month: month + 1, total, byMaterial } });
});

// GET /api/reports/yearly-summary?year=
const yearlySummaryReport = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);

  const notes = await DeliveryNote.find({ date: { $gte: from, $lt: to } });
  const byMonth = Array.from({ length: 12 }, () => 0);
  notes.forEach((n) => {
    byMonth[new Date(n.date).getMonth()] += n.totalAmount;
  });
  const total = notes.reduce((s, n) => s + n.totalAmount, 0);
  const paid = notes.filter((n) => n.paymentStatus === 'Paid').reduce((s, n) => s + n.totalAmount, 0);

  const materialPurchases = await StockTransaction.find({ type: 'IN', date: { $gte: from, $lt: to } });
  const materialSpend = materialPurchases.reduce((s, t) => s + t.quantity * t.rate, 0);

  res.json({
    success: true,
    data: {
      year,
      totalRevenue: total,
      paidRevenue: paid,
      pendingRevenue: total - paid,
      totalDeliveryNotes: notes.length,
      materialSpend,
      byMonth,
    },
  });
});

module.exports = {
  getDashboard,
  dailyBillingReport,
  dailyMaterialMovement,
  monthlyRevenueReport,
  monthlyMaterialCostReport,
  yearlySummaryReport,
};
