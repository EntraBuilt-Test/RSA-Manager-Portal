import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { settingsApi, moduleApi } from '../../api';
import ConfirmDialog from '../common/ConfirmDialog.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';

const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'percent', label: 'Percent' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'reference', label: 'Reference (another module)' },
  { value: 'file', label: 'File / Photo' },
];

/**
 * Superadmin control panel - a hidden, isSuperAdmin-gated screen for editing
 * the value-lists that used to be hardcoded (Delivery Note Particulars,
 * Material Categories/Units, generic Item Columns, and now Labour Sites).
 * Reached by clicking the sidebar logo 5 times.
 *
 * DESIGNED TO GROW: each editable area is registered as one entry in
 * SUPERADMIN_SECTIONS below, rendered through a shared sub-tab strip. Adding
 * a future config area (e.g. a new module, or an ASI-driven automation rule
 * set) means adding one more section here and one more backend Settings
 * field/route - the panel shell, auth gate, and navigation don't need to
 * change. This is intentional groundwork for the system evolving over time,
 * not a one-off screen.
 */
const SUPERADMIN_SECTIONS = [
  { key: 'particulars', label: 'Delivery Note Particulars' },
  { key: 'columns', label: 'Item Columns (Discount, etc.)' },
  { key: 'materials', label: 'Material Categories & Units' },
  { key: 'sites', label: 'Labour Sites' },
  { key: 'roles', label: 'Worker Roles' },
  { key: 'sheetSizes', label: 'Sheet Sizes' },
  { key: 'modules', label: 'Modules (Custom Tabs)' },
];

