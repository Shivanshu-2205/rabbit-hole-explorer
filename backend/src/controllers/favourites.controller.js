import { favouritesService } from '../services/favourites.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HTTP } from '../utils/constants.js';

const getFavourites = asyncHandler(async (req, res) => {
  const favourites = await favouritesService.getFavourites(req.user._id);
  res.status(HTTP.OK).json(
    new ApiResponse(HTTP.OK, 'Favourites fetched', favourites)
  );
});

const saveFavourite = asyncHandler(async (req, res) => {
  const favourite = await favouritesService.saveFavourite(req.user._id, req.body);
  res.status(HTTP.CREATED).json(
    new ApiResponse(HTTP.CREATED, 'Saved to favourites', favourite)
  );
});

const renameFavourite = asyncHandler(async (req, res) => {
  const updated = await favouritesService.renameFavourite(
    req.user._id,
    req.params.id,
    req.body.customName
  );
  res.status(HTTP.OK).json(
    new ApiResponse(HTTP.OK, 'Favourite renamed', updated)
  );
});

const deleteFavourite = asyncHandler(async (req, res) => {
  await favouritesService.deleteFavourite(req.user._id, req.params.id);
  res.status(HTTP.OK).json(
    new ApiResponse(HTTP.OK, 'Favourite deleted')
  );
});

export const favouritesController = {
  getFavourites,
  saveFavourite,
  renameFavourite,
  deleteFavourite,
};