import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Instagram Login popup landing (LT-043).
 *
 * Instagram redirects the OAuth popup here with `?code=...&state=...` (or
 * `?error=...` on refusal). The page's only job is to relay those params to
 * the portfolio page that opened the popup — postMessage pinned to our own
 * origin, never `*` (LT-008) — and close itself. The code is single-use and
 * worthless without the app secret, which never leaves the server.
 */
const InstagramCallback: React.FC = () => {
    const { t } = useTranslation();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        window.opener?.postMessage(
            {
                type: 'ig-oauth',
                code: params.get('code') ?? undefined,
                state: params.get('state') ?? undefined,
                error: params.get('error') ?? undefined,
            },
            window.location.origin
        );
        window.close();
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-screen gap-3 text-gray-500 dark:text-gray-400">
            <Loader2 className="animate-spin text-primary" />
            <p className="text-sm">{t('igImport.completing')}</p>
        </div>
    );
};

export default InstagramCallback;
