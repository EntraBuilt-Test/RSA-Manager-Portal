import React, { useEffect, useState } from 'react';
import { reportApi } from '../../api';
import StatCard from '../common/StatCard.jsx';
import StatusBadge from '../common/StatusBadge.jsx';
import RevenueBarChart from '../common/RevenueBarChart.jsx';
import DonutChart from '../common/DonutChart.jsx';
import { IconCalendar, IconClock, IconRupee, IconWallet, IconStack, IconAlertTriangle } from '../common/icons.jsx';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useViewport } from '../../context/ViewportContext.jsx';

const MONTH_LABELS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Dashboard() {
  const { t } = useLanguage();
  const { isMobile } = useViewport();
  const [data, setData] = useState(null);
  const [yearly, setYearly] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    reportApi
      .dashboard()
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard'));
    reportApi
      .yearlySummary(new Date().getFullYear())
      .then((res) => setYearly(res.data))
      .catch(() => {
        /* charts are a nice-to-have - the rest of the dashboard still works without this */
      });
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <div className="page-loading">{t('dashboard.loading')}</div>;

  return (
    <div className="dashboard">
      {/* On mobile the page title already lives in the sticky app header
          (MobileShell in Layout.jsx), so repeating it here would just be a
          second "Dashboard" heading stacked on top of the first. */}
      {!isMobile && (
        <div className="page-header">
          <h1 className="page-title">{t('dashboard.title')}</h1>
        </div>
      )}

      <div className="stat-grid">
        <StatCard
          icon={<IconClock />}
          label={t('dashboard.todaysBilling')}
          value={formatCurrency(data.todaysBilling)}
          sub={`${data.todaysBillingCount} ${t('dashboard.notesSuffix')}`}
        />
        <StatCard
          icon={<IconCalendar />}
          label={t('dashboard.monthlyBilling')}
          value={formatCurrency(data.monthlyBilling)}
          sub={`${data.monthlyBillingCount} ${t('dashboard.notesSuffix')}`}
        />
        <StatCard
          icon={<IconCalendar />}
          label={t('dashboard.yearlyBilling')}
          value={formatCurrency(data.yearlyBilling)}
          sub={`${data.yearlyBillingCount} ${t('dashboard.notesSuffix')}`}
        />
        <StatCard
          icon={<IconRupee />}
          label={t('dashboard.totalRevenue')}
          value={formatCurrency(data.totalRevenue)}
          tone="brand"
        />
        <StatCard
          icon={<IconWallet />}
          label={t('dashboard.pendingPayments')}
          value={formatCurrency(data.pendingPayments)}
          sub={`${data.pendingPaymentsCount} ${t('dashboard.notesSuffix')}`}
          tone="warn"
        />
        <StatCard icon={<IconStack />} label={t('dashboard.totalMaterials')} value={data.totalMaterials} />
        <StatCard
          icon={<IconAlertTriangle />}
          label={t('dashboard.lowStockAlert')}
          value={data.lowStockCount}
          sub={data.lowStockCount ? t('dashboard.needsAttention') : t('dashboard.allStocked')}
          tone={data.lowStockCount ? 'danger' : 'ok'}
        />
      </div>

      {yearly && (
        <div className="chart-grid">
          <div className="panel chart-panel-wide">
            <h2>
              {t('dashboard.monthlyBilling')} ({yearly.year})
            </h2>
            <RevenueBarChart byMonth={yearly.byMonth} monthLabels={MONTH_LABELS_EN} />
          </div>
          <div className="panel chart-panel-narrow">
            <h2>{t('reports.totalRevenue')}</h2>
            <DonutChart
              centerValue={formatCurrency(yearly.totalRevenue).replace(/\.00$/, '')}
              centerLabel={yearly.year}
              segments={[
                { label: t('reports.paid'), value: yearly.paidRevenue, colorVar: '--green' },
                { label: t('reports.pendingAmt'), value: yearly.pendingRevenue, colorVar: '--amber' },
              ]}
            />
          </div>
        </div>
      )}

      {data.lowStockAlerts.length > 0 && (
        <div className="panel">
          <h2>{t('dashboard.lowStockAlertsTitle')}</h2>
          {isMobile ? (
            <div className="m-card-list">
              {data.lowStockAlerts.map((m) => (
                <div className="m-card" key={m.id}>
                  <div className="m-card-row">
                    <span className="m-card-title">{m.materialName}</span>
                    <span className="danger-text">
                      {m.remainingStock} {m.unit}
                    </span>
                  </div>
                  <div className="m-card-row m-card-row-sub">
                    <span>{t('dashboard.reorderLevel')}</span>
                    <span>{m.reorderLevel}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('dashboard.material')}</th>
                  <th>{t('dashboard.remaining')}</th>
                  <th>{t('dashboard.reorderLevel')}</th>
                </tr>
              </thead>
              <tbody>
                {data.lowStockAlerts.map((m) => (
                  <tr key={m.id}>
                    <td>{m.materialName}</td>
                    <td className="danger-text">
                      {m.remainingStock} {m.unit}
                    </td>
                    <td>{m.reorderLevel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>{t('dashboard.recentTransactions')}</h2>
        </div>
        {isMobile ? (
          <div className="m-card-list">
            {data.recentTransactions.map((n) => (
              <div className="m-card" key={n._id}>
                <div className="m-card-row">
                  <span className="m-card-title">{n.noteNumber}</span>
                  <StatusBadge status={n.paymentStatus} />
                </div>
                <div className="m-card-row m-card-row-sub">
                  <span>{n.customerNameSnapshot}</span>
                  <span>{formatDate(n.date)}</span>
                </div>
                <div className="m-card-row m-card-amount">{formatCurrency(n.totalAmount)}</div>
              </div>
            ))}
            {data.recentTransactions.length === 0 && <div className="empty-row">{t('billing.noNotes')}</div>}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('dashboard.noteNo')}</th>
                <th>{t('dashboard.date')}</th>
                <th>{t('dashboard.customer')}</th>
                <th>{t('dashboard.amount')}</th>
                <th>{t('dashboard.status')}</th>
              </tr>
            </thead>
            <tbody>
              {data.recentTransactions.map((n) => (
                <tr key={n._id}>
                  <td>{n.noteNumber}</td>
                  <td>{formatDate(n.date)}</td>
                  <td>{n.customerNameSnapshot}</td>
                  <td>{formatCurrency(n.totalAmount)}</td>
                  <td>
                    <StatusBadge status={n.paymentStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
