import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';

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

// Components
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ScheduleVacations from './pages/ScheduleVacations';
import ErrorBoundaryWithLanguage from './components/ui/ErrorBoundary';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Toaster position="top-center" />
          <AnimatePresence mode="wait">
            <ErrorBoundaryWithLanguage>
              <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                  <Route index element={<Dashboard />} />
                  <Route path="appointments" element={<Appointments />} />
                  <Route path="schedule-vacations" element={<ScheduleVacations />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="appointment-types" element={<AppointmentTypes />} />
                  <Route path="account" element={<Account />} />
                  <Route path="portfolio" element={<Portfolio />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ErrorBoundaryWithLanguage>
          </AnimatePresence>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;