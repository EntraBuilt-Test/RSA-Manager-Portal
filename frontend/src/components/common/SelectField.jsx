import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Items F and R: the designed dropdown that replaces every native <select>.
 *
 * The native control was showing the browser's blue highlight on the web view
 * and a black tooltip-style popup inside the Android WebView (the Site field),
 * so the same screen looked different on every device and neither version
 * matched the rest of the UI. This renders the menu itself: rounded panel,
 * soft shadow, a status dot per option, hover-tinted rows, and a divider with
 * a "Clear Filter" action at the bottom for filter dropdowns.
 *
 * onChange keeps the native contract - callers receive `{ target: { name,
 * value } }` - so a native <select> can be swapped for this without touching
 * the surrounding form logic.
 *
 * options: [{ value, label, tone? }]  tone: 'positive' | 'negative' | 'warning'
 */
export default function SelectField({
  value,
  onChange,
  options = [],
  placeholder = '--',
  name,
  id,
  disabled = false,
  searchable = false,
  allowClear = false,
  // Item O: material name / category / brand must be dropdowns so the same
  // material is not typed three different ways - but staff still need to be
  // able to enter a genuinely new one without waiting for an admin. With
  // allowCustom the search box doubles as "add new".
  allowCustom = false,
  clearLabel = 'Clear Filter',
  className = '',
  'aria-label': ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  const list = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => String(o.label).toLowerCase().includes(q));
  }, [options, query, searchable]);

  const selected = options.find((o) => String(o.value) === String(value));

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    if (searchable) searchRef.current?.focus();
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, searchable]);

  const commit = (v) => {
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
    onChange?.({ target: { name, value: v } });
  };

  // Full keyboard support - this is also part of the accessibility pass, and
  // it is what stops the field "getting stuck" when someone tabs through a
  // form and expects arrow keys / Enter to work like a native select.
  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(list.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && list[activeIndex]) commit(list[activeIndex].value);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className={`rsa-select ${className}`.trim()} ref={wrapRef}>
      <input type="hidden" name={name} value={value ?? ''} readOnly />
      <button
        type="button"
        id={id}
        className="rsa-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? '' : 'rsa-select-placeholder'}>{selected ? selected.label : placeholder}</span>
        <svg className="rsa-select-caret" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && !disabled && (
        <div className="rsa-select-menu" role="listbox" onKeyDown={onKeyDown}>
          {searchable && (
            <input
              ref={searchRef}
              className="rsa-select-search"
              placeholder="Search..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(-1);
              }}
              onKeyDown={onKeyDown}
            />
          )}

          {allowCustom && query.trim() && !options.some((o) => String(o.label).toLowerCase() === query.trim().toLowerCase()) && (
            <button type="button" className="rsa-select-option" onClick={() => commit(query.trim())}>
              <span className="rsa-select-dot" aria-hidden="true" />
              <span>Add &quot;{query.trim()}&quot;</span>
            </button>
          )}

          {list.length === 0 && !allowCustom && <div className="rsa-select-empty">No matches</div>}

          {list.map((o, i) => {
            const isSelected = String(o.value) === String(value);
            return (
              <button
                type="button"
                key={`${o.value}-${i}`}
                role="option"
                aria-selected={isSelected}
                data-tone={o.tone || undefined}
                className={[
                  'rsa-select-option',
                  isSelected ? 'is-selected' : '',
                  i === activeIndex ? 'is-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => commit(o.value)}
              >
                <span className="rsa-select-dot" aria-hidden="true" />
                <span>{o.label}</span>
              </button>
            );
          })}

          {allowClear && (
            <>
              <div className="rsa-select-divider" />
              <button type="button" className="rsa-select-clear" onClick={() => commit('')}>
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 5h18M6 10h12M10 15h4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                {clearLabel}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
