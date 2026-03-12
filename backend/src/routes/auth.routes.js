import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validator.middleware.js';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/auth.validators.js';

const router = Router();

// Public routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login',    validate(loginSchema),    authController.login);
router.post('/refresh',  validate(refreshTokenSchema), authController.refreshAccessToken);

// Protected route — must be logged in to log out
router.post('/logout', verifyJWT, authController.logout);

export { router as authRoutes };