export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  shareableLink: string;
  createdAt: Date;
}

export interface Circle {
  id: string;
  userId: string;
  friendId: string;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: Date;
}

export interface Location {
  id: string;
  userId: string;
  city: string;
  country: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  fromUserId: string;
  type: 'friend_in_town' | 'circle_request';
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LocationState {
  currentLocation: Location | null;
  isTracking: boolean;
  lastUpdate: Date | null;
}

export interface LoginMethod {
  type: 'google' | 'phone';
  data?: any;
} 