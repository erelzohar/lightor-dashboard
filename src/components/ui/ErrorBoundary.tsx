import React, { Component, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';


import { reportError } from '../../services/messagingApi';
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
  return <ErrorBoundaryClass {...props} language={language} user={auth.user} />;
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

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ error, errorInfo });

    // Report error to backend
    const { user } = this.props;
    reportError({
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      userInfo: user ? {
        id: user._id,
        username: user.username,
        email: user.email || user.mail,
      } : undefined,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
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
        supportEmail: 'ezwebsisr@gmail.com'
      },
      he: {
        title: 'משהו השתבש...',
        description: 'אם הבעיה נמשכת, אנא צור קשר עם התמיכה בכתובת',
        stackTrace: 'מעקב שגיאה',
        supportEmail: 'ezwebsisr@gmail.com'
      }
    };

    const t = translations[language];

    if (hasError) {
      return (
        fallback || (
          <div className="min-h-[400px] flex items-center justify-center p-8">
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