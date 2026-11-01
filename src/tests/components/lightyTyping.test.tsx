import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LightyTyping } from '../../components/lighty/LightyChat';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

/** LT-524 — Lighty thinking is a line of words with a light over it, not dots. */
describe('LightyTyping', () => {
  it('says he is thinking in words a screen reader hears', () => {
    render(<LightyTyping />);
    const line = screen.getByRole('status');
    expect(line).toHaveTextContent('lighty.thinking');
    expect(line).toHaveClass('thinking-shimmer');
    expect(document.querySelector('.animate-bounce')).toBeNull();
  });
});
