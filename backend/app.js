import express from 'express';
import cors from 'cors';

import './src/config/passport.js'; // registers the Google strategy
import passport from 'passport';

import { authRoutes }       from './src/routes/auth.routes.js';
import { historyRoutes }    from './src/routes/history.routes.js';
import { favouritesRoutes } from './src/routes/favourites.routes.js';
import { healthcheckRoutes } from './src/routes/healthcheck.routes.js';

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// ── Passport (stateless — no sessions) ───────────────────────────────────
app.use(passport.initialize());

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/history',    historyRoutes);
app.use('/api/favourites', favouritesRoutes);
app.use('/api/health',     healthcheckRoutes);

// ── 404 fallback ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Global error handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message    = err.message    || 'Internal Server Error';

  res.status(statusCode).json({
    success:  false,
    message,
    errors:   err.errors || [],
    stack:    process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

export { app };
