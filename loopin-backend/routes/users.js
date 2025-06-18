const express = require('express');
const { verifyToken } = require('./auth');
const User = require('../models/User');
const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
        phone: req.user.phone,
        shareableLink: `${process.env.CLIENT_URL || 'http://localhost:3000'}/invite/${req.user.shareableLink}`,
        isVerified: req.user.isVerified,
        preferences: req.user.preferences,
        currentLocation: req.user.currentLocation,
        lastActive: req.user.lastActive,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { name, phone, preferences } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (preferences) updateData.preferences = { ...req.user.preferences, ...preferences };

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        phone: updatedUser.phone,
        shareableLink: `${process.env.CLIENT_URL || 'http://localhost:3000'}/invite/${updatedUser.shareableLink}`,
        preferences: updatedUser.preferences,
        currentLocation: updatedUser.currentLocation
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// @route   GET /api/users/by-link/:shareableLink
// @desc    Get user by shareable link (for invite pages)
// @access  Public
router.get('/by-link/:shareableLink', async (req, res) => {
  try {
    const { shareableLink } = req.params;
    
    console.log(`[DEBUG] Looking up user by shareable link: ${shareableLink}`);
    
    const user = await User.findByShareableLink(shareableLink);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return public user info (no sensitive data)
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        shareableLink: user.shareableLink
      }
    });
  } catch (error) {
    console.error('Get user by link error:', error);
    res.status(500).json({ error: 'Failed to get user information' });
  }
});

// @route   POST /api/users/search
// @desc    Search users by name or email
// @access  Private
router.post('/search', verifyToken, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } }, // Exclude current user
        {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    })
    .select('name email avatar isVerified')
    .limit(10);

    res.json({
      success: true,
      users: users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        isVerified: user.isVerified
      }))
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// @route   DELETE /api/users/account
// @desc    Delete user account
// @access  Private
router.delete('/account', verifyToken, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    
    req.logout((err) => {
      if (err) {
        console.error('Logout after delete error:', err);
      }
      res.json({ success: true, message: 'Account deleted successfully' });
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// @route   POST /api/users/fix-shareable-link
// @desc    Fix corrupted shareable link
// @access  Private
router.post('/fix-shareable-link', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    
    console.log(`[DEBUG] Current shareable link for ${user.name}:`, user.shareableLink);
    
    // Check if the shareable link is corrupted (contains URLs)
    let needsFix = false;
    let cleanLink = user.shareableLink;
    
    if (user.shareableLink.includes('http') || user.shareableLink.includes('/invite/')) {
      needsFix = true;
      
      // Try to extract the original code
      if (user.shareableLink.includes('/invite/')) {
        const parts = user.shareableLink.split('/invite/');
        cleanLink = parts[parts.length - 1];
      }
      
      // Remove any remaining URL parts
      if (cleanLink.includes('http')) {
        const match = cleanLink.match(/[A-Za-z0-9]{8}/);
        cleanLink = match ? match[0] : generateNewShareableLink();
      }
      
      // If still corrupted, generate a new one
      if (cleanLink.length !== 8 || !/^[A-Za-z0-9]+$/.test(cleanLink)) {
        cleanLink = generateNewShareableLink();
      }
    }
    
    if (needsFix) {
      console.log(`[DEBUG] Fixing shareable link from "${user.shareableLink}" to "${cleanLink}"`);
      
      user.shareableLink = cleanLink;
      await user.save();
      
      res.json({
        success: true,
        message: 'Shareable link fixed',
        oldLink: req.body.oldLink || 'corrupted',
        newLink: cleanLink
      });
    } else {
      res.json({
        success: true,
        message: 'Shareable link is already valid',
        link: user.shareableLink
      });
    }
  } catch (error) {
    console.error('Fix shareable link error:', error);
    res.status(500).json({ error: 'Failed to fix shareable link' });
  }
});

function generateNewShareableLink() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

module.exports = router; 