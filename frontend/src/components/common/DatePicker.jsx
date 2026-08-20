import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Item D: one calendar for the whole system.
 *
 * The portals were showing whatever native date picker the browser or Android
 * WebView happened to ship, which is why the same screen looked different on
 * every device and why the Manager portal never matched the Admin one. This is
 * a plain React calendar - Mon..Sun week, « ‹ Month YYYY › » navigation,
 * today outlined, the selected day filled, and an explicit Cancel / Apply
 * footer so a mis-tap never silently changes a billed date.
 *
 * Values are exchanged as 'YYYY-MM-DD' strings, exactly like the native
 * <input type="date"> it replaces, so no caller has to change how it stores
 * dates.
 */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function toISO(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${m}-${day}`;
}

/** 'YYYY-MM-DD' -> local Date, without the UTC shift `new Date(str)` causes. */
export function fromISO(s) {
  if (!s) return null;
  const [y, m, d] = String(s).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Display format used across the portals: 20-Aug-2026. */
export function formatDisplay(s) {
  const d = fromISO(s);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()].slice(0, 3)}-${d.getFullYear()}`;
}

// Monday-first grid, always 6 rows so the popover never changes height as the
// user pages through months (a jumping panel is what made the old picker feel
// unstable on phones).
function buildGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // JS: 0=Sun -> we want 0=Mon
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export default function DatePicker({ value, onApply, onCancel, min, max }) {
  const selected = fromISO(value);
  const today = new Date();
  const [draft, setDraft] = useState(selected);
  const [cursor, setCursor] = useState(() => selected || today);
  const rootRef = useRef(null);

  // Escape closes, and the first focusable control takes focus, so the whole
  // thing is usable from the keyboard on the web view.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', onKey);
    rootRef.current?.querySelector('button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const grid = useMemo(() => buildGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const minD = fromISO(min);
  const maxD = fromISO(max);

  const shift = (months, years = 0) =>
    setCursor((c) => new Date(c.getFullYear() + years, c.getMonth() + months, 1));

  const sameDay = (a, b) =>
    !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const disabled = (d) => (minD && d < minD) || (maxD && d > maxD);

  return (
    <div className="rsa-datepicker" ref={rootRef} role="dialog" aria-label="Choose a date">
      <div className="rsa-dp-head">
        <button type="button" className="rsa-dp-nav" aria-label="Previous year" onClick={() => shift(0, -1)}>
          «
        </button>
        <button type="button" className="rsa-dp-nav" aria-label="Previous month" onClick={() => shift(-1)}>
          ‹
        </button>
        <div className="rsa-dp-title" aria-live="polite">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </div>
        <button type="button" className="rsa-dp-nav" aria-label="Next month" onClick={() => shift(1)}>
          ›
        </button>
        <button type="button" className="rsa-dp-nav" aria-label="Next year" onClick={() => shift(0, 1)}>
          »
        </button>
      </div>

      <div className="rsa-dp-weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="rsa-dp-grid">
        {grid.map((d) => {
          const outside = d.getMonth() !== cursor.getMonth();
          const cls = [
            'rsa-dp-day',
            outside ? 'is-outside' : '',
            sameDay(d, today) ? 'is-today' : '',
            sameDay(d, draft) ? 'is-selected' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              type="button"
              key={d.toISOString()}
              className={cls}
              disabled={disabled(d)}
              aria-current={sameDay(d, today) ? 'date' : undefined}
              aria-pressed={sameDay(d, draft)}
              onClick={() => setDraft(d)}
              onDoubleClick={() => onApply?.(toISO(d))}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <div className="rsa-dp-actions">
        <button type="button" className="rsa-dp-btn rsa-dp-btn-ghost" onClick={() => onApply?.('')}>
          Clear
        </button>
        <button
          type="button"
          className="rsa-dp-btn rsa-dp-btn-ghost"
          onClick={() => {
            setDraft(today);
            setCursor(today);
          }}
        >
          Today
        </button>
        <span className="rsa-dp-spacer" />
        <button type="button" className="rsa-dp-btn rsa-dp-btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="rsa-dp-btn rsa-dp-btn-apply" onClick={() => onApply?.(toISO(draft))}>
          Apply
        </button>
      </div>
    </div>
  );
}
