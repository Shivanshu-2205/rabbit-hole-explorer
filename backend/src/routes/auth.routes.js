import { Router } from 'express';
import passport from 'passport';
import { authController } from '../controllers/auth.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validator.middleware.js';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/auth.validators.js';

const router = Router();

// ── Local auth ────────────────────────────────────────────────────────────
router.post('/register', validate(registerSchema), authController.register);
router.post('/login',    validate(loginSchema),    authController.login);
router.post('/refresh',  validate(refreshTokenSchema), authController.refreshAccessToken);

// ── Email verification ────────────────────────────────────────────────────
router.get('/verify-email',          authController.verifyEmail);
router.post('/resend-verification',  authController.resendVerification);

// ── Google OAuth ──────────────────────────────────────────────────────────
// Step 1 — redirect user to Google consent screen
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// Step 2 — Google redirects back here with a code
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/api/auth/google/failure' }),
  authController.googleCallback
);

router.get('/google/failure', (req, res) => {
  res.status(401).json({ success: false, message: 'Google authentication failed' });
});

// ── Protected ─────────────────────────────────────────────────────────────
router.post('/logout', verifyJWT, authController.logout);
router.get('/me',      verifyJWT, authController.getProfile);

export { router as authRoutes };
