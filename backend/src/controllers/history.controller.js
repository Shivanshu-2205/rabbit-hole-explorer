import { historyService } from '../services/history.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HTTP } from '../utils/constants.js';

const getHistory = asyncHandler(async (req, res) => {
  const history = await historyService.getHistory(req.user._id);
  res.status(HTTP.OK).json(
    new ApiResponse(HTTP.OK, 'History fetched', history)
  );
});

const saveSearch = asyncHandler(async (req, res) => {
  const entry = await historyService.saveSearch(req.user._id, req.body);
  res.status(HTTP.CREATED).json(
    new ApiResponse(HTTP.CREATED, 'Search saved to history', entry)
  );
});

const mergeGuestHistory = asyncHandler(async (req, res) => {
  await historyService.mergeGuestHistory(req.user._id, req.body.guestHistory);
  res.status(HTTP.OK).json(
    new ApiResponse(HTTP.OK, 'Guest history merged')
  );
});

export const historyController = { getHistory, saveSearch, mergeGuestHistory };