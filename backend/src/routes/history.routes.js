import { Router } from 'express';
import { historyController } from '../controllers/history.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validator.middleware.js';
import { saveHistorySchema, mergeHistorySchema } from '../validators/history.validators.js';

const router = Router();

// All history routes require auth
router.use(verifyJWT);

router.get('/',       historyController.getHistory);
router.post('/',      validate(saveHistorySchema),  historyController.saveSearch);
router.post('/merge', validate(mergeHistorySchema), historyController.mergeGuestHistory);

export { router as historyRoutes };