import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import PhoneInput from '../../components/ui/PhoneInput';
import { resetPhoneCountries, setOpenAbroad, setOwnerPhone } from '../../services/phoneCountries';
import type { PhoneAccept, PhoneChangeInfo } from '../../utils/phone';

/**
 * LT-677: the phone field's country chip. With Israel alone it is the static
 * chip it always was; once the server opens a country it is a button that
 * opens the list of countries, and the chosen one is where a local number is
 * read: its placeholder, its format as it is typed, its E.164.
 */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));

const Harness: React.FC<{
  accept?: PhoneAccept;
  initial?: string;
  defaultCountry?: string | null;
  onChange?: (value: string, info: PhoneChangeInfo) => void;
}> = ({ accept = 'mobile', initial = '', defaultCountry, onChange }) => {
  const [value, setValue] = useState(initial);
  return (
    <>
      <PhoneInput
        label="Phone"
        name="phone"
        accept={accept}
        defaultCountry={defaultCountry}
        value={value}
        onChange={(next, info) => {
          setValue(next);
          onChange?.(next, info);
        }}
      />
      <output data-testid="value">{value}</output>
      <button type="button">elsewhere</button>
    </>
  );
};

const field = () => screen.getByLabelText('Phone') as HTMLInputElement;
const type = (value: string) => fireEvent.change(field(), { target: { value } });
const handedUp = () => screen.getByTestId('value').textContent;
const chip = () => screen.getByTestId('phone-country');
const openList = () => {
  fireEvent.click(chip());
  return screen.getByRole('listbox');
};
const pick = (code: 'IL' | 'US') => {
  const list = openList();
  fireEvent.click(within(list).getByText(`phoneInput.names.${code}`));
};

afterEach(() => resetPhoneCountries());

describe('PhoneInput with Israel alone (as before LT-677)', () => {
  it('keeps its static chip: no button, no list, the Israeli placeholder', () => {
    render(<Harness />);
    expect(screen.queryByTestId('phone-country')).toBeNull();
    expect(screen.queryByRole('button', { name: /phoneInput\.chooseCountry/ })).toBeNull();
    expect(screen.getByText('+972')).toBeInTheDocument();
    expect(screen.getByText('phoneInput.country')).toHaveClass('sr-only');
    expect(field()).toHaveAttribute('placeholder', '050-123-4567');
    expect(screen.getByTestId('phone-input').querySelector('[data-country]')).toHaveAttribute('data-country', 'IL');
  });

  it('takes no number abroad as an owner phone, and reads a local number as Israeli', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    type('+1 212 555 0123');
    expect(onChange).toHaveBeenLastCalledWith('+1 212 555 0123', { valid: false, kind: null });
    type('0501234567');
    expect(onChange).toHaveBeenLastCalledWith('+972501234567', { valid: true, kind: 'mobile' });
  });
});

