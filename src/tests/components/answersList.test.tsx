import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnswersList from '../../components/appointments/AnswersList';
import type { BookingField } from '../../types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The saved catalog, as the store would hold it.
const CATALOG: BookingField[] = [
  { key: 'address', label: 'Address', type: 'address', required: true, services: [] },
  { key: 'parking', label: 'Parking available', type: 'confirm', required: false, services: [] },
  { key: 'car', label: 'Car model', type: 'text', required: false, services: [] },
];
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: { webConfig: { data: { bookingFields: BookingField[] } } }) => unknown): unknown =>
    selector({ webConfig: { data: { bookingFields: CATALOG } } }),
}));

const ADDRESS = 'Herzl 12, Tel Aviv';

/** A customer's answers wherever an appointment shows (LT-178). */
describe('AnswersList', () => {
  it('renders nothing without answers', () => {
    const { container } = render(<AnswersList answers={[]} />);
    expect(container).toBeEmptyDOMElement();
    const none = render(<AnswersList />);
    expect(none.container).toBeEmptyDOMElement();
  });

  it('renders an address as a Google Maps link that opens in a new tab', () => {
    render(<AnswersList answers={[{ key: 'address', label: 'Address', value: ADDRESS }]} />);

    const link = screen.getByRole('link', { name: /Herzl 12, Tel Aviv/ });
    expect(link).toHaveAttribute(
      'href',
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('title', 'appointments.answers.openInMaps');
  });

  it('renders a ticked confirm as a tick and its label, and text as label + value', () => {
    render(
      <AnswersList
        answers={[
          { key: 'parking', label: 'Parking available', value: 'yes' },
          { key: 'car', label: 'Car model', value: 'Mazda 3' },
        ]}
      />
    );

    expect(screen.getByText('appointments.answers.title')).toBeTruthy();
    expect(screen.getByText('Parking available')).toBeTruthy();
    expect(screen.queryByText('yes')).toBeNull();
    expect(screen.getByText('Car model')).toBeTruthy();
    expect(screen.getByText('Mazda 3')).toBeTruthy();
  });

  it('shows the label the customer was actually asked, even for a deleted question', () => {
    render(<AnswersList answers={[{ key: 'gone', label: 'Old question', value: 'old answer' }]} fields={[]} />);

    expect(screen.getByText('Old question')).toBeTruthy();
    expect(screen.getByText('old answer')).toBeTruthy();
  });

  it('compact: prefers the address over the first answer, and falls back to the first answer', () => {
    const { unmount } = render(
      <AnswersList
        compact
        answers={[
          { key: 'car', label: 'Car model', value: 'Mazda 3' },
          { key: 'address', label: 'Address', value: ADDRESS },
        ]}
      />
    );
    expect(screen.getByRole('link', { name: /Herzl 12/ })).toBeTruthy();
    expect(screen.queryByText(/Mazda/)).toBeNull();
    unmount();

    render(<AnswersList compact answers={[{ key: 'car', label: 'Car model', value: 'Mazda 3' }]} />);
    expect(screen.getByTestId('answers-compact')).toHaveTextContent('Car model: Mazda 3');
  });
});
