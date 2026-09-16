import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store/store';
import App from './App.tsx';
import './i18n/config';
import './index.css';
import RootErrorBoundary from './components/ui/RootErrorBoundary';
import { installGlobalErrorHandlers } from './services/errorReporting';

// Uncaught exceptions and unhandled rejections outside React's render path
// (event handlers, timers, requests nobody awaited) — see errorReporting.ts.
installGlobalErrorHandlers();

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <Provider store={store}>
      <App />
    </Provider>
  </RootErrorBoundary>
);
