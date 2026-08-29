import apiClient from './apiClient';
import globals from './globals';

interface ErrorReport {
    error: string;
    stack?: string;
    componentStack?: string;
    userInfo?: {
        id: string;
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
        await apiClient.post(`${globals.messagingUrl}report-error`, fullReport);
    } catch (err) {
        console.error('Failed to report error to backend:', err);
    }
};
