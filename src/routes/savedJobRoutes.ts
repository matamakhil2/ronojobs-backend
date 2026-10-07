import { Router } from 'express';
import { getSavedJobs } from '../controllers/savedJobController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, requireRole('candidate'), getSavedJobs);

export default router;
