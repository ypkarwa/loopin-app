const express = require('express');
const passport = require('passport');
const router = express.Router();

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
    // Successful authentication, redirect to frontend
    const clientURL = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${clientURL}/?auth=success`);
  }
);

// @route   GET /api/auth/current
// @desc    Get current authenticated user
// @access  Private
router.get('/current', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Update last active time
  req.user.updateLastActive();

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

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

module.exports = { router, requireAuth }; 