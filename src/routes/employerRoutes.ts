import { Router } from 'express';
import {
  getEmployerJobs,
  getJobApplicants,
  getEmployerStats,
} from '../controllers/employerController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/jobs', authenticate, requireRole('employer', 'admin'), getEmployerJobs);
router.get('/jobs/:id/applicants', authenticate, requireRole('employer', 'admin'), getJobApplicants);
router.get('/stats', authenticate, requireRole('employer', 'admin'), getEmployerStats);

export default router;
