import axios from 'axios';
import globals from './globals';

const api = axios.create({
    baseURL: globals.messagingUrl,
});

// Add request interceptor to include the token with each request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('ezlines');

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
