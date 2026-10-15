import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LightyTyped, revealMarkdown, typewriterConfig } from '../../components/lighty/LightyTyped';

/** LT-271 — Lighty writes his answers out, never showing broken markdown. */
describe('revealMarkdown', () => {
  const text = 'Hi **two bookings** - see [the calendar](/appointments) now';

  it('is a plain prefix outside any token, and the whole text at the end', () => {
    expect(revealMarkdown(text, 3)).toBe('Hi ');
    expect(revealMarkdown(text, text.length)).toBe(text);
    expect(revealMarkdown(text, 999)).toBe(text);
    expect(revealMarkdown(text, 0)).toBe('');
  });

  it('closes half-typed bold instead of showing the asterisks', () => {
    expect(revealMarkdown(text, 4)).toBe('Hi '); // only the opening "*"
    expect(revealMarkdown(text, 9)).toBe('Hi **two **');
  });

  it('shows a link (an in-app button) only once it is whole', () => {
    const at = text.indexOf('[');
    const end = text.indexOf(')') + 1;
    for (let n = at + 1; n < end; n++) expect(revealMarkdown(text, n)).toBe(text.slice(0, at));
    expect(revealMarkdown(text, end)).toBe(text.slice(0, end));
  });

  it('handles a link inside bold', () => {
    const t = '**[the hours](/schedule-vacations) today**';
    expect(revealMarkdown(t, 6)).toBe(''); // inside the link inside the bold
    expect(revealMarkdown(t, t.indexOf(')') + 1)).toBe('**[the hours](/schedule-vacations)**');
  });
});

describe('LightyTyped', () => {
  const answer = 'You have **two bookings** tomorrow, at 10:00 and at 12:30.';
  const shownText = (container: HTMLElement) =>
    (container.querySelector('[aria-hidden="true"]') ?? container).textContent ?? '';

  beforeEach(() => {
    typewriterConfig.enabled = true;
  });
  afterEach(() => {
    typewriterConfig.enabled = false;
    vi.unstubAllGlobals();
  });

  it('types a fresh answer out, then shows it whole', async () => {
    const onType = vi.fn();
    const { container } = render(<MemoryRouter><LightyTyped text={answer} animate onType={onType} /></MemoryRouter>);
    // Screen readers get it once, whole, while it types.
    expect(container.querySelector('.sr-only')?.textContent).toBe(answer);
    await waitFor(() => expect(shownText(container).length).toBeGreaterThan(0));
    expect(shownText(container).length).toBeLessThan('You have two bookings tomorrow, at 10:00 and at 12:30.'.length);
    expect(shownText(container)).not.toContain('*');
    await waitFor(() => expect(container.querySelector('.sr-only')).toBeNull(), { timeout: 3000 });
    expect(screen.getByText('two bookings').tagName).toBe('STRONG');
    expect(onType).toHaveBeenCalled();
  });

  it('shows an older answer whole', () => {
    const { container } = render(<MemoryRouter><LightyTyped text={answer} animate={false} /></MemoryRouter>);
    expect(container.querySelector('.sr-only')).toBeNull();
    expect(screen.getByText('two bookings')).toBeInTheDocument();
  });

  it('shows it whole under reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    const { container } = render(<LightyTyped plain text="Done." animate />);
    expect(container.textContent).toBe('Done.');
  });
});
