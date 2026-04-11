import { User } from '../models/user.model.js';

// All MongoDB queries for User — no business logic here

const findByEmail = (email) =>
  User.findOne({ email }).select('+password +refreshToken');

const findById = (id) =>
  User.findById(id);

const findByIdWithTokens = (id) =>
  User.findById(id).select('+refreshToken');

const findByVerificationToken = (token) =>
  User.findOne({
    emailVerificationToken:  token,
    emailVerificationExpiry: { $gt: Date.now() },
  }).select('+emailVerificationToken +emailVerificationExpiry');

const create = (data) =>
  User.create(data);

const updateRefreshToken = (userId, refreshToken) =>
  User.findByIdAndUpdate(userId, { refreshToken }, { new: true });

const clearRefreshToken = (userId) =>
  User.findByIdAndUpdate(userId, { refreshToken: null });

const markEmailVerified = (userId) =>
  User.findByIdAndUpdate(userId, {
    isEmailVerified:         true,
    emailVerificationToken:  null,
    emailVerificationExpiry: null,
  });

export const userRepository = {
  findByEmail,
  findById,
  findByIdWithTokens,
  findByVerificationToken,
  create,
  updateRefreshToken,
  clearRefreshToken,
  markEmailVerified,
};
