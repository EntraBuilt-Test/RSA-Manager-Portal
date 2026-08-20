const Worker = require('../models/Worker');
const LabourEntry = require('../models/LabourEntry');
const SiteLog = require('../models/SiteLog');
const asyncHandler = require('../utils/asyncHandler');
const { round2 } = require('../utils/calc');
const { isCloudinaryConfigured, uploadBufferToCloudinary, storeImageBuffer } = require('../config/cloudinary');

/**
 * POST /api/labour/entries
 * Posts one daily voucher line for a worker (per "Labour ku Vouchers.. daily
 * sheet: site name, workername, salary, old balance, advance, total, paid").
 * wageEarned = wageRate x daysWorked; the worker's running currentBalance is
 * updated by (wageEarned - advance - paid) and snapshotted onto the entry as
 * balanceAfter, the same running-total pattern used for Material stock.
 */
const createEntry = asyncHandler(async (req, res) => {
  const { workerId, date, daysWorked, advance, paid, remarks } = req.body;
  if (!workerId) {
    res.status(400);
    throw new Error('workerId is required');
  }
  const worker = await Worker.findById(workerId);
  if (!worker) {
    res.status(404);
    throw new Error('Worker not found');
  }

  const days = Number(daysWorked) > 0 ? Number(daysWorked) : 1;
  const wageRate = worker.dailyWage;
  const wageEarned = round2(wageRate * days);
  const advanceAmt = round2(Number(advance) || 0);
  const paidAmt = round2(Number(paid) || 0);

  const balanceBefore = worker.currentBalance;
  const totalDue = round2(balanceBefore + wageEarned);
  worker.currentBalance = round2(totalDue - advanceAmt - paidAmt);
  await worker.save();

  const entry = await LabourEntry.create({
    workerId: worker._id,
    workerName: worker.name,
    site: worker.site,
    role: worker.role,
    date: date || new Date(),
    daysWorked: days,
    wageRate,
    wageEarned,
    balanceBefore,
    totalDue,
    advance: advanceAmt,
    paid: paidAmt,
    balanceAfter: worker.currentBalance,
    remarks: remarks || '',
  });

  res.status(201).json({ success: true, data: { entry, worker } });
});

// GET /api/labour/entries?site=&workerId=&from=&to=
const getEntries = asyncHandler(async (req, res) => {
  const { site, workerId, from, to } = req.query;
  const filter = {};
  if (site) filter.site = site;
  if (workerId) filter.workerId = workerId;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  const entries = await LabourEntry.find(filter).sort({ date: -1, createdAt: -1 });
  res.json({ success: true, count: entries.length, data: entries });
});

// DELETE /api/labour/entries/:id  (reverses its effect on the worker's running balance)
const deleteEntry = asyncHandler(async (req, res) => {
  const entry = await LabourEntry.findById(req.params.id);
  if (!entry) {
    res.status(404);
    throw new Error('Entry not found');
  }
  const worker = await Worker.findById(entry.workerId);
  if (worker) {
    worker.currentBalance = round2(worker.currentBalance - entry.wageEarned + entry.advance + entry.paid);
    await worker.save();
  }
  await LabourEntry.deleteOne({ _id: entry._id });
  res.json({ success: true, data: {} });
});

/**
 * GET /api/labour/site-sheet?site=&from=&to=
 * "10 sites - individual sheet" - the daily entries for one site in a date
 * range, plus every worker currently assigned there (with their live running
 * balance) so the sheet reads like a proper site labour register even for
 * workers who didn't have an entry on a specific day.
 */
const getSiteSheet = asyncHandler(async (req, res) => {
  const { site, from, to } = req.query;
  if (!site) {
    res.status(400);
    throw new Error('site is required');
  }
  const filter = { site };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  const [entries, workers] = await Promise.all([
    LabourEntry.find(filter).sort({ date: 1, createdAt: 1 }),
    Worker.find({ site, active: true }).sort({ name: 1 }),
  ]);

  const totals = entries.reduce(
    (acc, e) => ({
      wageEarned: round2(acc.wageEarned + e.wageEarned),
      advance: round2(acc.advance + e.advance),
      paid: round2(acc.paid + e.paid),
    }),
    { wageEarned: 0, advance: 0, paid: 0 }
  );
  const totalBalanceDue = round2(workers.reduce((sum, w) => sum + w.currentBalance, 0));
  // Distinct workers active at this site (matches getConsolidatedSheet's
  // workerCount) - not attendance-days, just headcount of the crew.
  const workerCount = workers.length;

  res.json({ success: true, data: { site, entries, workers, totals, totalBalanceDue, workerCount } });
});

/**
 * GET /api/labour/consolidated?from=&to=
 * "common sheet" - every site rolled up side by side: period wages/advance/paid
 * plus each site's total outstanding balance (sum of its active workers'
 * currentBalance), and a grand total row across all sites.
 */
