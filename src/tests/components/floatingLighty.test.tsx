import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FloatingAiAssistant } from '../../components/ui/glowing-ai-chat-assistant';
import { cardPlacement, clampOffset, readOffset, saveOffset } from '../../utils/floatingLighty';

/** LT-292: the floating Lighty can be dragged; held up, he throws a tantrum. */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('../../components/lighty/Lighty3D', () => ({
  default: ({ dragging, mood }: { dragging?: boolean; mood?: number }) => <div data-testid="lighty-3d" data-dragging={String(!!dragging)} data-mood={String(mood ?? 0)} />,
}));
const { lightTick, impact } = vi.hoisted(() => ({ lightTick: vi.fn(), impact: vi.fn() }));
vi.mock('../../lib/haptics', () => ({ lightTick, impact }));

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

  it('is felt: picked up, bumping the edge once, put down (LT-313)', () => {
    lightTick.mockClear();
    impact.mockClear();
    render(<FloatingAiAssistant onSend={vi.fn()} />);
    pointer('pointerDown', 930, 740);
    pointer('pointerMove', 830, 640);
    expect(impact).toHaveBeenCalledWith('medium');
    expect(lightTick).not.toHaveBeenCalled();
    pointer('pointerMove', 3000, 3000); // against the edge
    pointer('pointerMove', 3100, 3100); // still there: no second bump
    expect(lightTick).toHaveBeenCalledTimes(1);
    pointer('pointerMove', 600, 400);   // off the edge, and back
    pointer('pointerMove', 3000, 3000);
    expect(lightTick).toHaveBeenCalledTimes(2);
    pointer('pointerUp', 3000, 3000);
    expect(lightTick).toHaveBeenCalledTimes(3); // landed
    expect(impact).toHaveBeenCalledTimes(1);
  });

  it('comes back where he was left, and opens his card below him near the top', () => {
    saveOffset({ x: -800, y: -600 });
    render(<FloatingAiAssistant onSend={vi.fn()} />);
    expect(wrap().style.transform).toBe('translate(-800px, -600px)');
    fireEvent.click(lighty());
    expect(screen.getByRole('dialog').className).toContain('top-[6.5rem]');
  });

  it('starts on screen though his saved place was off this one (LT-307)', () => {
    saveOffset({ x: -5000, y: -5000 }); // left on a much bigger window
    render(<FloatingAiAssistant onSend={vi.fn()} />);
    expect(wrap().style.transform).toBe(`translate(${8 - HOME.left}px, ${8 - HOME.top}px)`);
  });

  it('a tap after a touch drag (which fires no click) still opens his card (LT-312)', async () => {
    render(<FloatingAiAssistant onSend={vi.fn()} />);
    pointer('pointerDown', 930, 740);
    pointer('pointerMove', 700, 500);
    pointer('pointerUp', 700, 500);
    await act(() => new Promise((r) => setTimeout(r, 150)));
    fireEvent.click(lighty());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

/** LT-385: how the week is going - his mood reaches the 3D Lighty, and he says why. */
describe('the floating Lighty, in a mood', () => {
  beforeEach(() => sessionStorage.clear());

  it('passes his mood to the 3D Lighty', () => {
    render(<FloatingAiAssistant onSend={vi.fn()} mood={3} />);
    expect(screen.getByTestId('lighty-3d')).toHaveAttribute('data-mood', '3');
  });

  it("adds the reason under the home page's greeting", () => {
    render(<FloatingAiAssistant onSend={vi.fn()} greeting="Good morning, Dana" note="Inquiries are up 42% on last week" />);
    expect(screen.getByTestId('lighty-greeting').textContent).toContain('Good morning, Dana\nInquiries are up 42% on last week');
  });

  it('says it once a session on the other pages', () => {
    const { unmount } = render(<FloatingAiAssistant onSend={vi.fn()} note="Income is up 35% on last week" />);
    expect(screen.getByTestId('lighty-greeting').textContent).toContain('Income is up 35% on last week');
    unmount();
    render(<FloatingAiAssistant onSend={vi.fn()} note="Income is up 35% on last week" />);
    expect(screen.queryByTestId('lighty-greeting')).toBeNull();
  });

  it('says nothing without a reason', () => {
    render(<FloatingAiAssistant onSend={vi.fn()} mood={0} />);
    expect(screen.queryByTestId('lighty-greeting')).toBeNull();
  });
});
