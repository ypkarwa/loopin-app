import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../hooks/useLocation';

interface PersonInTown {
  id: string;
  name: string;
  avatar?: string;
  city: string;
  lastSeen: Date;
}

// API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [peopleInTown, setPeopleInTown] = useState<PersonInTown[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  // Fetch friends in town when location changes
  useEffect(() => {
    if (location.currentLocation?.city && user) {
      fetchFriendsInTown();
    }
  }, [location.currentLocation, user]);

  // Send location update to backend when location changes
  useEffect(() => {
    if (location.currentLocation?.city && user) {
      updateLocationOnServer();
    }
  }, [location.currentLocation]);

  const fetchFriendsInTown = async () => {
    try {
      setIsLoadingFriends(true);
      const response = await fetch(`${API_BASE_URL}/circles/in-town`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setPeopleInTown(data.friendsInTown || []);
      }
    } catch (error) {
      console.error('Error fetching friends in town:', error);
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const updateLocationOnServer = async () => {
    if (!location.currentLocation) return;

    try {
      await fetch(`${API_BASE_URL}/locations/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          city: location.currentLocation.city,
          country: location.currentLocation.country,
          isPublic: true // Ask user for permission in future
        }),
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const copyLink = async () => {
    if (user?.shareableLink) {
      try {
        await navigator.clipboard.writeText(user.shareableLink);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy link:', err);
      }
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-primary-600 rounded-full flex items-center justify-center">
              <span className="text-white text-lg font-bold">LI</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">LoopIn</h1>
              {location.currentLocation && (
                <p className="text-sm text-gray-500">
                  📍 {location.currentLocation.city}, {location.currentLocation.country}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={logout}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Location Status */}
        {location.error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-yellow-800">Location Access Needed</h3>
                <p className="text-sm text-yellow-700 mt-1">{location.error}</p>
                <button
                  onClick={location.requestPermission}
                  className="mt-2 text-sm text-yellow-800 underline hover:text-yellow-900"
                >
                  Enable Location
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Welcome Message */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Hey {user?.name}! 👋
          </h2>
          <p className="text-gray-600">
            Share your link below to add people to your circle. When you're in the same city, you'll both get notified!
          </p>
        </div>

        {/* Shareable Link */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Your LoopIn Link</h3>
          <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono text-gray-900 truncate">
                {user?.shareableLink}
              </p>
            </div>
            <button
              onClick={copyLink}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                linkCopied
                  ? 'bg-green-100 text-green-800'
                  : 'bg-primary-100 text-primary-800 hover:bg-primary-200'
              }`}
            >
              {linkCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Share this link with friends to add them to your circle
          </p>
        </div>

        {/* People in Town */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">People in Town</h3>
            {location.currentLocation && (
              <span className="text-sm text-gray-500">
                {location.currentLocation.city}
              </span>
            )}
          </div>

          {isLoadingFriends ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading friends...</p>
            </div>
          ) : peopleInTown.length > 0 ? (
            <div className="space-y-3">
              {peopleInTown.map((person) => (
                <div key={person.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="h-10 w-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {getInitials(person.name)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{person.name}</p>
                    <p className="text-xs text-gray-500">
                      In town • {formatTimeAgo(person.lastSeen)}
                    </p>
                  </div>
                  <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No one in town yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                When someone from your circle is in {location.currentLocation?.city || 'your city'}, they'll appear here!
              </p>
            </div>
          )}
        </div>

        {/* Location Tracking Status */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Location Tracking</h3>
              <p className="text-xs text-gray-500 mt-1">
                {location.isTracking ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div className={`h-3 w-3 rounded-full ${location.isTracking ? 'bg-green-400' : 'bg-gray-300'}`} />
          </div>
          {location.lastUpdate && (
            <p className="text-xs text-gray-500 mt-2">
              Last updated: {formatTimeAgo(location.lastUpdate)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 