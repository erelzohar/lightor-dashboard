import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FloatingAiAssistant } from '../../components/ui/glowing-ai-chat-assistant';
import { cardPlacement, clampOffset, readOffset, saveOffset } from '../../utils/floatingLighty';

/** LT-292: the floating Lighty can be dragged; held up, he throws a tantrum. */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('../../components/lighty/Lighty3D', () => ({
  default: ({ dragging }: { dragging?: boolean }) => <div data-testid="lighty-3d" data-dragging={String(!!dragging)} />,
}));
vi.mock('../../lib/haptics', () => ({ lightTick: vi.fn() }));

const VW = 1000, VH = 800;
const HOME = { left: VW - 24 - 80, top: VH - 24 - 96, width: 80, height: 96 };

describe('the rules', () => {
  it('keeps him whole on screen and never below his home line', () => {
    expect(clampOffset(HOME, -5000, -5000, VW, VH)).toEqual({ x: 8 - HOME.left, y: 8 - HOME.top });
    expect(clampOffset(HOME, 500, 500, VW, VH)).toEqual({ x: VW - 80 - 8 - HOME.left, y: 0 });
    expect(clampOffset(HOME, -100, -200, VW, VH)).toEqual({ x: -100, y: -200 });
  });

  it('remembers where he was left, and starts at home without it', () => {
    expect(readOffset()).toEqual({ x: 0, y: 0 });
    saveOffset({ x: -300, y: -120 });
    expect(readOffset()).toEqual({ x: -300, y: -120 });
    localStorage.setItem('lighty.floatOffset', '{"x":"nope"}');
    expect(readOffset()).toEqual({ x: 0, y: 0 });
  });

  it('opens his card on the side with room, below him near the top', () => {
    // Home corner, bottom-right: above him, right edges lined up.
    expect(cardPlacement({ left: 896, right: 976, top: 680 }, VW, 340)).toEqual({ left: 80 - 340, below: false });
    // Top-left of the screen: below him, starting at his left edge.
    expect(cardPlacement({ left: 20, right: 100, top: 40 }, VW, 340)).toEqual({ left: 0, below: true });
    // A phone, him in the middle: the card stays on screen.
    const phone = cardPlacement({ left: 150, right: 230, top: 600 }, 390, 340);
    expect(150 + phone.left).toBeGreaterThanOrEqual(12);
    expect(150 + phone.left + Math.min(340, 390 - 24)).toBeLessThanOrEqual(390 - 12);
  });
});

describe('the floating Lighty, dragged', () => {
  const realRect = Element.prototype.getBoundingClientRect;
  beforeAll(() => {
    // jsdom has no PointerEvent; a MouseEvent with a pointerId stands in.
    if (!('PointerEvent' in window)) {
      class PE extends MouseEvent {
        pointerId: number;
        constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 1;
        }
      }
      (window as unknown as { PointerEvent: typeof PE }).PointerEvent = PE;
    }
    // His box: the home corner, moved by whatever translate he carries.
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if ((this as HTMLElement).dataset?.testid !== 'floating-lighty') return realRect.call(this);
      const m = /translate\((-?\d+)px, (-?\d+)px\)/.exec((this as HTMLElement).style.transform);
      const x = m ? +m[1] : 0, y = m ? +m[2] : 0;
      return { left: HOME.left + x, top: HOME.top + y, right: HOME.left + x + 80, bottom: HOME.top + y + 96, width: 80, height: 96, x: HOME.left + x, y: HOME.top + y, toJSON: () => ({}) } as DOMRect;
    };
  });
  afterAll(() => { Element.prototype.getBoundingClientRect = realRect; });
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: VW, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: VH, configurable: true });
  });

  const lighty = () => screen.getByRole('button', { name: 'lighty.ask' });
  const wrap = () => screen.getByTestId('floating-lighty');
  const pointer = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', x: number, y: number) =>
    act(() => { fireEvent[type](lighty(), { pointerId: 1, button: 0, clientX: x, clientY: y }); });

  it('a tap still opens his card', () => {
    render(<FloatingAiAssistant onSend={vi.fn()} />);
    pointer('pointerDown', 930, 740);
    pointer('pointerMove', 932, 741);
    pointer('pointerUp', 932, 741);
    fireEvent.click(lighty());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(wrap().style.transform).toBe('');
  });

  it('follows the pointer, throws a tantrum while held, and stays where he is put down', () => {
    render(<FloatingAiAssistant onSend={vi.fn()} />);
    expect(screen.getByTestId('lighty-3d')).toHaveAttribute('data-dragging', 'false');
    pointer('pointerDown', 930, 740);
    pointer('pointerMove', 830, 640);
    expect(screen.getByTestId('lighty-3d')).toHaveAttribute('data-dragging', 'true');
    pointer('pointerMove', 630, 440);
    expect(wrap().style.transform).toBe('translate(-300px, -300px)');
    pointer('pointerUp', 630, 440);
    expect(screen.getByTestId('lighty-3d')).toHaveAttribute('data-dragging', 'false');
    // The click that ends a drag is the drop, not a tap.
    fireEvent.click(lighty());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readOffset()).toEqual({ x: -300, y: -300 });
  });

  it('cannot be dragged off screen', () => {
    render(<FloatingAiAssistant onSend={vi.fn()} />);
    pointer('pointerDown', 930, 740);
    pointer('pointerMove', 3000, 3000);
    expect(wrap().style.transform).toBe(`translate(${VW - 80 - 8 - HOME.left}px, 0px)`);
    pointer('pointerUp', 3000, 3000);
  });

  it('comes back where he was left, and opens his card below him near the top', () => {
    saveOffset({ x: -800, y: -600 });
    render(<FloatingAiAssistant onSend={vi.fn()} />);
    expect(wrap().style.transform).toBe('translate(-800px, -600px)');
    fireEvent.click(lighty());
    expect(screen.getByRole('dialog').className).toContain('top-[6.5rem]');
  });
});
