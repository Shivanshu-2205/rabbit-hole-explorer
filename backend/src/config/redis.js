import Redis from 'ioredis';

let redisClient = null;

const connectRedis = async () => {
  try {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      // Retry strategy — wait 500ms between retries, give up after 3
      retryStrategy: (times) => {
        if (times > 3) {
          console.error(' Redis retry limit reached. Giving up.');
          return null; // stop retrying
        }
        return Math.min(times * 500, 2000);
      },
      // Don't crash the whole server if Redis is down
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    await redisClient.connect();
    console.log(' Redis connected');

    redisClient.on('error', (err) => {
      // Log but don't crash — app still works without cache
      console.warn('  Redis error:', err.message);
    });

  } catch (err) {
    // Redis is optional — if it fails, app continues without caching
    console.warn('  Redis unavailable, running without cache:', err.message);
    redisClient = null;
  }
};

// Getter used by cache.service.js
// Always check if client is available before using
const getRedisClient = () => redisClient;

export { connectRedis, getRedisClient };