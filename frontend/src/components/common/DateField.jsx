import React, { useEffect, useRef, useState } from 'react';
import DatePicker, { formatDisplay } from './DatePicker.jsx';

/**
 * The single date input used everywhere in both portals.
 *
 * Item D: opens the shared RSA calendar instead of whatever the browser or
 * Android WebView would show, so every date field looks and behaves the same
 * on web, Android and iOS.
 *
 * Item E: this now always renders a real bordered box. On the billing item row
 * the date cell used to be bare grey "DD/MM/YYYY" text with no input box at
 * all, so it did not read as something you could click, unlike the Per-day
 * Rate / Monthly Rate fields beside it.
 *
 * The onChange contract is unchanged - callers still receive an event-shaped
 * object with `target.value` as 'YYYY-MM-DD', so no existing screen needed
 * rewriting when this stopped being a native <input type="date">.
 */
export default function DateField({
  value,
  onChange,
  className = '',
  disabled = false,
  readOnly = false,
  name,
  id,
  min,
  max,
  required,
  placeholder = 'DD/MM/YYYY',
  ...props
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const apply = (iso) => {
    setOpen(false);
    onChange?.({ target: { name, value: iso } });
  };

  return (
    <div className={`date-field ${open ? 'is-open' : ''}`} ref={wrapRef}>
      {/* Real form value, so existing form submits / validation keep working. */}
      <input type="hidden" name={name} value={value || ''} readOnly />
      <button
        type="button"
        id={id}
        className={`date-field-box ${className}`.trim()}
        disabled={disabled || readOnly}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-required={required || undefined}
        onClick={() => setOpen((o) => !o)}
        {...props}
      >
        <span className={value ? 'date-field-value' : 'date-field-overlay'}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <svg className="date-field-icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M3 10h18M8 3v4M16 3v4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
      {open && !disabled && !readOnly && (
        <div className="date-field-pop">
          <DatePicker value={value} min={min} max={max} onApply={apply} onCancel={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
