import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const AuthCallback: React.FC = () => {
  const { isLoading } = useAuth();

  useEffect(() => {
    // Check URL parameters for auth success/failure
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    
    if (authStatus === 'success') {
      // Authentication successful, redirect will happen via AuthContext
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } else if (authStatus === 'error') {
      // Authentication failed
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-16 w-16 bg-primary-600 rounded-full flex items-center justify-center shadow-lg mb-6">
          <span className="text-white text-2xl font-bold">LI</span>
        </div>
        
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Signing you in...</h2>
            <p className="text-gray-600">Please wait while we complete your authentication</p>
          </>
        ) : (
          <>
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to LoopIn!</h2>
            <p className="text-gray-600">Redirecting you to your dashboard...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback; 