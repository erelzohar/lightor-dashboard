import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignInCard } from '../../components/ui/sign-in-card-2';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { dir: () => 'ltr' } }),
}));

/**
 * LT-398 — Erel: logged out within the hour without "remember me" (a plain
 * login is a 60-minute session). The box is ticked from the start.
 */
describe('sign-in card "remember me"', () => {
  const renderCard = (onSubmit = vi.fn(async () => {})) => {
    render(
      <MemoryRouter>
        <SignInCard onSubmit={onSubmit} onGoogleLogin={() => {}} onFacebookLogin={() => {}} />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByPlaceholderText('login.enterEmail'), { target: { value: 'jane@biz.com' } });
    fireEvent.change(screen.getByPlaceholderText('login.enterPassword'), { target: { value: 'secret' } });
    return onSubmit;
  };
  const submit = () => fireEvent.submit(screen.getByPlaceholderText('login.enterEmail').closest('form')!);

  it('is ticked from the start, and a login asks for the long session', async () => {
    const onSubmit = renderCard();
    expect(screen.getByLabelText('login.rememberMe')).toBeChecked();
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('jane@biz.com', 'secret', true));
  });

  it('can still be unticked for a short session', async () => {
    const onSubmit = renderCard();
    fireEvent.click(screen.getByLabelText('login.rememberMe'));
    expect(screen.getByLabelText('login.rememberMe')).not.toBeChecked();
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('jane@biz.com', 'secret', false));
  });
});
