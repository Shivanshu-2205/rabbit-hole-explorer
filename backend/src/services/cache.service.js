import { getRedisClient } from '../config/redis.js';
import { CACHE_TTL, CACHE_KEYS } from '../utils/constants.js';

// ── Generic helpers ────────────────────────────────────────────────────────
// All methods silently return null if Redis is down — app keeps working

const get = async (key) => {
  const client = getRedisClient();
  if (!client) return null;
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

const set = async (key, value, ttl) => {
  const client = getRedisClient();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttl);
  } catch {
    // silently fail
  }
};

const del = async (key) => {
  const client = getRedisClient();
  if (!client) return;
  try {
    await client.del(key);
  } catch {
    // silently fail
  }
};

// ── User history specific ops ─────────────────────────────────────────────

const getUserHistory = (userId) =>
  get(CACHE_KEYS.userHistory(userId));

const setUserHistory = (userId, history) =>
  set(CACHE_KEYS.userHistory(userId), history, CACHE_TTL.USER_HISTORY);

// Called whenever user adds a new search or changes favourites
// Forces next read to go to MongoDB and re-populate the cache
const invalidateUserHistory = (userId) =>
  del(CACHE_KEYS.userHistory(userId));

// ── Future scalability placeholders ──────────────────────────────────────
// When you're ready to cache Wikipedia responses, add methods here:
//
// const getWikiSummary = (title) => get(CACHE_KEYS.wikiSummary(title));
// const setWikiSummary = (title, data) => set(CACHE_KEYS.wikiSummary(title), data, CACHE_TTL.WIKI_SUMMARY);

export const cacheService = {
  get,
  set,
  del,
  getUserHistory,
  setUserHistory,
  invalidateUserHistory,
};