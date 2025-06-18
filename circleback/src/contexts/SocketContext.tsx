import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  notifications: Notification[];
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

interface Notification {
  id: string;
  type: 'friend_request' | 'friend_accepted' | 'friend_in_town' | 'general';
  from?: {
    id: string;
    name: string;
    avatar?: string;
  };
  message: string;
  timestamp: Date;
  read?: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (user) {
      console.log('[Socket] Connecting to server...');
      
      // Create socket connection
      const newSocket = io(API_BASE_URL, {
        withCredentials: true,
        transports: ['websocket', 'polling']
      });

      newSocket.on('connect', () => {
        console.log('[Socket] Connected to server');
        setIsConnected(true);
        
        // Join user's personal room for notifications
        newSocket.emit('join-user-room', user.id);
        console.log(`[Socket] Joined user room: user-${user.id}`);
        
        // Test the connection
        newSocket.emit('test-message', { userId: user.id, message: 'Socket connected' });
      });

      // Listen for room join confirmation
      newSocket.on('room-joined', (data) => {
        console.log('[Socket] Room joined confirmation:', data);
      });

      // Listen for test responses
      newSocket.on('test-response', (data) => {
        console.log('[Socket] Test response received:', data);
      });

      newSocket.on('connection-confirmed', (data) => {
        console.log('[Socket] Connection confirmed:', data);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected from server:', reason);
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error);
        setIsConnected(false);
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log(`[Socket] Reconnected after ${attemptNumber} attempts`);
        setIsConnected(true);
        // Rejoin user room after reconnection
        newSocket.emit('join-user-room', user.id);
      });

      // Listen for friend request notifications
      newSocket.on('new-notification', (data) => {
        console.log('[Socket] Received notification:', data);
        
        const notification: Notification = {
          id: Date.now().toString(),
          type: data.type,
          from: data.from,
          message: data.message,
          timestamp: new Date(),
          read: false
        };
        
        addNotification(notification);
        
        // Show browser notification if permission granted
        if (Notification.permission === 'granted') {
          new Notification(`LoopIn - ${data.from?.name || 'Friend'}`, {
            body: data.message,
            icon: data.from?.avatar || '/favicon.ico'
          });
        }
      });

      // Listen for friend acceptance notifications
      newSocket.on('friend-accepted', (data) => {
        console.log('[Socket] Friend accepted:', data);
        
        const notification: Notification = {
          id: Date.now().toString(),
          type: 'friend_accepted',
          from: data.from,
          message: `${data.from.name} accepted your friend request!`,
          timestamp: new Date(),
          read: false
        };
        
        addNotification(notification);
      });

      // Listen for location updates (friends in town)
      newSocket.on('friend-in-town', (data) => {
        console.log('[Socket] Friend in town:', data);
        
        const notification: Notification = {
          id: Date.now().toString(),
          type: 'friend_in_town',
          from: data.from,
          message: `${data.from.name} is now in ${data.location.city}!`,
          timestamp: new Date(),
          read: false
        };
        
        addNotification(notification);
      });

      setSocket(newSocket);

      return () => {
        console.log('[Socket] Cleaning up connection');
        newSocket.disconnect();
      };
    }
  }, [user]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const addNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50 notifications
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const value: SocketContextType = {
    socket,
    isConnected,
    notifications,
    addNotification,
    removeNotification,
    clearNotifications
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}; 