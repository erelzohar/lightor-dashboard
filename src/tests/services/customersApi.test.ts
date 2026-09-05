import { describe, it, expect, vi, afterEach } from 'vitest';
import apiClient from '../../services/apiClient';
import {
  fetchCustomers,
  fetchCustomerStats,
  fetchCustomer,
  createCustomer,
  setCustomerBlock,
  setCustomerNotes,
  exportCustomersCsv,
  isApiErrorCode,
  apiErrorStatus,
} from '../../services/customersApi';
import globals from '../../services/globals';

/**
 * The customers API client (LT-122): same contract as adminApi — cookie
 * session, legacy Bearer shim, throws on failure, list keeps the paginated
 * envelope while single-object calls unwrap `.data`.
 */
describe('customersApi', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('lists with params and keeps the paginated envelope', async () => {
    const envelope = {
      success: true,
      count: 1,
      pagination: { total: 1, page: 2, limit: 20, pages: 1 },
      data: [{ _id: 'c1', name: 'Dana' }],
    };
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: envelope } as never);

    const result = await fetchCustomers({ page: 2, search: 'dan', blocked: 'true', sort: 'visits', order: 'desc' });

    expect(result.pagination.page).toBe(2);
    expect(result.data[0].name).toBe('Dana');
    expect(get).toHaveBeenCalledWith(
      `${globals.customersUrl}`,
      expect.objectContaining({
        withCredentials: true,
        params: expect.objectContaining({ page: 2, search: 'dan', blocked: 'true', sort: 'visits', order: 'desc' }),
      })
    );
  });

  it('unwraps stats and detail, adding the Bearer shim when a token is stored', async () => {
    localStorage.setItem('lightor', 'legacy-token');
    const overview = { totals: { customers: 3 }, top: { byVisits: [], byRevenue: [] } };
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { success: true, data: overview } } as never);

    await expect(fetchCustomerStats(5)).resolves.toEqual(overview);
    expect(get).toHaveBeenCalledWith(
      `${globals.customersUrl}stats`,
      expect.objectContaining({
        params: { limit: 5 },
        headers: expect.objectContaining({ Authorization: 'Bearer legacy-token' }),
      })
    );

    const detail = { customer: { _id: 'c1' }, stats: {}, history: [] };
    get.mockResolvedValue({ data: { success: true, data: detail } } as never);
    await expect(fetchCustomer('c1')).resolves.toEqual(detail);
    expect(get).toHaveBeenLastCalledWith(`${globals.customersUrl}c1`, expect.anything());
  });

  it('sends mutations with the right verb, path and body', async () => {
    const request = vi
      .spyOn(apiClient, 'request')
      .mockResolvedValue({ data: { success: true, data: { _id: 'c1' }, cancelledCount: 2 } } as never);

    await createCustomer({ name: 'Dana', phone: '0584006014', isBlocked: true });
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'post',
        url: `${globals.customersUrl}`,
        data: { name: 'Dana', phone: '0584006014', isBlocked: true },
      })
    );

    const blocked = await setCustomerBlock('c1', { isBlocked: true, cancelUpcoming: true, reason: 'late' });
    expect(blocked.cancelledCount).toBe(2);
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'patch',
        url: `${globals.customersUrl}c1/block`,
        data: { isBlocked: true, cancelUpcoming: true, reason: 'late' },
      })
    );

    await setCustomerNotes('c1', 'hello');
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({ method: 'patch', url: `${globals.customersUrl}c1/notes`, data: { notes: 'hello' } })
    );
  });

  it('throws on failure and exposes the machine-readable code', async () => {
    const error = { response: { status: 409, data: { success: false, code: 'CUSTOMER_EXISTS', customerId: 'c9' } } };
    vi.spyOn(apiClient, 'request').mockRejectedValue(error);

    await expect(createCustomer({ name: 'x', phone: '0500000000' })).rejects.toBe(error);
    expect(isApiErrorCode(error, 'CUSTOMER_EXISTS')).toBe(true);
    expect(isApiErrorCode(error, 'CUSTOMER_BLOCKED')).toBe(false);
    expect(apiErrorStatus(error)).toBe(409);
    expect(isApiErrorCode(new Error('plain'), 'CUSTOMER_EXISTS')).toBe(false);
  });

  it('downloads the CSV as a blob through the authenticated client', async () => {
    const blob = new Blob(['a,b'], { type: 'text/csv' });
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: blob,
      headers: { 'content-disposition': 'attachment; filename="customers-2026-09-05.csv"' },
    } as never);
    const createObjectURL = vi.fn(() => 'blob:x');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await exportCustomersCsv({ blocked: 'true' });

    expect(get).toHaveBeenCalledWith(
      `${globals.customersUrl}export.csv`,
      expect.objectContaining({ responseType: 'blob', withCredentials: true, params: { blocked: 'true' } })
    );
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });
});
