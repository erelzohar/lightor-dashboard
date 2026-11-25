import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PhoneCodeForm from '../../components/onboarding/PhoneCodeForm';
import { sendPhoneCode, verifyPhoneCode } from '../../services/phoneCodeApi';

/**
 * The phone and its code (LT-360), the body of the two-free-months offer
 * since LT-724 (it was the PhoneGate's, LT-500): the number, a code, and the
 * save that carries the proof.
 */
const { t, updateUser } = vi.hoisted(() => ({
  t: (key: string) => key,
  updateUser: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'he' }) }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ updateUser, auth: { user: { email: 'owner@example.com', googleId: 'g-1' } } }),
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

describe('PhoneCodeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendPhoneCode).mockResolvedValue(undefined);
    vi.mocked(verifyPhoneCode).mockResolvedValue('proof');
    updateUser.mockResolvedValue(undefined);
  });

  it('sends a code to a mobile, saves the phone with its proof, and says it is saved', async () => {
    const onSaved = vi.fn();
    render(<PhoneCodeForm onSaved={onSaved} />);
    await toCodeStep();
    expect(sendPhoneCode).toHaveBeenCalledWith('+972541234567', 'sms', 'he');
    expect(screen.getByText('account.phoneCode.sent')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('account.phoneCode.label'), { target: { value: '123456' } });
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ phone: '+972541234567', phoneToken: 'proof' }));
    expect(verifyPhoneCode).toHaveBeenCalledWith('+972541234567', '123456');
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('sends nothing to a number a code cannot reach', async () => {
    render(<PhoneCodeForm />);
    typePhone('031234567');
    fireEvent.click(screen.getByText('onboarding.phoneGate.send'));
    await waitFor(() => expect(screen.getByLabelText(/onboarding\.phoneGate\.label/).getAttribute('aria-invalid')).toBe('true'));
    expect(sendPhoneCode).not.toHaveBeenCalled();
  });

  it('a wrong code stays on the step, saves nothing, and can be typed again', async () => {
    vi.mocked(verifyPhoneCode).mockRejectedValue(new Error('no'));
    const onSaved = vi.fn();
    render(<PhoneCodeForm onSaved={onSaved} />);
    await toCodeStep();

    const input = screen.getByLabelText('account.phoneCode.label') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '000000' } });
    await screen.findByText('account.phoneCode.failed');
    expect(updateUser).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(input.value).toBe('');
    expect(input.disabled).toBe(false);
  });

  it("says the server's refusal of the save and stays on the step", async () => {
    updateUser.mockRejectedValue({ response: { status: 400, data: { code: 'PHONE_NOT_VERIFIED' } } });
    const onSaved = vi.fn();
    render(<PhoneCodeForm onSaved={onSaved} />);
    await toCodeStep();
    fireEvent.change(screen.getByLabelText('account.phoneCode.label'), { target: { value: '123456' } });
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByLabelText('account.phoneCode.label')).toBeTruthy();
  });

  it('goes back to change the number', async () => {
    render(<PhoneCodeForm />);
    await toCodeStep();
    fireEvent.click(screen.getByText('onboarding.phoneGate.changePhone'));
    expect(screen.getByLabelText(/onboarding\.phoneGate\.label/)).toBeTruthy();
  });

  it('holds the new code for 30 seconds', async () => {
    render(<PhoneCodeForm />);
    await toCodeStep();
    expect(screen.queryByText('onboarding.phoneGate.whatsapp')).toBeNull();
    expect(screen.getByText('onboarding.phoneGate.resendIn')).toBeTruthy();
  });

  it('has no way out of the account in it: the offer around it has its own "later"', () => {
    render(<PhoneCodeForm />);
    expect(screen.queryByText('onboarding.phoneGate.logout')).toBeNull();
    expect(screen.queryByText('danger.deleteCta')).toBeNull();
  });
});
