import axios from 'axios';
import globals from './globals';
import { install401Handler } from './authInterceptor';

const api = axios.create({
    baseURL: globals.instagramUrl,
    withCredentials: true,
});
install401Handler(api);

// LT-009 transition shim, same as the other services — delete 2027-02.
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('lightor');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

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
    const res = await api.post('/oauth/exchange', { code, redirectUri });
    return res.data.data;
};
