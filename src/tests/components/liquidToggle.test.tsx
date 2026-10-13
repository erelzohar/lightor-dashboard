import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toggle } from '../../components/ui/liquid-toggle';
import ToggleSwitch from '../../components/ui/ToggleSwitch';

const { lightTick } = vi.hoisted(() => ({ lightTick: vi.fn() }));
vi.mock('../../lib/haptics', () => ({ lightTick }));

/** LT-311 — the dashboard's one switch: the liquid toggle. */
describe('the liquid toggle', () => {
  beforeEach(() => lightTick.mockClear());

  it('is a switch that follows its prop, and ticks on a change', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Toggle checked={false} onCheckedChange={onChange} aria-label="Visible" />);
    const sw = screen.getByRole('switch', { name: 'Visible' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(lightTick).toHaveBeenCalledTimes(1);
    // Controlled: the parent said no (a refused save) — it stays off.
    expect(sw).toHaveAttribute('aria-checked', 'false');
    rerender(<Toggle checked onCheckedChange={onChange} aria-label="Visible" />);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('does nothing while disabled', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onCheckedChange={onChange} disabled aria-label="Off" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
    expect(lightTick).not.toHaveBeenCalled();
  });

  it('gives each switch its own gooey filter', () => {
    render(<><Toggle checked={false} aria-label="a" /><Toggle checked aria-label="b" /></>);
    const ids = Array.from(document.querySelectorAll('filter'), (f) => f.id);
    expect(new Set(ids).size).toBe(2);
    document.querySelectorAll('svg[filter]').forEach((svg, i) => expect(svg.getAttribute('filter')).toBe(`url(#${ids[i]})`));
  });

  it('draws ToggleSwitch, whose callers keep their props', () => {
    const Host = () => {
      const [on, setOn] = useState(false);
      return <ToggleSwitch checked={on} onChange={setOn} ariaLabel="Section visible" />;
    };
    render(<Host />);
    fireEvent.click(screen.getByRole('switch', { name: 'Section visible' }));
    expect(screen.getByRole('switch', { name: 'Section visible' })).toHaveAttribute('aria-checked', 'true');
    expect(lightTick).toHaveBeenCalledTimes(1);
  });
});
