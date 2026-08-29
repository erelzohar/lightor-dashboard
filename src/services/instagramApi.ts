import apiClient from './apiClient';
import globals from './globals';

/**
 * Exchange an Instagram Login authorization code for a short-lived Graph
 * token (LT-043). The exchange itself happens server-side because it needs
 * the app secret; the token comes straight back here and lives only in the
 * portfolio page's state, exactly like the Facebook-route token.
 */
export const exchangeInstagramCode = async (
    code: string,
    redirectUri: string
): Promise<{ accessToken: string; userId: string }> => {
    const res = await apiClient.post(`${globals.instagramUrl}oauth/exchange`, { code, redirectUri });
    return res.data.data;
};
