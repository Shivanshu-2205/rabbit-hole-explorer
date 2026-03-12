import { getRedisClient } from '../config/redis.js';
import { ApiResponse } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HTTP } from '../utils/constants.js';

const healthcheck = asyncHandler(async (req, res) => {
  const redisStatus = getRedisClient() ? 'connected' : 'unavailable';
  res.status(HTTP.OK).json(
    new ApiResponse(HTTP.OK, 'Server is healthy', {
      server:    'ok',
      redis:     redisStatus,
      timestamp: new Date().toISOString(),
    })
  );
});

export const healthcheckController = { healthcheck };