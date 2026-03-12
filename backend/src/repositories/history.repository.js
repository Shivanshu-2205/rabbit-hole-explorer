import { History } from '../models/history.model.js';
import { LIMITS } from '../utils/constants.js';

// All MongoDB queries for History — no business logic here

const findByUserId = (userId) =>
  History.find({ userId }).sort({ createdAt: -1 }).limit(LIMITS.MAX_HISTORY_PER_USER);

const countByUserId = (userId) =>
  History.countDocuments({ userId });

const create = (data) =>
  History.create(data);

// Deletes the oldest entry for a user — called when limit is exceeded
const deleteOldest = (userId) =>
  History.findOneAndDelete({ userId }, { sort: { createdAt: 1 } });

// Delete all history for a user (used during account deletion / clear)
const deleteAllByUserId = (userId) =>
  History.deleteMany({ userId });

// Bulk insert — used when merging guest session history on login
const insertMany = (entries) =>
  History.insertMany(entries, { ordered: false }); // ordered:false = don't stop on one fail

export const historyRepository = {
  findByUserId,
  countByUserId,
  create,
  deleteOldest,
  deleteAllByUserId,
  insertMany,
};