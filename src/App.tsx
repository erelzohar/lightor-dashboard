import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Context
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Settings from './pages/Settings';
import AppointmentTypes from './pages/AppointmentTypes';
import Account from './pages/Account';
import Portfolio from './pages/Portfolio';
import AiBuilder from './pages/AiBuilder';

// Components
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ScheduleVacations from './pages/ScheduleVacations';
import VerifyEmail from './pages/VerifyEmail';
import ErrorBoundaryWithLanguage from './components/ui/ErrorBoundary';

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <Toaster position="top-center" />
            <AnimatePresence mode="wait">
              <ErrorBoundaryWithLanguage>
                <Routes>
                  <Route path="/" element={<Login />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/verify" element={<VerifyEmail />} />
                  <Route path="/verify/:token" element={<VerifyEmail />} />
                  <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route index element={<Dashboard />} />
                    <Route path="appointments" element={<Appointments />} />
                    <Route path="schedule-vacations" element={<ScheduleVacations />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="appointment-types" element={<AppointmentTypes />} />
                    <Route path="account" element={<Account />} />
                    <Route path="portfolio" element={<Portfolio />} />
                    <Route path="ai" element={<AiBuilder />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </ErrorBoundaryWithLanguage>
            </AnimatePresence>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;