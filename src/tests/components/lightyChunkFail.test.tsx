import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LightyPage from '../../pages/Lighty';
import { FloatingAiAssistant } from '../../components/ui/glowing-ai-chat-assistant';

/**
 * LT-315 (M5) — the 3D Lighty's chunk failing to load (a deploy since the
 * tab opened, a dropped connection) must not take the page down: his page
 * shows the still Lighty, the floating one keeps his still face.
 */
const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'he' } }) }));
vi.mock('../../components/lighty/Lighty3D', () => {
  throw new TypeError('Failed to fetch dynamically imported module: /assets/Lighty3D-old.js');
});
vi.mock('../../lib/haptics', () => ({ lightTick: vi.fn(), impact: vi.fn() }));
vi.mock('../../hooks/useVirtualKeyboard', () => ({ useVirtualKeyboard: () => false }));
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn(async () => null) }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown) => selector({ webConfig: { data: { conversion: 'book' } } }),
}));
vi.mock('../../services/assistantApi', () => ({
  assistantService: { chat: vi.fn(), thread: vi.fn(async () => []), clear: vi.fn() },
}));

describe('the 3D Lighty failing to load (LT-315)', () => {
  it("leaves his page standing, with the still Lighty", async () => {
    render(
      <MemoryRouter>
        <LightyPage />
      </MemoryRouter>
    );
    expect(await screen.findByTestId('lighty-still')).toBeInTheDocument();
    expect(screen.getByText('lighty.hello')).toBeInTheDocument();
  });

  it('leaves the floating Lighty with his still face', async () => {
    render(<FloatingAiAssistant onSend={vi.fn()} />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const button = screen.getByRole('button', { name: 'lighty.ask' });
    expect(button.querySelector('img[src="/lighty-avatar.webp"]')).not.toBeNull();
  });
});
