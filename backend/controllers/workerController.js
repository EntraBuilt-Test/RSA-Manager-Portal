const Worker = require('../models/Worker');
const LabourEntry = require('../models/LabourEntry');
const asyncHandler = require('../utils/asyncHandler');
const { round2 } = require('../utils/calc');

// GET /api/workers?site=&active=
// Each worker also carries totalAdvance/totalPaid - lifetime sums from its
// LabourEntry history (not stored fields, computed fresh on every read) so
// the Workers table can show Advance -> Paid -> Balance without a separate
// request per row.
const getWorkers = asyncHandler(async (req, res) => {
  const { site, active } = req.query;
  const filter = {};
  if (site) filter.site = site;
  if (active !== undefined) filter.active = active === 'true';
  const workers = await Worker.find(filter).sort({ site: 1, name: 1 });

  const totals = await LabourEntry.aggregate([
    { $match: { workerId: { $in: workers.map((w) => w._id) } } },
    { $group: { _id: '$workerId', totalAdvance: { $sum: '$advance' }, totalPaid: { $sum: '$paid' } } },
  ]);
  const totalsByWorker = new Map(totals.map((t) => [String(t._id), t]));

  const data = workers.map((w) => {
    const t = totalsByWorker.get(String(w._id));
    return {
      ...w.toObject(),
      totalAdvance: round2(t ? t.totalAdvance : 0),
      totalPaid: round2(t ? t.totalPaid : 0),
    };
  });

  res.json({ success: true, count: data.length, data });
});

// GET /api/workers/:id
const getWorker = asyncHandler(async (req, res) => {
  const worker = await Worker.findById(req.params.id);
  if (!worker) {
    res.status(404);
    throw new Error('Worker not found');
  }
  res.json({ success: true, data: worker });
});

// POST /api/workers  { name, site, role, dailyWage, vehicle, whatsappNumber, remarks }
// New workers always start at a zero balance - there is no more "Opening
// Balance" input to type one in from (see item 6: any pre-existing due
// amount is entered as a normal LabourEntry advance/paid line instead, so it
// shows up in the worker's history rather than as an untraceable starting number).
const createWorker = asyncHandler(async (req, res) => {
  const { name, site, role, dailyWage, vehicle, whatsappNumber, remarks } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error('Worker name is required');
  }
  const worker = await Worker.create({
    name: name.trim(),
    site: site || '',
    role: role || 'Labour',
    dailyWage: Number(dailyWage) || 0,
    openingBalance: 0,
    currentBalance: 0,
    vehicle: vehicle || '',
    whatsappNumber: whatsappNumber || '',
    remarks: remarks || '',
  });
  res.status(201).json({ success: true, data: worker });
});

// PUT /api/workers/:id  (edits master fields only - currentBalance only ever
// changes via posting a LabourEntry, so history always reconciles)
const updateWorker = asyncHandler(async (req, res) => {
  const { name, site, role, dailyWage, vehicle, whatsappNumber, active, remarks } = req.body;
  const worker = await Worker.findById(req.params.id);
  if (!worker) {
    res.status(404);
    throw new Error('Worker not found');
  }
  if (name) worker.name = name.trim();
  if (site !== undefined) worker.site = site;
  if (role !== undefined) worker.role = role;
  if (dailyWage !== undefined) worker.dailyWage = Number(dailyWage) || 0;
  if (vehicle !== undefined) worker.vehicle = vehicle;
  if (whatsappNumber !== undefined) worker.whatsappNumber = whatsappNumber;
  if (active !== undefined) worker.active = !!active;
  if (remarks !== undefined) worker.remarks = remarks;
  await worker.save();
  res.json({ success: true, data: worker });
});

// DELETE /api/workers/:id
const deleteWorker = asyncHandler(async (req, res) => {
  const inUse = await LabourEntry.exists({ workerId: req.params.id });
  if (inUse) {
    res.status(400);
    throw new Error('Cannot delete a worker with existing labour entries. Mark them inactive instead.');
  }
  const worker = await Worker.findByIdAndDelete(req.params.id);
  if (!worker) {
    res.status(404);
    throw new Error('Worker not found');
  }
  res.json({ success: true, data: {} });
});

module.exports = { getWorkers, getWorker, createWorker, updateWorker, deleteWorker };
