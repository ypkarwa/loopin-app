const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Helper function to generate unique link
function generateUniqueLink() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'production' 
      ? "https://loopin-app-production.up.railway.app/api/auth/google/callback"
      : "/api/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists with this Google ID
      let existingUser = await User.findByGoogleId(profile.id);
      
      if (existingUser) {
        // Update user info and last active
        existingUser.name = profile.displayName;
        existingUser.avatar = profile.photos[0]?.value;
        existingUser.lastActive = new Date();
        await existingUser.save();
        return done(null, existingUser);
      }

      // Check if user exists with same email
      existingUser = await User.findOne({ email: profile.emails[0].value });
      
      if (existingUser) {
        // Link Google account to existing user
        existingUser.googleId = profile.id;
        existingUser.name = profile.displayName;
        existingUser.avatar = profile.photos[0]?.value;
        existingUser.isVerified = true;
        existingUser.lastActive = new Date();
        await existingUser.save();
        return done(null, existingUser);
      }

      // Create new user
      const newUser = new User({
        googleId: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        avatar: profile.photos[0]?.value,
        isVerified: true,
        lastActive: new Date(),
        shareableLink: generateUniqueLink() // Explicitly generate shareableLink
      });

      await newUser.save();
      return done(null, newUser);
      
    } catch (error) {
      console.error('Google OAuth error:', error);
      return done(error, null);
    }
  }
));

module.exports = passport; 