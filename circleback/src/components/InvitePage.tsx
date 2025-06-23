import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getApiBaseUrl } from '../utils/platform';

interface InviteUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  shareableLink: string;
}

const API_BASE_URL = getApiBaseUrl();

const InvitePage: React.FC = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [inviteUser, setInviteUser] = useState<InviteUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    if (inviteCode) {
      fetchInviteUser();
    }
  }, [inviteCode]);

  const fetchInviteUser = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/users/by-link/${inviteCode}`);
      
      if (response.ok) {
        const data = await response.json();
        setInviteUser(data.user);
      } else {
        setError('Invalid or expired invite link');
      }
    } catch (error) {
      console.error('Error fetching invite user:', error);
      setError('Failed to load invite. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async () => {
    if (!isAuthenticated) {
      // Store the invite code and redirect to login
      localStorage.setItem('pendingInvite', inviteCode || '');
      navigate('/');
      return;
    }

    if (!inviteUser) return;

    try {
      setSendingRequest(true);
      const token = localStorage.getItem('jwt_token');
      
      const response = await fetch(`${API_BASE_URL}/circles/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shareableLink: inviteCode
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setRequestSent(true);
      } else {
        setError(data.error || 'Failed to send friend request');
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      setError('Failed to send friend request. Please try again.');
    } finally {
      setSendingRequest(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Invite</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Go to LoopIn
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (requestSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Request Sent!</h2>
            <p className="text-gray-600 mb-6">
              Your friend request has been sent to <strong>{inviteUser?.name}</strong>. 
              They'll be notified and can accept your request.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="max-w-md mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="h-12 w-12 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-white text-lg font-bold">LI</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Join LoopIn</h1>
            <p className="text-gray-600 text-sm mt-1">You've been invited to connect!</p>
          </div>

          {/* Invite User Profile */}
          {inviteUser && (
            <div className="text-center mb-8">
              <div className="h-20 w-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-xl font-bold">
                  {getInitials(inviteUser.name)}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{inviteUser.name}</h2>
              <p className="text-gray-600 text-sm">{inviteUser.email}</p>
              <p className="text-primary-600 text-sm mt-2">wants to add you to their circle</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-4">
            {isAuthenticated ? (
              <>
                <button
                  onClick={sendFriendRequest}
                  disabled={sendingRequest}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                    sendingRequest
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {sendingRequest ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Sending Request...</span>
                    </div>
                  ) : (
                    'Send Friend Request'
                  )}
                </button>
                <p className="text-xs text-gray-500 text-center">
                  Signed in as {user?.name}
                </p>
              </>
            ) : (
              <>
                <button
                  onClick={sendFriendRequest}
                  className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  Sign in to Send Request
                </button>
                <p className="text-xs text-gray-500 text-center">
                  You'll be redirected to sign in, then automatically sent back here
                </p>
              </>
            )}
          </div>

          {/* App Info */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-center">
              <h3 className="text-sm font-medium text-gray-900 mb-2">About LoopIn</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Stay connected with friends and know when they're in town. 
                Share your location privately with your circle and never miss a chance to meet up!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvitePage; 