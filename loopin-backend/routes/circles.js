const express = require('express');
const { verifyToken } = require('./auth');
const Circle = require('../models/Circle');
const User = require('../models/User');
const Notification = require('../models/Notification');
const router = express.Router();

// @route   GET /api/circles
// @desc    Get user's circles (friends)
// @access  Private
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log(`[DEBUG] Getting circles for user: ${req.user._id} (${req.user.name})`);
    
    const circles = await Circle.getUserCircles(req.user._id);
    console.log(`[DEBUG] Found ${circles.length} circles:`, circles.map(c => ({
      id: c._id,
      requester: c.requester._id,
      recipient: c.recipient._id,
      status: c.status
    })));
    
    const friends = circles.map(circle => {
      const friend = circle.getOtherUser(req.user._id);
      console.log(`[DEBUG] Processing circle ${circle._id}, other user:`, {
        friendId: friend._id,
        friendName: friend.name,
        isRequester: circle.requester._id.toString() === req.user._id.toString()
      });
      
      return {
        id: friend._id,
        name: friend.name,
        email: friend.email,
        avatar: friend.avatar,
        currentLocation: friend.currentLocation,
        connectionDate: circle.respondedAt || circle.createdAt,
        status: circle.status
      };
    });

    console.log(`[DEBUG] Returning ${friends.length} friends for user ${req.user.name}`);

    res.json({
      success: true,
      friends,
      count: friends.length
    });
  } catch (error) {
    console.error('Get circles error:', error);
    res.status(500).json({ error: 'Failed to get circles' });
  }
});

// @route   POST /api/circles/request
// @desc    Send circle request to a user
// @access  Private
router.post('/request', verifyToken, async (req, res) => {
  try {
    const { recipientId, shareableLink } = req.body;
    
    let recipient;
    
    if (shareableLink) {
      // Find user by shareable link
      recipient = await User.findByShareableLink(shareableLink);
      if (!recipient) {
        return res.status(404).json({ error: 'User not found' });
      }
    } else if (recipientId) {
      // Find user by ID
      recipient = await User.findById(recipientId);
      if (!recipient) {
        return res.status(404).json({ error: 'User not found' });
      }
    } else {
      return res.status(400).json({ error: 'Recipient ID or shareable link required' });
    }

    // Prevent self-request
    if (recipient._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot add yourself to circle' });
    }

    // Check if connection already exists
    const existingCircle = await Circle.findCircleStatus(req.user._id, recipient._id);
    
    if (existingCircle) {
      if (existingCircle.status === 'accepted') {
        return res.status(400).json({ error: 'Already in your circle' });
      } else if (existingCircle.status === 'pending') {
        return res.status(400).json({ error: 'Circle request already pending' });
      } else if (existingCircle.status === 'blocked') {
        return res.status(400).json({ error: 'Cannot send request to this user' });
      }
    }

    // Create new circle request
    const newCircle = new Circle({
      requester: req.user._id,
      recipient: recipient._id,
      connectionMethod: shareableLink ? 'link' : 'manual'
    });

    await newCircle.save();

    // Create notification for recipient
    await Notification.createFriendRequest(req.user._id, recipient._id, newCircle._id);

    // Emit real-time notification
    const io = req.app.get('io');
    io.to(`user-${recipient._id}`).emit('new-notification', {
      type: 'friend_request',
      from: {
        id: req.user._id,
        name: req.user.name,
        avatar: req.user.avatar
      },
      message: `${req.user.name} wants to add you to their circle`
    });

    res.json({
      success: true,
      message: 'Circle request sent successfully',
      circleId: newCircle._id
    });
  } catch (error) {
    console.error('Send circle request error:', error);
    res.status(500).json({ error: 'Failed to send circle request' });
  }
});

