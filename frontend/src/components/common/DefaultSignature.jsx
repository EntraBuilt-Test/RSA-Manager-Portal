import React from 'react';

/**
 * Placeholder signature mark rendered on a Voucher print when no specific
 * signature has been captured for it. This is deliberately an abstract
 * flourish, not a forged rendering of anyone's real signature - the founder
 * should replace this with a scanned image of the actual authorized
 * signature (see the final report's confirm-list).
 */
export default function DefaultSignature({ className, style, width = '120px' }) {
  return (
    <svg
      className={className}
      style={{ width, height: 'auto', ...style }}
      viewBox="0 0 200 60"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 40 C 25 10, 40 10, 50 30 C 58 45, 65 20, 75 25 C 85 30, 90 45, 100 30 C 110 15, 120 40, 135 30 C 150 20, 160 35, 190 20"
        fill="none"
        stroke="#333"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
