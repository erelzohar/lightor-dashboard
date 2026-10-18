import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LightyIcon from '../lighty/LightyIcon';
import { pop } from '../ui/pop-button';
import { useAuth } from '../../contexts/AuthContext';
import { useAppSelector } from '../../hooks/useAppSelector';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { isLeadsSite } from '../../utils/siteMode';
import { markTourSeen, setToursOff } from '../../services/toursApi';
import { tourFor, type TourStep } from './tours';
import { findTarget } from './geometry';

/**
 * Lighty's page tour (LT-389): on an owner's first visit to a page, the page
 * dims, one part of it is lit at a time, and Lighty says what it is for in a
 * card beside it ("next", "back", "skip"). Finishing or skipping marks the
 * tour done on the account; "don't show tours" turns them all off.
 *
 * The page stays put under it (clicks go nowhere while it runs). It waits for
 * the page's own targets to appear, and for no other popup to be open; a page
 * with nothing to point at (an empty list) gets its tour on a later visit.
 */

/** Tours done in this session, before the account says so. */
const doneHere = new Set<string>();
let offHere = false;

/** "Start over" on the account page: the session forgets too. */
export const forgetToursDoneHere = (): void => {
  doneHere.clear();
  offHere = false;
};

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 6; // the light's room around its target
const GAP = 12; // between the light and the card
const EDGE = 16; // from the window's edges
const CARD_W = 352;

interface PageTourProps {
  /** Off while the account is being set up or the first-run welcome is up. */
  enabled: boolean;
  /** How long a page gets to settle before the tour looks for its parts (tests pass 0). */
  settleMs?: number;
}

