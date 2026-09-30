import { useEffect, useRef, useState } from 'react';

/**
 * Whether to show a skeleton for `loading` (ADR-40): only once loading has
 * lasted `delay` ms, so a local read that answers in 20 ms never flashes one;
 * and once shown, for at least `minShow` ms, so it does not blink away.
 */
export function useDelayedLoading(loading: boolean, delay = 150, minShow = 300): boolean {
  const [show, setShow] = useState(false);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    if (loading) {
      if (show) return;
      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setShow(true);
      }, delay);
      return () => clearTimeout(timer);
    }
    if (!show) return;
    const left = Math.max(0, (shownAt.current ?? 0) + minShow - Date.now());
    const timer = setTimeout(() => {
      shownAt.current = null;
      setShow(false);
    }, left);
    return () => clearTimeout(timer);
  }, [loading, show, delay, minShow]);

  return show;
}
