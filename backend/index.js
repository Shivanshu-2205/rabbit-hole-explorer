import dotenv from 'dotenv';
dotenv.config();

import { app } from './app.js';
import { connectDB } from './src/db/index.js';
import { connectRedis } from './src/config/redis.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();

    app.listen(PORT, () => {
      console.log(` Server running on http://localhost:${PORT}`);
      console.log(` API available at http://localhost:${PORT}/api`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error(' Failed to start server:', err.message);
    process.exit(1);
  }
};

startServer();