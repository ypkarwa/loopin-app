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

interface FriendRequest {
  id: string;
  from: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  requestedAt: Date;
  connectionMethod: string;
}

interface Friend {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  currentLocation?: {
    city: string;
    country: string;
    lastUpdated: Date;
  };
  connectionDate: Date;
  status: string;
}

// API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'home' | 'friends' | 'all-friends' | 'requests'>('home');
  const [peopleInTown, setPeopleInTown] = useState<PersonInTown[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  
  // Friend request states
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [addFriendLink, setAddFriendLink] = useState('');
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [addFriendError, setAddFriendError] = useState('');
  const [addFriendSuccess, setAddFriendSuccess] = useState('');
  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.currentLocation]);

  // Fetch friend requests and friends list on component mount
  useEffect(() => {
    if (user) {
      fetchFriendRequests();
      fetchFriends();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchFriendsInTown = async () => {
    try {
      setIsLoadingFriends(true);
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_BASE_URL}/circles/in-town`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Additional frontend filtering to ensure current user is never included
        const filteredPeopleInTown = (data.friendsInTown || []).filter((person: PersonInTown) => {
          const isNotCurrentUser = person.id !== user?.id && person.name !== user?.name;
          console.log(`[DEBUG Frontend] Person in town: ${person.name}, isNotCurrentUser: ${isNotCurrentUser}`);
          return isNotCurrentUser;
        });
        
        // Remove duplicates based on ID
        const uniquePeopleInTown = filteredPeopleInTown.filter((person: PersonInTown, index: number, array: PersonInTown[]) => {
          return array.findIndex(p => p.id === person.id) === index;
        });
        
        console.log(`[DEBUG Frontend] Fetched ${data.friendsInTown?.length || 0} people in town, filtered to ${uniquePeopleInTown.length}`);
        setPeopleInTown(uniquePeopleInTown);
      }
    } catch (error) {
      console.error('Error fetching friends in town:', error);
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      setIsLoadingRequests(true);
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_BASE_URL}/circles/requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setFriendRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const fetchFriends = async () => {
    try {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_BASE_URL}/circles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Additional frontend filtering to prevent any self-inclusion
        const filteredFriends = (data.friends || []).filter((friend: Friend) => {
          return friend.id !== user?.id && friend.email !== user?.email;
        });
        
        // Remove duplicates based on ID
        const uniqueFriends = filteredFriends.filter((friend: Friend, index: number, array: Friend[]) => {
          return array.findIndex(f => f.id === friend.id) === index;
        });
        
        console.log(`[DEBUG Frontend] Fetched ${data.friends?.length || 0} friends, filtered to ${uniqueFriends.length}`);
        setFriends(uniqueFriends);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const updateLocationOnServer = async () => {
    if (!location.currentLocation) return;

    try {
      const token = localStorage.getItem('jwt_token');
      await fetch(`${API_BASE_URL}/locations/update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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

  const extractShareableLinkCode = (link: string) => {
    // Extract the shareable code from various link formats
    if (link.includes('/invite/')) {
      return link.split('/invite/')[1].split('?')[0].split('#')[0];
    }
    // If it's just the code itself
    if (link.length === 8 && /^[A-Za-z0-9]+$/.test(link)) {
      return link;
    }
    return link;
  };

  const addFriend = async () => {
    if (!addFriendLink.trim()) {
      setAddFriendError('Please enter a friend\'s link');
      return;
    }

    try {
      setIsAddingFriend(true);
      setAddFriendError('');
      setAddFriendSuccess('');

      const shareableCode = extractShareableLinkCode(addFriendLink.trim());
      
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_BASE_URL}/circles/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shareableLink: shareableCode
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setAddFriendSuccess('Friend request sent successfully!');
        setAddFriendLink('');
        // Refresh friends list to show any updates
        fetchFriends();
        setTimeout(() => setAddFriendSuccess(''), 3000);
      } else {
        setAddFriendError(data.error || 'Failed to send friend request');
      }
    } catch (error) {
      console.error('Error adding friend:', error);
      setAddFriendError('Failed to send friend request');
    } finally {
      setIsAddingFriend(false);
    }
  };

  const respondToFriendRequest = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_BASE_URL}/circles/${requestId}/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Remove the request from the list
        setFriendRequests(prev => prev.filter(req => req.id !== requestId));
        
        if (action === 'accept') {
          console.log('[DEBUG Frontend] Friend request accepted, refreshing data...');
          
          // Add a small delay to ensure backend has processed the acceptance
          setTimeout(() => {
            // Refresh all friend-related data
            fetchFriends();
            fetchFriendsInTown();
          }, 500);
          
          // Show success message
          if (data.friend) {
            alert(`You are now friends with ${data.friend.name}!`);
          }
        } else {
          console.log('[DEBUG Frontend] Friend request declined');
        }
      } else {
        const data = await response.json();
        console.error('Error responding to request:', data.error);
        alert(data.error || `Failed to ${action} friend request`);
      }
    } catch (error) {
      console.error('Error responding to friend request:', error);
      alert(`Failed to ${action} friend request`);
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

  const TabButton = ({ tab, label, badge }: { tab: string; label: string; badge?: number }) => (
    <button
      onClick={() => setActiveTab(tab as any)}
      className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        activeTab === tab
          ? 'bg-primary-600 text-white'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {label}
      {badge && badge > 0 && (
        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );

  const removeFriend = async (friendId: string, friendName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${friendName} from your circle? This action cannot be undone.`)) {
      return;
    }

    try {
      setRemovingFriendId(friendId);
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_BASE_URL}/circles/${friendId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Remove friend from local state
        setFriends(prev => prev.filter(friend => friend.id !== friendId));
        setPeopleInTown(prev => prev.filter(person => person.id !== friendId));
        
        // Show success message briefly
        const successMessage = `${friendName} has been removed from your circle.`;
        alert(successMessage);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to remove friend');
      }
    } catch (error) {
      console.error('Error removing friend:', error);
      alert('Failed to remove friend');
    } finally {
      setRemovingFriendId(null);
    }
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

      <div className="max-w-md mx-auto px-4 py-6">
        {/* Location Status */}
        {location.error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
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

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-white rounded-lg p-1 shadow-sm overflow-x-auto">
          <TabButton tab="home" label="Home" />
          <TabButton tab="all-friends" label="All Friends" />
          <TabButton tab="friends" label="Add Friends" />
          <TabButton tab="requests" label="Requests" badge={friendRequests.length} />
        </div>

        {/* Tab Content */}
        {activeTab === 'home' && (
          <div className="space-y-6">
        {/* Welcome Message */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Hey {user?.name}! 👋
          </h2>
          <p className="text-gray-600">
                {peopleInTown.length > 0 
                  ? `${peopleInTown.length} friend${peopleInTown.length > 1 ? 's' : ''} in town!`
                  : 'No friends in town yet. Share your link to connect with people!'
                }
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
                  <p className="mt-2 text-sm text-gray-500">Looking for friends...</p>
                </div>
              ) : peopleInTown.length > 0 ? (
                <div className="space-y-3">
                  {peopleInTown.map((person) => (
                    <div key={person.id} className="flex items-center space-x-3 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-100">
                      <div className="h-12 w-12 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center">
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
                      <div className="flex items-center space-x-2">
                        <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-xs text-green-600 font-medium">Online</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No one's in town yet</h3>
                  <p className="mt-2 text-sm text-gray-500">
                    When your friends visit {location.currentLocation?.city || 'your city'}, they'll appear here!
                  </p>
                  <button
                    onClick={() => setActiveTab('friends')}
                    className="mt-4 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Add Friends
                  </button>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-primary-600">{friends.length}</div>
                <div className="text-sm text-gray-500">Friends</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-green-600">{peopleInTown.length}</div>
                <div className="text-sm text-gray-500">In Town</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'all-friends' && (
          <div className="space-y-6">
            {/* Friends Overview */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Your Friends</h2>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>{friends.length} total</span>
                  <span>•</span>
                  <span>{peopleInTown.length} nearby</span>
                </div>
              </div>
              
              {friends.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No friends yet</h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Start building your circle by adding friends!
                  </p>
                  <button
                    onClick={() => setActiveTab('friends')}
                    className="mt-4 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Add Your First Friend
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {friends.map((friend) => {
                    const isInTown = friend.currentLocation && location.currentLocation && 
                                   friend.currentLocation.city === location.currentLocation.city;
                    const hasLocation = friend.currentLocation && friend.currentLocation.city;
                    
                    return (
                      <div 
                        key={friend.id} 
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                          isInTown 
                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' 
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                            isInTown 
                              ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                              : hasLocation
                              ? 'bg-gradient-to-br from-blue-500 to-purple-600'
                              : 'bg-gradient-to-br from-gray-400 to-gray-500'
                          }`}>
                            <span className="text-white text-sm font-medium">
                              {getInitials(friend.name)}
                            </span>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{friend.name}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              {hasLocation && friend.currentLocation ? (
                                <>
                                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  <span className="text-xs text-gray-600">
                                    {friend.currentLocation.city}, {friend.currentLocation.country}
                                  </span>
                                  {friend.currentLocation.lastUpdated && (
                                    <>
                                      <span className="text-gray-300">•</span>
                                      <span className="text-xs text-gray-500">
                                        {formatTimeAgo(friend.currentLocation.lastUpdated)}
                                      </span>
                                    </>
                                  )}
                                </>
                              ) : (
                                <span className="text-xs text-gray-500 italic">Location not shared</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          {isInTown && (
                            <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 rounded-full">
                              <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-xs font-medium text-green-700">In Town</span>
                            </div>
                          )}
                          
                          {hasLocation && !isInTown && friend.currentLocation && (
                            <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 rounded-full">
                              <div className="h-1.5 w-1.5 bg-blue-500 rounded-full"></div>
                              <span className="text-xs font-medium text-blue-700">
                                {friend.currentLocation.city}
                              </span>
                            </div>
                          )}
                          
                          {!hasLocation && (
                            <div className="flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded-full">
                              <div className="h-1.5 w-1.5 bg-gray-400 rounded-full"></div>
                              <span className="text-xs font-medium text-gray-600">Offline</span>
                            </div>
                          )}
                          
                          {/* Remove Friend Button */}
                          <button
                            onClick={() => removeFriend(friend.id, friend.name)}
                            disabled={removingFriendId === friend.id}
                            className={`ml-2 p-1.5 rounded-full transition-colors ${
                              removingFriendId === friend.id
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={`Remove ${friend.name}`}
                          >
                            {removingFriendId === friend.id ? (
                              <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Location Summary */}
            {friends.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Location Summary</h3>
                
                {(() => {
                  // Group friends by city
                  const locationGroups = friends.reduce((acc, friend) => {
                    if (friend.currentLocation && friend.currentLocation.city) {
                      const location = `${friend.currentLocation.city}, ${friend.currentLocation.country}`;
                      if (!acc[location]) {
                        acc[location] = [];
                      }
                      acc[location].push(friend);
                    } else {
                      if (!acc['Unknown']) {
                        acc['Unknown'] = [];
                      }
                      acc['Unknown'].push(friend);
                    }
                    return acc;
                  }, {} as Record<string, Friend[]>);

                  const locationEntries = Object.entries(locationGroups)
                    .sort(([a], [b]) => {
                      if (a === 'Unknown') return 1;
                      if (b === 'Unknown') return -1;
                      return locationGroups[b].length - locationGroups[a].length;
                    });

                  return (
                    <div className="space-y-3">
                      {locationEntries.map(([locationStr, friendsInLocation]) => {
                        const isCurrentCity = location.currentLocation && locationStr.includes(location.currentLocation.city);
                        
                        return (
                          <div key={locationStr} className={`flex items-center justify-between p-3 rounded-lg ${
                            isCurrentCity ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                          }`}>
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                isCurrentCity 
                                  ? 'bg-green-500 text-white' 
                                  : locationStr === 'Unknown'
                                  ? 'bg-gray-400 text-white'
                                  : 'bg-blue-500 text-white'
                              }`}>
                                {locationStr === 'Unknown' ? '?' : friendsInLocation.length}
                              </div>
                              
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {locationStr === 'Unknown' ? 'Location not shared' : locationStr}
                                  {isCurrentCity && (
                                    <span className="ml-2 text-xs text-green-600 font-medium">(Your city)</span>
                                  )}
                                </p>
                               <p className="text-xs text-gray-500">
                                 {friendsInLocation.length} friend{friendsInLocation.length > 1 ? 's' : ''}
                               </p>
                             </div>
                           </div>
                           
                           <div className="flex -space-x-1">
                             {friendsInLocation.slice(0, 3).map((friend, index) => (
                               <div 
                                 key={friend.id}
                                 className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-xs font-medium text-white border-2 border-white"
                                 title={friend.name}
                               >
                                 {getInitials(friend.name)[0]}
                               </div>
                             ))}
                             {friendsInLocation.length > 3 && (
                               <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600 border-2 border-white">
                                 +{friendsInLocation.length - 3}
                               </div>
                             )}
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 );
               })()}
             </div>
           )}
         </div>
       )}

       {activeTab === 'friends' && (
         <div className="space-y-6">
           {/* Your Link */}
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

           {/* Add Friend */}
           <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
             <h3 className="text-lg font-semibold text-gray-900">Add Friend</h3>
             <div className="space-y-3">
               <div className="flex items-center space-x-3">
                 <input
                   type="text"
                   value={addFriendLink}
                   onChange={(e) => setAddFriendLink(e.target.value)}
                   placeholder="Paste friend's LoopIn link here..."
                   className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                   disabled={isAddingFriend}
                 />
                 <button
                   onClick={addFriend}
                   disabled={isAddingFriend || !addFriendLink.trim()}
                   className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                     isAddingFriend || !addFriendLink.trim()
                       ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                       : 'bg-primary-600 text-white hover:bg-primary-700'
                   }`}
                 >
                   {isAddingFriend ? (
                     <div className="flex items-center space-x-2">
                       <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                       <span>Adding...</span>
                     </div>
                   ) : (
                     'Send Request'
                   )}
                 </button>
               </div>
               
               {addFriendError && (
                 <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                   <p className="text-sm text-red-700">{addFriendError}</p>
                 </div>
               )}
               
               {addFriendSuccess && (
                 <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                   <p className="text-sm text-green-700">{addFriendSuccess}</p>
                 </div>
               )}
             </div>
           </div>

           {/* Your Circle */}
           {friends.length > 0 && (
             <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
               <div className="flex items-center justify-between">
                 <h3 className="text-lg font-semibold text-gray-900">Your Circle</h3>
                 <span className="text-sm text-gray-500">{friends.length} friends</span>
               </div>
               <div className="space-y-3">
                 {friends.map((friend) => (
                   <div key={friend.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                     <div className="flex items-center space-x-3">
                       <div className="h-10 w-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                         <span className="text-white text-sm font-medium">
                           {getInitials(friend.name)}
                         </span>
                       </div>
                       <div>
                         <p className="text-sm font-medium text-gray-900">{friend.name}</p>
                         <p className="text-xs text-gray-500">
                           {friend.currentLocation ? 
                             `📍 ${friend.currentLocation.city}, ${friend.currentLocation.country}` : 
                             'Location not shared'
                           }
                         </p>
                       </div>
                     </div>
                     <div className="flex items-center space-x-3">
                       {friend.currentLocation && location.currentLocation && 
                        friend.currentLocation.city === location.currentLocation.city ? (
                         <div className="flex items-center space-x-1">
                           <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                           <span className="text-xs text-green-600 font-medium">In town</span>
                         </div>
                       ) : (
                         <span className="text-xs text-gray-400">Away</span>
                       )}
                       
                       {/* Remove Friend Button */}
                       <button
                         onClick={() => removeFriend(friend.id, friend.name)}
                         disabled={removingFriendId === friend.id}
                         className={`p-1 rounded-full transition-colors ${
                           removingFriendId === friend.id
                             ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                             : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                         }`}
                         title={`Remove ${friend.name}`}
                       >
                         {removingFriendId === friend.id ? (
                           <div className="animate-spin h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                         ) : (
                           <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                           </svg>
                         )}
                       </button>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           )}
         </div>
       )}

       {activeTab === 'requests' && (
         <div className="space-y-6">
           {/* Friend Requests */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
               <h3 className="text-lg font-semibold text-gray-900">Friend Requests</h3>
               {friendRequests.length > 0 && (
                 <span className="px-2 py-1 bg-primary-100 text-primary-800 text-xs font-medium rounded-full">
                   {friendRequests.length}
              </span>
            )}
          </div>

             {isLoadingRequests ? (
            <div className="text-center py-8">
                 <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                 <p className="mt-2 text-sm text-gray-500">Loading requests...</p>
            </div>
             ) : friendRequests.length > 0 ? (
            <div className="space-y-3">
                 {friendRequests.map((request) => (
                   <div key={request.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100">
                     <div className="flex items-center space-x-3">
                       <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                           {getInitials(request.from.name)}
                    </span>
                  </div>
                       <div>
                         <p className="text-sm font-medium text-gray-900">{request.from.name}</p>
                         <p className="text-xs text-gray-500">{request.from.email}</p>
                       </div>
                     </div>
                     <div className="flex items-center space-x-2">
                       <button
                         onClick={() => respondToFriendRequest(request.id, 'accept')}
                         className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors"
                       >
                         Accept
                       </button>
                       <button
                         onClick={() => respondToFriendRequest(request.id, 'decline')}
                         className="px-3 py-1.5 bg-gray-300 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-400 transition-colors"
                       >
                         Decline
                       </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
               <div className="text-center py-12">
                 <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
                 <h3 className="mt-4 text-lg font-medium text-gray-900">No pending requests</h3>
                 <p className="mt-2 text-sm text-gray-500">
                   Friend requests will appear here when someone wants to connect with you.
              </p>
            </div>
          )}
        </div>
         </div>
       )}

        {/* Location Tracking Status */}
       <div className="mt-6 bg-white rounded-xl shadow-sm p-4">
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