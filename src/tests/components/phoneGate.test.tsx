import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PhoneGate from '../../components/onboarding/PhoneGate';
import { sendPhoneCode, verifyPhoneCode } from '../../services/phoneCodeApi';
import { deleteAccount } from '../../services/authApi';

/**
 * LT-500: an Apple or Google signup proves its phone before the site is
 * built: the number, a code, and the save that carries the proof.
 */
const { t, updateUser, logout } = vi.hoisted(() => ({
  t: (key: string) => key,
  updateUser: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'he' }) }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ updateUser, logout, auth: { user: { email: 'owner@example.com', googleId: 'g-1' } } }),
}));
vi.mock('../../services/authApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/authApi')>()),
  deleteAccount: vi.fn(),
}));
vi.mock('../../services/phoneCodeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/phoneCodeApi')>()),
  sendPhoneCode: vi.fn(),
  verifyPhoneCode: vi.fn(),
}));

const typePhone = (value: string) =>
  fireEvent.change(screen.getByLabelText(/onboarding\.phoneGate\.label/), { target: { value } });

const toCodeStep = async () => {
  typePhone('0541234567');
  fireEvent.click(screen.getByText('onboarding.phoneGate.send'));
  await screen.findByLabelText('account.phoneCode.label');
};

describe('PhoneGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendPhoneCode).mockResolvedValue(undefined);
    vi.mocked(verifyPhoneCode).mockResolvedValue('proof');
    updateUser.mockResolvedValue(undefined);
  });

  it('sends a code to a mobile, and saves the phone with its proof', async () => {
    render(<PhoneGate />);
    await toCodeStep();
    expect(sendPhoneCode).toHaveBeenCalledWith('+972541234567', 'sms', 'he');

    fireEvent.change(screen.getByLabelText('account.phoneCode.label'), { target: { value: '123456' } });
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ phone: '+972541234567', phoneToken: 'proof' }));
    expect(verifyPhoneCode).toHaveBeenCalledWith('+972541234567', '123456');
  });

  it('sends nothing to a number a code cannot reach', async () => {
    render(<PhoneGate />);
    typePhone('031234567');
    fireEvent.click(screen.getByText('onboarding.phoneGate.send'));
    await waitFor(() => expect(screen.getByLabelText(/onboarding\.phoneGate\.label/).getAttribute('aria-invalid')).toBe('true'));
    expect(sendPhoneCode).not.toHaveBeenCalled();
  });

  it('a wrong code stays on the step, saves nothing, and can be typed again', async () => {
    vi.mocked(verifyPhoneCode).mockRejectedValue(new Error('no'));
    render(<PhoneGate />);
    await toCodeStep();

    const input = screen.getByLabelText('account.phoneCode.label') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '000000' } });
    await screen.findByText('account.phoneCode.failed');
    expect(updateUser).not.toHaveBeenCalled();
    expect(input.value).toBe('');
    expect(input.disabled).toBe(false);
  });

  it('goes back to change the number', async () => {
    render(<PhoneGate />);
    await toCodeStep();
    fireEvent.click(screen.getByText('onboarding.phoneGate.changePhone'));
    expect(screen.getByLabelText(/onboarding\.phoneGate\.label/)).toBeTruthy();
  });

  it('holds the new code for 30 seconds', async () => {
    render(<PhoneGate />);
    await toCodeStep();
    expect(screen.queryByText('onboarding.phoneGate.whatsapp')).toBeNull();
    expect(screen.getByText('onboarding.phoneGate.resendIn')).toBeTruthy();
  });

  it('has no way on but the code, only out', () => {
    render(<PhoneGate />);
    expect(screen.queryByText(/later|skip/i)).toBeNull();
    fireEvent.click(screen.getByText('onboarding.phoneGate.logout'));
    expect(logout).toHaveBeenCalled();
  });

  // LT-634: Apple wants an account made in the app deletable in the app, and
  // a reviewer with no Israeli mobile gets no further than this step.
  it('deletes the account from here, with the proof the account page asks for', async () => {
    vi.mocked(deleteAccount).mockResolvedValue(undefined as never);
    render(
      <MemoryRouter>
        <PhoneGate />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('danger.deleteCta'));
    const dialog = screen.getByRole('dialog', { name: 'danger.modalTitle' });
    const confirm = screen.getByText('danger.modalConfirm');
    expect(confirm.closest('button')).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/danger\.confirmEmailLabel/), { target: { value: 'owner@example.com' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith({ confirmEmail: 'owner@example.com' }));
    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(dialog).toBeTruthy();
  });

  it('closes the deletion step without deleting', () => {
    render(
      <MemoryRouter>
        <PhoneGate />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('danger.deleteCta'));
    fireEvent.click(screen.getByText('common.cancel'));
    expect(screen.queryByRole('dialog', { name: 'danger.modalTitle' })).toBeNull();
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(screen.getByTestId('phone-gate')).toBeTruthy();
  });
});
