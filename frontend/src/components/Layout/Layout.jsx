import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useViewport } from '../../context/ViewportContext.jsx';
import logoImg from '../../logo/logoo2.png';
import { moduleApi } from '../../api';
import ChatWidget from '../common/ChatWidget.jsx';
import {
  IconHome,
  IconTeam,
  IconGrid,
  IconChevronLeft,
  IconUserCircle,
  IconClose,
} from '../common/icons.jsx';

// Main navigation. The SAME list of routes drives both the desktop sidebar
// and the mobile bottom nav / "More" sheet below - a tab is added here once
// and both layouts pick it up, so there is never a case where a route exists
// on desktop but is unreachable on a phone (or vice versa). Additional
// modules can be added later by adding one more entry here plus a route in
// App.jsx - nothing else about either layout needs to change.
//
// Manager Portal: intentionally limited to Dashboard + Labour only - Billing,
// Material Stock/Purchase Ledger, Voucher, Stock View and Reports have been
// removed from this portal's navigation and routes (see App.jsx).
function useTabs(t) {
  return [
    { to: '/dashboard', label: t('nav.dashboard'), short: 'DB' },
    { to: '/labour', label: t('nav.labour'), short: 'LB' },
  ];
}

const HIDDEN_FROM_SIDEBAR = ['Outsourcing Material', 'Client Material'];
const COLLAPSE_STORAGE_KEY = 'rsa-sidebar-collapsed';
const LOGO_CLICKS_TO_UNLOCK = 5;
const LOGO_CLICK_WINDOW_MS = 1500;

// Every built-in tab gets its own bottom-nav icon on a phone; the bar itself
// scrolls horizontally so all of them (plus any Superadmin-created tab) fit
// without being squeezed - see .m-bottom-nav in app.css. Tabs without an
// explicit icon here (e.g. a custom module) fall back to IconGrid.
const MOBILE_ICONS = {
  '/dashboard': IconHome,
  '/labour': IconTeam,
};

/**
 * Root chrome for every authenticated route. This component itself never
 * changes what route is loaded - it only chooses HOW to present whichever
 * route React Router has already matched (the <Outlet/> at the bottom of
 * each branch below), based on the current viewport. Same URL, same data,
 * same <Outlet/> content; only the surrounding navigation shell differs:
 *   - phone-width viewport  -> MobileShell (header + bottom nav + sheet)
 *   - tablet/desktop widths -> DesktopShell (sidebar, unchanged from before)
 */
export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { isMobile } = useViewport();
  const navigate = useNavigate();
  const location = useLocation();
  const tabs = useTabs(t);

  // Tabs created later in the Superadmin Portal. Fetched separately from -
  // and appended after - the seven built-in tabs above, so a failed fetch
  // here never breaks the tabs that already worked before this existed.
  const [customTabs, setCustomTabs] = useState([]);
  useEffect(() => {
    moduleApi
      .list()
      .then((res) => {
        const custom = (res.data || [])
          .filter((m) => !m.isSystem && m.isActive && !HIDDEN_FROM_SIDEBAR.includes(m.label))
          .sort((a, b) => a.order - b.order)
          .map((m) => ({
            to: m.path,
            label: m.label,
            short: m.short || m.icon || m.label.slice(0, 2).toUpperCase(),
          }));
        setCustomTabs(custom);
      })
      .catch(() => {
        /* Superadmin-created tabs are additive - if this fails, the built-in
           tabs above are unaffected. */
      });
  }, []);
  const allTabs = [...tabs, ...customTabs];

  // Hidden Superadmin entrance: 5 clicks on the brand/logo within 1.5s opens
  // /superadmin. Only wired up at all for isSuperAdmin users - for everyone
  // else the clicks are silently ignored, so the feature isn't discoverable.
  const logoClickCount = useRef(0);
  const logoClickTimer = useRef(null);
  const handleLogoClick = () => {
    if (!user?.isSuperAdmin) return;
    logoClickCount.current += 1;
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current);
    if (logoClickCount.current >= LOGO_CLICKS_TO_UNLOCK) {
      logoClickCount.current = 0;
      navigate('/superadmin');
      return;
    }
    logoClickTimer.current = setTimeout(() => {
      logoClickCount.current = 0;
    }, LOGO_CLICK_WINDOW_MS);
  };
  useEffect(() => {
    return () => {
      if (logoClickTimer.current) clearTimeout(logoClickTimer.current);
    };
  }, []);

  if (isMobile) {
    return (
      <MobileShell
        user={user}
        logout={logout}
        theme={theme}
        toggleTheme={toggleTheme}
        language={language}
        setLanguage={setLanguage}
        t={t}
        allTabs={allTabs}
        location={location}
        navigate={navigate}
      />
    );
  }

  return (
    <DesktopShell
      user={user}
      logout={logout}
      theme={theme}
      toggleTheme={toggleTheme}
      language={language}
      setLanguage={setLanguage}
      t={t}
      allTabs={allTabs}
      onLogoClick={handleLogoClick}
    />
  );
}

