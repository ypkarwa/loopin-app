const express = require('express');
const { requireAuth } = require('./auth');
const User = require('../models/User');
const Circle = require('../models/Circle');
const Notification = require('../models/Notification');
const router = express.Router();

// @route   POST /api/locations/update
// @desc    Update user's current location
// @access  Private
router.post('/update', requireAuth, async (req, res) => {
  try {
    const { city, country, latitude, longitude, isPublic } = req.body;

    if (!city || !country) {
      return res.status(400).json({ error: 'City and country are required' });
    }

    // Check if location actually changed
    const previousLocation = req.user.currentLocation;
    const locationChanged = !previousLocation || 
      previousLocation.city !== city || 
      previousLocation.country !== country;

    // Update user's location
    const locationData = {
      city,
      country,
      latitude: latitude || null,
      longitude: longitude || null,
      isPublic: isPublic !== undefined ? isPublic : true,
      lastUpdated: new Date()
    };

    await req.user.updateLocation(locationData);

    // If location changed and is public, notify friends in the same city
    if (locationChanged && isPublic) {
      await notifyFriendsInTown(req.user, locationData);
    }

    res.json({
      success: true,
      message: 'Location updated successfully',
      location: {
        city: locationData.city,
        country: locationData.country,
        isPublic: locationData.isPublic,
        lastUpdated: locationData.lastUpdated
      },
      friendsNotified: locationChanged && isPublic
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// @route   POST /api/locations/privacy
// @desc    Update location privacy setting
// @access  Private
router.post('/privacy', requireAuth, async (req, res) => {
  try {
    const { isPublic } = req.body;

    if (typeof isPublic !== 'boolean') {
      return res.status(400).json({ error: 'isPublic must be a boolean value' });
    }

    // Update location privacy
    if (req.user.currentLocation) {
      await req.user.updateLocation({
        ...req.user.currentLocation.toObject(),
        isPublic
      });

      // If making location public, notify friends in the same city
      if (isPublic && req.user.currentLocation.city) {
        await notifyFriendsInTown(req.user, req.user.currentLocation);
      }
    }

    res.json({
      success: true,
      message: `Location is now ${isPublic ? 'public' : 'private'}`,
      isPublic,
      friendsNotified: isPublic && req.user.currentLocation?.city
    });
  } catch (error) {
    console.error('Update location privacy error:', error);
    res.status(500).json({ error: 'Failed to update location privacy' });
  }
});

// @route   GET /api/locations/current
// @desc    Get user's current location
// @access  Private
router.get('/current', requireAuth, (req, res) => {
  try {
    const location = req.user.currentLocation;
    
    if (!location) {
      return res.json({
        success: true,
        location: null,
        message: 'No location data available'
      });
    }

    res.json({
      success: true,
      location: {
        city: location.city,
        country: location.country,
        latitude: location.latitude,
        longitude: location.longitude,
        isPublic: location.isPublic,
        lastUpdated: location.lastUpdated
      }
    });
  } catch (error) {
    console.error('Get current location error:', error);
    res.status(500).json({ error: 'Failed to get current location' });
  }
});

// @route   GET /api/locations/history
// @desc    Get user's location history (future feature)
// @access  Private
router.get('/history', requireAuth, (req, res) => {
  // This would require a separate LocationHistory model
  // For now, just return current location
  res.json({
    success: true,
    history: req.user.currentLocation ? [req.user.currentLocation] : [],
    message: 'Location history feature coming soon'
  });
});

// @route   POST /api/locations/check-friends
// @desc    Check which friends are in the current city
// @access  Private
router.post('/check-friends', requireAuth, async (req, res) => {
  try {
    const { city, country } = req.body;

    if (!city || !country) {
      return res.status(400).json({ error: 'City and country are required' });
    }

    // Get user's circles
    const circles = await Circle.getUserCircles(req.user._id);
    
    // Find friends in the same city
    const friendsInCity = circles
      .map(circle => circle.getOtherUser(req.user._id))
      .filter(friend => 
        friend.currentLocation && 
        friend.currentLocation.city === city &&
        friend.currentLocation.country === country &&
        friend.currentLocation.isPublic
      )
      .map(friend => ({
        id: friend._id,
        name: friend.name,
        avatar: friend.avatar,
        lastSeen: friend.currentLocation.lastUpdated || friend.lastActive
      }));

    res.json({
      success: true,
      friendsInCity,
      count: friendsInCity.length,
      location: { city, country }
    });
  } catch (error) {
    console.error('Check friends in city error:', error);
    res.status(500).json({ error: 'Failed to check friends in city' });
  }
});

// Helper function to notify friends when user is in town
async function notifyFriendsInTown(user, locationData) {
  try {
    // Get user's circles
    const circles = await Circle.getUserCircles(user._id);
    
    // Find friends in the same city
    const friendsInSameCity = circles
      .map(circle => circle.getOtherUser(user._id))
      .filter(friend => 
        friend.currentLocation && 
        friend.currentLocation.city === locationData.city &&
        friend.currentLocation.country === locationData.country &&
        friend.preferences?.notifications !== false
      );

    // Send notifications to friends in the same city
    for (const friend of friendsInSameCity) {
      // Create database notification
      await Notification.createLocationUpdate(
        user._id,
        friend._id,
        locationData
      );

      // Emit real-time notification
      const io = global.io; // We'll need to make io globally accessible
      if (io) {
        io.to(`user-${friend._id}`).emit('friend-in-town', {
          type: 'friend_in_town',
          from: {
            id: user._id,
            name: user.name,
            avatar: user.avatar
          },
          location: {
            city: locationData.city,
            country: locationData.country
          },
          message: `${user.name} is in ${locationData.city}!`
        });
      }
    }

    console.log(`Notified ${friendsInSameCity.length} friends about ${user.name} being in ${locationData.city}`);
    return friendsInSameCity.length;
  } catch (error) {
    console.error('Error notifying friends in town:', error);
    return 0;
  }
}

module.exports = router; 