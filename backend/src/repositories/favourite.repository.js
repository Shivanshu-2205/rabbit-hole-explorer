import { Favourite } from '../models/favourite.model.js';

// All MongoDB queries for Favourites — no business logic here

const findByUserId = (userId) =>
  Favourite.find({ userId }).sort({ createdAt: -1 });

const findById = (id) =>
  Favourite.findById(id);

const findByIdAndUserId = (id, userId) =>
  Favourite.findOne({ _id: id, userId }); // ensures user owns the document

const create = (data) =>
  Favourite.create(data);

const rename = (id, userId, customName) =>
  Favourite.findOneAndUpdate(
    { _id: id, userId },
    { customName },
    { new: true }
  );

const deleteById = (id, userId) =>
  Favourite.findOneAndDelete({ _id: id, userId });

export const favouriteRepository = {
  findByUserId,
  findById,
  findByIdAndUserId,
  create,
  rename,
  deleteById,
};