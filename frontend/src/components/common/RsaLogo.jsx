import React from 'react';

export default function RsaLogo({ className, style, width = '150px' }) {
  return (
    <svg
      className={className}
      style={{ width, height: 'auto', ...style }}
      viewBox="0 0 500 250"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Sky blue to royal blue gradient matching the logo */}
        <linearGradient id="rsa-diagonal-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00bfff" />
          <stop offset="100%" stopColor="#0077ff" />
        </linearGradient>
        <linearGradient id="rsa-building-grad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#00bfff" />
          <stop offset="100%" stopColor="#0033cc" />
        </linearGradient>
      </defs>

      {/* 1. Left diagonal accent line (Cyan to blue gradient) */}
      <path
        d="M 75 190 L 155 132"
        stroke="url(#rsa-diagonal-grad)"
        strokeWidth="8.5"
        strokeLinecap="round"
      />

      {/* 2. Bottom horizontal baseline */}
      <path
        d="M 75 190 L 420 190"
        stroke="url(#rsa-diagonal-grad)"
        strokeWidth="8.5"
        strokeLinecap="round"
      />

      {/* 3. Stair-step building outline (continuous path to match original perfectly) */}
      <path
        d="M 315 190 L 315 110 L 350 110 L 350 135 L 370 135 L 370 40 L 420 40 L 420 190"
        stroke="url(#rsa-building-grad)"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 4. "R" Stroke Lettering */}
      <path
        d="M 175 95 L 175 160 M 175 95 C 205 95 210 125 175 125 M 190 125 C 200 135 205 150 210 160"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 5. "S" Stroke Lettering */}
      <path
        d="M 248 102 C 228 98 218 115 238 127 C 258 137 248 160 228 158"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 6. "A" Stroke Lettering */}
      <path
        d="M 268 160 L 291 95 L 314 160 M 276 138 L 306 138"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Subtext - capitalized construction text matching layout */}
      <text
        x="248"
        y="215"
        fontFamily="'Montserrat', 'Inter', -apple-system, sans-serif"
        fontWeight="600"
        fontSize="16.5"
        fill="currentColor"
        textAnchor="middle"
        letterSpacing="4"
        opacity="0.95"
      >
        CONSTRUCTION &
      </text>
      <text
        x="248"
        y="238"
        fontFamily="'Montserrat', 'Inter', -apple-system, sans-serif"
        fontWeight="600"
        fontSize="16.5"
        fill="currentColor"
        textAnchor="middle"
        letterSpacing="4"
        opacity="0.95"
      >
        BUILDING MATERIALS
      </text>
    </svg>
  );
}
