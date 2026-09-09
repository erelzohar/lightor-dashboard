import { describe, it, expect, vi, afterEach } from 'vitest';
import apiClient from '../../services/apiClient';
import { fetchLogFiles, fetchLogs, clearLogFile } from '../../services/adminApi';
import globals from '../../services/globals';

/** The server-log client (LT-153) — same contract as the rest of adminApi. */
describe('adminApi server logs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('lists files and unwraps the envelope', async () => {
    const files = [{ key: 'combined', filename: 'combined.log', clearable: true, size: 10, rotatedFiles: 0, rotatedSize: 0, modified: null as string | null }];
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { success: true, data: files } } as never);

    await expect(fetchLogFiles()).resolves.toEqual(files);
    expect(get).toHaveBeenCalledWith(`${globals.adminUrl}logs/files`, expect.objectContaining({ withCredentials: true }));
  });

  it('passes the filters through as query params and keeps the page envelope', async () => {
    const page = {
      success: true, count: 1, pagination: { total: 1, page: 1, limit: 100, pages: 1 },
      truncated: false, levels: ['error', 'info'], file: 'error', data: [{ line: 1, timestamp: null as string | null, level: 'error', message: 'boom', meta: {}, raw: '{}' }],
    };
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: page } as never);

    const result = await fetchLogs({ file: 'error', level: 'error', q: 'boom', page: 1, limit: 100 });
    expect(result.levels).toEqual(['error', 'info']);
    expect(get).toHaveBeenCalledWith(
      `${globals.adminUrl}logs`,
      expect.objectContaining({ params: expect.objectContaining({ file: 'error', level: 'error', q: 'boom' }) })
    );
  });

  it('clears by POSTing the file key', async () => {
    const request = vi
      .spyOn(apiClient, 'request')
      .mockResolvedValue({ data: { success: true, data: { file: 'combined', freedBytes: 512, removedRotated: 2 } } } as never);

    await expect(clearLogFile('combined')).resolves.toEqual({ file: 'combined', freedBytes: 512, removedRotated: 2 });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'post', url: `${globals.adminUrl}logs/combined/clear` })
    );
  });
});
