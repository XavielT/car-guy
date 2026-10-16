import { useCallback, useEffect, useRef, useState } from 'react';

import { cachedMapStyle, markMapStyleFailed, resetMapStyleCache, resolveMapStyle } from '@/lib/map/config';

/**
 * The style URL once the health check answered (lib/map/config.ts): a URL, or
 * null when no style loads (the component calls onUnavailable). `checking`
 * while the first check runs — the component shows a plain dark box.
 * `retry` forgets a remembered failure and checks again (the "Reintentar" of the
 * offline map, IMP 16102026 M-8).
 */
export function useMapStyle(onUnavailable?: () => void, onAvailable?: () => void): { url: string | null; checking: boolean; fail: () => void; retry: () => void } {
  const [state, setState] = useState<{ url: string | null; checking: boolean }>(() => {
    const hit = cachedMapStyle();
    return hit === undefined ? { url: null, checking: true } : { url: hit, checking: false };
  });
  const alive = useRef(true);
  const unavailable = useRef(onUnavailable);
  const available = useRef(onAvailable);
  useEffect(() => {
    unavailable.current = onUnavailable;
    available.current = onAvailable;
  });

  const check = useCallback(() => {
    void resolveMapStyle().then((url) => {
      if (!alive.current) return;
      setState({ url, checking: false });
      if (url) available.current?.();
      else unavailable.current?.();
    });
  }, []);

  useEffect(() => {
    alive.current = true;
    // The check runs once per mount; a later "Reintentar" runs it again.
    check();
    return () => {
      alive.current = false;
    };
  }, [check]);

  const fail = () => {
    markMapStyleFailed();
    setState({ url: null, checking: false });
    onUnavailable?.();
  };
  const retry = () => {
    resetMapStyleCache();
    setState({ url: null, checking: true });
    check();
  };
  return { ...state, fail, retry };
}
