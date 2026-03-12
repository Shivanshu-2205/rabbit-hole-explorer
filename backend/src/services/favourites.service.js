import { favouriteRepository } from '../repositories/favourite.repository.js';
import { ApiError } from '../utils/api-error.js';
import { HTTP } from '../utils/constants.js';

// ── Get all favourites for a user ─────────────────────────────────────────
const getFavourites = async (userId) => {
  return favouriteRepository.findByUserId(userId);
};

// ── Save a rabbit hole as favourite ───────────────────────────────────────
const saveFavourite = async (userId, { title, path }) => {
  const favourite = await favouriteRepository.create({ userId, title, path });
  return favourite;
};

// ── Rename a favourite ────────────────────────────────────────────────────
const renameFavourite = async (userId, favouriteId, customName) => {
  const updated = await favouriteRepository.rename(favouriteId, userId, customName);
  if (!updated) {
    throw new ApiError(HTTP.NOT_FOUND, 'Favourite not found');
  }
  return updated;
};

// ── Delete a favourite ────────────────────────────────────────────────────
const deleteFavourite = async (userId, favouriteId) => {
  const deleted = await favouriteRepository.deleteById(favouriteId, userId);
  if (!deleted) {
    throw new ApiError(HTTP.NOT_FOUND, 'Favourite not found');
  }
  return deleted;
};

export const favouritesService = {
  getFavourites,
  saveFavourite,
  renameFavourite,
  deleteFavourite,
};