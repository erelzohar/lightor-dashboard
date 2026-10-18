import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PhoneInput from '../../components/ui/PhoneInput';
import type { PhoneAccept, PhoneChangeInfo } from '../../utils/phone';

/**
 * LT-404: the phone field: formats as it is typed, takes pasted
 * international forms, hands up E.164 once the number is one the field
 * takes, and says so after a blur or a submit.
 */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));

const Harness: React.FC<{
  accept: PhoneAccept;
  initial?: string;
  onChange?: (value: string, info: PhoneChangeInfo) => void;
  showError?: boolean;
  error?: string | null;
}> = ({ accept, initial = '', onChange, showError, error }) => {
  const [value, setValue] = useState(initial);
  return (
    <>
      <PhoneInput
        label="Phone"
        name="phone"
        accept={accept}
        value={value}
        showError={showError}
        error={error}
        onChange={(next, info) => {
          setValue(next);
          onChange?.(next, info);
        }}
      />
      <output data-testid="value">{value}</output>
    </>
  );
};

const field = () => screen.getByLabelText('Phone') as HTMLInputElement;

describe('PhoneInput (LT-404)', () => {
  it('is a labelled left-to-right tel field with the Israeli chip', () => {
    render(<Harness accept="mobile" />);
    expect(field()).toHaveAttribute('type', 'tel');
    expect(field()).toHaveAttribute('inputmode', 'tel');
    expect(field()).toHaveAttribute('autocomplete', 'tel');
    expect(field()).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('+972')).toBeInTheDocument();
    // The country is read with the field.
    const country = screen.getByText('phoneInput.country');
    expect(field().getAttribute('aria-describedby')).toContain(country.id);
  });

  it('formats as it is typed and hands up E.164 once valid', () => {
    const onChange = vi.fn();
    render(<Harness accept="mobile" onChange={onChange} />);

    fireEvent.change(field(), { target: { value: '05012' } });
    expect(field()).toHaveValue('050-12');
    expect(onChange).toHaveBeenLastCalledWith('050-12', { valid: false, kind: null });

    fireEvent.change(field(), { target: { value: '0501234567' } });
    expect(field()).toHaveValue('050-123-4567');
    expect(onChange).toHaveBeenLastCalledWith('+972501234567', { valid: true, kind: 'mobile' });
  });

  it.each([
    ['+972-50-123-4567', '+972 50 123 4567'],
    ['00972501234567', '+972 50 123 4567'],
    ['050 123 4567', '050-123-4567'],
  ])('takes a pasted %j', (pasted, shown) => {
    render(<Harness accept="mobile" />);
    fireEvent.change(field(), { target: { value: pasted } });
    expect(field()).toHaveValue(shown);
    expect(screen.getByTestId('value')).toHaveTextContent('+972501234567');
  });

  it('shows a stored E.164 number nationally', () => {
    render(<Harness accept="any" initial="+97231234567" />);
    expect(field()).toHaveValue('03-123-4567');
  });

  it('takes a landline where any number goes, not where a mobile must', () => {
    const onChange = vi.fn();
    const { unmount } = render(<Harness accept="any" onChange={onChange} />);
    fireEvent.change(field(), { target: { value: '031234567' } });
    expect(onChange).toHaveBeenLastCalledWith('+97231234567', { valid: true, kind: 'landline' });
    fireEvent.blur(field());
    expect(screen.queryByText('phoneInput.invalidAny')).toBeNull();
    unmount();

    render(<Harness accept="mobile" onChange={onChange} />);
    fireEvent.change(field(), { target: { value: '031234567' } });
    expect(onChange).toHaveBeenLastCalledWith('03-123-4567', { valid: false, kind: 'landline' });
    fireEvent.blur(field());
    expect(screen.getByText('phoneInput.invalidMobile')).toBeInTheDocument();
  });

  it('says a wrong number is wrong only after a blur, and ties the message to the field', () => {
    render(<Harness accept="any" />);
    fireEvent.change(field(), { target: { value: '05012' } });
    expect(screen.queryByText('phoneInput.invalidAny')).toBeNull();
    expect(field()).not.toHaveAttribute('aria-invalid');

    fireEvent.blur(field());
    const message = screen.getByText('phoneInput.invalidAny');
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(field().getAttribute('aria-describedby')).toContain(message.id);

    fireEvent.change(field(), { target: { value: '0501234567' } });
    expect(screen.queryByText('phoneInput.invalidAny')).toBeNull();
  });

  it('shows its error at once after a submit, and an error from the server always', () => {
    const { rerender } = render(<Harness accept="mobile" showError />);
    expect(screen.queryByText('phoneInput.invalidMobile')).toBeNull(); // empty and not required
    fireEvent.change(field(), { target: { value: '0501' } });
    expect(screen.getByText('phoneInput.invalidMobile')).toBeInTheDocument();

    rerender(<Harness accept="mobile" error="Server says no" />);
    expect(screen.getByText('Server says no')).toBeInTheDocument();
  });

  it('takes the digit before a hyphen that Backspace removed', () => {
    render(<Harness accept="mobile" />);
    fireEvent.change(field(), { target: { value: '0501234567' } });
    expect(field()).toHaveValue('050-123-4567');

    // The caret sat after "050-": Backspace took the hyphen only.
    fireEvent.keyDown(field(), { key: 'Backspace' });
    fireEvent.change(field(), { target: { value: '050123-4567', selectionStart: 3, selectionEnd: 3 } });
    expect(field()).toHaveValue('051-234-567');
  });
});
