import { describe, it, expect, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import apiClient from '../../services/apiClient';
import globals from '../../services/globals';
import { getVacations } from '../../services/vacationsApi';
import vacationsReducer, { fetchVacations } from '../../store/slices/vacationsSlice';

/**
 * LT-626: the API lists vacations only by the site (GET /api/vacations/:webConfigId).
 * After a Lighty day-off card the dashboard asked GET /api/vacations/, which
 * answered 404 ("Failed to fetch vacations" in the console).
 */
describe("a site's vacations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads them by the site's id and unwraps the list", async () => {
    const list = [{ _id: 'v1', title: 'חופש', startDate: '1', endDate: '2', webConfig_id: 'wc1' }];
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { success: true, data: list } } as never);
    await expect(getVacations('wc1')).resolves.toEqual(list);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(`${globals.vacationsUrl}wc1`);
    expect(globals.vacationsUrl.endsWith('/api/vacations/')).toBe(true);
  });

  it('asks nothing without a site', async () => {
    const get = vi.spyOn(apiClient, 'get');
    await expect(getVacations('')).rejects.toThrow();
    expect(get).not.toHaveBeenCalled();
  });

  it('the refresh replaces the stored list with the site\'s', async () => {
    const store = configureStore({ reducer: { vacations: vacationsReducer } });
    const before = { _id: 'gone', title: 'old', startDate: '1', endDate: '2', webConfig_id: 'wc1' };
    store.dispatch({ type: 'vacations/create/fulfilled', payload: before });
    expect(store.getState().vacations.data).toEqual([before]);

    const fresh = [{ _id: 'v2', title: 'שישי', startDate: '3', endDate: '4', webConfig_id: 'wc1' }];
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { success: true, data: fresh } } as never);
    await store.dispatch(fetchVacations('wc1'));
    expect(get).toHaveBeenCalledWith(`${globals.vacationsUrl}wc1`);
    expect(store.getState().vacations).toMatchObject({ data: fresh, loading: false, error: null });
  });
});
