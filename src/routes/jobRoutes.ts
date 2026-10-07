import { Router } from 'express';
import {
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
} from '../controllers/jobController';
import { applyToJob } from '../controllers/applicationController';
import { saveJob, unsaveJob } from '../controllers/savedJobController';
import {
  authenticate,
  optionalAuthenticate,
  requireRole,
} from '../middleware/auth';

const router = Router();

// Public / Candidate exploration
router.get('/', optionalAuthenticate, getJobs);
router.get('/:id', optionalAuthenticate, getJobById);

// Employer / Admin management
router.post('/', authenticate, requireRole('employer', 'admin'), createJob);
router.put('/:id', authenticate, requireRole('employer', 'admin'), updateJob);
router.delete('/:id', authenticate, requireRole('employer', 'admin'), deleteJob);

// Candidate Actions on a job
router.post('/:id/apply', authenticate, requireRole('candidate'), applyToJob);
router.post('/:id/save', authenticate, requireRole('candidate'), saveJob);
router.delete('/:id/save', authenticate, requireRole('candidate'), unsaveJob);

export default router;
