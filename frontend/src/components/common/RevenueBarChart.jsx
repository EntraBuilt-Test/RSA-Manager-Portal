import React from 'react';
import { formatCurrency } from '../../utils/format.js';

/**
 * Lightweight, dependency-free SVG bar chart (no Chart.js/D3) - keeps the
 * production bundle small and avoids adding a new build dependency that
 * can't be verified in every environment. Renders monthly revenue totals
 * for the given year, tallest bar first for scale reference.
 */
export default function RevenueBarChart({ byMonth = [], monthLabels }) {
  const width = 640;
  const height = 220;
  const padding = { top: 16, right: 12, bottom: 28, left: 12 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const max = Math.max(1, ...byMonth);
  const barGap = 8;
  const barWidth = byMonth.length ? chartW / byMonth.length - barGap : 0;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Monthly revenue chart">
      {byMonth.map((value, i) => {
        const barH = max > 0 ? (value / max) * chartH : 0;
        const x = padding.left + i * (barWidth + barGap);
        const y = padding.top + (chartH - barH);
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={Math.max(barWidth, 1)}
              height={Math.max(barH, 1)}
              rx="3"
              className="chart-bar"
            >
              <title>{`${monthLabels[i]}: ${formatCurrency(value)}`}</title>
            </rect>
            <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" className="chart-axis-label">
              {monthLabels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
