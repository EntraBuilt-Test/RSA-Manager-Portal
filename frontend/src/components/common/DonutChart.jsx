import React from 'react';

/**
 * Lightweight, dependency-free SVG donut chart. segments: [{ label, value, colorVar }]
 * where colorVar is a CSS custom property name (e.g. '--green') so it stays
 * theme-aware without any JS color logic.
 */
export default function DonutChart({ segments = [], centerLabel, centerValue }) {
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0);
  const size = 160;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offsetSoFar = 0;

  return (
    <div className="donut-chart-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Payment status breakdown">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        {total > 0 &&
          segments.map((seg, i) => {
            const fraction = (seg.value || 0) / total;
            const dash = fraction * circumference;
            const dashArray = `${dash} ${circumference - dash}`;
            const dashOffset = -offsetSoFar;
            offsetSoFar += dash;
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={`var(${seg.colorVar})`}
                strokeWidth={stroke}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              >
                <title>{`${seg.label}: ${seg.value}`}</title>
              </circle>
            );
          })}
        <text x="50%" y="46%" textAnchor="middle" className="donut-center-value">
          {centerValue}
        </text>
        <text x="50%" y="60%" textAnchor="middle" className="donut-center-label">
          {centerLabel}
        </text>
      </svg>
      <div className="donut-legend">
        {segments.map((seg, i) => (
          <div className="donut-legend-row" key={i}>
            <span className="donut-legend-swatch" style={{ background: `var(${seg.colorVar})` }} />
            <span>{seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
