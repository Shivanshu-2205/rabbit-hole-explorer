import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },

    // Optional — Google users won't have a password
    password: {
      type:      String,
      minlength: [8, 'Password must be at least 8 characters'],
      select:    false,
    },

    refreshToken: {
      type:   String,
      select: false,
    },

    // ── Google OAuth ───────────────────────────────────────────────────────
    googleId: {
      type:   String,
      sparse: true,  // allows many docs to have null googleId
      unique: true,
    },

    authProvider: {
      type:    String,
      enum:    ['local', 'google'],
      default: 'local',
    },

    // ── Email verification ─────────────────────────────────────────────────
    isEmailVerified: {
      type:    Boolean,
      default: false,
    },

    emailVerificationToken: {
      type:   String,
      select: false,
    },

    emailVerificationExpiry: {
      type:   Date,
      select: false,
    },
  },
  { timestamps: true }
);

// ── Hash password before saving ───────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Instance method: compare password ─────────────────────────────────────
userSchema.methods.isPasswordCorrect = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model('User', userSchema);
