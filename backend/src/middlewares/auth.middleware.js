import { verifyAccessToken } from '../utils/tokens.js';
import { userRepository } from '../repositories/user.repository.js';
import { ApiError } from '../utils/api-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HTTP } from '../utils/constants.js';

// Protects routes — must have a valid access token in Authorization header
// Usage in routes: router.get('/protected', verifyJWT, controller)
//
// Frontend sends: Authorization: Bearer <accessToken>

const verifyJWT = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(HTTP.UNAUTHORIZED, 'Access token required');
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Access token expired'
      : 'Invalid access token';
    throw new ApiError(HTTP.UNAUTHORIZED, message);
  }

  const user = await userRepository.findById(decoded._id);
  if (!user) {
    throw new ApiError(HTTP.UNAUTHORIZED, 'User no longer exists');
  }

  // Attach user to request so controllers can use req.user
  req.user = user;
  next();
});

export { verifyJWT };