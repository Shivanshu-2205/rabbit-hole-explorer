// ── Redis TTL values (in seconds) ─────────────────────────────────────────
export const CACHE_TTL = {
  USER_HISTORY:   60 * 60,        // 1 hour  — invalidated on write anyway
  // Future expansions (scalability placeholders):
  // WIKI_SUMMARY: 60 * 60 * 24, // 24 hours — Wikipedia doesn't change often
  // WIKI_LINKS:   60 * 60 * 6,  // 6 hours
};

// ── Redis key prefixes ─────────────────────────────────────────────────────
// Namespaced so keys never collide when we add more cached resources
export const CACHE_KEYS = {
  userHistory:    (userId) => `user:${userId}:history`,
  // Future:
  // wikiSummary: (title)  => `wiki:summary:${title}`,
  // wikiLinks:   (title)  => `wiki:links:${title}`,
};

// ── Business logic limits ─────────────────────────────────────────────────
export const LIMITS = {
  MAX_HISTORY_PER_USER: 10,  // MongoDB free tier is small — keep it lean
};

// ── HTTP status codes (avoids magic numbers in code) ─────────────────────
export const HTTP = {
  OK:           200,
  CREATED:      201,
  BAD_REQUEST:  400,
  UNAUTHORIZED: 401,
  FORBIDDEN:    403,
  NOT_FOUND:    404,
  CONFLICT:     409,
  SERVER_ERROR: 500,
};