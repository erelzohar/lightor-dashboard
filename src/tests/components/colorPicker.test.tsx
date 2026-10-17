import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useState } from 'react';
import ColorPicker from '../../components/ui/ColorPicker';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

/**
 * LT-384 — Erel: the main colour is a round swatch with no hex box beside it,
 * and a tap opens the Apple-style colour picker.
 */
function Field({ onChange = vi.fn() }: { onChange?: (c: string) => void }) {
  const [color, setColor] = useState('#d71676');
  return <ColorPicker label="Main colour" color={color} onChange={(c) => { onChange(c); setColor(c); }} />;
}
const swatch = () => screen.getByTestId('color-swatch');
const dialog = () => screen.queryByRole('dialog', { name: 'colorPicker.title' });

beforeEach(() => localStorage.clear());

describe('the colour field (LT-384)', () => {
  it('is a round swatch of the colour, named by its label, with no text box', () => {
    render(<Field />);
    expect(swatch()).toHaveClass('rounded-full');
    expect(swatch()).toHaveStyle({ backgroundColor: '#d71676' });
    expect(swatch()).toHaveAccessibleName('Main colour');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(dialog()).toBeNull();
  });

  it('opens the picker on a tap; a grid colour applies live and the swatch follows', () => {
    const onChange = vi.fn();
    render(<Field onChange={onChange} />);
    fireEvent.click(swatch());
    expect(dialog()).not.toBeNull();
    fireEvent.click(within(dialog()!).getAllByRole('button', { name: '#3366CC' })[0]);
    expect(onChange).toHaveBeenLastCalledWith('#3366cc');
    expect(swatch()).toHaveStyle({ backgroundColor: '#3366cc' });
    expect(screen.getByTestId('color-current')).toHaveStyle({ backgroundColor: '#3366cc' });
  });

  it('takes a hex code only once it is whole, and moves with the RGB sliders', () => {
    const onChange = vi.fn();
    render(<Field onChange={onChange} />);
    fireEvent.click(swatch());
    fireEvent.click(within(dialog()!).getByRole('tab', { name: 'colorPicker.sliders' }));
    const hex = within(dialog()!).getByRole('textbox', { name: 'colorPicker.hex' });
    expect(hex).toHaveValue('d71676');
    fireEvent.change(hex, { target: { value: '12' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(hex, { target: { value: '1a2b3c' } });
    expect(onChange).toHaveBeenLastCalledWith('#1a2b3c');
    // Red to 255 through its number box.
    fireEvent.change(within(dialog()!).getAllByLabelText('colorPicker.red')[1], { target: { value: '255' } });
    expect(onChange).toHaveBeenLastCalledWith('#ff2b3c');
  });

  it('keeps a colour among the recent ones on this device', () => {
    render(<Field />);
    fireEvent.click(swatch());
    fireEvent.click(within(dialog()!).getByRole('button', { name: 'colorPicker.add' }));
    const recent = within(within(dialog()!).getByRole('group', { name: 'colorPicker.recent' }));
    expect(recent.getAllByRole('button')[0]).toHaveAccessibleName('#d71676');
    expect(JSON.parse(localStorage.getItem('lightor.recentColors')!)[0]).toBe('#d71676');
  });

  it('closes on Escape, on its X and on a tap outside', () => {
    render(<Field />);
    fireEvent.click(swatch());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(dialog()).toBeNull();
    fireEvent.click(swatch());
    fireEvent.click(within(dialog()!).getByRole('button', { name: 'colorPicker.close' }));
    expect(dialog()).toBeNull();
    fireEvent.click(swatch());
    fireEvent.click(screen.getByTestId('color-picker-backdrop'));
    expect(dialog()).toBeNull();
  });
});