describe('PhoneInput with a country open abroad (LT-677)', () => {
  const openUS = () => setOpenAbroad(['US']);

  it('makes the chip a button that opens a listbox of the countries', () => {
    openUS();
    render(<Harness />);
    expect(chip().tagName).toBe('BUTTON');
    expect(chip()).toHaveAttribute('type', 'button');
    expect(chip()).toHaveAttribute('aria-haspopup', 'listbox');
    expect(chip()).toHaveAttribute('aria-expanded', 'false');
    expect(chip()).toHaveAttribute('data-country', 'IL');
    expect(chip()).toHaveAccessibleName('phoneInput.chooseCountry: phoneInput.country');
    expect(screen.queryByRole('listbox')).toBeNull();

    const list = openList();
    expect(chip()).toHaveAttribute('aria-expanded', 'true');
    expect(chip()).toHaveAttribute('aria-controls', list.id);
    const options = within(list).getAllByRole('option');
    expect(options.map((o) => o.getAttribute('data-value'))).toEqual(['IL', 'US']);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'false');
    // Each row: the name and the calling code.
    expect(options[1]).toHaveTextContent('phoneInput.names.US');
    expect(options[1]).toHaveTextContent('+1');
    // The country is still read with the field.
    expect(field().getAttribute('aria-describedby')).toContain(screen.getByText('phoneInput.country', { selector: '.sr-only' }).id);
  });

  it('works from the keyboard: arrows, Enter, Escape', () => {
    openUS();
    render(<Harness />);
    chip().focus();
    fireEvent.keyDown(chip(), { key: 'ArrowDown' });
    const list = screen.getByRole('listbox');
    expect(list).toHaveFocus();
    // Opens on the chosen country; the arrow moves to the next.
    expect(list.getAttribute('aria-activedescendant')).toBe(within(list).getAllByRole('option')[0].id);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(list.getAttribute('aria-activedescendant')).toBe(within(list).getAllByRole('option')[1].id);

    // Escape closes, changes nothing, and the chip has the focus again.
    fireEvent.keyDown(list, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(chip()).toHaveAttribute('data-country', 'IL');
    expect(chip()).toHaveFocus();

    fireEvent.keyDown(chip(), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Enter' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(chip()).toHaveAttribute('data-country', 'US');
    expect(chip()).toHaveFocus();
  });

  it('closes on a tap outside', () => {
    openUS();
    render(<Harness />);
    openList();
    fireEvent.pointerDown(screen.getByText('elsewhere'));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(chip()).toHaveAttribute('data-country', 'IL');
  });

  it('reads a local number in the picked country: placeholder, format and E.164', () => {
    openUS();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    // Under Israel a US number written locally is no number.
    type('2125550123');
    expect(onChange).toHaveBeenLastCalledWith('2125550123', { valid: false, kind: null });
    type('');

    pick('US');
    expect(chip()).toHaveAttribute('data-country', 'US');
    expect(chip()).toHaveTextContent('+1');
    expect(field()).toHaveAttribute('placeholder', '(212) 555-0123');
    expect(screen.getByText('phoneInput.countryUS')).toHaveClass('sr-only');

    type('212555');
    expect(field()).toHaveValue('(212) 555');
    type('2125550123');
    expect(field()).toHaveValue('(212) 555-0123');
    expect(onChange).toHaveBeenLastCalledWith('+12125550123', { valid: true, kind: null });
    expect(handedUp()).toBe('+12125550123');
  });

  it('reads what is already typed again when the country is picked after it', () => {
    openUS();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    type('2125550123');
    expect(handedUp()).toBe('2125550123');
    pick('US');
    expect(field()).toHaveValue('(212) 555-0123');
    expect(onChange).toHaveBeenLastCalledWith('+12125550123', { valid: true, kind: null });

    pick('IL');
    expect(field()).toHaveValue('2125550123');
    expect(onChange).toHaveBeenLastCalledWith('2125550123', { valid: false, kind: null });
  });

  it('hands half a number abroad up with its calling code, so nothing reads it as Israeli', () => {
    openUS();
    const onChange = vi.fn();
    render(<Harness accept="any" onChange={onChange} />);
    pick('US');
    // "21255501" alone is a valid Jerusalem landline; under the US chip it is half a number.
    type('21255501');
    expect(field()).toHaveValue('(212) 555-01');
    expect(onChange).toHaveBeenLastCalledWith('+121255501', { valid: false, kind: null });
    fireEvent.blur(field());
    expect(screen.getByText('phoneInput.invalidAbroad')).toBeInTheDocument();
    expect(field()).toHaveAttribute('aria-invalid', 'true');

    // An Israeli number written locally is no US number either.
    type('0501234567');
    expect(onChange).toHaveBeenLastCalledWith('+10501234567', { valid: false, kind: null });
  });

  it.each([
    ['+1 212 555 0123', '+1 212 555 0123'],
    ['0012125550123', '+1 212 555 0123'],
  ])('moves the chip to the United States for a pasted %j', (pasted, shown) => {
    openUS();
    render(<Harness />);
    expect(chip()).toHaveAttribute('data-country', 'IL');
    type(pasted);
    expect(chip()).toHaveAttribute('data-country', 'US');
    expect(field()).toHaveValue(shown);
    expect(handedUp()).toBe('+12125550123');
  });

  it('moves the chip as soon as the calling code is typed, and back for +972', () => {
    openUS();
    render(<Harness />);
    type('+1');
    expect(chip()).toHaveAttribute('data-country', 'US');
    type('+972');
    expect(chip()).toHaveAttribute('data-country', 'IL');
    type('+972501234567');
    expect(handedUp()).toBe('+972501234567');
    // A country that is not offered moves nothing.
    type('+44 20 7946 0958');
    expect(chip()).toHaveAttribute('data-country', 'IL');
  });

  it('refuses a Canadian number where only the United States is open, and takes it where any number goes', () => {
    openUS();
    const onChange = vi.fn();
    const { unmount } = render(<Harness accept="mobile" onChange={onChange} />);
    type('+1 416 555 0123');
    expect(onChange).toHaveBeenLastCalledWith('+1 416 555 0123', { valid: false, kind: null });
    fireEvent.blur(field());
    expect(screen.getByText('phoneInput.invalidAbroad')).toBeInTheDocument();
    unmount();

    render(<Harness accept="world" onChange={onChange} />);
    pick('US');
    type('4165550123');
    expect(onChange).toHaveBeenLastCalledWith('+14165550123', { valid: true, kind: null });
    type('212555');
    fireEvent.blur(field());
    expect(screen.getByText('phoneInput.invalidWorldAbroad')).toBeInTheDocument();
  });

  it("keeps Israel's own words under the Israeli chip", () => {
    openUS();
    render(<Harness accept="mobile" />);
    type('031234567');
    fireEvent.blur(field());
    expect(screen.getByText('phoneInput.invalidMobile')).toBeInTheDocument();
  });

  describe('where the chip starts', () => {
    it('is the country of the value already in the field', () => {
      openUS();
      setOwnerPhone('+972501234567');
      render(<Harness initial="+12125550123" />);
      expect(chip()).toHaveAttribute('data-country', 'US');
      expect(field()).toHaveValue('(212) 555-0123');
    });

    it("is the country of the owner's phone for an empty field, and Israel for an Israeli value", () => {
      openUS();
      setOwnerPhone('+12125550123');
      const { unmount } = render(<Harness />);
      expect(chip()).toHaveAttribute('data-country', 'US');
      expect(field()).toHaveAttribute('placeholder', '(212) 555-0123');
      unmount();

      render(<Harness initial="+972501234567" />);
      expect(chip()).toHaveAttribute('data-country', 'IL');
      expect(field()).toHaveValue('050-123-4567');
    });

    it('is the country the screen names, when it is offered', () => {
      openUS();
      const { unmount } = render(<Harness defaultCountry="US" />);
      expect(chip()).toHaveAttribute('data-country', 'US');
      unmount();
      render(<Harness defaultCountry="FR" />);
      expect(chip()).toHaveAttribute('data-country', 'IL');
    });

    it('shows a number of a country that is not offered internationally, as before', () => {
      openUS();
      render(<Harness accept="world" initial="+442079460958" />);
      expect(chip()).toHaveAttribute('data-country', 'IL');
      expect(field()).toHaveValue('+44 20 7946 0958');
    });
  });

  describe('when the countries arrive after the field', () => {
    it('reads an untouched field again: the default chip, a stored number nationally', () => {
      setOwnerPhone('+12125550123');
      const { unmount } = render(<Harness />);
      expect(screen.queryByTestId('phone-country')).toBeNull();
      act(() => setOpenAbroad(['US']));
      expect(chip()).toHaveAttribute('data-country', 'US');
      unmount();

      resetPhoneCountries();
      render(<Harness initial="+12125550123" />);
      // Israel alone: a number abroad shows internationally, as before.
      expect(field()).toHaveValue('+1 212 555 0123');
      act(() => setOpenAbroad(['US']));
      expect(chip()).toHaveAttribute('data-country', 'US');
      expect(field()).toHaveValue('(212) 555-0123');
    });

    it('leaves a field someone is typing in alone', () => {
      setOwnerPhone('+12125550123');
      render(<Harness />);
      type('05012');
      act(() => setOpenAbroad(['US']));
      expect(chip()).toHaveAttribute('data-country', 'IL');
      expect(field()).toHaveValue('050-12');
    });
  });
});
