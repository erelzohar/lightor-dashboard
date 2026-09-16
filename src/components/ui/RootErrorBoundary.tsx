import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientError } from '../../services/errorReporting';

/**
 * The outermost error boundary (LT-170), mounted above the Redux provider
 * and every context in main.tsx. The boundary inside App.tsx covers the
 * routes; this one is for what it cannot reach — a provider, the router,
 * the auth or theme context — where a throw otherwise leaves the owner a
 * white page (or a frozen native app) and the operator nothing.
 *
 * It deliberately depends on nothing: no context, no theme, no i18n, no
 * Tailwind (whichever of those failed may be the reason we are here). Copy
 * is inline, colours are the browser's own system colours so dark mode
 * still works, and the language is read from <html lang>, which i18next
 * sets before anything can throw.
 */

const COPY = {
  en: { title: 'Something went wrong', body: 'Reloading usually fixes it. If it keeps happening, write to', reload: 'Reload' },
  he: { title: 'משהו השתבש', body: 'טעינה מחדש בדרך כלל פותרת את זה. אם זה חוזר, כתבו לנו ל-', reload: 'טעינה מחדש' },
  ar: { title: 'حدث خطأ ما', body: 'عادةً ما تحل إعادة التحميل المشكلة. إذا تكررت، راسلنا على', reload: 'إعادة التحميل' },
  fr: { title: 'Une erreur est survenue', body: 'Recharger règle généralement le problème. Si cela persiste, écrivez à', reload: 'Recharger' },
  es: { title: 'Algo salió mal', body: 'Recargar suele resolverlo. Si se repite, escríbenos a', reload: 'Recargar' },
} as const;

type Lang = keyof typeof COPY;
const RTL: ReadonlySet<Lang> = new Set<Lang>(['he', 'ar']);
const SUPPORT_EMAIL = 'lightorapp@gmail.com';

const pickLanguage = (): Lang => {
  const raw = (document.documentElement.lang || navigator.language || 'en').slice(0, 2).toLowerCase();
  return raw in COPY ? (raw as Lang) : 'en';
};

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void reportClientError({
      error: error.message ? `${error.name}: ${error.message}` : error.name,
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
      kind: 'boundary',
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    const lang = pickLanguage();
    const t = COPY[lang];
    return (
      <div
        role="alert"
        dir={RTL.has(lang) ? 'rtl' : 'ltr'}
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'calc(env(safe-area-inset-top) + 2rem) 1rem calc(env(safe-area-inset-bottom) + 2rem)',
          background: 'Canvas',
          color: 'CanvasText',
          colorScheme: 'light dark',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '28rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 0.75rem' }}>{t.title}</h1>
          <p style={{ margin: '0 0 1.5rem', lineHeight: 1.6, opacity: 0.8 }}>
            {t.body}{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'inherit' }}>
              {SUPPORT_EMAIL}
            </a>
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '0.75rem 1.75rem',
              borderRadius: '9999px',
              border: '1px solid currentColor',
              background: 'transparent',
              color: 'inherit',
              font: 'inherit',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t.reload}
          </button>
        </div>
      </div>
    );
  }
}
