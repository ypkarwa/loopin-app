const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    sparse: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  name: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    default: null
  },
  shareableLink: {
    type: String,
    unique: true,
    required: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  preferences: {
    notifications: {
      type: Boolean,
      default: true
    },
    locationSharing: {
      type: Boolean,
      default: true
    }
  },
  currentLocation: {
    city: String,
    country: String,
    latitude: Number,
    longitude: Number,
    isPublic: {
      type: Boolean,
      default: false
    },
    lastUpdated: Date
  }
}, {
  timestamps: true
});

// Generate unique shareable link
userSchema.pre('save', function(next) {
  if (!this.shareableLink) {
    this.shareableLink = generateUniqueLink();
  }
  next();
});

// Helper function to generate unique link
function generateUniqueLink() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Instance methods
userSchema.methods.updateLastActive = function() {
  this.lastActive = new Date();
  return this.save();
};

userSchema.methods.updateLocation = function(locationData) {
  this.currentLocation = {
    ...this.currentLocation,
    ...locationData,
    lastUpdated: new Date()
  };
  return this.save();
};

// Static methods
userSchema.statics.findByShareableLink = function(link) {
  return this.findOne({ shareableLink: link });
};

userSchema.statics.findByGoogleId = function(googleId) {
  return this.findOne({ googleId });
};

module.exports = mongoose.model('User', userSchema); 