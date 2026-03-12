import { userRepository } from '../repositories/user.repository.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/tokens.js';
import { ApiError } from '../utils/api-error.js';
import { HTTP } from '../utils/constants.js';

// ── Register ───────────────────────────────────────────────────────────────
const register = async ({ email, password }) => {
  // Check if email already taken
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw new ApiError(HTTP.CONFLICT, 'Email already registered');
  }

  // Create user — password hashing handled in model pre-save hook
  const user = await userRepository.create({ email, password });

  // Generate tokens straight away so user is logged in after register
  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Save refresh token to DB so we can invalidate on logout
  await userRepository.updateRefreshToken(user._id, refreshToken);

  return {
    user:         { _id: user._id, email: user.email },
    accessToken,
    refreshToken,
  };
};

// ── Login ─────────────────────────────────────────────────────────────────
const login = async ({ email, password }) => {
  // findByEmail uses .select('+password') so we get the hashed password
  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new ApiError(HTTP.UNAUTHORIZED, 'Invalid email or password');
  }

  const isValid = await user.isPasswordCorrect(password);
  if (!isValid) {
    // Same message as above — don't tell attacker which field was wrong
    throw new ApiError(HTTP.UNAUTHORIZED, 'Invalid email or password');
  }

  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await userRepository.updateRefreshToken(user._id, refreshToken);

  return {
    user:         { _id: user._id, email: user.email },
    accessToken,
    refreshToken,
  };
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

  // Check the token stored in DB matches — this lets us invalidate on logout
  const user = await userRepository.findByIdWithTokens(decoded._id);
  if (!user || user.refreshToken !== incomingRefreshToken) {
    throw new ApiError(HTTP.UNAUTHORIZED, 'Refresh token has been revoked');
  }

  const newAccessToken  = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  await userRepository.updateRefreshToken(user._id, newRefreshToken);

  return {
    accessToken:  newAccessToken,
    refreshToken: newRefreshToken,
  };
};

// ── Logout ────────────────────────────────────────────────────────────────
const logout = async (userId) => {
  // Clearing refresh token from DB invalidates it immediately
  // Even if someone has the old token they can't use it
  await userRepository.clearRefreshToken(userId);
};

export const authService = {
  register,
  login,
  refreshAccessToken,
  logout,
};