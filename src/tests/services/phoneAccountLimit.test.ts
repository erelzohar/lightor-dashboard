import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../../services/apiClient';
import { phoneCodeErrorKey } from '../../services/phoneCodeApi';
import { updateUserInfo } from '../../services/userApi';

/** LT-515: a number with 3 accounts is refused when it is saved, in words of its own. */
describe('a phone number that holds 3 accounts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the server`s code through the save', async () => {
    vi.spyOn(apiClient, 'put').mockRejectedValue({
      response: { status: 409, data: { error: 'full', code: 'PHONE_ACCOUNT_LIMIT' } },
    });
    await expect(updateUserInfo('u1', { phone: '+972521111111' })).rejects.toMatchObject({
      message: 'full',
      code: 'PHONE_ACCOUNT_LIMIT',
    });
  });

  it('words it, and leaves every other failure as it was', () => {
    expect(phoneCodeErrorKey(Object.assign(new Error('full'), { code: 'PHONE_ACCOUNT_LIMIT' }))).toBe('phoneInput.accountLimit');
    expect(phoneCodeErrorKey(new Error('other'))).toBe('account.phoneCode.failed');
  });
});
