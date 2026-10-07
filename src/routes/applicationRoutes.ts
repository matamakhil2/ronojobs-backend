import { Router } from 'express';
import {
  getCandidateApplications,
  getApplicationById,
  updateApplicationStatus,
} from '../controllers/applicationController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Candidate: List their applied jobs
router.get('/', authenticate, requireRole('candidate'), getCandidateApplications);

// View specific application details (Candidate, Employer of that job, or Admin)
router.get('/:id', authenticate, getApplicationById);

// Employer or Admin: Update status (Applied -> Shortlisted -> Interview -> Selected / Rejected)
router.patch('/:id/status', authenticate, requireRole('employer', 'admin'), updateApplicationStatus);

export default router;
