import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PullToRefresh from '../../components/ui/PullToRefresh';

const touch = (y: number) => ({ touches: [{ clientY: y }] });

const mount = (onRefresh: () => Promise<void>, scrollTop = 0) => {
  const utils = render(
    <div data-scroll-root>
      <PullToRefresh onRefresh={onRefresh} threshold={60}>
        <p>content</p>
      </PullToRefresh>
    </div>
  );
  const scroller = utils.container.querySelector('[data-scroll-root]') as HTMLElement;
  Object.defineProperty(scroller, 'scrollTop', { value: scrollTop, configurable: true });
  return scroller;
};

/**
 * Drag-down reload (LT-127). The gesture arms only when the scroller is at
 * the top, so it never fights ordinary scrolling; a short tug does nothing.
 */
describe('PullToRefresh', () => {
  it('refreshes after a pull past the threshold from the top', async () => {
    let release: () => void = () => {};
    const onRefresh = vi.fn(() => new Promise<void>((r) => { release = r; }));
    const scroller = mount(onRefresh);

    fireEvent.touchStart(scroller, touch(100));
    fireEvent.touchMove(scroller, touch(400)); // (300-8)*0.5 = 146 ≥ 60
    fireEvent.touchEnd(scroller);

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toBeInTheDocument();
    release();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('ignores a short tug', () => {
    const onRefresh = vi.fn(async () => {});
    const scroller = mount(onRefresh);
    fireEvent.touchStart(scroller, touch(100));
    fireEvent.touchMove(scroller, touch(140)); // (40-8)*0.5 = 16 < 60
    fireEvent.touchEnd(scroller);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does not arm while the page is scrolled down', () => {
    const onRefresh = vi.fn(async () => {});
    const scroller = mount(onRefresh, 200);
    fireEvent.touchStart(scroller, touch(100));
    fireEvent.touchMove(scroller, touch(500));
    fireEvent.touchEnd(scroller);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});

describe('PullToRefresh with a nested scroller', () => {
  it('leaves the gesture to an inner scroller that is scrolled down', () => {
    const onRefresh = vi.fn(async () => {});
    const { container } = render(
      <div data-scroll-root>
        <PullToRefresh onRefresh={onRefresh} threshold={60}>
          <div data-testid="inner" style={{ overflowY: 'auto' }}>
            <p>calendar body</p>
          </div>
        </PullToRefresh>
      </div>
    );
    const scroller = container.querySelector('[data-scroll-root]') as HTMLElement;
    const inner = screen.getByTestId('inner');
    Object.defineProperty(inner, 'scrollTop', { value: 120, configurable: true });

    fireEvent.touchStart(inner, touch(100));
    fireEvent.touchMove(scroller, touch(500));
    fireEvent.touchEnd(scroller);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
