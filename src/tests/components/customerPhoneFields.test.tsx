import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddCustomerModal from '../../components/customers/AddCustomerModal';
import UserFormModal from '../../components/admin/UserFormModal';
import { createCustomer } from '../../services/customersApi';
import { createUser } from '../../services/adminApi';
import { updateUserInfo } from '../../services/userApi';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../services/customersApi', () => ({ createCustomer: vi.fn(async () => ({ _id: 'c1' })), isApiErrorCode: () => false }));
vi.mock('../../services/adminApi', () => ({ createUser: vi.fn(async () => ({ _id: 'u9' })) }));
vi.mock('../../services/userApi', () => ({ updateUserInfo: vi.fn(async () => ({ _id: 'u9' })) }));

/**
 * LT-407 — Erel: the customers' and the admin's phone fields too. A
 * customer's phone is any valid number: Israeli, or with its country code
 * for a business abroad (only Israeli mobiles get texts);
 * an owner's, set by the operator, an Israeli mobile or nothing. Sent in E.164.
 */
beforeEach(() => vi.clearAllMocks());

describe("the owner's new customer", () => {
  const renderIt = () => render(<AddCustomerModal open onClose={vi.fn()} onSaved={vi.fn()} onExists={vi.fn()} />);
  const fill = (phone: string) => {
    fireEvent.change(screen.getByLabelText('customers.add.name'), { target: { value: 'Noa' } });
    fireEvent.change(screen.getByLabelText(/customers\.add\.phone/), { target: { value: phone } });
    fireEvent.submit(screen.getByLabelText('customers.add.name').closest('form')!);
  };

  it('refuses what is no number, and says so', async () => {
    renderIt();
    fill('12345');
    expect(await screen.findByText('phoneInput.invalidWorld')).toBeInTheDocument();
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it("takes a number abroad with its country code (a business abroad's customer)", async () => {
    renderIt();
    fill('+1 212 555 0101');
    await waitFor(() => expect(createCustomer).toHaveBeenCalledWith(expect.objectContaining({ phone: '+12125550101' })));
  });

  it('takes a landline, sent in E.164', async () => {
    renderIt();
    fill('03-612 3456');
    await waitFor(() => expect(createCustomer).toHaveBeenCalledWith(expect.objectContaining({ phone: '+97236123456' })));
  });
});

describe("the operator's user form", () => {
  const renderIt = (mode: 'create' | 'edit' = 'create') =>
    render(
      <UserFormModal
        open
        mode={mode}
        user={mode === 'edit' ? { _id: 'u9', name: 'Dana', email: 'd@b.co', phone: '0501234567', defaultLanguage: 'he', channelType: 'sms' } as never : undefined}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
  const submit = () => fireEvent.click(screen.getByText(/admin\.userForm\.(create|save)/));

  it('refuses a landline for an owner, and an empty phone is fine', async () => {
    renderIt();
    fireEvent.change(screen.getByLabelText('admin.userForm.name'), { target: { value: 'Dana' } });
    fireEvent.change(screen.getByLabelText('admin.userForm.email'), { target: { value: 'd@b.co' } });
    fireEvent.change(screen.getByLabelText('admin.userForm.password'), { target: { value: 'abc123' } });
    fireEvent.change(screen.getByLabelText(/admin\.userForm\.phone/), { target: { value: '03-6123456' } });
    submit();
    expect(await screen.findByText('phoneInput.invalidMobile')).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/admin\.userForm\.phone/), { target: { value: '' } });
    submit();
    await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createUser).mock.calls[0][0]).not.toHaveProperty('phone');
  });

  it("sends an owner's stored local number in E.164", async () => {
    renderIt('edit');
    submit();
    await waitFor(() => expect(updateUserInfo).toHaveBeenCalledWith('u9', expect.objectContaining({ phone: '+972501234567' })));
  });
});
