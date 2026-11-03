import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LeadsTopics from '../../components/dashboard/LeadsTopics';

// The rest bucket's label in the UI language; an option spelled the same way
// (any case) is the same "other" (LT-576).
const { t } = vi.hoisted(() => ({
  t: (key: string) => (key === 'dashboard.leadsTopics.other' ? 'Divers' : key),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));

const rowTexts = () => screen.getAllByTestId('leads-topic-row').map((row) => row.textContent);

describe('LeadsTopics', () => {
  it('folds an option named like the rest label in the UI language', () => {
    render(<LeadsTopics topic={{ label: 'Q', items: [{ value: 'Bague', count: 3 }, { value: 'DIVERS', count: 2 }], other: 1 }} />);
    expect(rowTexts()).toEqual(['Bague3', 'Divers3']);
  });

  it.each(['אחר', 'Other', 'autre', 'Otro', 'أخرى'])('folds "%s"', (word) => {
    render(<LeadsTopics topic={{ label: 'Q', items: [{ value: 'A', count: 5 }, { value: word, count: 2 }], other: 0 }} />);
    expect(rowTexts()).toEqual(['A5', 'Divers2']);
  });

  it('keeps an option that only contains the word', () => {
    render(<LeadsTopics topic={{ label: 'Q', items: [{ value: 'שירות אחר', count: 2 }], other: 1 }} />);
    expect(rowTexts()).toEqual(['שירות אחר2', 'Divers1']);
  });
});
