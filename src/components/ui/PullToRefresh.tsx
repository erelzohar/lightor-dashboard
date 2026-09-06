import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | unknown;
  children: React.ReactNode;
  /** Pull distance (px) that triggers a refresh. */
  threshold?: number;
}

/** Distance the finger has to travel before we start treating it as a pull. */
const SLOP = 8;

/**
 * Drag-down-to-reload for touch screens (LT-127, mobile plan phase 0).
 *
 * The app shell has no address bar to reload with, and the appointments
 * slice otherwise refreshes on a 4-minute timer — an owner who just got a
 * booking SMS wants the list now. Attaches touch listeners to the nearest
 * `[data-scroll-root]` ancestor (Layout's main scroller): the gesture only
 * arms when that scroller is at the very top, so ordinary scrolling is
 * untouched. Mouse users never see it — touch events don't fire for them.
 *
 * Pure UI: the parent decides what "refresh" means (a Redux thunk, a fetch).
 */
const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children, threshold = 72 }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  const run = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      setPull(0);
    }
  }, [onRefresh]);

  useEffect(() => {
    const scroller = hostRef.current?.closest<HTMLElement>('[data-scroll-root]');
    if (!scroller) return;

    // A nested scroller (the calendar body) that is scrolled down owns the
    // gesture: dragging there scrolls it back up and must not also pull.
    const innerScrolled = (target: EventTarget | null): boolean => {
      let el = target instanceof Element ? target : null;
      while (el && el !== scroller) {
        if (el.scrollTop > 0) return true;
        el = el.parentElement;
      }
      return false;
    };
    const onStart = (e: TouchEvent) => {
      startY.current =
        scroller.scrollTop <= 0 && !refreshingRef.current && !innerScrolled(e.target)
          ? e.touches[0].clientY
          : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= SLOP || scroller.scrollTop > 0) {
        setPull(0);
        return;
      }
      // Rubber-band: the indicator lags the finger so it reads as resistance.
      setPull(Math.min((dy - SLOP) * 0.5, threshold * 1.5));
    };
    const onEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      setPull((current) => {
        if (current >= threshold) void run();
        return current >= threshold ? current : 0;
      });
    };

    scroller.addEventListener('touchstart', onStart, { passive: true });
    scroller.addEventListener('touchmove', onMove, { passive: true });
    scroller.addEventListener('touchend', onEnd);
    scroller.addEventListener('touchcancel', onEnd);
    return () => {
      scroller.removeEventListener('touchstart', onStart);
      scroller.removeEventListener('touchmove', onMove);
      scroller.removeEventListener('touchend', onEnd);
      scroller.removeEventListener('touchcancel', onEnd);
    };
  }, [run, threshold]);

  const armed = pull >= threshold;
  const visible = pull > 0 || refreshing;

  return (
    <div ref={hostRef} className="relative">
      <div
        aria-hidden={!refreshing}
        role={refreshing ? 'status' : undefined}
        data-testid="pull-indicator"
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-center transition-opacity duration-150"
        style={{
          opacity: visible ? 1 : 0,
          transform: `translateY(${visible ? Math.min(pull, threshold) - 40 : -40}px)`,
        }}
      >
        <span className="rounded-full bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 p-2 text-primary">
          <RefreshCw
            size={18}
            className={refreshing ? 'animate-spin' : ''}
            style={{ transform: refreshing ? undefined : `rotate(${armed ? 180 : (pull / threshold) * 180}deg)` }}
          />
        </span>
      </div>
      <div style={{ transform: visible ? `translateY(${Math.min(pull, threshold) * 0.4}px)` : undefined, transition: pull ? undefined : 'transform 150ms' }}>
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