export default function SuperadminPanel() {
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState('particulars');
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    settingsApi
      .get()
      .then((res) => setSettings(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load settings'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Superadmin</h1>
        <Link to="/dashboard" className="btn btn-ghost btn-sm">
          {t('print.back')}
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="report-tabs">
        {SUPERADMIN_SECTIONS.map((s) => (
          <button
            key={s.key}
            className={`tab-link${activeSection === s.key ? ' active' : ''}`}
            onClick={() => setActiveSection(s.key)}
            type="button"
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading && <div className="page-loading">{t('common.loading')}</div>}

      {!loading && settings && activeSection === 'particulars' && (
        <ParticularsManager
          particulars={settings.particulars}
          sheetSizeOptions={settings.sheetSizeOptions || []}
          onChange={reload}
        />
      )}
      {!loading && settings && activeSection === 'columns' && (
        <ColumnsManager columns={settings.itemColumns} onChange={reload} />
      )}
      {!loading && settings && activeSection === 'materials' && (
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <OrderedListManager
            title="Material Categories"
            hint="Shown as suggestions in the Material Entry form's Category field. Add, edit, reorder (the order shown here is the suggestion order), or delete a category any time - no code deploy needed."
            values={settings.materialCategories}
            onAdd={(value) => settingsApi.addCategory(value).then(reload)}
            onUpdate={(index, value) => settingsApi.updateCategory(index, value).then(reload)}
            onMove={(index, direction) => settingsApi.moveCategory(index, direction).then(reload)}
            onRemove={(index) => settingsApi.removeCategory(index).then(reload)}
          />
          <OrderedListManager
            title="Units"
            hint="Shown as suggestions in the Material Entry form's Unit field. Add, edit, reorder, or delete a unit any time - no code deploy needed."
            values={settings.materialUnits}
            onAdd={(value) => settingsApi.addUnit(value).then(reload)}
            onUpdate={(index, value) => settingsApi.updateUnit(index, value).then(reload)}
            onMove={(index, direction) => settingsApi.moveUnit(index, direction).then(reload)}
            onRemove={(index) => settingsApi.removeUnit(index).then(reload)}
          />
          <OrderedListManager
            title="Material Brands"
            hint="Shown as suggestions in the Material Entry form's Brand field. Add, edit, reorder, or delete a brand any time - no code deploy needed."
            values={settings.materialBrands || []}
            onAdd={(value) => settingsApi.addBrand(value).then(reload)}
            onUpdate={(index, value) => settingsApi.updateBrand(index, value).then(reload)}
            onMove={(index, direction) => settingsApi.moveBrand(index, direction).then(reload)}
            onRemove={(index) => settingsApi.removeBrand(index).then(reload)}
          />
        </div>
      )}
      {!loading && settings && activeSection === 'sites' && (
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <OrderedListManager
            title="Construction Sites"
            hint="The site list used throughout the Labour module - assigning a worker to a site, filtering the Site Sheet, and rolling up the All Sites summary. Add, edit, reorder, or delete a site here as projects open and close."
            values={settings.sites || []}
            onAdd={(value) => settingsApi.addSite(value).then(reload)}
            onUpdate={(index, value) => settingsApi.updateSite(index, value).then(reload)}
            onMove={(index, direction) => settingsApi.moveSite(index, direction).then(reload)}
            onRemove={(index) => settingsApi.removeSite(index).then(reload)}
          />
        </div>
      )}
      {!loading && settings && activeSection === 'roles' && (
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <OrderedListManager
            title="Worker Roles"
            hint="The role list used in the Labour module's Add Worker form. Add, edit, reorder, or delete a role any time - no code deploy needed."
            values={settings.workerRoles || []}
            onAdd={(value) => settingsApi.addRole(value).then(reload)}
            onUpdate={(index, value) => settingsApi.updateRole(index, value).then(reload)}
            onMove={(index, direction) => settingsApi.moveRole(index, direction).then(reload)}
            onRemove={(index) => settingsApi.removeRole(index).then(reload)}
          />
        </div>
      )}
      {!loading && settings && activeSection === 'sheetSizes' && (
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <OrderedListManager
            title="Sheet Sizes"
            hint="The shared size list used by any particular whose variant sizes should stay in sync with each other (e.g. Column Box and Sheets bill the same sizes at different rates). Add, edit, reorder, or delete a size here - every linked particular picks it up automatically. Set each particular's own rate per size from its Manage Variants screen."
            values={settings.sheetSizeOptions || []}
            onAdd={(value) => settingsApi.addSheetSize(value).then(reload)}
            onUpdate={(index, value) => settingsApi.updateSheetSize(index, value).then(reload)}
            onMove={(index, direction) => settingsApi.moveSheetSize(index, direction).then(reload)}
            onRemove={(index) => settingsApi.removeSheetSize(index).then(reload)}
          />
        </div>
      )}
      {activeSection === 'modules' && <ModulesManager />}
    </div>
  );
}

// Module Builder - lets a Superadmin create a brand-new tab (e.g. "Outsourcing
// Material", "Client Material", "Site Visits") and manage its columns, using
// the moduleController API that already existed but had no frontend screen.
function ModulesManager() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedKey, setExpandedKey] = useState(null);
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('📄');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const reload = () => {
    setLoading(true);
    moduleApi
      .all()
      .then((res) => setModules(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load modules'))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const createModule = async (e) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await moduleApi.create({
        label: newLabel.trim(),
        icon: newIcon.trim() || '📄',
        description: newDescription.trim(),
      });
      setNewLabel('');
      setNewIcon('📄');
      setNewDescription('');
      setExpandedKey(res.data.key);
      reload();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create module');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="panel">
        <h2>Modules</h2>
        <p className="amount-display" style={{ marginTop: 0 }}>
          Create a brand-new tab (e.g. "Outsourcing Material", "Client Material", "Site Visits") and
          define its columns below. A tab appears in every Admin/Manager/Staff sidebar as soon as it
          has at least one field - no code deploy needed. Built-in tabs (Billing, Materials, ...) can
          have extra columns added the same way, but keep their own dedicated screens.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <form className="form-grid" onSubmit={createModule}>
          <div className="form-field">
            <label>New Module Name</label>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Outsourcing Material" required />
          </div>
          <div className="form-field">
            <label>Icon (emoji)</label>
            <input value={newIcon} onChange={(e) => setNewIcon(e.target.value)} style={{ width: 80 }} />
          </div>
          <div className="form-field form-field-wide">
            <label>Description</label>
            <input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating...' : '+ Create Module'}
            </button>
          </div>
        </form>
      </div>

      {loading && <div className="page-loading">Loading...</div>}

      {!loading &&
        modules.map((m) => (
          <div className="panel" key={m.key}>
            <div className="row-actions" style={{ justifyContent: 'space-between', width: '100%' }}>
              <h2 style={{ margin: 0 }}>
                {m.icon} {m.label}
                {m.isSystem && <span className="stat-sub"> (built-in)</span>}
                {!m.isActive && <span className="stat-sub"> - hidden</span>}
              </h2>
              <div className="row-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setExpandedKey(expandedKey === m.key ? null : m.key)}
                >
                  {expandedKey === m.key ? 'Collapse' : 'Manage Fields'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => moduleApi.update(m.key, { isActive: !m.isActive }).then(reload)}>
                  {m.isActive ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {expandedKey === m.key && <FieldManager mod={m} onChange={reload} />}
          </div>
        ))}
    </div>
  );
}

function FieldManager({ mod, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editField, setEditField] = useState(null);

  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('text');
  const [newRequired, setNewRequired] = useState(false);
  const [newOptions, setNewOptions] = useState('');
  const [newOptionsSource, setNewOptionsSource] = useState('');
  const [newReferenceModule, setNewReferenceModule] = useState('');
  const [newShowInTable, setNewShowInTable] = useState(true);
  const [newShowInForm, setNewShowInForm] = useState(true);
  const [newShowInPrint, setNewShowInPrint] = useState(false);

  const fields = mod.fields.slice().sort((a, b) => a.position - b.position);

  const resetNewField = () => {
    setNewLabel('');
    setNewType('text');
    setNewRequired(false);
    setNewOptions('');
    setNewOptionsSource('');
    setNewReferenceModule('');
    setNewShowInTable(true);
    setNewShowInForm(true);
    setNewShowInPrint(false);
  };

  const addField = async (e) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setBusy(true);
    setError('');
    try {
      await moduleApi.addField(mod.key, {
        label: newLabel.trim(),
        type: newType,
        required: newRequired,
        options: newOptions
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
        optionsSource: newOptionsSource.trim(),
        referenceModule: newReferenceModule.trim(),
        showInTable: newShowInTable,
        showInForm: newShowInForm,
        showInPrint: newShowInPrint,
      });
      resetNewField();
      onChange();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add field');
    } finally {
      setBusy(false);
    }
  };

  const move = async (fieldId, direction) => {
    const idx = fields.findIndex((f) => f.id === fieldId);
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= fields.length) return;
    const reordered = fields.slice();
    const tmp = reordered[idx];
    reordered[idx] = reordered[swapWith];
    reordered[swapWith] = tmp;
    setBusy(true);
    try {
      await moduleApi.reorderFields(mod.key, reordered.map((f) => f.id));
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (f) => {
    setEditingId(f.id);
    setEditField({
      label: f.label,
      required: f.required,
      options: (f.options || []).join(', '),
      optionsSource: f.optionsSource || '',
      referenceModule: f.referenceModule || '',
      showInTable: f.showInTable,
      showInForm: f.showInForm,
      showInPrint: f.showInPrint,
    });
  };

  const saveEdit = async (f) => {
    setBusy(true);
    setError('');
    try {
      await moduleApi.updateField(mod.key, f.id, {
        label: editField.label,
        required: editField.required,
        options: editField.options
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
        optionsSource: editField.optionsSource,
        referenceModule: editField.referenceModule,
        showInTable: editField.showInTable,
        showInForm: editField.showInForm,
        showInPrint: editField.showInPrint,
      });
      setEditingId(null);
      onChange();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update field');
    } finally {
      setBusy(false);
    }
  };

  const toggleField = async (f) => {
    setBusy(true);
    try {
      if (f.isActive) {
        await moduleApi.deleteField(mod.key, f.id);
      } else {
        await moduleApi.restoreField(mod.key, f.id);
      }
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const typeLabel = (t) => FIELD_TYPE_OPTIONS.find((o) => o.value === t)?.label || t;

  return (
    <div style={{ marginTop: 16 }}>
      {error && <div className="alert alert-error">{error}</div>}
      <table className="data-table">
        <thead>
          <tr>
            <th>Label</th>
            <th>Type</th>
            <th>Required</th>
            <th>Table</th>
            <th>Form</th>
            <th>Print</th>
            <th style={{ width: 260 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.id} style={!f.isActive ? { opacity: 0.5 } : undefined}>
              {editingId === f.id ? (
                <>
                  <td>
                    <input value={editField.label} onChange={(e) => setEditField((v) => ({ ...v, label: e.target.value }))} />
                  </td>
                  <td>{typeLabel(f.type)}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={editField.required}
                      onChange={(e) => setEditField((v) => ({ ...v, required: e.target.checked }))}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={editField.showInTable}
                      onChange={(e) => setEditField((v) => ({ ...v, showInTable: e.target.checked }))}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={editField.showInForm}
                      onChange={(e) => setEditField((v) => ({ ...v, showInForm: e.target.checked }))}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={editField.showInPrint}
                      onChange={(e) => setEditField((v) => ({ ...v, showInPrint: e.target.checked }))}
                    />
                  </td>
                  <td className="row-actions">
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveEdit(f)}>
                      Save
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td>{f.label}</td>
                  <td>
                    {typeLabel(f.type)}
                    {f.type === 'select' && f.optionsSource ? ` (${f.optionsSource})` : ''}
                  </td>
                  <td>{f.required ? 'Yes' : '—'}</td>
                  <td>{f.showInTable ? '✓' : '—'}</td>
                  <td>{f.showInForm ? '✓' : '—'}</td>
                  <td>{f.showInPrint ? '✓' : '—'}</td>
                  <td className="row-actions">
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => move(f.id, 'up')} title="Move left">
                      ↑
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => move(f.id, 'down')} title="Move right">
                      ↓
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => startEdit(f)}>
                      Edit
                    </button>
                    <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => toggleField(f)}>
                      {f.isActive ? 'Remove' : 'Restore'}
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {fields.length === 0 && (
            <tr>
              <td colSpan={7} className="empty-row">
                No columns yet - add one below.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form className="form-grid" style={{ marginTop: 16 }} onSubmit={addField}>
        <div className="form-field">
          <label>Label</label>
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} required />
        </div>
        <div className="form-field">
          <label>Type</label>
          <select value={newType} onChange={(e) => setNewType(e.target.value)}>
            {FIELD_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {newType === 'select' && (
          <>
            <div className="form-field">
              <label>Options (comma-separated)</label>
              <input value={newOptions} onChange={(e) => setNewOptions(e.target.value)} placeholder="Small, Medium, Large" />
            </div>
            <div className="form-field">
              <label>Or Options Source</label>
              <input value={newOptionsSource} onChange={(e) => setNewOptionsSource(e.target.value)} placeholder="settings.sites" />
            </div>
          </>
        )}
        {newType === 'reference' && (
          <div className="form-field">
            <label>Reference Module Key</label>
            <input value={newReferenceModule} onChange={(e) => setNewReferenceModule(e.target.value)} placeholder="materials" />
          </div>
        )}
        <div className="form-field">
          <label>Required</label>
          <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} />
        </div>
        <div className="form-field">
          <label>Show in Table</label>
          <input type="checkbox" checked={newShowInTable} onChange={(e) => setNewShowInTable(e.target.checked)} />
        </div>
        <div className="form-field">
          <label>Show in Form</label>
          <input type="checkbox" checked={newShowInForm} onChange={(e) => setNewShowInForm(e.target.checked)} />
        </div>
        <div className="form-field">
          <label>Show in Print</label>
          <input type="checkbox" checked={newShowInPrint} onChange={(e) => setNewShowInPrint(e.target.checked)} />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            + Add Field
          </button>
        </div>
      </form>
    </div>
  );
}

function ParticularsManager({ particulars, sheetSizeOptions, onChange }) {
  const [newNo, setNewNo] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newLabelEn, setNewLabelEn] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editNo, setEditNo] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editLabelEn, setEditLabelEn] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [variantsTargetId, setVariantsTargetId] = useState(null);

  const startEdit = (p) => {
    setEditingId(p._id);
    setEditNo(p.no || '');
    setEditLabel(p.label);
    setEditLabelEn(p.labelEn || '');
  };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id) => {
    setBusy(true);
    setLocalError('');
    try {
      await settingsApi.updateParticular(id, { no: editNo, label: editLabel, labelEn: editLabelEn });
      setEditingId(null);
      onChange();
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Failed to update');
    } finally {
      setBusy(false);
    }
  };

  const move = async (id, direction) => {
    setBusy(true);
    try {
      await settingsApi.moveParticular(id, direction);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const addParticular = async (e) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setBusy(true);
    setLocalError('');
    try {
      await settingsApi.addParticular({ no: newNo.trim(), label: newLabel.trim(), labelEn: newLabelEn.trim() });
      setNewNo('');
      setNewLabel('');
      setNewLabelEn('');
      onChange();
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Failed to add');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await settingsApi.removeParticular(deleteTarget._id);
      setDeleteTarget(null);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>Delivery Note Particulars</h2>
      <p className="amount-display" style={{ marginTop: 0 }}>
        This is the pre-printed row list on the Delivery Note (No. / Particulars). Changes here appear
        immediately on the Create Delivery Note form and the printed note - no code deploy needed.
        Fill in both "Label (Tamil)" and "Label (English)" so the row's name switches correctly with
        the language toggle; if English is left blank, the Tamil text is shown for both languages.
      </p>
      {localError && <div className="alert alert-error">{localError}</div>}

      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 70 }}>No.</th>
            <th>Label (Tamil)</th>
            <th>Label (English)</th>
            <th style={{ width: 140 }}>Variants</th>
            <th style={{ width: 280 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {particulars.map((p) => (
            <React.Fragment key={p._id}>
              <tr>
                {editingId === p._id ? (
                  <>
                    <td>
                      <input value={editNo} onChange={(e) => setEditNo(e.target.value)} style={{ width: 60 }} />
                    </td>
                    <td>
                      <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} style={{ width: '100%' }} />
                    </td>
                    <td>
                      <input
                        value={editLabelEn}
                        onChange={(e) => setEditLabelEn(e.target.value)}
                        placeholder="(same as Tamil if left blank)"
                        style={{ width: '100%' }}
                      />
                    </td>
                    <td />
                    <td className="row-actions">
                      <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveEdit(p._id)}>
                        Save
                      </button>
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={cancelEdit}>
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{p.no}</td>
                    <td>{p.label}</td>
                    <td>{p.labelEn || <span className="stat-sub">(same as Tamil)</span>}</td>
                    <td>
                      {p.variants?.length ? `${p.variants.length} variant(s)` : <span className="stat-sub">none</span>}
                      {p.variantSizeSource && <div className="stat-sub">linked: Sheet Sizes</div>}
                    </td>
                    <td className="row-actions">
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => move(p._id, 'up')} title="Move up">
                        ↑
                      </button>
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => move(p._id, 'down')} title="Move down">
                        ↓
                      </button>
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => startEdit(p)}>
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => setVariantsTargetId(variantsTargetId === p._id ? null : p._id)}
                      >
                        {variantsTargetId === p._id ? 'Close Variants' : 'Manage Variants'}
                      </button>
                      <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => setDeleteTarget(p)}>
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
              {variantsTargetId === p._id && (
                <tr>
                  <td colSpan={5}>
                    <VariantsEditor
                      particular={p}
                      sheetSizeOptions={sheetSizeOptions}
                      onChange={onChange}
                      onClose={() => setVariantsTargetId(null)}
                    />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {particulars.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-row">
                No particulars yet - add the first row below.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form className="form-grid" style={{ marginTop: 16 }} onSubmit={addParticular}>
        <div className="form-field">
          <label>No. (e.g. 21, 15g)</label>
          <input value={newNo} onChange={(e) => setNewNo(e.target.value)} placeholder="21" />
        </div>
        <div className="form-field form-field-wide">
          <label>Label (Tamil)</label>
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="New particular name" required />
        </div>
        <div className="form-field form-field-wide">
          <label>Label (English)</label>
          <input
            value={newLabelEn}
            onChange={(e) => setNewLabelEn(e.target.value)}
            placeholder="(same as Tamil if left blank)"
          />
        </div>
        <div className="form-field">
          <label>&nbsp;</label>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            + Add Row
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete particular"
        message={deleteTarget ? `Delete "${deleteTarget.label}"? This cannot be undone.` : ''}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}

// Add/edit/remove size-and-rate variants (e.g. Column Box's 15a-15f, Welding
// Machine's amperage ratings) for one particular row. Saves the whole
// variants array in one PUT, matching how the backend accepts it.
const SHEET_SIZE_SOURCE = 'settings.sheetSizeOptions';

function VariantsEditor({ particular, sheetSizeOptions, onChange, onClose }) {
  const [variantSizeSource, setVariantSizeSource] = useState(particular.variantSizeSource || '');
  const [variants, setVariants] = useState((particular.variants || []).map((v) => ({ ...v })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const linked = variantSizeSource === SHEET_SIZE_SOURCE;

  const updateVariant = (idx, field, value) => {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)));
  };
  const addVariant = () => setVariants((prev) => [...prev, { label: '', rate: 0, perDayRate: 0 }]);
  const removeVariant = (idx) => setVariants((prev) => prev.filter((_, i) => i !== idx));

  // When linked, the row's labels always mirror the shared Sheet Sizes list
  // (Superadmin > Sheet Sizes) - editing/reordering/removing a label happens
  // there, not here. This screen only edits this particular's own rate per
  // label, looked up by label from whatever `variants` already has.
  const setLinked = (nextLinked) => {
    setVariantSizeSource(nextLinked ? SHEET_SIZE_SOURCE : '');
    if (nextLinked) {
      setVariants((prev) =>
        (sheetSizeOptions || []).map((label) => {
          const existing = prev.find((v) => v.label === label);
          return existing ? { ...existing } : { label, rate: 0, perDayRate: 0 };
        })
      );
    }
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await settingsApi.updateParticular(particular._id, { variants, variantSizeSource });
      onChange();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save variants');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel" style={{ margin: '8px 0' }}>
      <h3 style={{ marginTop: 0 }}>Variants for "{particular.labelEn || particular.label}"</h3>
      <p className="amount-display" style={{ marginTop: 0 }}>
        Add one row per size/rating (e.g. "15a", "250A", "10ft"). Selecting a variant on a Delivery Note
        auto-fills its Rate/Per-Day Rate the same way the row's own default does.
      </p>
      <div className="form-field" style={{ maxWidth: 420 }}>
        <label>Size labels come from</label>
        <select value={linked ? SHEET_SIZE_SOURCE : ''} onChange={(e) => setLinked(e.target.value === SHEET_SIZE_SOURCE)}>
          <option value="">This row's own list (edit labels below)</option>
          <option value={SHEET_SIZE_SOURCE}>Shared Sheet Sizes list (Superadmin &gt; Sheet Sizes)</option>
        </select>
        {linked && (
          <p className="stat-sub" style={{ marginTop: 4 }}>
            Labels are synced from the shared Sheet Sizes list and can't be edited here - add/rename/remove a
            size from the Sheet Sizes section instead. Only this row's own Rate/Per-Day Rate per size are set
            below.
          </p>
        )}
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <table className="data-table">
        <thead>
          <tr>
            <th>Label</th>
            <th style={{ width: 140 }}>Rate</th>
            <th style={{ width: 140 }}>Per-Day Rate</th>
            {!linked && <th style={{ width: 80 }}></th>}
          </tr>
        </thead>
        <tbody>
          {variants.map((v, idx) => (
            <tr key={idx}>
              <td>
                {linked ? (
                  v.label
                ) : (
                  <input value={v.label} onChange={(e) => updateVariant(idx, 'label', e.target.value)} placeholder="15a" />
                )}
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={v.rate}
                  onChange={(e) => updateVariant(idx, 'rate', Number(e.target.value))}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={v.perDayRate}
                  onChange={(e) => updateVariant(idx, 'perDayRate', Number(e.target.value))}
                />
              </td>
              {!linked && (
                <td>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removeVariant(idx)}>
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
          {variants.length === 0 && (
            <tr>
              <td colSpan={linked ? 3 : 4} className="empty-row">
                {linked ? 'The shared Sheet Sizes list is empty - add sizes from Superadmin > Sheet Sizes.' : 'No variants yet - add one below.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="row-actions" style={{ marginTop: 12 }}>
        {!linked && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={addVariant}>
            + Add Variant
          </button>
        )}
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>
          {busy ? 'Saving...' : 'Save Variants'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const COLUMN_TYPE_OPTIONS = [
  { value: 'number', label: 'Number (flat amount)' },
  { value: 'percent', label: 'Percent (%)' },
  { value: 'text', label: 'Text (no effect on Amount)' },
];
const COLUMN_EFFECT_OPTIONS = [
  { value: 'subtract', label: 'Subtract from Amount (e.g. Discount)' },
  { value: 'add', label: 'Add to Amount (e.g. Surcharge)' },
];

function ColumnsManager({ columns, onChange }) {
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('number');
  const [newEffect, setNewEffect] = useState('subtract');
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editType, setEditType] = useState('number');
  const [editEffect, setEditEffect] = useState('subtract');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  const startEdit = (c) => {
    setEditingId(c._id);
    setEditLabel(c.label);
    setEditType(c.type);
    setEditEffect(c.effect);
  };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id) => {
    setBusy(true);
    setLocalError('');
    try {
      await settingsApi.updateColumn(id, { label: editLabel, type: editType, effect: editEffect });
      setEditingId(null);
      onChange();
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Failed to update');
    } finally {
      setBusy(false);
    }
  };

  const move = async (id, direction) => {
    setBusy(true);
    try {
      await settingsApi.moveColumn(id, direction);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const addColumn = async (e) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setBusy(true);
    setLocalError('');
    try {
      await settingsApi.addColumn({ label: newLabel.trim(), type: newType, effect: newEffect });
      setNewLabel('');
      setNewType('number');
      setNewEffect('subtract');
      onChange();
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Failed to add');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await settingsApi.removeColumn(deleteTarget._id);
      setDeleteTarget(null);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const effectLabel = (col) => {
    if (col.type === 'text') return '—';
    return col.effect === 'add' ? 'Adds to Amount' : 'Subtracts from Amount';
  };

  return (
    <div className="panel">
      <h2>Item Columns</h2>
      <p className="amount-display" style={{ marginTop: 0 }}>
        Add extra columns to the Delivery Note items table - a Discount, a Discount %, a surcharge,
        or a plain text note per row. These appear on the Create Delivery Note form and the printed
        note automatically, right after Rate and before Amount. Number/Percent columns with an
        Add/Subtract effect change the calculated Amount live; Text columns are informational only.
      </p>
      {localError && <div className="alert alert-error">{localError}</div>}

      <table className="data-table">
        <thead>
          <tr>
            <th>Label</th>
            <th style={{ width: 170 }}>Type</th>
            <th style={{ width: 200 }}>Effect on Amount</th>
            <th style={{ width: 220 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((c) => (
            <tr key={c._id}>
              {editingId === c._id ? (
                <>
                  <td>
                    <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} style={{ width: '100%' }} />
                  </td>
                  <td>
                    <select
                      value={editType}
                      onChange={(e) => {
                        setEditType(e.target.value);
                        if (e.target.value === 'text') setEditEffect('none');
                        else if (editEffect === 'none') setEditEffect('subtract');
                      }}
                    >
                      {COLUMN_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {editType !== 'text' && (
                      <select value={editEffect} onChange={(e) => setEditEffect(e.target.value)}>
                        {COLUMN_EFFECT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {editType === 'text' && <span className="stat-sub">—</span>}
                  </td>
                  <td className="row-actions">
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveEdit(c._id)}>
                      Save
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={cancelEdit}>
                      Cancel
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td>{c.label}</td>
                  <td>{COLUMN_TYPE_OPTIONS.find((o) => o.value === c.type)?.label || c.type}</td>
                  <td>{effectLabel(c)}</td>
                  <td className="row-actions">
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => move(c._id, 'up')} title="Move up">
                      ↑
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => move(c._id, 'down')} title="Move down">
                      ↓
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => startEdit(c)}>
                      Edit
                    </button>
                    <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => setDeleteTarget(c)}>
                      Delete
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {columns.length === 0 && (
            <tr>
              <td colSpan={4} className="empty-row">
                No extra columns yet - add one below (e.g. "Discount").
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form className="form-grid" style={{ marginTop: 16 }} onSubmit={addColumn}>
        <div className="form-field">
          <label>Label</label>
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Discount" required />
        </div>
        <div className="form-field">
          <label>Type</label>
          <select
            value={newType}
            onChange={(e) => {
              setNewType(e.target.value);
              if (e.target.value === 'text') setNewEffect('none');
              else if (newEffect === 'none') setNewEffect('subtract');
            }}
          >
            {COLUMN_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {newType !== 'text' && (
          <div className="form-field">
            <label>Effect</label>
            <select value={newEffect} onChange={(e) => setNewEffect(e.target.value)}>
              {COLUMN_EFFECT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="form-field">
          <label>&nbsp;</label>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            + Add Column
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete column"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.label}"? Existing delivery notes keep their saved values, but this column will no longer show on new notes.`
            : ''
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </div>
  );
}

// Reusable manager for simple ordered value lists (Material Categories, Material
// Units, Labour Sites) - gives them the same add / edit-in-place / move up-down /
// delete functionality as the Particulars and Item Columns managers above.
// Rows are addressed by their array index, which doubles as their display order.
function OrderedListManager({ title, hint, values, onAdd, onUpdate, onMove, onRemove }) {
  const [newValue, setNewValue] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  const startEdit = (idx, v) => {
    setEditingIndex(idx);
    setEditValue(v);
  };
  const cancelEdit = () => setEditingIndex(null);

  const saveEdit = async (idx) => {
    if (!editValue.trim()) return;
    setBusy(true);
    setLocalError('');
    try {
      await onUpdate(idx, editValue.trim());
      setEditingIndex(null);
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Failed to update');
    } finally {
      setBusy(false);
    }
  };

  const move = async (idx, direction) => {
    setBusy(true);
    try {
      await onMove(idx, direction);
    } finally {
      setBusy(false);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    if (!newValue.trim()) return;
    setBusy(true);
    setLocalError('');
    try {
      await onAdd(newValue.trim());
      setNewValue('');
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Failed to add');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteIndex === null) return;
    setBusy(true);
    try {
      await onRemove(deleteIndex);
      setDeleteIndex(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>{title}</h2>
      <p className="amount-display" style={{ marginTop: 0 }}>
        {hint}
      </p>
      {localError && <div className="alert alert-error">{localError}</div>}

      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 50 }}>No.</th>
            <th>Value</th>
            <th style={{ width: 220 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {values.map((v, idx) => (
            <tr key={idx}>
              {editingIndex === idx ? (
                <>
                  <td>{idx + 1}</td>
                  <td>
                    <input value={editValue} onChange={(e) => setEditValue(e.target.value)} style={{ width: '100%' }} />
                  </td>
                  <td className="row-actions">
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveEdit(idx)}>
                      Save
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={cancelEdit}>
                      Cancel
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td>{idx + 1}</td>
                  <td>{v}</td>
                  <td className="row-actions">
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => move(idx, 'up')} title="Move up">
                      ↑
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => move(idx, 'down')}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => startEdit(idx, v)}>
                      Edit
                    </button>
                    <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => setDeleteIndex(idx)}>
                      Delete
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {values.length === 0 && (
            <tr>
              <td colSpan={3} className="empty-row">
                None yet - add the first one below.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form className="toolbar" style={{ marginTop: 16 }} onSubmit={add}>
        <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Add new value..." />
        <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
          + Add
        </button>
      </form>

      <ConfirmDialog
        open={deleteIndex !== null}
        title="Delete"
        message={deleteIndex !== null ? `Delete "${values[deleteIndex]}"? This cannot be undone.` : ''}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteIndex(null)}
        danger
      />
    </div>
  );
}
