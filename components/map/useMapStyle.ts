import { useEffect, useState } from 'react';

import { cachedMapStyle, markMapStyleFailed, resolveMapStyle } from '@/lib/map/config';

/**
 * The style URL once the health check answered (lib/map/config.ts): a URL, or
 * null when no style loads (the component calls onUnavailable). `checking`
 * while the first check runs — the component shows a plain dark box.
 */
export function useMapStyle(onUnavailable?: () => void): { url: string | null; checking: boolean; fail: () => void } {
  const [state, setState] = useState<{ url: string | null; checking: boolean }>(() => {
    const hit = cachedMapStyle();
    return hit === undefined ? { url: null, checking: true } : { url: hit, checking: false };
  });
  useEffect(() => {
    let alive = true;
    void resolveMapStyle().then((url) => {
      if (!alive) return;
      setState({ url, checking: false });
      if (!url) onUnavailable?.();
    });
    return () => {
      alive = false;
    };
    // The check runs once per mount; onUnavailable is the screen's callback of the moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fail = () => {
    markMapStyleFailed();
    setState({ url: null, checking: false });
    onUnavailable?.();
  };
  return { ...state, fail };
}
