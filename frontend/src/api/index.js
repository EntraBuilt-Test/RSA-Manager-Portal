import client from './client';
import { downloadFile } from '../utils/download';

export const authApi = {
  login: (payload) => client.post('/auth/login', payload).then((r) => r.data),
  register: (payload) => client.post('/auth/register', payload).then((r) => r.data),
  me: () => client.get('/auth/me').then((r) => r.data),
};

export const customerApi = {
  list: (params) => client.get('/customers', { params }).then((r) => r.data),
  get: (id) => client.get(`/customers/${id}`).then((r) => r.data),
  create: (payload) => client.post('/customers', payload).then((r) => r.data),
  update: (id, payload) => client.put(`/customers/${id}`, payload).then((r) => r.data),
  remove: (id) => client.delete(`/customers/${id}`).then((r) => r.data),
  // file: a browser File object (the Aadhaar card photo).
  scanAadhaar: (file) => {
    const formData = new FormData();
    formData.append('aadhaar', file);
    return client
      .post('/customers/scan-aadhaar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};

export const deliveryNoteApi = {
  list: (params) => client.get('/delivery-notes', { params }).then((r) => r.data),
  get: (id) => client.get(`/delivery-notes/${id}`).then((r) => r.data),
  create: (payload) => client.post('/delivery-notes', payload).then((r) => r.data),
  update: (id, payload) => client.put(`/delivery-notes/${id}`, payload).then((r) => r.data),
  remove: (id) => client.delete(`/delivery-notes/${id}`).then((r) => r.data),
  setPaymentStatus: (id, paymentStatus) =>
    client.patch(`/delivery-notes/${id}/payment-status`, { paymentStatus }).then((r) => r.data),
  // file: a browser File object (from <input type="file">). Sent as multipart
  // form data since JSON can't carry binary file content.
  uploadVehiclePhoto: (id, file) => {
    const formData = new FormData();
    formData.append('vehiclePhoto', file);
    return client
      .post(`/delivery-notes/${id}/vehicle-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  removeVehiclePhoto: (id) => client.delete(`/delivery-notes/${id}/vehicle-photo`).then((r) => r.data),
  uploadReceiverPhoto: (id, file) => {
    const formData = new FormData();
    formData.append('receiverPhoto', file);
    return client
      .post(`/delivery-notes/${id}/receiver-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  removeReceiverPhoto: (id) => client.delete(`/delivery-notes/${id}/receiver-photo`).then((r) => r.data),
  // dataUrl: a "data:image/png;base64,..." string from the signature <canvas>.
  saveSignature: (id, dataUrl) => client.post(`/delivery-notes/${id}/signature`, { dataUrl }).then((r) => r.data),
  recordAdvance: (id, advanceReceived) =>
    client.patch(`/delivery-notes/${id}/advance`, { advanceReceived }).then((r) => r.data),
};

export const materialApi = {
  list: (params) => client.get('/materials', { params }).then((r) => r.data),
  get: (id) => client.get(`/materials/${id}`).then((r) => r.data),
  create: (payload) => client.post('/materials', payload).then((r) => r.data),
  update: (id, payload) => client.put(`/materials/${id}`, payload).then((r) => r.data),
  remove: (id) => client.delete(`/materials/${id}`).then((r) => r.data),
};

export const stockApi = {
  summary: () => client.get('/stock').then((r) => r.data),
  lowStock: () => client.get('/stock/low-stock').then((r) => r.data),
  transactions: (materialId) => client.get(`/stock/${materialId}/transactions`).then((r) => r.data),
  ledger: (params) => client.get('/stock/ledger', { params }).then((r) => r.data),
  adjust: (payload) => client.post('/stock/adjust', payload).then((r) => r.data),
};

export const reportApi = {
  dashboard: () => client.get('/reports/dashboard').then((r) => r.data),
  dailyBilling: (date) => client.get('/reports/daily-billing', { params: { date } }).then((r) => r.data),
  dailyMaterialMovement: (date) =>
    client.get('/reports/daily-material-movement', { params: { date } }).then((r) => r.data),
  monthlyRevenue: (year, month) =>
    client.get('/reports/monthly-revenue', { params: { year, month } }).then((r) => r.data),
  monthlyMaterialCost: (year, month) =>
    client.get('/reports/monthly-material-cost', { params: { year, month } }).then((r) => r.data),
  yearlySummary: (year) => client.get('/reports/yearly-summary', { params: { year } }).then((r) => r.data),
  // Authenticated file download (blob + Bearer token) - NOT a plain <a href>,
  // since a plain link navigation can't carry the JWT the API requires.
  exportDeliveryNotesExcel: (params = {}) =>
    downloadFile('/reports/export/delivery-notes.xlsx', params, 'delivery-notes-report.xlsx'),
};

export const settingsApi = {
  get: () => client.get('/settings').then((r) => r.data),
  addParticular: (payload) => client.post('/settings/particulars', payload).then((r) => r.data),
  updateParticular: (id, payload) => client.put(`/settings/particulars/${id}`, payload).then((r) => r.data),
  moveParticular: (id, direction) => client.patch(`/settings/particulars/${id}/move`, { direction }).then((r) => r.data),
  removeParticular: (id) => client.delete(`/settings/particulars/${id}`).then((r) => r.data),
  addCategory: (value) => client.post('/settings/categories', { value }).then((r) => r.data),
  updateCategory: (index, value) => client.put(`/settings/categories/${index}`, { value }).then((r) => r.data),
  moveCategory: (index, direction) =>
    client.patch(`/settings/categories/${index}/move`, { direction }).then((r) => r.data),
  removeCategory: (index) => client.delete(`/settings/categories/${index}`).then((r) => r.data),
  addUnit: (value) => client.post('/settings/units', { value }).then((r) => r.data),
  updateUnit: (index, value) => client.put(`/settings/units/${index}`, { value }).then((r) => r.data),
  moveUnit: (index, direction) => client.patch(`/settings/units/${index}/move`, { direction }).then((r) => r.data),
  removeUnit: (index) => client.delete(`/settings/units/${index}`).then((r) => r.data),
  addSite: (value) => client.post('/settings/sites', { value }).then((r) => r.data),
  updateSite: (index, value) => client.put(`/settings/sites/${index}`, { value }).then((r) => r.data),
  moveSite: (index, direction) => client.patch(`/settings/sites/${index}/move`, { direction }).then((r) => r.data),
  removeSite: (index) => client.delete(`/settings/sites/${index}`).then((r) => r.data),
  addBrand: (value) => client.post('/settings/brands', { value }).then((r) => r.data),
  updateBrand: (index, value) => client.put(`/settings/brands/${index}`, { value }).then((r) => r.data),
  moveBrand: (index, direction) => client.patch(`/settings/brands/${index}/move`, { direction }).then((r) => r.data),
  removeBrand: (index) => client.delete(`/settings/brands/${index}`).then((r) => r.data),
  addRole: (value) => client.post('/settings/roles', { value }).then((r) => r.data),
  updateRole: (index, value) => client.put(`/settings/roles/${index}`, { value }).then((r) => r.data),
  moveRole: (index, direction) => client.patch(`/settings/roles/${index}/move`, { direction }).then((r) => r.data),
  removeRole: (index) => client.delete(`/settings/roles/${index}`).then((r) => r.data),
  addSheetSize: (value) => client.post('/settings/sheet-sizes', { value }).then((r) => r.data),
  updateSheetSize: (index, value) => client.put(`/settings/sheet-sizes/${index}`, { value }).then((r) => r.data),
  moveSheetSize: (index, direction) =>
    client.patch(`/settings/sheet-sizes/${index}/move`, { direction }).then((r) => r.data),
  removeSheetSize: (index) => client.delete(`/settings/sheet-sizes/${index}`).then((r) => r.data),
  addColumn: (payload) => client.post('/settings/columns', payload).then((r) => r.data),
  updateColumn: (id, payload) => client.put(`/settings/columns/${id}`, payload).then((r) => r.data),
  moveColumn: (id, direction) => client.patch(`/settings/columns/${id}/move`, { direction }).then((r) => r.data),
  removeColumn: (id) => client.delete(`/settings/columns/${id}`).then((r) => r.data),
};

export const assistantApi = {
  chat: (messages) => client.post('/assistant/chat', { messages }).then((r) => r.data),
};

export const workerApi = {
  list: (params) => client.get('/workers', { params }).then((r) => r.data),
  get: (id) => client.get(`/workers/${id}`).then((r) => r.data),
  create: (payload) => client.post('/workers', payload).then((r) => r.data),
  update: (id, payload) => client.put(`/workers/${id}`, payload).then((r) => r.data),
  remove: (id) => client.delete(`/workers/${id}`).then((r) => r.data),
};

export const labourApi = {
  createEntry: (payload) => client.post('/labour/entries', payload).then((r) => r.data),
  listEntries: (params) => client.get('/labour/entries', { params }).then((r) => r.data),
  removeEntry: (id) => client.delete(`/labour/entries/${id}`).then((r) => r.data),
  siteSheet: (params) => client.get('/labour/site-sheet', { params }).then((r) => r.data),
  consolidated: (params) => client.get('/labour/consolidated', { params }).then((r) => r.data),
  monthlySalary: (params) => client.get('/labour/monthly-salary', { params }).then((r) => r.data),
  siteLogs: (params) => client.get('/labour/site-log', { params }).then((r) => r.data),
  // files: an array of browser File objects (2-7 photos). note: optional
  // manual location note (e.g. "Thanjavur Site, near the water tank"), used
  // when GPS is unavailable or inaccurate on the capturing device.
  uploadSiteLogPhotos: (site, date, files, location, note) => {
    const formData = new FormData();
    formData.append('site', site);
    formData.append('date', date);
    if (location?.lat !== undefined && location?.lat !== null) formData.append('lat', location.lat);
    if (location?.lng !== undefined && location?.lng !== null) formData.append('lng', location.lng);
    if (location?.address) formData.append('address', location.address);
    if (location?.accuracy !== undefined && location?.accuracy !== null) formData.append('accuracy', location.accuracy);
    if (note) formData.append('note', note);
    files.forEach((f) => formData.append('photos', f));
    return client
      .post('/labour/site-log/photos', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data);
  },
};

export const voucherApi = {
  list: (params) => client.get('/vouchers', { params }).then((r) => r.data),
  get: (id) => client.get(`/vouchers/${id}`).then((r) => r.data),
  create: (payload) => client.post('/vouchers', payload).then((r) => r.data),
  remove: (id) => client.delete(`/vouchers/${id}`).then((r) => r.data),
};

// Module registry (built-in + Superadmin-created tabs). Reads are open to any
// authenticated user - this is what lets a tab created in the Superadmin
// Portal reach every Admin/Manager/Staff sidebar with no separate sync step.
export const moduleApi = {
  list: () => client.get('/modules').then((r) => r.data),
  all: () => client.get('/modules/all').then((r) => r.data),
  get: (key) => client.get(`/modules/${key}`).then((r) => r.data),
  create: (payload) => client.post('/modules', payload).then((r) => r.data),
  update: (key, payload) => client.put(`/modules/${key}`, payload).then((r) => r.data),
  reorder: (keys) => client.patch('/modules/reorder', { keys }).then((r) => r.data),
  remove: (key, permanent) => client.delete(`/modules/${key}`, { params: permanent ? { permanent: true } : {} }).then((r) => r.data),
  addField: (key, payload) => client.post(`/modules/${key}/fields`, payload).then((r) => r.data),
  updateField: (key, fieldId, payload) => client.put(`/modules/${key}/fields/${fieldId}`, payload).then((r) => r.data),
  reorderFields: (key, fieldIds) => client.patch(`/modules/${key}/fields/reorder`, { fieldIds }).then((r) => r.data),
  deleteField: (key, fieldId, permanent) =>
    client.delete(`/modules/${key}/fields/${fieldId}`, { params: permanent ? { permanent: true } : {} }).then((r) => r.data),
  restoreField: (key, fieldId) => client.patch(`/modules/${key}/fields/${fieldId}/restore`).then((r) => r.data),
};

// Generic row storage for Superadmin-created custom modules (isSystem: false).
// Built-in tabs (Billing, Materials, ...) are never served through this -
// they keep their own dedicated APIs above, since their audited business
// logic (stock deduction, note numbering, wage balances) lives there.
export const recordApi = {
  list: (moduleKey, params) => client.get(`/records/${moduleKey}`, { params }).then((r) => r.data),
  get: (moduleKey, id) => client.get(`/records/${moduleKey}/${id}`).then((r) => r.data),
  create: (moduleKey, data) => client.post(`/records/${moduleKey}`, { data }).then((r) => r.data),
  update: (moduleKey, id, data) => client.put(`/records/${moduleKey}/${id}`, { data }).then((r) => r.data),
  remove: (moduleKey, id) => client.delete(`/records/${moduleKey}/${id}`).then((r) => r.data),
  // file: a browser File object. Uploads first and returns a Cloudinary URL,
  // which the caller then includes as a normal field value (same pattern as
  // deliveryNoteApi.uploadVehiclePhoto, but not tied to a specific record).
  uploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return client
      .post('/records/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data);
  },
};

export default client;