// @route   POST /api/circles/:circleId/respond
// @desc    Respond to circle request (accept/decline)
// @access  Private
router.post('/:circleId/respond', verifyToken, async (req, res) => {
  try {
    const { circleId } = req.params;
    const { action } = req.body; // 'accept' or 'decline'

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use accept or decline' });
    }

    const circle = await Circle.findById(circleId).populate('requester');
    
    if (!circle) {
      return res.status(404).json({ error: 'Circle request not found' });
    }

    // Verify user is the recipient
    if (circle.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to respond to this request' });
    }

    // Check if already responded
    if (circle.status !== 'pending') {
      return res.status(400).json({ error: 'Request already responded to' });
    }

    if (action === 'accept') {
      console.log(`[DEBUG] Accepting friend request: Circle ${circleId}, Requester: ${circle.requester._id} (${circle.requester.name}), Recipient: ${req.user._id} (${req.user.name})`);
      
      await circle.accept();
      
      console.log(`[DEBUG] Circle accepted successfully. Status: ${circle.status}`);
      
      // Create notification for requester
      await Notification.createFriendAccepted(req.user._id, circle.requester._id, circle._id);
      
      // Emit real-time notification
      const io = req.app.get('io');
      io.to(`user-${circle.requester._id}`).emit('new-notification', {
        type: 'friend_accepted',
        from: {
          id: req.user._id,
          name: req.user.name,
          avatar: req.user.avatar
        },
        message: `${req.user.name} accepted your circle request`
      });

      res.json({
        success: true,
        message: 'Circle request accepted',
        friend: {
          id: circle.requester._id,
          name: circle.requester.name,
          email: circle.requester.email,
          avatar: circle.requester.avatar
        }
      });
    } else {
      await circle.decline();
      res.json({
        success: true,
        message: 'Circle request declined'
      });
    }
  } catch (error) {
    console.error('Respond to circle request error:', error);
    res.status(500).json({ error: 'Failed to respond to circle request' });
  }
});

// @route   GET /api/circles/requests
// @desc    Get pending circle requests
// @access  Private
router.get('/requests', verifyToken, async (req, res) => {
  try {
    const pendingRequests = await Circle.getPendingRequests(req.user._id);
    
    const requests = pendingRequests.map(circle => ({
      id: circle._id,
      from: {
        id: circle.requester._id,
        name: circle.requester.name,
        email: circle.requester.email,
        avatar: circle.requester.avatar
      },
      requestedAt: circle.requestedAt,
      connectionMethod: circle.connectionMethod
    }));

    res.json({
      success: true,
      requests,
      count: requests.length
    });
  } catch (error) {
    console.error('Get circle requests error:', error);
    res.status(500).json({ error: 'Failed to get circle requests' });
  }
});

// @route   DELETE /api/circles/:friendId
// @desc    Remove friend from circle
// @access  Private
router.delete('/:friendId', verifyToken, async (req, res) => {
  try {
    const { friendId } = req.params;
    
    const circle = await Circle.findCircleStatus(req.user._id, friendId);
    
    if (!circle) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    if (circle.status !== 'accepted') {
      return res.status(400).json({ error: 'Not connected to this user' });
    }

    await Circle.findByIdAndDelete(circle._id);

    res.json({
      success: true,
      message: 'Friend removed from circle'
    });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// @route   GET /api/circles/in-town
// @desc    Get friends currently in the same city
// @access  Private
router.get('/in-town', verifyToken, async (req, res) => {
  try {
    if (!req.user.currentLocation || !req.user.currentLocation.city) {
      return res.json({
        success: true,
        friendsInTown: [],
        count: 0,
        message: 'Location not available'
      });
    }

    const circles = await Circle.getUserCircles(req.user._id);
    
    const friendsInTown = circles
      .map(circle => circle.getOtherUser(req.user._id))
      .filter(friend => 
        friend.currentLocation && 
        friend.currentLocation.city === req.user.currentLocation.city &&
        friend.currentLocation.isPublic
      )
      .map(friend => ({
        id: friend._id,
        name: friend.name,
        avatar: friend.avatar,
        city: friend.currentLocation.city,
        country: friend.currentLocation.country,
        lastSeen: friend.currentLocation.lastUpdated || friend.lastActive
      }));

    res.json({
      success: true,
      friendsInTown,
      count: friendsInTown.length,
      yourLocation: {
        city: req.user.currentLocation.city,
        country: req.user.currentLocation.country
      }
    });
  } catch (error) {
    console.error('Get friends in town error:', error);
    res.status(500).json({ error: 'Failed to get friends in town' });
  }
});

module.exports = router; 