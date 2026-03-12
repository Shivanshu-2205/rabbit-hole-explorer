import jwt from 'jsonwebtoken';

// ── Access token ───────────────────────────────────────────────────────────
// Short-lived (15m). Sent with every protected API request.
// Contains minimal payload — just enough to identify the user.
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      _id:   user._id,
      email: user.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m' }
  );
};

// ── Refresh token ─────────────────────────────────────────────────────────
// Long-lived (30d). Used ONLY to get a new access token.
// Stored in MongoDB on the user document so it can be invalidated on logout.
const generateRefreshToken = (user) => {
  return jwt.sign(
    { _id: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '30d' }
  );
};

// ── Verify helpers ────────────────────────────────────────────────────────
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
};

export {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};