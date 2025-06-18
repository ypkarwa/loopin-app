const mongoose = require('mongoose');

const circleSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'blocked'],
    default: 'pending'
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date,
    default: null
  },
  // For tracking how they connected
  connectionMethod: {
    type: String,
    enum: ['link', 'contact', 'manual'],
    default: 'link'
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate circle requests
circleSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Static methods
circleSchema.statics.findCircleStatus = function(userId1, userId2) {
  // Ensure we don't allow self-circles
  if (userId1.toString() === userId2.toString()) {
    return null;
  }
  
  return this.findOne({
    $or: [
      { requester: userId1, recipient: userId2 },
      { requester: userId2, recipient: userId1 }
    ]
  });
};

circleSchema.statics.getUserCircles = function(userId, status = 'accepted') {
  return this.find({
    $and: [
      {
        $or: [
          { requester: userId, status },
          { recipient: userId, status }
        ]
      },
      // Ensure requester and recipient are different (prevent self-circles)
      { $expr: { $ne: ['$requester', '$recipient'] } }
    ]
  }).populate('requester recipient', 'name email avatar currentLocation lastActive');
};

circleSchema.statics.getPendingRequests = function(userId) {
  return this.find({
    recipient: userId,
    status: 'pending',
    // Ensure requester is not the same as recipient
    $expr: { $ne: ['$requester', '$recipient'] }
  }).populate('requester', 'name email avatar');
};

circleSchema.statics.areConnected = function(userId1, userId2) {
  // Prevent self-connection checks
  if (userId1.toString() === userId2.toString()) {
    return null;
  }
  
  return this.findOne({
    $or: [
      { requester: userId1, recipient: userId2, status: 'accepted' },
      { requester: userId2, recipient: userId1, status: 'accepted' }
    ]
  });
};

// Instance methods
circleSchema.methods.accept = function() {
  this.status = 'accepted';
  this.respondedAt = new Date();
  return this.save();
};

circleSchema.methods.decline = function() {
  this.status = 'declined';
  this.respondedAt = new Date();
  return this.save();
};

circleSchema.methods.block = function() {
  this.status = 'blocked';
  this.respondedAt = new Date();
  return this.save();
};

// Get the other user in the circle relationship
circleSchema.methods.getOtherUser = function(currentUserId) {
  return this.requester.toString() === currentUserId.toString() 
    ? this.recipient 
    : this.requester;
};

module.exports = mongoose.model('Circle', circleSchema); 