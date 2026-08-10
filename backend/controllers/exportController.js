const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const DeliveryNote = require('../models/DeliveryNote');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/reports/export/delivery-notes.xlsx?from=&to=&status=
 * Excel export for the Billing report. For the pixel-accurate Tamil delivery-note
 * replica itself, the frontend's print view (window.print -> Save as PDF) is used,
 * since it can render the exact Tamil header/fonts the browser already has. This
 * endpoint covers the "Export: PDF / Excel" reporting requirement for tabular reports.
 */
const exportDeliveryNotesExcel = asyncHandler(async (req, res) => {
  const { from, to, status } = req.query;
  const filter = {};
  if (status) filter.paymentStatus = status;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  const notes = await DeliveryNote.find(filter).sort({ date: 1 });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RSA Construction Management System';
  const sheet = workbook.addWorksheet('Delivery Notes');

  sheet.columns = [
    { header: 'Note No.', key: 'noteNumber', width: 16 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Customer', key: 'customer', width: 24 },
    { header: 'Vehicle No.', key: 'vehicle', width: 16 },
    { header: 'Items', key: 'items', width: 40 },
    { header: 'Total Amount', key: 'total', width: 16 },
    { header: 'Payment Status', key: 'status', width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };

  notes.forEach((n) => {
    sheet.addRow({
      noteNumber: n.noteNumber,
      date: new Date(n.date).toLocaleDateString('en-IN'),
      customer: n.customerNameSnapshot,
      vehicle: n.vehicleNumber,
      items: n.items.map((i) => `${i.itemName} (${i.quantity} x ${i.rate})`).join(', '),
      total: n.totalAmount,
      status: n.paymentStatus,
    });
  });

  const totalRow = sheet.addRow({ noteNumber: '', customer: '', total: notes.reduce((s, n) => s + n.totalAmount, 0) });
  totalRow.font = { bold: true };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=delivery-notes-report.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});

/**
 * GET /api/reports/export/delivery-note/:id.pdf
 * Server-generated PDF fallback (English labels) - functional download for systems
 * where client-side printing isn't available. The primary print path is the frontend's
 * print-styled DeliveryNotePrint view, which matches the original paper exactly.
 */
const exportDeliveryNotePDF = asyncHandler(async (req, res) => {
  const note = await DeliveryNote.findById(req.params.id.replace('.pdf', ''));
  if (!note) {
    res.status(404);
    throw new Error('Delivery note not found');
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${note.noteNumber}.pdf`);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.pipe(res);

  doc.fontSize(16).text('R.S.A CONSTRUCTION', { align: 'center' });
  doc.fontSize(9).text('1/6, Pathima Nagar, N.K. Road, Thanjavur - 613 001', { align: 'center' });
  doc.text('Cell: 90470 35567, 93603 42993', { align: 'center' });
  doc.moveDown();
  doc.fontSize(13).text('DELIVERY NOTE', { align: 'center', underline: true });
  doc.moveDown(0.5);

  doc.fontSize(10);
  doc.text(`Date: ${new Date(note.date).toLocaleDateString('en-IN')}`, 40, doc.y, { continued: true });
  doc.text(`S.No: ${note.noteNumber}`, { align: 'right' });
  doc.text(`Customer: ${note.customerNameSnapshot}`);
  doc.text(`Phone: ${note.customerPhoneSnapshot || '-'}`);
  doc.text(`Address: ${note.customerAddressSnapshot || '-'}`);
  doc.text(`Vehicle No: ${note.vehicleNumber || '-'}`);
  doc.moveDown();

  const tableTop = doc.y;
  doc.font('Helvetica-Bold');
  doc.text('No.', 40, tableTop, { width: 30 });
  doc.text('Particulars', 75, tableTop, { width: 260 });
  doc.text('Qty', 340, tableTop, { width: 60 });
  doc.text('Amount', 420, tableTop, { width: 100 });
  doc.font('Helvetica');
  let y = tableTop + 18;
  note.items.forEach((item, idx) => {
    doc.text(String(idx + 1), 40, y, { width: 30 });
    doc.text(item.itemName, 75, y, { width: 260 });
    doc.text(String(item.quantity), 340, y, { width: 60 });
    doc.text(item.amount.toFixed(2), 420, y, { width: 100 });
    y += 18;
  });

  doc.moveTo(40, y + 4).lineTo(555, y + 4).stroke();
  doc.font('Helvetica-Bold').text('TOTAL', 340, y + 10, { width: 60 });
  doc.text(note.totalAmount.toFixed(2), 420, y + 10, { width: 100 });
  doc.font('Helvetica').text(`Payment Status: ${note.paymentStatus}`, 40, y + 40);

  doc.text('_____________________', 40, y + 100);
  doc.text('Customer Signature', 40, y + 118);
  doc.text('_____________________', 380, y + 100);
  doc.text('Authorized Signature', 380, y + 118);

  doc.end();
});

module.exports = { exportDeliveryNotesExcel, exportDeliveryNotePDF };
