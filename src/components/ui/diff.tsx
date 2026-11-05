import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * LT-581 (Erel's Diff, 2026-11-05): two pictures one over the other, a handle
 * between them. Left of the handle is the first item, right of it the
 * second; dragging the handle (or the arrow keys, Home and End on the frame)
 * moves the line. Built for this project: the first item is cut with
 * clip-path rather than container queries (Tailwind 3 here has no plugin for
 * them), the line and its knob are drawn by the handle, the colours are ours,
 * and the frame's and the handle's names come from the caller's language.
 * The frame is always laid out left to right, so "left" means the same in
 * Hebrew.
 */
type DiffContextValue = {
  position: number;
  setPosition: (value: number) => void;
  containerRef: React.RefObject<HTMLElement | null>;
  handleLabel: string;
};

const DiffContext = React.createContext<DiffContextValue | null>(null);

function useDiff() {
  const context = React.useContext(DiffContext);
  if (!context) throw new Error('Diff components must be used within <Diff>.');
  return context;
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

/** Every direct child fills the frame; pictures cover it, centred. */
const itemChildClassName =
  '[&>*]:pointer-events-none [&>*]:absolute [&>*]:inset-0 [&>*]:h-full [&>*]:w-full [&>*]:max-w-none [&>img]:object-cover [&>img]:object-center';

function Diff({
  className,
  children,
  defaultValue = 50,
  value,
  onValueChange,
  onKeyDown,
  label,
  handleLabel,
  style,
  ...props
}: React.ComponentProps<'figure'> & {
  /** Uncontrolled starting position, 0 to 100. */
  defaultValue?: number;
  /** Controlled position, 0 to 100. */
  value?: number;
  onValueChange?: (value: number) => void;
  /** What the frame compares, in the page's language. */
  label: string;
  /** The handle's name, in the page's language. */
  handleLabel: string;
}) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const position = value ?? uncontrolled;
  const containerRef = React.useRef<HTMLElement>(null);

  const setPosition = React.useCallback(
    (next: number) => {
      const clamped = clamp(next);
      if (value === undefined) setUncontrolled(clamped);
      onValueChange?.(clamped);
    },
    [onValueChange, value],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const step = event.shiftKey ? 10 : 2;
    const moves: Record<string, number> = { ArrowLeft: position - step, ArrowRight: position + step, Home: 0, End: 100 };
    if (event.key in moves) {
      event.preventDefault();
      setPosition(moves[event.key]);
    }
  };

  return (
    <DiffContext.Provider value={{ position, setPosition, containerRef, handleLabel }}>
      <figure
        ref={containerRef as React.RefObject<HTMLElement>}
        data-slot="diff"
        data-diff-position={position}
        tabIndex={0}
        role="group"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative m-0 block w-full min-w-0 overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          className,
        )}
        style={{ ...style, direction: 'ltr', '--diff-position': `${position}%` } as React.CSSProperties}
        {...props}
      >
        {children}
      </figure>
    </DiffContext.Provider>
  );
}

/** The first picture: left of the line. */
function DiffItem1({ className, children, style, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="diff-item-1"
      className={cn('absolute inset-0 z-[1]', itemChildClassName, className)}
      style={{ ...style, clipPath: 'inset(0 calc(100% - var(--diff-position)) 0 0)' }}
      {...props}
    >
      {children}
    </div>
  );
}

/** The second picture: the whole frame, under the first. */
function DiffItem2({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="diff-item-2" className={cn('absolute inset-0', itemChildClassName, className)} {...props}>
      {children}
    </div>
  );
}

/** The line and its knob; drag it anywhere along the frame. */
function DiffResizer({ className, style, ...props }: React.ComponentProps<'div'>) {
  const { position, setPosition, containerRef, handleLabel } = useDiff();
  const dragging = React.useRef(false);

  const updateFromClientX = React.useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      setPosition(((clientX - rect.left) / rect.width) * 100);
    },
    [containerRef, setPosition],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateFromClientX(event.clientX);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current) updateFromClientX(event.clientX);
  };
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      data-slot="diff-resizer"
      role="slider"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(position)}
      aria-label={handleLabel}
      tabIndex={-1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn(
        'absolute inset-y-0 z-[2] w-8 -translate-x-1/2 cursor-ew-resize touch-none',
        // The line itself.
        'before:pointer-events-none before:absolute before:inset-y-0 before:left-1/2 before:w-0.5 before:-translate-x-1/2 before:bg-white before:shadow-[0_0_0_1px_rgb(0_0_0/0.18)]',
        // The knob in its middle.
        'after:pointer-events-none after:absolute after:left-1/2 after:top-1/2 after:h-7 after:w-5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border-2 after:border-white after:bg-white/95 after:shadow-[0_0_0_2px_rgb(0_0_0/0.16)] after:transition-[height] after:duration-200 hover:after:h-9',
        className,
      )}
      style={{ ...style, left: 'var(--diff-position)' }}
      {...props}
    />
  );
}

export { Diff, DiffItem1, DiffItem2, DiffResizer };
export default Diff;
