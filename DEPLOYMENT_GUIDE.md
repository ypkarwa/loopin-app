# 🚀 CircleBack Deployment Guide

## Overview
CircleBack consists of two main components:
- **Frontend**: React app deployed on Netlify
- **Backend**: Node.js API deployed on Railway

## Prerequisites
- [Railway](https://railway.app) account
- [Netlify](https://netlify.com) account
- [MongoDB Atlas](https://cloud.mongodb.com) account
- [Google Cloud Console](https://console.cloud.google.com) account

## 🎯 Backend Deployment (Railway)

### 1. Create Railway Project
1. Go to [Railway](https://railway.app) and create a new project
2. Connect your GitHub repository
3. Select `loopin-backend` as the root directory

### 2. Set Environment Variables
In Railway dashboard, add these environment variables:

```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/loopin

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
SESSION_SECRET=your-session-secret-key-change-in-production

# Client Configuration
CLIENT_URL=https://your-frontend-url.netlify.app

# Environment
NODE_ENV=production
PORT=5000
```

### 3. Deploy
Railway will automatically deploy using the `Dockerfile` configuration.

## 🌐 Frontend Deployment (Netlify)

### 1. Connect Repository
1. Go to [Netlify](https://netlify.com) and create a new site
2. Connect your GitHub repository
3. Netlify will automatically detect the build settings from `netlify.toml`

### 2. Update Environment Variables
The environment variables are already configured in `netlify.toml`, but you should update them in Netlify's dashboard for security:

```env
REACT_APP_API_URL=https://your-railway-app.railway.app/api
REACT_APP_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
REACT_APP_LOCATION_FETCH_TIMES=08:00,14:00,20:00
```

### 3. Update Backend URL
After Railway deployment, update the `REACT_APP_API_URL` in:
- `netlify.toml`
- Netlify dashboard environment variables

## 🔧 Post-Deployment Configuration

### 1. Update CORS Settings
In your backend, ensure CORS is configured for your Netlify domain:

```javascript
// In server.js
const corsOptions = {
  origin: [
    'https://your-netlify-site.netlify.app',
    'http://localhost:3000'
  ],
  credentials: true
};
```

### 2. Update Google OAuth Redirect URLs
In Google Cloud Console:
- Add your Netlify URL to authorized redirect URIs
- Format: `https://your-netlify-site.netlify.app/auth/callback`

### 3. Test the Deployment
1. Visit your Netlify site
2. Test Google login
3. Test location features
4. Verify automatic location updates

## 🔐 Security Considerations

### 1. Environment Variables
- Never commit `.env` files
- Use different API keys for production
- Rotate secrets regularly

### 2. Google Maps API
- Restrict API key to your domains only
- Enable only required APIs (Geocoding, Maps JavaScript)
- Monitor usage and set quotas

### 3. MongoDB
- Use MongoDB Atlas for production
- Enable network access restrictions
- Use strong passwords

## 📱 Mobile App (Optional)
If you want to deploy the mobile app:
1. Use Capacitor to build for Android/iOS
2. Update `capacitor.config.ts` with production URLs
3. Build and deploy to app stores

## 🔍 Troubleshooting

### Common Issues
1. **CORS Errors**: Update backend CORS configuration
2. **API Key Errors**: Verify Google Maps API key is set correctly
3. **MongoDB Connection**: Check connection string and network access
4. **OAuth Issues**: Verify redirect URLs in Google Console

### Logs and Debugging
- **Railway**: Check deployment logs in Railway dashboard
- **Netlify**: Check function logs and deploy logs
- **Browser**: Check console for frontend errors

---

## 🚀 Quick Deploy Commands

### Backend (Railway)
```bash
# Railway will automatically deploy from GitHub
# Just push to main branch
git add .
git commit -m "Deploy backend"
git push origin main
```

### Frontend (Netlify)
```bash
# Netlify will automatically deploy from GitHub
# Just push to main branch
git add .
git commit -m "Deploy frontend"
git push origin main
```

---

**Note**: This deployment uses the current Google Maps API key. For production, consider using environment-specific API keys and implementing proper secret management. 