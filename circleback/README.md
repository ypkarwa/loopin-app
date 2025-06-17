# LoopIn 🔄

A simple yet aesthetic app that helps you stay connected with your circle when you're in town. Get notified when someone from your circle is in your city, and let them know when you're in theirs!

## Features

- **Simple Authentication**: Login with Google or Phone number + OTP
- **Automatic Location Detection**: GPS-based city detection with privacy controls
- **Circle Management**: Add friends via shareable links or contacts
- **Smart Notifications**: Get notified when circle members are in your city
- **Privacy First**: You control when to share your location
- **Clean UI**: Modern, mobile-first design

## How It Works

1. **Login**: Use Google or phone number authentication
2. **Location Permission**: Grant location access for automatic city detection
3. **Share Your Link**: Copy your unique LoopIn link and share with friends
4. **Build Your Circle**: Friends join your circle through mutual consent
5. **Stay Connected**: When you travel to a new city, you'll be asked if you want to share your location
6. **Get Notified**: When you're in the same city as circle members, you'll both get notifications

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Location Services**: Browser Geolocation API + OpenStreetMap Nominatim
- **State Management**: React Context + Hooks
- **Authentication**: Mock implementation (ready for real auth integration)
- **Styling**: Tailwind CSS with custom design system

## Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/loopin.git
cd loopin
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
```

The build artifacts will be stored in the `build/` directory.

## App Structure

```
src/
├── components/
│   ├── Login.tsx          # Authentication component
│   └── Dashboard.tsx      # Main app dashboard
├── contexts/
│   └── AuthContext.tsx    # Authentication state management
├── hooks/
│   └── useLocation.ts     # Location tracking hook
├── types/
│   └── index.ts          # TypeScript type definitions
└── services/             # API services (future)
```

## Key Components

### Authentication (`AuthContext`)
- Manages user authentication state
- Provides login/logout functionality
- Persists user session in localStorage

### Location Tracking (`useLocation`)
- Automatic GPS-based location detection
- Reverse geocoding for city names
- Privacy controls for location sharing
- Efficient background tracking

### Dashboard
- Displays shareable link for adding friends
- Shows circle members currently in town
- Location tracking status
- Clean, mobile-first interface

## Privacy & Permissions

- **Location**: Required for core functionality, used only for city-level detection
- **Contacts**: Optional, for easier friend discovery
- **Notifications**: For real-time updates when friends are in town
- **Data**: All data stored locally for this demo version

## Development Roadmap

### Phase 1 (Current - MVP)
- ✅ Basic authentication
- ✅ Location detection
- ✅ UI/UX foundation
- ✅ Circle management basics

### Phase 2 (Next)
- [ ] Real authentication (Google OAuth, SMS OTP)
- [ ] Backend API integration
- [ ] Push notifications
- [ ] Contact import functionality

### Phase 3 (Future)
- [ ] Advanced privacy controls
- [ ] Circle categories (work, friends, family)
- [ ] Travel history
- [ ] iOS/Android mobile apps

## Contributing

This is currently a personal project, but suggestions and feedback are welcome!

## License

MIT License - feel free to use this code for your own projects.

---

**LoopIn** - Stay connected when you're in town! 🌍✈️👥
