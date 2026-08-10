import { useEffect, useState } from 'react';

/**
 * Turns `true` once `loading` has been true for longer than `delayMs` (a few
 * seconds), so a screen can tell a normal-latency fetch apart from one that's
 * actually waiting on Render's backend cold start (30-60s the first time it
 * wakes from ~15min idle). Resets back to `false` as soon as loading ends.
 */
export default function useSlowLoading(loading, delayMs = 4000) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), delayMs);
    return () => clearTimeout(timer);
  }, [loading, delayMs]);

  return slow;
}
