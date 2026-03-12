import { authService } from '../services/auth.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HTTP } from '../utils/constants.js';

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(HTTP.CREATED).json(
    new ApiResponse(HTTP.CREATED, 'Account created successfully', result)
  );
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.status(HTTP.OK).json(
    new ApiResponse(HTTP.OK, 'Logged in successfully', result)
  );
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const result = await authService.refreshAccessToken(req.body.refreshToken);
  res.status(HTTP.OK).json(
    new ApiResponse(HTTP.OK, 'Token refreshed', result)
  );
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);
  res.status(HTTP.OK).json(
    new ApiResponse(HTTP.OK, 'Logged out successfully')
  );
});

export const authController = { register, login, refreshAccessToken, logout };