const PageTour: React.FC<PageTourProps> = ({ enabled, settleMs = 700 }) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { auth } = useAuth();
  // The site's mode picks some of the words (a leads site's home, hours):
  // no tour before the site is known.
  const webConfig = useAppSelector((state) => state.webConfig.data);
  const leadsSite = isLeadsSite(webConfig);
  const reduceMotion = useReducedMotion();
  const tour = tourFor(pathname, leadsSite);
  const saved = auth.user?.tours;
  const wanted =
    enabled && !!webConfig && !!tour && !offHere && saved?.off !== true && !saved?.seen?.includes(tour.id) && !doneHere.has(tour.id);

  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardH, setCardH] = useState(0);
  const direction = useRef<1 | -1>(1);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  // A page's parts appear once its data is in: look for them a beat after
  // it opens, and again every 300 ms, while nothing else is open over it.
  const tourId = tour?.id;
  useEffect(() => {
    setSteps(null);
    setIndex(0);
    setTarget(null);
    setRect(null);
    if (!wanted || !tour) return;
    let timer = 0;
    const startedAt = Date.now();
    const look = () => {
      const waited = Date.now() - startedAt;
      if (!document.querySelector('[aria-modal="true"]')) {
        const shown = tour.steps.filter((s) => !s.target || findTarget(s.target));
        if (shown.some((s) => s.target)) {
          direction.current = 1;
          setSteps(shown);
          return;
        }
        // None of its parts on the page: not this visit.
        if (waited > 3000) return;
      }
      if (waited < 8000) timer = window.setTimeout(look, 300);
    };
    timer = window.setTimeout(look, settleMs);
    return () => window.clearTimeout(timer);
    // The tour is a fresh object each render; its id is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, tourId, leadsSite, settleMs]);

  const step = steps?.[index] ?? null;

  // The step's part, looked up as it opens (the page may have changed under
  // the tour); one that is gone hands over to the next step in the same
  // direction. Lit parts are scrolled into the middle of their scroller.
  useLayoutEffect(() => {
    if (!steps || !step) return;
    if (!step.target) {
      setTarget(null);
      setRect(null);
      return;
    }
    const el = findTarget(step.target);
    if (!el) {
      const next = index + direction.current;
      if (next >= 0 && next < steps.length) setIndex(next);
      else setSteps(null);
      return;
    }
    setTarget(el);
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [steps, step, index, reduceMotion]);

  // Follow the lit part through scrolling, resizing and its own changes.
  useEffect(() => {
    if (!target) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = target.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(target);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      observer?.disconnect();
    };
  }, [target]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [step, rect]);

  // Each step starts on its "next": Enter goes on.
  useEffect(() => {
    if (step) nextRef.current?.focus({ preventScroll: true });
  }, [step]);

  const close = useCallback(
    (how: 'done' | 'off') => {
      if (!tour) return;
      doneHere.add(tour.id);
      if (how === 'off') offHere = true;
      setSteps(null);
      setTarget(null);
      setRect(null);
      void (how === 'off' ? setToursOff(true) : markTourSeen(tour.id)).catch(() => undefined);
    },
    [tour]
  );

  const open = !!steps && !!step;
  useDialogFocus(open, cardRef, () => close('done'));

  if (!open || !steps || !step) return null;

  const last = index === steps.length - 1;
  const go = (delta: 1 | -1) => {
    direction.current = delta;
    setIndex((i) => i + delta);
  };

  // Where the card goes. A phone docks it to the edge away from the lit
  // part; a wider screen puts it under the part, else over it, else beside.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const phone = vw < 768;
  let place: React.CSSProperties;
  if (!rect) {
    place = phone
      ? { left: EDGE, right: EDGE, top: '50%', transform: 'translateY(-50%)' }
      : { left: '50%', top: '50%', width: CARD_W, transform: 'translate(-50%, -50%)' };
  } else if (phone) {
    place = rect.top + rect.height / 2 < vh * 0.55
      ? { left: EDGE, right: EDGE, bottom: 'calc(5.75rem + env(safe-area-inset-bottom))' }
      : { left: EDGE, right: EDGE, top: 'calc(1rem + env(safe-area-inset-top))' };
  } else {
    const w = Math.min(CARD_W, vw - 2 * EDGE);
    const h = cardH || 200;
    const below = rect.top + rect.height + PAD + GAP;
    const above = rect.top - PAD - GAP - h;
    let top: number;
    let left = rect.left + rect.width / 2 - w / 2;
    if (below + h <= vh - EDGE) top = below;
    else if (above >= EDGE) top = above;
    else {
      top = Math.min(Math.max(rect.top + rect.height / 2 - h / 2, EDGE), vh - h - EDGE);
      left = rect.left + rect.width + PAD + GAP + w <= vw - EDGE ? rect.left + rect.width + PAD + GAP : rect.left - PAD - GAP - w;
    }
    place = { top, left: Math.min(Math.max(left, EDGE), vw - w - EDGE), width: w };
  }

  return createPortal(
    // The whole window is the tour's while it runs: clicks stop here.
    <div className="fixed inset-0 z-[10040]" data-testid="page-tour">
      {rect ? (
        <div
          aria-hidden="true"
          className="absolute rounded-2xl ring-2 ring-white/90 dark:ring-violet-300/80 pointer-events-none motion-safe:transition-[top,left,width,height] motion-safe:duration-300"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + 2 * PAD,
            height: rect.height + 2 * PAD,
            boxShadow: '0 0 0 200vmax rgba(17, 12, 34, 0.55)',
          }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-[rgba(17,12,34,0.55)]" />
      )}

      <div className="absolute" style={place}>
        <motion.div
          key={`${tour?.id}-${index}`}
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          tabIndex={-1}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.18 }}
          className="rounded-3xl bg-white dark:bg-slate-900 border border-violet-100 dark:border-white/10 shadow-2xl p-4 outline-none"
        >
          <div className="flex items-start gap-3">
            <LightyIcon className="w-11 h-11 shrink-0" />
            <div className="min-w-0 flex-1" aria-live="polite">
              <h2 id={titleId} className="font-bold text-gray-900 dark:text-white leading-snug">
                {t(`tour.${step.key}.title`)}
              </h2>
              <p id={bodyId} className="mt-1 text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
                {t(`tour.${step.key}.body`)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="text-xs text-gray-400 dark:text-slate-500 tabular-nums">
              {t('tour.step', { n: index + 1, total: steps.length })}
            </span>
            {/* The main button first, for focus; drawn at the end. */}
            <div className="flex flex-row-reverse items-center gap-1.5">
              <button
                ref={nextRef}
                type="button"
                onClick={() => (last ? close('done') : go(1))}
                className={`px-4 py-2 rounded-xl text-sm font-semibold ${pop()}`}
              >
                {t(last ? 'tour.done' : 'tour.next')}
              </button>
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="px-3 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5"
                >
                  {t('tour.prev')}
                </button>
              )}
              {!last && (
                <button
                  type="button"
                  onClick={() => close('done')}
                  className="px-3 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5"
                >
                  {t('tour.skip')}
                </button>
              )}
            </div>
          </div>

          {index === 0 && (
            <button
              type="button"
              onClick={() => close('off')}
              className="mt-2 text-xs text-gray-500 dark:text-slate-400 underline underline-offset-2 hover:text-gray-700 dark:hover:text-slate-200"
            >
              {t('tour.turnOff')}
            </button>
          )}
        </motion.div>
      </div>
    </div>,
    document.body
  );
};

export default PageTour;
