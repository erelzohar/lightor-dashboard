import React, { Component, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';


import { reportClientError } from '../../services/errorReporting';
import { useAuth } from '../../contexts/AuthContext';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// Create a wrapper component to access the language context and auth
const ErrorBoundaryWithLanguage: React.FC<ErrorBoundaryProps> = (props) => {
  const { language } = useTheme();
  const { auth } = useAuth();
  const lang: 'en' | 'he' = language === 'he' ? 'he' : 'en';
  return <ErrorBoundaryClass {...props} language={lang} user={auth.user} />;
};

class ErrorBoundaryClass extends Component<
  ErrorBoundaryProps & { language: 'en' | 'he'; user: any },
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps & { language: 'en' | 'he'; user: any }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ error, errorInfo });

    // Report to the backend (LT-170). The reporter itself is production-only
    // and de-duplicates, so a page that throws on every render is one email.
    const { user } = this.props;
    void reportClientError({
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack ?? undefined,
      userInfo: user ? { id: String(user._id), email: user.email || user.mail } : undefined,
      kind: 'boundary',
    });
  }

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { fallback, children, language } = this.props;

    const translations = {
      en: {
        title: 'Something went wrong...',
        description: 'If the problem persists, please contact support at',
        stackTrace: 'Stack trace',
        reload: 'Reload',
        supportEmail: 'lightorapp@gmail.com'
      },
      he: {
        title: 'משהו השתבש...',
        description: 'אם הבעיה נמשכת, אנא צור קשר עם התמיכה בכתובת',
        stackTrace: 'מעקב שגיאה',
        reload: 'טעינה מחדש',
        supportEmail: 'lightorapp@gmail.com'
      }
    };

    const t = translations[language];

    if (hasError) {
      return (
        fallback || (
          <div className="min-h-[25rem] flex items-center justify-center p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center text-center max-w-md"
            >
              {/* <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, -5, 5, -5, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut"
                }}
                className="w-32 h-32 mb-6"
              >
                <img 
                  src="https://raw.githubusercontent.com/stackblitz/stackblitz-icons/main/broken-ice-cream.png" 
                  alt="Error illustration"
                  className="w-full h-full object-contain"
                />
              </motion.div> */}
              <h2 className="text-2xl font-heading font-semibold text-light-text dark:text-dark-text mb-3">
                {t.title}
              </h2>
              {/* A way out (LT-170): the page used to leave the owner staring
                  at the title with nothing to press. */}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-2 px-6 py-2.5 rounded-full border border-light-text/30 dark:border-dark-text/30 text-light-text dark:text-dark-text font-semibold hover:bg-light-text/5 dark:hover:bg-dark-text/5 transition-colors"
              >
                {t.reload}
              </button>
              {/* <p className="text-light-text/80 dark:text-dark-text/80 mb-4">
                {t.description}
              </p>
              <a
                href={`mailto:${t.supportEmail}`}
                className="text-primary dark:text-primary-dark hover:underline"
              >
                {t.supportEmail}
              </a> */}

              {process.env.NODE_ENV === "development" && (
                <div className="mt-8 w-full">
                  {error && (
                    <div className="p-4 bg-red-500/5 rounded-lg text-left mb-4">
                      <p className="text-red-500 font-mono text-sm">{error.toString()}</p>
                    </div>
                  )}
                  {errorInfo && (
                    <details className="text-left">
                      <summary className="text-light-text/60 dark:text-dark-text/60 cursor-pointer mb-2">
                        {t.stackTrace}
                      </summary>
                      <pre className="p-4 bg-light-surface dark:bg-dark-surface rounded-lg overflow-auto text-xs font-mono text-light-text/70 dark:text-dark-text/70">
                        {errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )
      );
    }

    return children;
  }
}

export default ErrorBoundaryWithLanguage;