import crypto from 'crypto';
import { userRepository } from '../repositories/user.repository.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/tokens.js';
import { sendVerificationEmail } from '../utils/mail.js';
import { ApiError } from '../utils/api-error.js';
import { HTTP } from '../utils/constants.js';

// ── Register (local) ──────────────────────────────────────────────────────
const register = async ({ email, password }) => {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw new ApiError(HTTP.CONFLICT, 'Email already registered');
  }

  // Generate a secure verification token
  const verificationToken  = crypto.randomBytes(32).toString('hex');
  const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await userRepository.create({
    email,
    password,
    emailVerificationToken:  verificationToken,
    emailVerificationExpiry: verificationExpiry,
    isEmailVerified:         false,
    authProvider:            'local',
  });

  // Send the verification email — don't block registration if it fails
  try {
    await sendVerificationEmail(email, verificationToken);
  } catch (err) {
    console.error('[MAIL ERROR]', err.message);
  }

  return { message: 'Account created. Please check your email to verify your account.' };
};

// ── Verify Email ──────────────────────────────────────────────────────────
const verifyEmail = async (token) => {
  if (!token) throw new ApiError(HTTP.BAD_REQUEST, 'Verification token is required');

  const user = await userRepository.findByVerificationToken(token);
  if (!user) {
    throw new ApiError(HTTP.BAD_REQUEST, 'Invalid or expired verification token');
  }

  await userRepository.markEmailVerified(user._id);

  // Issue tokens so user is logged in immediately after verification
  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await userRepository.updateRefreshToken(user._id, refreshToken);

  return {
    user: { _id: user._id, email: user.email },
    accessToken,
    refreshToken,
  };
};

// ── Login (local) ─────────────────────────────────────────────────────────
const login = async ({ email, password }) => {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new ApiError(HTTP.UNAUTHORIZED, 'Invalid email or password');
  }

  // Block Google-only accounts from using password login
  if (user.authProvider === 'google' && !user.password) {
    throw new ApiError(HTTP.UNAUTHORIZED, 'This account uses Google Sign-In. Please login with Google.');
  }

  const isValid = await user.isPasswordCorrect(password);
  if (!isValid) {
    throw new ApiError(HTTP.UNAUTHORIZED, 'Invalid email or password');
  }

  if (!user.isEmailVerified) {
    throw new ApiError(HTTP.FORBIDDEN, 'Please verify your email before logging in.');
  }

  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await userRepository.updateRefreshToken(user._id, refreshToken);

  return {
    user: { _id: user._id, email: user.email },
    accessToken,
    refreshToken,
  };
};

// ── Google OAuth — issue tokens after passport callback ───────────────────
const googleLogin = async (user) => {
  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await userRepository.updateRefreshToken(user._id, refreshToken);

  return { accessToken, refreshToken };
};

// ── Refresh access token ──────────────────────────────────────────────────
const refreshAccessToken = async (incomingRefreshToken) => {
  if (!incomingRefreshToken) {
    throw new ApiError(HTTP.UNAUTHORIZED, 'Refresh token required');
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(incomingRefreshToken);
  } catch {
    throw new ApiError(HTTP.UNAUTHORIZED, 'Invalid or expired refresh token');
  }

  const user = await userRepository.findByIdWithTokens(decoded._id);
  if (!user || user.refreshToken !== incomingRefreshToken) {
    throw new ApiError(HTTP.UNAUTHORIZED, 'Refresh token has been revoked');
  }

  const newAccessToken  = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);
  await userRepository.updateRefreshToken(user._id, newRefreshToken);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

// ── Logout ────────────────────────────────────────────────────────────────
const logout = async (userId) => {
  await userRepository.clearRefreshToken(userId);
};

// ── Resend verification email ─────────────────────────────────────────────
const resendVerification = async (email) => {
  const user = await userRepository.findByEmail(email);
  if (!user) throw new ApiError(HTTP.NOT_FOUND, 'No account with that email');
  if (user.isEmailVerified) throw new ApiError(HTTP.CONFLICT, 'Email already verified');

  const verificationToken  = crypto.randomBytes(32).toString('hex');
  const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  user.emailVerificationToken  = verificationToken;
  user.emailVerificationExpiry = verificationExpiry;
  await user.save({ validateBeforeSave: false });

  await sendVerificationEmail(email, verificationToken);
  return { message: 'Verification email resent.' };
};

export const authService = {
  register,
  verifyEmail,
  login,
  googleLogin,
  refreshAccessToken,
  logout,
  resendVerification,
};
