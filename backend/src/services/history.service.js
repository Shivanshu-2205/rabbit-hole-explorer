import { historyRepository } from '../repositories/history.repository.js';
import { cacheService } from './cache.service.js';
import { LIMITS } from '../utils/constants.js';

// ── Get history for a user ─────────────────────────────────────────────────
// Checks Redis first — falls back to MongoDB on cache miss
const getHistory = async (userId) => {
  // 1. Try cache
  const cached = await cacheService.getUserHistory(userId);
  if (cached) {
    return cached; // cache hit
  }

  // 2. Cache miss — hit MongoDB
  const history = await historyRepository.findByUserId(userId);

  // 3. Populate cache for next request
  await cacheService.setUserHistory(userId, history);

  return history;
};

// ── Save a new search to history ───────────────────────────────────────────
const saveSearch = async (userId, { searchTerm, path }) => {
  // Check current count
  const count = await historyRepository.countByUserId(userId);

  // If at limit, remove oldest before inserting new one
  if (count >= LIMITS.MAX_HISTORY_PER_USER) {
    await historyRepository.deleteOldest(userId);
  }

  const entry = await historyRepository.create({ userId, searchTerm, path });

  // Invalidate cache — next getHistory will re-fetch from MongoDB
  await cacheService.invalidateUserHistory(userId);

  return entry;
};

// ── Merge guest session history on login ───────────────────────────────────
// Called right after login if the guest had session history
// guestHistory is the array from the frontend's sessionStorage
const mergeGuestHistory = async (userId, guestHistory) => {
  if (!guestHistory || guestHistory.length === 0) return;

  // Get how many slots are left
  const currentCount = await historyRepository.countByUserId(userId);
  const slotsLeft    = LIMITS.MAX_HISTORY_PER_USER - currentCount;

  if (slotsLeft <= 0) return; // already at limit, don't overwrite anything

  // Take the most recent guest entries that fit
  const toMerge = guestHistory
    .slice(-slotsLeft)                        // take last N (most recent)
    .map(entry => ({
      userId,
      searchTerm: entry.searchTerm,
      path:       entry.path || [],
      createdAt:  entry.createdAt ? new Date(entry.createdAt) : new Date(),
    }));

  await historyRepository.insertMany(toMerge);

  // Invalidate cache after merge
  await cacheService.invalidateUserHistory(userId);
};

export const historyService = {
  getHistory,
  saveSearch,
  mergeGuestHistory,
};