const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['friend_request', 'friend_accepted', 'friend_in_town', 'location_update'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    // Additional data specific to notification type
    circleId: mongoose.Schema.Types.ObjectId,
    locationData: {
      city: String,
      country: String,
      latitude: Number,
      longitude: Number
    }
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  // For tracking delivery status
  deliveryStatus: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed'],
    default: 'pending'
  },
  sentAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better query performance
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

// Static methods
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ recipient: userId, isRead: false });
};

notificationSchema.statics.getUserNotifications = function(userId, limit = 20) {
  return this.find({ recipient: userId })
    .populate('sender', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(limit);
};

notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    { recipient: userId, isRead: false },
    { 
      isRead: true, 
      readAt: new Date() 
    }
  );
};

// Instance methods
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsSent = function() {
  this.deliveryStatus = 'sent';
  this.sentAt = new Date();
  return this.save();
};

// Static helper methods for creating specific notification types
notificationSchema.statics.createFriendRequest = function(senderId, recipientId, circleId) {
  return this.create({
    recipient: recipientId,
    sender: senderId,
    type: 'friend_request',
    title: 'New Circle Request',
    message: 'wants to add you to their circle',
    data: { circleId }
  });
};

notificationSchema.statics.createFriendAccepted = function(senderId, recipientId, circleId) {
  return this.create({
    recipient: recipientId,
    sender: senderId,
    type: 'friend_accepted',
    title: 'Circle Request Accepted',
    message: 'accepted your circle request',
    data: { circleId }
  });
};

notificationSchema.statics.createLocationUpdate = function(senderId, recipientId, locationData) {
  return this.create({
    recipient: recipientId,
    sender: senderId,
    type: 'friend_in_town',
    title: 'Friend in Town!',
    message: `is in ${locationData.city}!`,
    data: { locationData }
  });
};

module.exports = mongoose.model('Notification', notificationSchema); 