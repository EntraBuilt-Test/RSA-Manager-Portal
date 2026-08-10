import React, { useRef } from 'react';

// Wraps a native <input type="date"> so the calendar picker and all
// value/onChange behavior stay 100% native, but the empty-state text reads
// "DD/MM/YYYY" instead of the browser's own lowercase locale text. Done with
// a real span that's removed outright the moment a value exists (rather than
// a CSS ::before trick, which has no reliable way to know whether the native
// input currently has a value and ends up rendering the placeholder on top
// of real typed text).
//
// Clicking anywhere in the box opens the calendar - browsers only pop the
// native date picker when the tiny calendar glyph itself is clicked, which
// made this field feel unresponsive/hard to hit. showPicker() (supported in
// all current evergreen browsers) is called on click of the wrapper too, so
// the whole box behaves like one big clickable field; falls back to a plain
// focus() on older browsers that don't have showPicker() at all.
export default function DateField({ value, onChange, className = '', ...props }) {
  const inputRef = useRef(null);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el || el.disabled || el.readOnly) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        /* showPicker can throw if not called from a direct user gesture in
           some browsers - fall through to focus() below */
      }
    }
    el.focus();
  };

  return (
    <div className="date-field" onClick={openPicker}>
      <input
        ref={inputRef}
        type="date"
        value={value || ''}
        onChange={onChange}
        className={`date-field-input ${className}`.trim()}
        {...props}
      />
      {!value && <span className="date-field-overlay">DD/MM/YYYY</span>}
    </div>
  );
}
