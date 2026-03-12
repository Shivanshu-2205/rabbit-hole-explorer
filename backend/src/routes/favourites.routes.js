import { Router } from 'express';
import { favouritesController } from '../controllers/favourites.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validator.middleware.js';
import { saveFavouriteSchema, renameFavouriteSchema } from '../validators/history.validators.js';

const router = Router();

// All favourites routes require auth
router.use(verifyJWT);

router.get('/',         favouritesController.getFavourites);
router.post('/',        validate(saveFavouriteSchema),   favouritesController.saveFavourite);
router.patch('/:id',    validate(renameFavouriteSchema), favouritesController.renameFavourite);
router.delete('/:id',   favouritesController.deleteFavourite);

export { router as favouritesRoutes };