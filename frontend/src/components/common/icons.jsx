import React from 'react';

/**
 * Small inline SVG icon set for the "premium, no-photos" visual pass -
 * construction-themed but abstract/geometric rather than literal stock
 * photography, so it stays lightweight and license-free. Each icon inherits
 * currentColor so it can be recolored per stat card via CSS.
 */
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' };

export function IconRupee(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 4h12M6 9h12M6 4c4 0 7 1.5 7 4.5S10 13 6 13h9l-9 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClock(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCalendar(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconStack(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M3 12l9 5 9-5M3 16l9 5 9-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function IconAlertTriangle(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4 2 20h20L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 10.5v4M12 17.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconWallet(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="6.5" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10.5h18" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="14" r="1.2" fill="currentColor" />
      <path d="M6 6.5 15 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ---- Mobile shell icons (bottom nav / header) ---- */
export function IconHome(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 11.5 12 4l8 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9h12v-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 19v-5h4v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconReceipt(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3h12v18l-2.5-1.6L13 21l-1-1.6L11 21l-2.5-1.6L6 21V3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6M9 16h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconVoucher(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 10v4M21 10v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconTeam(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15.5 19c0-2.3 1.6-4.2 3.8-4.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconGrid(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function IconChevronLeft(props) {
  return (
    <svg {...base} {...props}>
      <path d="M15 4.5 7.5 12l7.5 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconUserCircle(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 18.5c1.3-2.4 3.7-3.8 6.5-3.8s5.2 1.4 6.5 3.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconBox(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 8 12 3.5 20.5 8 12 12.5 3.5 8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M3.5 8v8L12 20.5 20.5 16V8" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 12.5V20.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function IconChart(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20V10M11 20V4M18 20v-7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 20.5h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconClose(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function IconBrandMark(props) {
  // Abstract construction mark for the login screen - stacked beams/roof
  // silhouette, purely geometric (no photography, no stock imagery).
  return (
    <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" {...props}>
      <polygon points="60,14 108,52 92,52 92,100 28,100 28,52 12,52" fill="currentColor" opacity="0.12" />
      <path d="M60 14 108 52H92v48H28V52H12L60 14Z" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" fill="none" />
      <path d="M44 100V72h32v28" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
