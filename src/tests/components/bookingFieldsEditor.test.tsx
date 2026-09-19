import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import BookingFieldsEditor from '../../components/settings/BookingFieldsEditor';
import type { AppointmentType, BookingField } from '../../types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => (vars && 'n' in vars ? `${key}:${vars.n}` : key),
  }),
}));

const service = (id: string, name: string): AppointmentType => ({
  _id: id,
  name,
  webConfig_id: 'w1',
  price: '100',
  durationMS: '3600000',
});
const SERVICES = [service('s1', 'Massage'), service('s2', 'Facial')];

const field = (over: Partial<BookingField> = {}): BookingField => ({
  label: 'Question',
  type: 'text',
  required: false,
  services: [],
  ...over,
});

const renderEditor = (value: BookingField[]) => {
  const onChange = vi.fn();
  render(<BookingFieldsEditor value={value} onChange={onChange} services={SERVICES} />);
  return onChange;
};

/**
 * The booking-questions editor (LT-178). Keys are the server's: a question
 * added here goes out without one, and the ones the server already named
 * keep theirs through every edit.
 */
describe('BookingFieldsEditor', () => {
  it('adds a question with no key', () => {
    const onChange = renderEditor([]);

    fireEvent.click(screen.getByText('settings.bookingFields.addQuestion'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const [next] = onChange.mock.calls[0] as [BookingField[]];
    expect(next).toHaveLength(1);
    expect(next[0]).not.toHaveProperty('key');
    expect(next[0]).toMatchObject({ type: 'text', required: false, services: [] });
  });

  it('keeps an existing key while a field is edited', () => {
    const onChange = renderEditor([field({ key: 'address', label: 'Address', type: 'address' })]);

    fireEvent.change(screen.getByLabelText('settings.bookingFields.label'), { target: { value: 'Home address' } });

    const [next] = onChange.mock.calls[0] as [BookingField[]];
    expect(next[0]).toMatchObject({ key: 'address', label: 'Home address', type: 'address' });
  });

  it('caps the catalog at eight questions', () => {
    const eight = Array.from({ length: 8 }, (_, i) => field({ key: `q${i}`, label: `Q${i}` }));
    const onChange = renderEditor(eight);

    const add = screen.getByText('settings.bookingFields.addQuestion').closest('button');
    expect(add).toBeDisabled();
    fireEvent.click(add!);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('booking-fields-count')).toHaveTextContent('8/8');
  });

  it('allows only one address question', () => {
    renderEditor([
      field({ key: 'address', label: 'Address', type: 'address' }),
      field({ key: 'car', label: 'Car', type: 'text' }),
    ]);

    const [first, second] = screen.getAllByLabelText('settings.bookingFields.type') as HTMLSelectElement[];
    const option = (select: HTMLSelectElement) =>
      within(select).getByText('settings.bookingFields.types.address') as HTMLOptionElement;

    // The field that IS the address can keep it; any other field cannot pick it.
    expect(option(first).disabled).toBe(false);
    expect(option(second).disabled).toBe(true);
  });

  it('seeds two empty options when a question becomes a choice, and drops them when it stops being one', () => {
    const onChange = renderEditor([field({ key: 'parking', label: 'Parking' })]);

    fireEvent.change(screen.getByLabelText('settings.bookingFields.type'), { target: { value: 'choice' } });
    let [next] = onChange.mock.calls[0] as [BookingField[]];
    expect(next[0]).toMatchObject({ key: 'parking', type: 'choice', options: ['', ''] });

    onChange.mockClear();
    render(
      <BookingFieldsEditor
        value={[field({ key: 'parking', label: 'Parking', type: 'choice', options: ['Yes', 'No'] })]}
        onChange={onChange}
        services={SERVICES}
      />
    );
    const selects = screen.getAllByLabelText('settings.bookingFields.type');
    fireEvent.change(selects[selects.length - 1], { target: { value: 'confirm' } });
    [next] = onChange.mock.calls[0] as [BookingField[]];
    expect(next[0].type).toBe('confirm');
    expect(next[0]).not.toHaveProperty('options');
  });

  it('reorders with the arrows and deletes', () => {
    const onChange = renderEditor([
      field({ key: 'a', label: 'A' }),
      field({ key: 'b', label: 'B' }),
    ]);

    fireEvent.click(screen.getAllByLabelText('settings.bookingFields.moveDown')[0]);
    let [next] = onChange.mock.calls[0] as [BookingField[]];
    expect(next.map((f) => f.key)).toEqual(['b', 'a']);

    fireEvent.click(screen.getAllByLabelText('settings.bookingFields.delete')[1]);
    [next] = onChange.mock.calls[1] as [BookingField[]];
    expect(next.map((f) => f.key)).toEqual(['a']);
  });

  it('scopes a question to services, with [] meaning all', () => {
    const onChange = renderEditor([field({ key: 'a', label: 'A' })]);

    // From "all", deselecting one service leaves the others.
    fireEvent.click(screen.getByRole('button', { name: 'Massage' }));
    let [next] = onChange.mock.calls[0] as [BookingField[]];
    expect(next[0].services).toEqual(['s2']);

    // Back to every service is stored as [].
    onChange.mockClear();
    render(<BookingFieldsEditor value={next} onChange={onChange} services={SERVICES} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Massage' })[1]);
    [next] = onChange.mock.calls[0] as [BookingField[]];
    expect(next[0].services).toEqual([]);
  });

  it('previews the labels raw, with a required marker', () => {
    renderEditor([field({ key: 'a', label: 'כתובת מלאה', type: 'address', required: true })]);

    const preview = screen.getByTestId('booking-fields-preview');
    expect(within(preview).getByText('כתובת מלאה')).toBeTruthy();
    expect(within(preview).getByText('*')).toBeTruthy();
  });
});
