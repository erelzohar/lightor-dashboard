import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddCustomerModal from '../../components/customers/AddCustomerModal';
import UserFormModal from '../../components/admin/UserFormModal';
import { createCustomer } from '../../services/customersApi';
import { createUser } from '../../services/adminApi';
import { resetPhoneCountries, setOpenAbroad, setOwnerPhone } from '../../services/phoneCountries';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../services/customersApi', () => ({ createCustomer: vi.fn(async () => ({ _id: 'c1' })), isApiErrorCode: () => false }));
vi.mock('../../services/adminApi', () => ({ createUser: vi.fn(async () => ({ _id: 'u9' })) }));
vi.mock('../../services/userApi', () => ({ updateUserInfo: vi.fn(async () => ({ _id: 'u9' })) }));

/**
 * LT-677: the customers' and the operator's phone fields once a country is
 * open abroad. A customer's phone is still any valid number; the chip only
 * says where a number written locally is read, and starts on the country of
 * the owner's own phone. An owner's phone, set by the operator with no code,
 * may be a number of the open country.
 */
beforeEach(() => vi.clearAllMocks());
afterEach(() => resetPhoneCountries());

describe("the owner's new customer, abroad", () => {
  const renderIt = () => render(<AddCustomerModal open onClose={vi.fn()} onSaved={vi.fn()} onExists={vi.fn()} />);
  const fill = (phone: string) => {
    fireEvent.change(screen.getByLabelText('customers.add.name'), { target: { value: 'Noa' } });
    fireEvent.change(screen.getByLabelText(/customers\.add\.phone/), { target: { value: phone } });
    fireEvent.submit(screen.getByLabelText('customers.add.name').closest('form')!);
  };

  it('keeps the Israeli hint and chip while only Israel is offered', () => {
    renderIt();
    expect(screen.getByText('customers.add.phoneHint')).toBeInTheDocument();
    expect(screen.queryByTestId('phone-country')).toBeNull();
  });

  it("reads a local number in the country of the owner's own phone", async () => {
    setOpenAbroad(['US']);
    setOwnerPhone('+12125550123');
    renderIt();
    expect(screen.getByTestId('phone-country')).toHaveAttribute('data-country', 'US');
    expect(screen.getByText('customers.add.phoneHintCountries')).toBeInTheDocument();
    fill('(310) 555-0199');
    await waitFor(() => expect(createCustomer).toHaveBeenCalledWith(expect.objectContaining({ phone: '+13105550199' })));
  });

  it('still takes any number with its country code, and an Israeli one under the Israeli chip', async () => {
    setOpenAbroad(['US']);
    setOwnerPhone('+972501234567');
    const { unmount } = renderIt();
    expect(screen.getByTestId('phone-country')).toHaveAttribute('data-country', 'IL');
    fill('03-612 3456');
    await waitFor(() => expect(createCustomer).toHaveBeenCalledWith(expect.objectContaining({ phone: '+97236123456' })));
    unmount();

    renderIt();
    fill('+44 20 7946 0958');
    await waitFor(() => expect(createCustomer).toHaveBeenLastCalledWith(expect.objectContaining({ phone: '+442079460958' })));
  });

  it('refuses half a local number under the chip abroad, and says so', async () => {
    setOpenAbroad(['US']);
    setOwnerPhone('+12125550123');
    renderIt();
    // Eight digits that would be a Jerusalem landline if read as Israeli.
    fill('21255501');
    expect(await screen.findByText('phoneInput.invalidWorldAbroad')).toBeInTheDocument();
    expect(createCustomer).not.toHaveBeenCalled();
  });
});

describe("the operator's user form, abroad", () => {
  const renderIt = () => render(<UserFormModal open mode="create" onClose={vi.fn()} onSaved={vi.fn()} />);
  const fill = (phone: string) => {
    fireEvent.change(screen.getByLabelText('admin.userForm.name'), { target: { value: 'Dana' } });
    fireEvent.change(screen.getByLabelText('admin.userForm.email'), { target: { value: 'd@b.co' } });
    fireEvent.change(screen.getByLabelText('admin.userForm.password'), { target: { value: 'abc123' } });
    fireEvent.change(screen.getByLabelText(/admin\.userForm\.phone/), { target: { value: phone } });
    fireEvent.click(screen.getByText(/admin\.userForm\.(create|save)/));
  };

  it('refuses a number abroad for an owner while only Israel is offered, as before', async () => {
    renderIt();
    fill('+1 212 555 0123');
    expect(await screen.findByText('phoneInput.invalidMobile')).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();
  });

  it('sets an owner a number of the open country, in E.164, with no code', async () => {
    setOpenAbroad(['US']);
    renderIt();
    fill('+1 212 555 0123');
    await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createUser).mock.calls[0][0]).toMatchObject({ phone: '+12125550123' });
  });

  it('still refuses a Canadian number and an Israeli landline', async () => {
    setOpenAbroad(['US']);
    renderIt();
    fill('+1 416 555 0123');
    expect(await screen.findByText('phoneInput.invalidAbroad')).toBeInTheDocument();
    fill('+972 3 612 3456');
    expect(await screen.findByText('phoneInput.invalidMobile')).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();
  });
});
