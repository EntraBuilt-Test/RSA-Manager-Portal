import React from 'react';

export default function StatCard({ label, value, sub, tone, icon }) {
  return (
    <div className={`stat-card${tone ? ` stat-${tone}` : ''}`}>
      {icon && <div className="stat-icon">{icon}</div>}
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}
