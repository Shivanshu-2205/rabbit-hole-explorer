import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/user.model.js';

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email found in Google profile'), null);
        }

        // Case 1 — user already signed in with Google before
        let user = await User.findOne({ googleId: profile.id });
        if (user) return done(null, user);

        // Case 2 — user registered locally with same email → link Google
        user = await User.findOne({ email });
        if (user) {
          user.googleId        = profile.id;
          user.authProvider    = 'google';
          user.isEmailVerified = true;  // Google already verified it
          await user.save();
          return done(null, user);
        }

        // Case 3 — brand new user via Google
        user = await User.create({
          email,
          googleId:        profile.id,
          authProvider:    'google',
          isEmailVerified: true,  // Google already verified it
        });

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

export default passport;
