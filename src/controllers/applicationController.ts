import { Request, Response } from 'express';
import { query } from '../config/db';

export const applyToJob = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id: jobId } = req.params;
    const { cover_note, resume_url } = req.body;
    const candidateId = req.user.userId;

    // Check if job exists and is open
    const jobRes = await query('SELECT id, status, title FROM jobs WHERE id = $1', [jobId]);
    if (jobRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Job not found.' });
      return;
    }

    if (jobRes.rows[0].status === 'closed') {
      res.status(400).json({ success: false, message: 'This job posting is closed for applications.' });
      return;
    }

    // Check if already applied
    const existing = await query(
      'SELECT id, status FROM applications WHERE job_id = $1 AND candidate_id = $2',
      [jobId, candidateId]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({
        success: false,
        message: 'You have already applied for this position.',
        currentStatus: existing.rows[0].status,
      });
      return;
    }

    // If no resume_url provided, fetch from candidate profile
    let finalResumeUrl = resume_url;
    if (!finalResumeUrl) {
      const prof = await query('SELECT resume_url FROM candidate_profiles WHERE user_id = $1', [candidateId]);
      if (prof.rows.length > 0 && prof.rows[0].resume_url) {
        finalResumeUrl = prof.rows[0].resume_url;
      }
    }

    const insertRes = await query(
      `INSERT INTO applications (job_id, candidate_id, cover_note, resume_url, status)
       VALUES ($1, $2, $3, $4, 'Applied')
       RETURNING *`,
      [jobId, candidateId, cover_note || null, finalResumeUrl || null]
    );

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully!',
      data: insertRes.rows[0],
    });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ success: false, message: 'You have already applied for this position.' });
      return;
    }
    console.error('applyToJob error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit application.' });
  }
};

export const getCandidateApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const appQuery = `
      SELECT 
        a.id,
        a.job_id,
        a.status,
        a.cover_note,
        a.resume_url,
        a.created_at AS applied_date,
        a.updated_at AS last_updated,
        j.title AS job_title,
        j.location AS job_location,
        j.employment_type,
        j.experience_level,
        j.salary_min,
        j.salary_max,
        j.salary_currency,
        j.status AS job_status,
        c.name AS company_name,
        c.logo_url AS company_logo
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      LEFT JOIN companies c ON j.company_id = c.id
      WHERE a.candidate_id = $1
      ORDER BY a.created_at DESC
    `;

    const result = await query(appQuery, [req.user.userId]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    console.error('getCandidateApplications error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve applications.' });
  }
};

export const getApplicationById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const appQuery = `
      SELECT 
        a.*,
        j.title AS job_title,
        j.location AS job_location,
        j.employer_id,
        c.name AS company_name,
        c.logo_url AS company_logo,
        cp.full_name AS candidate_name,
        u.email AS candidate_email,
        cp.phone AS candidate_phone,
        cp.skills AS candidate_skills,
        cp.experience_years AS candidate_experience
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      LEFT JOIN companies c ON j.company_id = c.id
      LEFT JOIN users u ON a.candidate_id = u.id
      LEFT JOIN candidate_profiles cp ON a.candidate_id = cp.user_id
      WHERE a.id = $1
    `;

    const result = await query(appQuery, [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Application not found.' });
      return;
    }

    const app = result.rows[0];

    // Authorization: candidate who applied, employer who owns job, or admin
    const isCandidate = app.candidate_id === req.user.userId;
    const isEmployer = app.employer_id === req.user.userId;
    const isAdmin = req.user.role === 'admin';

    if (!isCandidate && !isEmployer && !isAdmin) {
      res.status(403).json({ success: false, message: 'Access denied.' });
      return;
    }

    res.json({
      success: true,
      data: app,
    });
  } catch (error: any) {
    console.error('getApplicationById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve application details.' });
  }
};

export const updateApplicationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Applied', 'Shortlisted', 'Interview', 'Selected', 'Rejected'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    // Verify employer owns the job
    const checkQuery = `
      SELECT a.id, a.candidate_id, a.job_id, j.employer_id, j.title AS job_title
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE a.id = $1
    `;
    const checkRes = await query(checkQuery, [id]);

    if (checkRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Application not found.' });
      return;
    }

    const app = checkRes.rows[0];
    if (app.employer_id !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ success: false, message: 'You can only update applications for your own jobs.' });
      return;
    }

    const updateRes = await query(
      `UPDATE applications
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    // Create notification for candidate
    await query(
      `INSERT INTO notifications (user_id, title, message)
       VALUES ($1, $2, $3)`,
      [
        app.candidate_id,
        `Application Status Updated: ${status}`,
        `Your application for "${app.job_title}" has been updated to "${status}".`,
      ]
    );

    res.json({
      success: true,
      message: `Application status updated to ${status}.`,
      data: updateRes.rows[0],
    });
  } catch (error: any) {
    console.error('updateApplicationStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to update application status.' });
  }
};