const getConsolidatedSheet = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const filter = {};
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  const [entries, workers] = await Promise.all([LabourEntry.find(filter), Worker.find({ active: true })]);

  const siteNames = new Set([...entries.map((e) => e.site), ...workers.map((w) => w.site)].filter(Boolean));

  const rows = Array.from(siteNames)
    .sort()
    .map((site) => {
      const siteEntries = entries.filter((e) => e.site === site);
      const siteWorkers = workers.filter((w) => w.site === site);
      const wageEarned = round2(siteEntries.reduce((s, e) => s + e.wageEarned, 0));
      const advance = round2(siteEntries.reduce((s, e) => s + e.advance, 0));
      const paid = round2(siteEntries.reduce((s, e) => s + e.paid, 0));
      const balanceDue = round2(siteWorkers.reduce((s, w) => s + w.currentBalance, 0));
      return { site, workerCount: siteWorkers.length, wageEarned, advance, paid, balanceDue };
    });

  const grandTotal = rows.reduce(
    (acc, r) => ({
      workerCount: acc.workerCount + r.workerCount,
      wageEarned: round2(acc.wageEarned + r.wageEarned),
      advance: round2(acc.advance + r.advance),
      paid: round2(acc.paid + r.paid),
      balanceDue: round2(acc.balanceDue + r.balanceDue),
    }),
    { workerCount: 0, wageEarned: 0, advance: 0, paid: 0, balanceDue: 0 }
  );

  res.json({ success: true, data: { rows, grandTotal } });
});

/**
 * GET /api/labour/monthly-salary?year=&month=  (month is 1-12)
 * Each worker's total wage earned in the given month - same
 * group-and-sum shape as getConsolidatedSheet, just grouped by worker
 * instead of by site.
 */
const getMonthlySalary = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);

  const entries = await LabourEntry.find({ date: { $gte: from, $lt: to } });
  const byWorker = new Map();
  entries.forEach((e) => {
    const key = String(e.workerId);
    const row = byWorker.get(key) || {
      workerId: e.workerId,
      workerName: e.workerName,
      site: e.site,
      role: e.role,
      daysWorked: 0,
      wageEarned: 0,
    };
    row.daysWorked = round2(row.daysWorked + e.daysWorked);
    row.wageEarned = round2(row.wageEarned + e.wageEarned);
    byWorker.set(key, row);
  });

  const rows = Array.from(byWorker.values()).sort((a, b) => a.workerName.localeCompare(b.workerName));
  const grandTotal = round2(rows.reduce((sum, r) => sum + r.wageEarned, 0));

  res.json({ success: true, data: { year, month, rows, grandTotal } });
});

/**
 * POST /api/labour/site-log/photos  (multipart, field name "photos", 2-7 files)
 * Body also carries: site, date, lat?, lng?, address?.
 * Upserts the one SiteLog for this site+date (see model comment for why it's
 * per-day-per-site rather than per-worker-entry) - re-submitting the same
 * day replaces the photo set and location rather than accumulating duplicates.
 */
const uploadSiteLogPhotos = asyncHandler(async (req, res) => {
  // Item U: no longer a hard stop. storeImageBuffer() uses Cloudinary when it
  // is configured and falls back to local disk when it is not, so the screen
  // works out of the box and the CLOUDINARY_* variables become an
  // optimisation rather than a prerequisite.
  const { site, date, lat, lng, address, accuracy, note } = req.body;
  if (!site || !String(site).trim()) {
    res.status(400);
    throw new Error('site is required');
  }
  if (!date) {
    res.status(400);
    throw new Error('date is required');
  }
  const files = req.files || [];
  if (files.length < 2) {
    res.status(400);
    throw new Error('At least 2 photos are required for a site log entry');
  }

  const uploads = await Promise.all(
    files.map((f) => storeImageBuffer(f.buffer, 'rsa-construction/site-logs', {}, f.originalname))
  );
  const photos = uploads.map((result) => ({
    url: result.secure_url,
    publicId: result.public_id,
    uploadedBy: req.user._id,
    uploadedAt: new Date(),
  }));

  const day = new Date(date);
  day.setHours(0, 0, 0, 0);

  const log = await SiteLog.findOneAndUpdate(
    { site, date: day },
    {
      site,
      date: day,
      photos,
      location: {
        lat: lat !== undefined && lat !== '' ? Number(lat) : null,
        lng: lng !== undefined && lng !== '' ? Number(lng) : null,
        address: address ? String(address).trim() : '',
        accuracy: accuracy !== undefined && accuracy !== '' ? Number(accuracy) : null,
      },
      note: note ? String(note).trim() : '',
      createdBy: req.user._id,
    },
    { upsert: true, new: true }
  );

  res.status(201).json({ success: true, data: log });
});

// GET /api/labour/site-log?site=&limit=  - most recent site logs, for the
// Daily Entry tab's thumbnail strip.
const getSiteLogs = asyncHandler(async (req, res) => {
  const { site, limit } = req.query;
  const filter = {};
  if (site) filter.site = site;
  const logs = await SiteLog.find(filter)
    .populate('createdBy', 'name')
    .sort({ date: -1 })
    .limit(Number(limit) || 10);
  res.json({ success: true, count: logs.length, data: logs });
});

module.exports = {
  createEntry,
  getEntries,
  deleteEntry,
  getSiteSheet,
  getConsolidatedSheet,
  getMonthlySalary,
  uploadSiteLogPhotos,
  getSiteLogs,
};
