import axios from 'axios';
import globals from './globals';

const api = axios.create({
    baseURL: globals.messagingUrl,
    withCredentials: true,
});

// LT-009: the session now rides an HttpOnly cookie (withCredentials). This
// Bearer interceptor is a transition shim for sessions that predate the
// cookie — AuthContext migrates them at startup and clears localStorage, so
// this finds nothing on any session created after LT-009. Delete it (and the
// other copies of it) once pre-cookie tokens have aged out: 2027-02.
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('lightor');

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

interface ErrorReport {
    error: string;
    stack?: string;
    componentStack?: string;
    userInfo?: {
        id: string;
        username: string;
        email: string;
    };
    url: string;
    userAgent: string;
    timestamp: string;
}

export const reportError = async (errorReport: Partial<ErrorReport> & { error: string }): Promise<void> => {
    try {
        const fullReport: ErrorReport = {
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            ...errorReport,
        };
        await api.post('/report-error', fullReport);
    } catch (err) {
        console.error('Failed to report error to backend:', err);
    }
};
