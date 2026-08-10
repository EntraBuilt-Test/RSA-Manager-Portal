import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Single source of truth for "what kind of screen is this" across the whole
 * app - every route (Dashboard, Billing, Labour, Voucher, ...) reads from
 * this same context instead of each page/component running its own
 * matchMedia listener. That's what lets one URL (e.g. /billing) render a
 * phone-shaped UI on a phone and a desktop-shaped UI on a laptop: the ROUTE
 * never changes, only which layout each page chooses based on this context.
 *
 * Deliberately viewport-width-based (matchMedia), not user-agent based - a
 * user-agent check can't react to the browser window being resized or a
 * tablet being rotated, and a phone in "desktop site" mode would otherwise
 * get the wrong layout. Width is also literally what determines whether a
 * sidebar or a bottom nav bar physically fits, which is the real question.
 *
 * Breakpoints:
 *   mobile:  <= 767px  (phones)
 *   tablet:  768-1023px
 *   desktop: >= 1024px
 */
const ViewportContext = createContext({
  width: typeof window !== 'undefined' ? window.innerWidth : 1280,
  isMobile: false,
  isTablet: false,
  isDesktop: true,
});

const MOBILE_QUERY = '(max-width: 767px)';
const TABLET_QUERY = '(min-width: 768px) and (max-width: 1023px)';

export function ViewportProvider({ children }) {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') {
      return { width: 1280, isMobile: false, isTablet: false, isDesktop: true };
    }
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;
    const isTablet = window.matchMedia(TABLET_QUERY).matches;
    return { width: window.innerWidth, isMobile, isTablet, isDesktop: !isMobile && !isTablet };
  });

  useEffect(() => {
    const mobileMq = window.matchMedia(MOBILE_QUERY);
    const tabletMq = window.matchMedia(TABLET_QUERY);

    // Recomputes from the media queries themselves (not window.innerWidth
    // directly) so this stays in perfect sync with the CSS breakpoints used
    // everywhere else in the app - one definition of "mobile", used by both
    // CSS and JS, instead of two numbers that could quietly drift apart.
    const recompute = () => {
      const isMobile = mobileMq.matches;
      const isTablet = tabletMq.matches;
      setState({ width: window.innerWidth, isMobile, isTablet, isDesktop: !isMobile && !isTablet });
    };

    // Covers window resize AND device rotation - addEventListener('change', ...)
    // on a MediaQueryList fires for both, with no separate orientation
    // listener needed.
    mobileMq.addEventListener ? mobileMq.addEventListener('change', recompute) : mobileMq.addListener(recompute);
    tabletMq.addEventListener ? tabletMq.addEventListener('change', recompute) : tabletMq.addListener(recompute);
    window.addEventListener('resize', recompute);

    return () => {
      mobileMq.removeEventListener ? mobileMq.removeEventListener('change', recompute) : mobileMq.removeListener(recompute);
      tabletMq.removeEventListener ? tabletMq.removeEventListener('change', recompute) : tabletMq.removeListener(recompute);
      window.removeEventListener('resize', recompute);
    };
  }, []);

  return <ViewportContext.Provider value={state}>{children}</ViewportContext.Provider>;
}

export function useViewport() {
  return useContext(ViewportContext);
}
