const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      email: user.email 
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

// @route   GET /api/auth/google
// @desc    Start Google OAuth flow
// @access  Public
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

// @route   GET /api/auth/google/callback
// @desc    Google OAuth callback
// @access  Public
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    try {
      // Generate JWT token
      const token = generateToken(req.user);
      
      // Successful authentication, redirect to frontend with token
      const clientURL = process.env.CLIENT_URL || 'http://localhost:3000';
      res.redirect(`${clientURL}/?auth=success&token=${token}`);
    } catch (error) {
      console.error('JWT generation error:', error);
      res.redirect(`${clientURL}/?auth=error`);
    }
  }
);

// JWT Middleware
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const User = require('../models/User');
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// @route   GET /api/auth/current
// @desc    Get current authenticated user
// @access  Private
router.get('/current', verifyToken, async (req, res) => {
  try {
    // Update last active time
    await req.user.updateLastActive();

    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
        shareableLink: `${process.env.CLIENT_URL || 'http://localhost:3000'}/invite/${req.user.shareableLink}`,
        isVerified: req.user.isVerified,
        preferences: req.user.preferences,
        currentLocation: req.user.currentLocation,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// @route   GET /api/auth/status
// @desc    Check authentication status
// @access  Public
router.get('/status', (req, res) => {
  res.json({ 
    isAuthenticated: !!req.user,
    user: req.user ? {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email
    } : null
  });
});

// Middleware to check if user is authenticated (legacy - keeping for compatibility)
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

module.exports = { router, requireAuth, verifyToken }; 