# LoopIn Backend Setup Guide

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Frontend URL
CLIENT_URL=http://localhost:3000

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/loopin

# Session Secret (change this in production!)
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 3. MongoDB Setup
**Option A: Local MongoDB**
- Install MongoDB locally
- Make sure MongoDB service is running
- Database will be created automatically

**Option B: MongoDB Atlas (Recommended)**
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create free account and cluster
3. Get connection string and replace `MONGODB_URI`

### 4. Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set application type to "Web application"
6. Add authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
7. Copy Client ID and Client Secret to your `.env` file

### 5. Start the Server
```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start
```

## 🔧 Configuration Details

### Environment Variables Explained

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` or `production` |
| `PORT` | Server port | `5000` |
| `CLIENT_URL` | Frontend URL for CORS and redirects | `http://localhost:3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/loopin` |
| `SESSION_SECRET` | Secret for session encryption | `random-secret-key` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `123456.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `GOCSPX-...` |

### API Endpoints

#### Authentication
- `GET /api/auth/google` - Start Google OAuth flow
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/current` - Get current user
- `POST /api/auth/logout` - Logout user

#### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/by-link/:shareableLink` - Get user by invitation link

#### Circles (Friends)
- `GET /api/circles` - Get user's friends
- `POST /api/circles/request` - Send friend request
- `POST /api/circles/:circleId/respond` - Accept/decline friend request
- `GET /api/circles/requests` - Get pending requests
- `GET /api/circles/in-town` - Get friends in same city

#### Locations
- `POST /api/locations/update` - Update current location
- `POST /api/locations/privacy` - Update location privacy
- `GET /api/locations/current` - Get current location
- `POST /api/locations/check-friends` - Check friends in city

## 🌐 Deployment

### Heroku Deployment
1. Create Heroku app: `heroku create your-app-name`
2. Set environment variables: `heroku config:set VAR_NAME=value`
3. Deploy: `git push heroku main`

### Railway Deployment
1. Connect GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

### Vercel Deployment
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Set environment variables in Vercel dashboard

## 🔒 Security Considerations

### Production Checklist
- [ ] Change `SESSION_SECRET` to a strong random string
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS in production
- [ ] Set secure MongoDB connection (Atlas)
- [ ] Configure proper CORS origins
- [ ] Set up rate limiting
- [ ] Enable helmet security headers

## 🐛 Troubleshooting

### Common Issues

**MongoDB Connection Error**
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
- Make sure MongoDB is running locally
- Check MongoDB connection string in `.env`

**Google OAuth Error**
```
Error: Cannot get user profile
```
- Verify Google Client ID and Secret
- Check redirect URI matches exactly
- Enable Google+ API in Google Cloud Console

**CORS Error**
```
Access-Control-Allow-Origin error
```
- Check `CLIENT_URL` in `.env` matches frontend URL
- Make sure frontend is running on correct port

## 📱 Frontend Integration

Update your React app to connect to the backend:

```javascript
// In your React app's AuthContext
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Google login
const loginWithGoogle = () => {
  window.location.href = `${API_BASE_URL}/auth/google`;
};

// API calls
const apiCall = async (endpoint, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: 'include', // Important for cookies
    ...options
  });
  return response.json();
};
```

## 🎯 Testing the API

Use these curl commands to test:

```bash
# Health check
curl http://localhost:5000/api/health

# Check auth status
curl http://localhost:5000/api/auth/status

# Get current user (requires authentication)
curl -X GET http://localhost:5000/api/auth/current \
  -H "Cookie: your-session-cookie"
```

## 📞 Need Help?

- Check the server logs for detailed error messages
- Verify all environment variables are set correctly
- Make sure MongoDB and the server are running
- Test API endpoints individually

---

**Ready to connect your frontend? Your LoopIn backend is now running!** 🚀 