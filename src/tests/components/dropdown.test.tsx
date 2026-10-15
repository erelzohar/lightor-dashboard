import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import Select from '../../components/ui/Select';

/**
 * LT-365 — Erel: "use this for all select boxes". `ui/Select` is the
 * animated dropdown now, behind the native select's API.
 */
const OPTIONS = [
  { value: 15, label: 'Fifteen minutes' },
  { value: 30, label: 'Thirty minutes' },
  { value: 45, label: 'Forty-five', disabled: true },
  { value: 60, label: 'Sixty minutes' },
];

function Harness({ onChange = vi.fn() }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState<number>(30);
  return (
    <>
      <Select
        id="len"
        label="Length"
        value={value}
        options={OPTIONS}
        onChange={(e) => {
          onChange(e.target.value);
          setValue(Number(e.target.value));
        }}
      />
      <button type="button">elsewhere</button>
    </>
  );
}

// The open list is named by the label too: the trigger is the button.
const trigger = () => screen.getByRole('button', { name: /^Length/ });
const listbox = () => screen.queryByRole('listbox');
// The panel leaves after its exit animation.
const shut = () => waitFor(() => expect(listbox()).toBeNull());

describe('Select is the dropdown (LT-365)', () => {
  it('is named by its label and its value, and shows the chosen option', () => {
    render(<Harness />);
    expect(trigger().tagName).toBe('BUTTON');
    expect(trigger()).toHaveAccessibleName('Length Thirty minutes');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens in <body>, marks the chosen option, and a tap picks another', async () => {
    const onChange = vi.fn();
    const { container } = render(<Harness onChange={onChange} />);
    fireEvent.click(trigger());
    const list = listbox()!;
    // Portalled: a modal's overflow cannot clip it.
    expect(container.contains(list)).toBe(false);
    expect(document.body.contains(list)).toBe(true);
    expect(screen.getByRole('option', { name: 'Thirty minutes' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('option', { name: 'Sixty minutes' }));
    expect(onChange).toHaveBeenCalledWith('60');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    await shut();
    expect(trigger()).toHaveAccessibleName('Length Sixty minutes');
    expect(trigger()).toHaveFocus();
  });

  it('does not pick a disabled option', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('option', { name: 'Forty-five' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(listbox()).not.toBeNull();
  });

  it('works from the keyboard: arrows skip disabled rows, Enter picks, Escape closes', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    const list = listbox()!;
    expect(list).toHaveFocus();
    const active = () => document.getElementById(list.getAttribute('aria-activedescendant')!)!;
    expect(active()).toHaveTextContent('Thirty minutes');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(active()).toHaveTextContent('Sixty minutes');
    fireEvent.keyDown(list, { key: 'Home' });
    expect(active()).toHaveTextContent('Fifteen minutes');
    // Typeahead.
    fireEvent.keyDown(list, { key: 's' });
    expect(active()).toHaveTextContent('Sixty minutes');
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('60');

    await shut();
    fireEvent.keyDown(trigger(), { key: 'Enter' });
    fireEvent.keyDown(listbox()!, { key: 'Escape' });
    await shut();
    expect(trigger()).toHaveFocus();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('closes on a tap outside without picking', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(trigger());
    fireEvent.pointerDown(screen.getByText('elsewhere'));
    await shut();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stays shut when disabled', () => {
    render(<Select id="x" label="Off" disabled value="a" options={[{ value: 'a', label: 'A' }]} />);
    fireEvent.click(screen.getByLabelText(/Off/));
    expect(listbox()).toBeNull();
  });
});
