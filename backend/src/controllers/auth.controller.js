import { authService } from '../services/auth.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HTTP } from '../utils/constants.js';

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(HTTP.CREATED).json(
    new ApiResponse(HTTP.CREATED, result.message, null)
  );
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;
  const result = await authService.verifyEmail(token);

  const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  res.redirect(
    `${frontendUrl}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`
  );
});

const resendVerification = asyncHandler(async (req, res) => {
  const result = await authService.resendVerification(req.body.email);
  res.status(HTTP.OK).json(new ApiResponse(HTTP.OK, result.message, null));
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.status(HTTP.OK).json(
    new ApiResponse(HTTP.OK, 'Logged in successfully', result)
  );
});

const googleCallback = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken } = await authService.googleLogin(req.user);

  const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  res.redirect(
    `${frontendUrl}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`
  );
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const result = await authService.refreshAccessToken(req.body.refreshToken);
  res.status(HTTP.OK).json(new ApiResponse(HTTP.OK, 'Token refreshed', result));
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);
  res.status(HTTP.OK).json(new ApiResponse(HTTP.OK, 'Logged out successfully'));
});

const getProfile = asyncHandler(async (req, res) => {
  const { _id, email, createdAt, authProvider, isEmailVerified } = req.user;
  res.status(HTTP.OK).json(
    new ApiResponse(HTTP.OK, 'Profile fetched', { _id, email, createdAt, authProvider, isEmailVerified })
  );
});

export const authController = {
  register,
  verifyEmail,
  resendVerification,
  login,
  googleCallback,
  refreshAccessToken,
  logout,
  getProfile,
};
