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
    
    // First, let's get ALL circles involving this user (regardless of status)
    const allCircles = await Circle.find({
      $or: [
        { requester: req.user._id },
        { recipient: req.user._id }
      ]
    }).populate('requester recipient', 'name email avatar currentLocation lastActive');
    
    console.log(`[DEBUG] ALL circles for user ${req.user.name}:`, allCircles.map(c => ({
      id: c._id,
      requester: `${c.requester._id} (${c.requester.name})`,
      recipient: `${c.recipient._id} (${c.recipient.name})`,
      status: c.status,
      createdAt: c.createdAt,
      respondedAt: c.respondedAt
    })));
    
    const circles = await Circle.getUserCircles(req.user._id);
    console.log(`[DEBUG] ACCEPTED circles for user ${req.user.name}:`, circles.map(c => ({
      id: c._id,
      requester: `${c.requester._id} (${c.requester.name})`,
      recipient: `${c.recipient._id} (${c.recipient.name})`,
      status: c.status
    })));
    
    // Filter and map friends, ensuring current user doesn't appear in their own list
    const friends = circles
      .map(circle => {
        const friend = circle.getOtherUser(req.user._id);
        
        // Additional safety check to prevent self-inclusion
        if (friend._id.toString() === req.user._id.toString()) {
          console.log(`[WARNING] Skipping self-reference in circle ${circle._id}`);
          return null;
        }
        
        console.log(`[DEBUG] Processing circle ${circle._id}, other user:`, {
          friendId: friend._id,
          friendName: friend.name,
          isRequester: circle.requester._id.toString() === req.user._id.toString(),
          circleStatus: circle.status
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
      })
      .filter(friend => friend !== null); // Remove any null entries

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

// @route   GET /api/circles/debug/:userId
// @desc    Debug circles for a specific user (development only)
// @access  Private
router.get('/debug/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get all circles involving this user
    const allCircles = await Circle.find({
      $or: [
        { requester: userId },
        { recipient: userId }
      ]
    }).populate('requester recipient', 'name email avatar');
    
    const acceptedCircles = await Circle.getUserCircles(userId);
    
    res.json({
      success: true,
      debug: {
        userId,
        allCircles: allCircles.map(c => ({
          id: c._id,
          requester: { id: c.requester._id, name: c.requester.name },
          recipient: { id: c.recipient._id, name: c.recipient.name },
          status: c.status,
          createdAt: c.createdAt,
          respondedAt: c.respondedAt
        })),
        acceptedCircles: acceptedCircles.map(c => ({
          id: c._id,
          requester: { id: c.requester._id, name: c.requester.name },
          recipient: { id: c.recipient._id, name: c.recipient.name },
          status: c.status
        }))
      }
    });
  } catch (error) {
    console.error('Debug circles error:', error);
    res.status(500).json({ error: 'Failed to debug circles' });
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
        return res.status(404).json({ error: 'User not found with this link' });
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

    // Prevent self-request - Enhanced check
    if (recipient._id.toString() === req.user._id.toString()) {
      console.log(`[WARNING] User ${req.user._id} attempted to send friend request to themselves`);
      return res.status(400).json({ error: 'You cannot add yourself to your circle' });
    }

    // Additional check with email to prevent any edge cases
    if (recipient.email === req.user.email) {
      console.log(`[WARNING] User ${req.user._id} attempted to send friend request to same email`);
      return res.status(400).json({ error: 'You cannot add yourself to your circle' });
    }

    console.log(`[DEBUG] Processing friend request from ${req.user._id} (${req.user.email}) to ${recipient._id} (${recipient.email})`);

    // Check if connection already exists
    const existingCircle = await Circle.findCircleStatus(req.user._id, recipient._id);
    
    if (existingCircle) {
      console.log(`[DEBUG] Existing circle found: Status ${existingCircle.status}`);
      if (existingCircle.status === 'accepted') {
        return res.status(400).json({ error: 'Already friends with this user' });
      } else if (existingCircle.status === 'pending') {
        // Check who sent the original request
        const isOriginalRequester = existingCircle.requester.toString() === req.user._id.toString();
        if (isOriginalRequester) {
          return res.status(400).json({ error: 'Friend request already sent to this user' });
        } else {
          return res.status(400).json({ error: 'This user has already sent you a friend request. Check your requests tab.' });
        }
      } else if (existingCircle.status === 'blocked') {
        return res.status(400).json({ error: 'Cannot send request to this user' });
      } else if (existingCircle.status === 'declined') {
        return res.status(400).json({ error: 'Your previous request to this user was declined' });
      }
    }

    // Create new circle request
    const newCircle = new Circle({
      requester: req.user._id,
      recipient: recipient._id,
      connectionMethod: shareableLink ? 'link' : 'manual'
    });

    await newCircle.save();
    console.log(`[DEBUG] Created new circle request: ${newCircle._id}`);

    // Create notification for recipient
    await Notification.createFriendRequest(req.user._id, recipient._id, newCircle._id);

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user-${recipient._id}`).emit('new-notification', {
        type: 'friend_request',
        from: {
          id: req.user._id,
          name: req.user.name,
          avatar: req.user.avatar
        },
        message: `${req.user.name} wants to add you to their circle`
      });
    }

    res.json({
      success: true,
      message: 'Friend request sent successfully',
      circleId: newCircle._id,
      recipient: {
        name: recipient.name,
        email: recipient.email
      }
    });
  } catch (error) {
    console.error('Send circle request error:', error);
    if (error.code === 11000) {
      // Duplicate key error - request already exists
      return res.status(400).json({ error: 'Friend request already exists with this user' });
    }
    res.status(500).json({ error: 'Failed to send friend request' });
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

    const circle = await Circle.findById(circleId).populate('requester recipient');
    
    if (!circle) {
      return res.status(404).json({ error: 'Circle request not found' });
    }

    // Verify user is the recipient
    if (circle.recipient._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to respond to this request' });
    }

    // Check if already responded
    if (circle.status !== 'pending') {
      return res.status(400).json({ error: 'Request already responded to' });
    }

    if (action === 'accept') {
      console.log(`[DEBUG] Accepting friend request: Circle ${circleId}`);
      console.log(`[DEBUG] Requester: ${circle.requester._id} (${circle.requester.name})`);
      console.log(`[DEBUG] Recipient: ${circle.recipient._id} (${circle.recipient.name})`);
      
      await circle.accept();
      
      console.log(`[DEBUG] Circle accepted successfully. Status: ${circle.status}, RespondedAt: ${circle.respondedAt}`);
      
      // SOLUTION: Create bidirectional friendship
      // Check if reverse circle already exists
      const reverseCircle = await Circle.findOne({
        requester: circle.recipient._id,
        recipient: circle.requester._id
      });
      
      if (!reverseCircle) {
        console.log(`[DEBUG] Creating reverse circle for bidirectional friendship`);
        const newReverseCircle = new Circle({
          requester: circle.recipient._id,
          recipient: circle.requester._id,
          status: 'accepted',
          connectionMethod: circle.connectionMethod,
          respondedAt: new Date()
        });
        await newReverseCircle.save();
        console.log(`[DEBUG] Reverse circle created: ${newReverseCircle._id}`);
      } else if (reverseCircle.status !== 'accepted') {
        console.log(`[DEBUG] Updating existing reverse circle to accepted`);
        reverseCircle.status = 'accepted';
        reverseCircle.respondedAt = new Date();
        await reverseCircle.save();
      }
      
      // Verify the circle was saved properly
      const verifyCircle = await Circle.findById(circleId);
      console.log(`[DEBUG] Verified circle status: ${verifyCircle.status}`);
      
      // Create notification for requester
      await Notification.createFriendAccepted(req.user._id, circle.requester._id, circle._id);
      
      // Emit real-time notification
      const io = req.app.get('io');
      if (io) {
        io.to(`user-${circle.requester._id}`).emit('new-notification', {
          type: 'friend_accepted',
          from: {
            id: req.user._id,
            name: req.user.name,
            avatar: req.user.avatar
          },
          message: `${req.user.name} accepted your circle request`
        });
      }

      res.json({
        success: true,
        message: 'Circle request accepted',
        friend: {
          id: circle.requester._id,
          name: circle.requester.name,
          email: circle.requester.email,
          avatar: circle.requester.avatar,
          currentLocation: circle.requester.currentLocation
        }
      });
    } else {
      console.log(`[DEBUG] Declining friend request: Circle ${circleId}`);
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
    
    console.log(`[DEBUG] Removing friendship between ${req.user._id} and ${friendId}`);
    
    // Find all circles between these two users
    const circles = await Circle.find({
      $or: [
        { requester: req.user._id, recipient: friendId },
        { requester: friendId, recipient: req.user._id }
      ]
    });
    
    if (circles.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    // Check if they are actually friends (at least one accepted circle)
    const hasAcceptedConnection = circles.some(circle => circle.status === 'accepted');
    if (!hasAcceptedConnection) {
      return res.status(400).json({ error: 'Not connected to this user' });
    }
    
    // Remove all circles between these users (bidirectional cleanup)
    const deleteResult = await Circle.deleteMany({
      $or: [
        { requester: req.user._id, recipient: friendId },
        { requester: friendId, recipient: req.user._id }
      ]
    });
    
    console.log(`[DEBUG] Removed ${deleteResult.deletedCount} circles between users`);

    res.json({
      success: true,
      message: 'Friend removed from circle',
      deletedCount: deleteResult.deletedCount
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
    console.log(`[DEBUG] Getting friends in town for user: ${req.user._id} (${req.user.name})`);
    
    if (!req.user.currentLocation || !req.user.currentLocation.city) {
      return res.json({
        success: true,
        friendsInTown: [],
        count: 0,
        message: 'Location not available'
      });
    }

    const circles = await Circle.getUserCircles(req.user._id);
    console.log(`[DEBUG] Found ${circles.length} circles for in-town check`);
    
    const friendsInTown = circles
      .map(circle => {
        const friend = circle.getOtherUser(req.user._id);
        console.log(`[DEBUG] Checking friend: ${friend._id} (${friend.name}) - Current user: ${req.user._id}`);
        
        // Additional safety check to prevent self-inclusion
        if (friend._id.toString() === req.user._id.toString()) {
          console.log(`[WARNING] Skipping self-reference in in-town check`);
          return null;
        }
        
        return friend;
      })
      .filter(friend => friend !== null) // Remove any null entries
      .filter(friend => {
        const hasLocation = friend.currentLocation && friend.currentLocation.city;
        const inSameCity = hasLocation && friend.currentLocation.city === req.user.currentLocation.city;
        const isPublic = friend.currentLocation && friend.currentLocation.isPublic;
        
        console.log(`[DEBUG] Friend ${friend.name}: hasLocation=${hasLocation}, inSameCity=${inSameCity}, isPublic=${isPublic}`);
        
        return hasLocation && inSameCity && isPublic;
      })
      .map(friend => ({
        id: friend._id,
        name: friend.name,
        avatar: friend.avatar,
        city: friend.currentLocation.city,
        country: friend.currentLocation.country,
        lastSeen: friend.currentLocation.lastUpdated || friend.lastActive
      }));

    console.log(`[DEBUG] Returning ${friendsInTown.length} friends in town`);

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

// @route   GET /api/circles/test-friendship/:friendEmail
// @desc    Test friendship status between current user and another user by email
// @access  Private
router.get('/test-friendship/:friendEmail', verifyToken, async (req, res) => {
  try {
    const { friendEmail } = req.params;
    
    // Find the friend by email
    const friend = await User.findOne({ email: friendEmail });
    if (!friend) {
      return res.status(404).json({ error: 'Friend not found' });
    }
    
    console.log(`[TEST] Testing friendship between ${req.user.email} (${req.user._id}) and ${friend.email} (${friend._id})`);
    
    // Get ALL circles involving these two users
    const allCircles = await Circle.find({
      $or: [
        { requester: req.user._id, recipient: friend._id },
        { requester: friend._id, recipient: req.user._id }
      ]
    }).populate('requester recipient', 'name email');
    
    console.log(`[TEST] Found ${allCircles.length} circles between users`);
    
    // Test getUserCircles for current user
    const currentUserCircles = await Circle.getUserCircles(req.user._id);
    const currentUserFriends = currentUserCircles.map(c => c.getOtherUser(req.user._id));
    const isFriendInCurrentUserList = currentUserFriends.some(f => f._id.toString() === friend._id.toString());
    
    // Test getUserCircles for friend
    const friendCircles = await Circle.getUserCircles(friend._id);
    const friendFriends = friendCircles.map(c => c.getOtherUser(friend._id));
    const isCurrentUserInFriendList = friendFriends.some(f => f._id.toString() === req.user._id.toString());
    
    res.json({
      success: true,
      test: {
        currentUser: { id: req.user._id, email: req.user.email, name: req.user.name },
        friend: { id: friend._id, email: friend.email, name: friend.name },
        allCirclesBetweenUsers: allCircles.map(c => ({
          id: c._id,
          requester: { id: c.requester._id, email: c.requester.email, name: c.requester.name },
          recipient: { id: c.recipient._id, email: c.recipient.email, name: c.recipient.name },
          status: c.status,
          createdAt: c.createdAt,
          respondedAt: c.respondedAt
        })),
        currentUserTotalFriends: currentUserCircles.length,
        friendTotalFriends: friendCircles.length,
        isFriendInCurrentUserList,
        isCurrentUserInFriendList,
        bidirectionalFriendship: isFriendInCurrentUserList && isCurrentUserInFriendList
      }
    });
  } catch (error) {
    console.error('Test friendship error:', error);
    res.status(500).json({ error: 'Failed to test friendship' });
  }
});

module.exports = router; 