import React from 'react';
import { AlertCircle } from 'lucide-react';
import Card from '../ui/Card';

interface DashboardFallbackProps {
    language: 'en' | 'he';
    title?: string;
}

const DashboardFallback: React.FC<DashboardFallbackProps> = ({ language, title }) => {
    const translations = {
        en: {
            error: 'Error loading component',
            retry: 'The system has been notified.',
        },
        he: {
            error: 'שגיאה בטעינת הרכיב',
            retry: 'המערכת קיבלה דיווח על השגיאה.',
        }
    };

    const t = translations[language];

    return (
        <Card className="h-full flex flex-col items-center justify-center py-8 opacity-80">
            <AlertCircle className="w-8 h-8 text-red-500 mb-3" />
            <h4 className="font-semibold text-gray-800 dark:text-white mb-1">
                {title || t.error}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                {t.retry}
            </p>
        </Card>
    );
};

export default DashboardFallback;
