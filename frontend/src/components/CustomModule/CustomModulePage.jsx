import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { moduleApi, recordApi, settingsApi } from '../../api';
import BackButton from '../common/BackButton.jsx';
import DateField from '../common/DateField.jsx';

/**
 * Renders any module created in the Superadmin Portal's Module Builder -
 * table + add/edit/delete - entirely from that module's field definitions.
 * No code change is needed for a new custom tab to work here; this page is
 * what "a tab created in Superadmin falls through to Admin" actually means
 * for a module that has no dedicated screen of its own.
 *
 * Built-in tabs (Billing, Materials, ...) never render through this page -
 * they keep their own dedicated screens, since their business logic (stock
 * deduction, note numbering, wage balances) lives in those controllers, not
 * in the generic CustomRecord store this page talks to.
 */

function emptyFormFromFields(fields) {
  const obj = {};
  fields.forEach((f) => {
    obj[f.key] = f.type === 'boolean' ? false : '';
  });
  return obj;
}

// Looks a source string like "settings.sites" up against the Settings
// document fetched once per page load - the only convention supported today.
function resolveOptionsSource(optionsSource, settings) {
  if (!optionsSource || !settings) return null;
  const [root, listName] = String(optionsSource).split('.');
  if (root !== 'settings' || !listName) return null;
  const list = settings[listName];
  return Array.isArray(list) ? list : null;
}

function isImageUrl(url) {
  return /\.(jpe?g|png|webp|heic|heif|gif)(\?|$)/i.test(String(url));
}

function formatCell(field, value) {
  if (value === null || value === undefined || value === '') return '-';
  if (field.type === 'date') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-IN');
  }
  if (field.type === 'number') return Number(value).toLocaleString('en-IN');
  if (field.type === 'percent') return `${value}%`;
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  if (field.type === 'file') {
    return isImageUrl(value) ? (
      <a href={value} target="_blank" rel="noopener noreferrer">
        <img src={value} alt={field.label} style={{ height: 40, borderRadius: 4 }} />
      </a>
    ) : (
      <a href={value} target="_blank" rel="noopener noreferrer">
        View
      </a>
    );
  }
  return String(value);
}

function FieldInput({ field, value, onChange, settings }) {
  if (field.type === 'boolean') {
    return (
      <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
    );
  }
  if (field.type === 'select') {
    const sourcedOptions = resolveOptionsSource(field.optionsSource, settings);
    const options = sourcedOptions || field.options || [];
    return (
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">--</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === 'date') {
    return <DateField value={value ? String(value).slice(0, 10) : ''} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.type === 'number' || field.type === 'percent') {
    return (
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    );
  }
  if (field.type === 'file') {
    return <FileFieldInput value={value} onChange={onChange} />;
  }
  // text, reference (kept as a plain text input for now - a real picker for
  // reference fields is a separate follow-up, not part of this fix)
  return <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
}

// Hidden file input + button, same trigger pattern as DeliveryNoteForm's
// vehicle-photo capture button - uploads immediately on selection via
// recordApi.uploadFile, then reports the resulting Cloudinary URL upward.
function FileFieldInput({ value, onChange }) {
  const inputRef = React.useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const res = await recordApi.uploadFile(file);
      onChange(res.data.url);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input type="file" accept="image/*,application/pdf" ref={inputRef} style={{ display: 'none' }} onChange={handleFileChange} />
      <button type="button" className="btn btn-ghost btn-sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? 'Uploading...' : value ? 'Replace file' : 'Upload file'}
      </button>
      {value && (
        <a href={value} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8 }}>
          View current
        </a>
      )}
      {error && <div className="alert alert-error">{error}</div>}
    </div>
  );
}

export default function CustomModulePage() {
  const { moduleKey } = useParams();

  const [mod, setMod] = useState(null);
  const [records, setRecords] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([moduleApi.get(moduleKey), recordApi.list(moduleKey), settingsApi.get().catch(() => null)])
      .then(([modRes, recRes, settingsRes]) => {
        setMod(modRes.data);
        setRecords(recRes.data.records || []);
        setSettings(settingsRes ? settingsRes.data : null);
      })
      .catch((err) => setError(err.response?.data?.message || 'Could not load this tab'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [moduleKey]);

  const fields = mod ? mod.fields.filter((f) => f.isActive) : [];
  const tableFields = fields.filter((f) => f.showInTable);
  const formFields = fields.filter((f) => f.showInForm);

  const openAddForm = () => {
    setEditingId(null);
    setFormValues(emptyFormFromFields(formFields));
    setShowForm(true);
  };

  const openEditForm = (record) => {
    setEditingId(record.id);
    setFormValues({ ...emptyFormFromFields(formFields), ...record.data });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const saveForm = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await recordApi.update(moduleKey, editingId, formValues);
      } else {
        await recordApi.create(moduleKey, formValues);
      }
      closeForm();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save this row');
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async (record) => {
    if (!window.confirm('Delete this row?')) return;
    try {
      await recordApi.remove(moduleKey, record.id);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete this row');
    }
  };

  if (loading) return <div className="page-loading">Loading...</div>;

  if (error && !mod) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">{moduleKey}</h1>
          <BackButton />
        </div>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{mod.label}</h1>
        <div className="row-actions">
          <button className="btn btn-primary" onClick={openAddForm}>
            + Add row
          </button>
          <BackButton />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {fields.length === 0 && (
        <div className="alert alert-error">
          This tab has no columns yet - add at least one in the Superadmin Portal's Field Manager first.
        </div>
      )}

      {showForm && (
        <div className="panel">
          <h2 className="ledger-title">{editingId ? 'Edit row' : 'Add row'}</h2>
          <form onSubmit={saveForm}>
            {formFields.map((f) => (
              <div key={f.key} style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  {f.label}
                  {f.required ? ' *' : ''}
                </label>
                <FieldInput
                  field={f}
                  value={formValues[f.key]}
                  onChange={(v) => setFormValues((prev) => ({ ...prev, [f.key]: v }))}
                  settings={settings}
                />
                {f.helpText && <div style={{ fontSize: '0.85em', opacity: 0.7 }}>{f.helpText}</div>}
              </div>
            ))}
            <div className="row-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={closeForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        {tableFields.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                {tableFields.map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  {tableFields.map((f) => (
                    <td key={f.key}>{formatCell(f, r.data[f.key])}</td>
                  ))}
                  <td className="row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEditForm(r)}>
                      Edit
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeRecord(r)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={tableFields.length + 1} className="empty-row">
                    No rows yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
