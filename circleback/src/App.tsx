import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { App as CapacitorApp } from '@capacitor/app';
import { isNative } from './utils/platform';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AuthCallback from './components/AuthCallback';
import InvitePage from './components/InvitePage';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading LoopIn...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/invite/:inviteCode" element={<InvitePage />} />
      <Route path="/" element={isAuthenticated ? <Dashboard /> : <Login />} />
    </Routes>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    // Mobile-specific initialization
    if (isNative()) {
      // Handle app state changes
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        console.log('App state changed. Is active?', isActive);
      });

      // Handle back button on Android
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) {
          CapacitorApp.exitApp();
        } else {
          window.history.back();
        }
      });

      // Handle deep links
      CapacitorApp.addListener('appUrlOpen', (event) => {
        console.log('App opened via URL:', event.url);
        // Handle invite links when app is opened from external link
        const url = new URL(event.url);
        if (url.pathname.includes('/invite/')) {
          const inviteCode = url.pathname.split('/invite/')[1];
          window.location.href = `/invite/${inviteCode}`;
        }
      });
    }

    return () => {
      if (isNative()) {
        CapacitorApp.removeAllListeners();
      }
    };
  }, []);

  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <AppContent />
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;
