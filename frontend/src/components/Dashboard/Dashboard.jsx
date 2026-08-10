import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { workerApi, labourApi } from '../../api';
import StatCard from '../common/StatCard.jsx';
import LoadingState from '../common/LoadingState.jsx';
import { IconTeam, IconCalendar, IconRupee, IconWallet, IconAlertTriangle } from '../common/icons.jsx';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useViewport } from '../../context/ViewportContext.jsx';

/**
 * Manager Portal dashboard.
 *
 * This portal only manages Labour (Billing, Materials, Voucher, Stock and
 * Reports were removed - see App.jsx/Layout.jsx), so the dashboard summarizes
 * Labour instead of billing/stock stats. Every number here is computed
 * client-side from the SAME api/index.js functions LabourPage's own tabs
 * already call (workerApi.list, labourApi.listEntries) - no new backend
 * endpoints, and LabourPage itself is untouched.
 */
const RECENT_ENTRIES_LIMIT = 8;

function isSameDay(dateA, dateB) {
  return new Date(dateA).toDateString() === new Date(dateB).toDateString();
}

// Every Labour tab lives inside LabourPage's own internal tab state, not the
// URL, so a link from here can only open Labour at its default tab - not
// deep-link into a specific one - without changing LabourPage.jsx, which is
// out of scope for this portal. Still a useful one-tap way in from here.
const LABOUR_QUICK_LINKS = ['tabWorkers', 'tabEntry', 'tabSiteSheet', 'tabConsolidated', 'tabMonthlySalary'];

export default function Dashboard() {
  const { t } = useLanguage();
  const { isMobile } = useViewport();

  const [workers, setWorkers] = useState(null);
  const [workersError, setWorkersError] = useState('');
  const [loadingWorkers, setLoadingWorkers] = useState(true);

  const [entries, setEntries] = useState(null);
  const [entriesError, setEntriesError] = useState('');
  const [loadingEntries, setLoadingEntries] = useState(true);

  const loadWorkers = () => {
    setLoadingWorkers(true);
    setWorkersError('');
    workerApi
      .list()
      .then((res) => setWorkers(res.data))
      .catch((err) => setWorkersError(err.response?.data?.message || 'Failed to load workers - the server may be slow to respond.'))
      .finally(() => setLoadingWorkers(false));
  };

  const loadEntries = () => {
    setLoadingEntries(true);
    setEntriesError('');
    labourApi
      .listEntries()
      .then((res) => setEntries(res.data))
      .catch((err) => setEntriesError(err.response?.data?.message || 'Failed to load labour entries - the server may be slow to respond.'))
      .finally(() => setLoadingEntries(false));
  };

  useEffect(() => {
    loadWorkers();
    loadEntries();
  }, []);

  if (loadingWorkers || loadingEntries) {
    return <div className="page-loading">{t('dashboard.loading')}</div>;
  }

  const workerList = workers || [];
  const entryList = entries || [];

  const activeWorkers = workerList.filter((w) => w.active);
  const outstandingBalance = activeWorkers.reduce((sum, w) => sum + (w.currentBalance || 0), 0);

  const today = new Date();
  const todaysEntries = entryList.filter((e) => isSameDay(e.date, today));
  const todaysAttendance = new Set(todaysEntries.map((e) => e.workerId)).size;
  const todaysWages = todaysEntries.reduce((sum, e) => sum + (e.wageEarned || 0), 0);
  const todaysAdvances = todaysEntries.reduce((sum, e) => sum + (e.advance || 0), 0);

  // entries already arrive sorted newest-first (see backend getEntries).
  const recentEntries = entryList.slice(0, RECENT_ENTRIES_LIMIT);

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

      <LoadingState loading={false} error={workersError} onRetry={loadWorkers} />
      <LoadingState loading={false} error={entriesError} onRetry={loadEntries} />

      <div className="stat-grid">
        <StatCard
          icon={<IconTeam />}
          label={t('dashboard.activeWorkers')}
          value={activeWorkers.length}
          sub={`${workerList.length} ${t('dashboard.totalWorkersSuffix')}`}
        />
        <StatCard
          icon={<IconCalendar />}
          label={t('dashboard.todaysAttendance')}
          value={todaysAttendance}
          sub={t('dashboard.attendanceSuffix')}
        />
        <StatCard icon={<IconRupee />} label={t('dashboard.todaysWages')} value={formatCurrency(todaysWages)} tone="brand" />
        <StatCard icon={<IconWallet />} label={t('dashboard.todaysAdvances')} value={formatCurrency(todaysAdvances)} tone="warn" />
        <StatCard
          icon={<IconAlertTriangle />}
          label={t('dashboard.outstandingBalance')}
          value={formatCurrency(outstandingBalance)}
          sub={outstandingBalance > 0 ? t('dashboard.hasDueBalance') : t('dashboard.allSettled')}
          tone={outstandingBalance > 0 ? 'warn' : 'ok'}
        />
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>{t('dashboard.labourTabsTitle')}</h2>
        </div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          {LABOUR_QUICK_LINKS.map((tabKey) => (
            <Link key={tabKey} to="/labour" className="btn btn-ghost btn-sm">
              {t('dashboard.openTab')} {t(`labour.${tabKey}`)}
            </Link>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>{t('labour.recentEntries')}</h2>
          <Link to="/labour" className="btn btn-ghost btn-sm">
            {t('dashboard.viewAll')}
          </Link>
        </div>
        {isMobile ? (
          <div className="m-card-list">
            {recentEntries.map((e) => (
              <div className="m-card" key={e._id}>
                <div className="m-card-row">
                  <span className="m-card-title">{e.workerName}</span>
                  <span>{formatDate(e.date)}</span>
                </div>
                <div className="m-card-row m-card-row-sub">
                  <span>{e.site}</span>
                  <span>
                    {t('labour.daysWorked')}: {e.daysWorked}
                  </span>
                </div>
                <div className="m-card-row m-card-amount">{formatCurrency(e.wageEarned)}</div>
              </div>
            ))}
            {recentEntries.length === 0 && <div className="empty-row">{t('labour.noEntries')}</div>}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('labour.date')}</th>
                <th>{t('labour.workerName')}</th>
                <th>{t('labour.site')}</th>
                <th>{t('labour.daysWorked')}</th>
                <th>{t('labour.wageEarned')}</th>
                <th>{t('labour.advance')}</th>
                <th>{t('labour.paid')}</th>
                <th>{t('labour.currentBalance')}</th>
              </tr>
            </thead>
            <tbody>
              {recentEntries.map((e) => (
                <tr key={e._id}>
                  <td>{formatDate(e.date)}</td>
                  <td>{e.workerName}</td>
                  <td>{e.site}</td>
                  <td>{e.daysWorked}</td>
                  <td>{formatCurrency(e.wageEarned)}</td>
                  <td>{formatCurrency(e.advance)}</td>
                  <td>{formatCurrency(e.paid)}</td>
                  <td>{formatCurrency(e.balanceAfter)}</td>
                </tr>
              ))}
              {recentEntries.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-row">
                    {t('labour.noEntries')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