/* ===========================================================================
   DESKTOP / TABLET SHELL - static left sidebar, unchanged from the original
   design. Only ever mounted at >=768px, so none of its own responsive
   drawer/hamburger logic is needed any more - that behavior now belongs to
   MobileShell below, purpose-built for a phone instead of a shrunk sidebar.
   =========================================================================== */
function DesktopShell({ user, logout, theme, toggleTheme, language, setLanguage, t, allTabs, onLogoClick }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const collapseBtnRef = useRef(null);

  const setCollapsedPersist = (next) => {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* localStorage unavailable (private mode etc.) - collapse still works for this session */
    }
  };

  // Ctrl+B (or Cmd+B on Mac) toggles the sidebar from anywhere on the page,
  // matching the shortcut convention used by most IDE/editor sidebars.
  useEffect(() => {
    const onKeyDown = (e) => {
      const key = e.key?.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'b') {
        e.preventDefault();
        setCollapsedPersist(!collapsed);
        collapseBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  return (
    <div className="app-shell">
      <div className="app-body">
        <aside className={`app-sidebar no-print${collapsed ? ' collapsed' : ''}`}>
          <div className="sidebar-top-row">
            <div
              className="brand"
              onClick={onLogoClick}
              style={{ cursor: user?.isSuperAdmin ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: collapsed ? 'center' : 'flex-start', gap: '4px' }}
            >
              <div style={{ width: collapsed ? '52px' : '82px', height: collapsed ? '24px' : '37px', overflow: 'hidden', position: 'relative' }}>
                <img
                  src={logoImg}
                  alt="RSA Logo"
                  style={{
                    width: collapsed ? '52px' : '82px',
                    height: 'auto',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    filter: 'invert(1) hue-rotate(180deg)',
                  }}
                />
              </div>
              {!collapsed && (
                <>
                  <div style={{ fontSize: '6.5px', fontWeight: 'bold', letterSpacing: '1.2px', textTransform: 'uppercase', color: '#fff', opacity: 0.8, lineHeight: 1.2, margin: '2px 0 4px' }}>
                    CONSTRUCTION &amp; BUILDING MATERIALS
                  </div>
                  <span className="brand-title" style={{ fontSize: '13px', fontWeight: '700', marginTop: '4px' }}>{t('app.title')}</span>
                  <span className="brand-sub">{t('app.subtitle')}</span>
                </>
              )}
            </div>
            <button
              ref={collapseBtnRef}
              type="button"
              className="collapse-toggle-btn"
              onClick={() => setCollapsedPersist(!collapsed)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
              title={`${collapsed ? t('common.expandSidebar') : t('common.collapseSidebar')} (Ctrl+B)`}
            >
              {collapsed ? '»' : '«'}
            </button>
          </div>

          <nav className="tab-nav">
            {allTabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}
                title={collapsed ? tab.label : undefined}
              >
                {collapsed ? tab.short : tab.label}
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-controls">
              <button className="btn btn-ghost btn-sm theme-toggle" onClick={toggleTheme} title={t('common.theme')}>
                {collapsed ? (theme === 'light' ? '☀' : '☽') : theme === 'light' ? t('common.dark') : t('common.light')}
              </button>
              {!collapsed && (
                <select className="lang-select" value={language} onChange={(e) => setLanguage(e.target.value)} title={t('common.language')}>
                  <option value="en">English</option>
                  <option value="ta">தமிழ்</option>
                </select>
              )}
            </div>
            <div className="user-menu">
              {!collapsed && <span>{user?.name}</span>}
              <button className="btn btn-ghost btn-sm" onClick={logout} title={t('nav.logout')}>
                {collapsed ? '⏻' : t('nav.logout')}
              </button>
            </div>
          </div>
        </aside>

        <main className="app-content">
          <Outlet />
        </main>
      </div>

      <ChatWidget />
    </div>
  );
}

// Pixels of vertical scroll before the header/bottom-nav react at all - keeps
// tiny scroll jitter (rubber-banding, a single line of momentum) from
// flickering the chrome in and out.
const SCROLL_HIDE_THRESHOLD = 6;
// Always shown while within this many pixels of the top, regardless of
// direction, so the chrome doesn't hide itself on a page that barely scrolls.
const SCROLL_TOP_SAFE_ZONE = 40;

// Tracks page scroll direction so the mobile header + bottom nav can hide
// themselves out of the way while scrolling down (more room to read) and
// reappear the moment the user scrolls back up (nav is never more than one
// swipe away). Listens on window because .m-content itself doesn't scroll -
// the whole document does, under the sticky header.
function useChromeVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = Math.max(window.scrollY, 0);
        const delta = y - lastY;
        if (y < SCROLL_TOP_SAFE_ZONE) {
          setVisible(true);
          lastY = y;
        } else if (delta > SCROLL_HIDE_THRESHOLD) {
          setVisible(false);
          lastY = y;
        } else if (delta < -SCROLL_HIDE_THRESHOLD) {
          setVisible(true);
          lastY = y;
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return visible;
}

/* ===========================================================================
   MOBILE SHELL - purpose-built phone-app layout: sticky header (back + page
   title + profile/menu), a fixed bottom tab bar that scrolls horizontally
   through EVERY destination (built-in + any Superadmin-created tab), and a
   slide-up "More" sheet for the account-level controls (language/theme/
   logout) that don't belong in the tab bar itself. Both the header and the
   bottom nav hide on scroll-down and reappear on scroll-up, so a long page
   gets the full screen while reading. Renders the exact same <Outlet/> - and
   therefore the exact same route, data, and page component - as DesktopShell;
   only the chrome around it is different.
   =========================================================================== */
function MobileShell({ user, logout, theme, toggleTheme, language, setLanguage, t, allTabs, location, navigate }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const chromeVisible = useChromeVisible() || moreOpen;

  const activeTab = allTabs.find((tab) => location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`));
  const isPrimaryRoot = activeTab && location.pathname === activeTab.to;
  const pageTitle = activeTab ? activeTab.label : t('app.title');

  // Root screens (any bottom-nav destination, at its own exact path) have
  // nothing "back" to go to - only screens reached by drilling in (Billing >
  // New Delivery Note, an edit screen, a Superadmin-created tab's sub-page,
  // ...) show a back arrow.
  const showBack = !isPrimaryRoot;
  const handleBack = () => {
    const hasHistory = window.history.state && window.history.state.idx > 0;
    if (hasHistory) navigate(-1);
    else navigate('/dashboard');
  };

  return (
    <div className="app-shell mobile-shell">
      <header className={`m-header no-print${chromeVisible ? '' : ' m-header-hidden'}`}>
        {showBack ? (
          <button type="button" className="m-header-icon-btn" onClick={handleBack} aria-label={t('common.back')}>
            <IconChevronLeft />
          </button>
        ) : (
          <span className="m-header-icon-spacer" />
        )}
        <span className="m-header-title">{pageTitle}</span>
        <button type="button" className="m-header-icon-btn" onClick={() => setMoreOpen(true)} aria-label="Menu">
          <IconUserCircle />
        </button>
      </header>

      <main className="app-content m-content">
        <Outlet />
      </main>

      <nav className={`m-bottom-nav no-print${chromeVisible ? '' : ' m-bottom-nav-hidden'}`}>
        {allTabs.map((tab) => {
          const Icon = MOBILE_ICONS[tab.to] || IconGrid;
          return (
            <NavLink key={tab.to} to={tab.to} className={({ isActive }) => `m-nav-item${isActive ? ' active' : ''}`}>
              <Icon />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {moreOpen && (
        <div className="m-sheet-backdrop no-print" onClick={() => setMoreOpen(false)}>
          <div className="m-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="m-sheet-handle" />
            <div className="m-sheet-header">
              <div className="m-sheet-user">
                <IconUserCircle className="m-sheet-user-icon" />
                <span>{user?.name}</span>
              </div>
              <button type="button" className="m-header-icon-btn" onClick={() => setMoreOpen(false)} aria-label="Close">
                <IconClose />
              </button>
            </div>

            <div className="m-sheet-controls">
              <button type="button" className="btn btn-ghost" onClick={toggleTheme}>
                {theme === 'light' ? t('common.dark') : t('common.light')}
              </button>
              <select className="lang-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="en">English</option>
                <option value="ta">தமிழ்</option>
              </select>
            </div>

            <button type="button" className="btn btn-danger m-sheet-logout" onClick={logout}>
              {t('nav.logout')}
            </button>
          </div>
        </div>
      )}

      <ChatWidget />
    </div>
  );
}
