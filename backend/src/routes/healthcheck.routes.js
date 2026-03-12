import { Router } from 'express';
import { healthcheckController } from '../controllers/healthcheck.controller.js';

const router = Router();

router.get('/', healthcheckController.healthcheck);

export { router as healthcheckRoutes };