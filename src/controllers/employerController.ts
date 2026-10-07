import { Request, Response } from 'express';
import { query } from '../config/db';

export const getEmployerJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employerId = req.user.userId;

    const sql = `
      SELECT 
        j.id,
        j.title,
        j.category,
        j.employment_type,
        j.location,
        j.experience_level,
        j.salary_min,
        j.salary_max,
        j.salary_currency,
        j.skills,
        j.status,
        j.created_at,
        j.updated_at,
        COUNT(a.id) AS applicants_count,
        COUNT(CASE WHEN a.status = 'Shortlisted' THEN 1 END) AS shortlisted_count,
        COUNT(CASE WHEN a.status = 'Interview' THEN 1 END) AS interview_count,
        COUNT(CASE WHEN a.status = 'Selected' THEN 1 END) AS selected_count
      FROM jobs j
      LEFT JOIN applications a ON j.id = a.job_id
      WHERE j.employer_id = $1
      GROUP BY j.id
      ORDER BY j.created_at DESC
    `;

    const result = await query(sql, [employerId]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    console.error('getEmployerJobs error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve employer jobs.' });
  }
};

export const getJobApplicants = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id: jobId } = req.params;
    const employerId = req.user.userId;

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(jobId)) {
      res.status(404).json({ success: false, message: 'Job not found.' });
      return;
    }

    // Verify ownership
    const jobCheck = await query('SELECT id, title, employer_id FROM jobs WHERE id = $1', [jobId]);
    if (jobCheck.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Job not found.' });
      return;
    }

    if (jobCheck.rows[0].employer_id !== employerId && req.user.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Access denied: not your job posting.' });
      return;
    }

    const sql = `
      SELECT 
        a.id,
        a.id AS application_id,
        a.job_id,
        a.candidate_id,
        a.status,
        a.cover_note,
        a.resume_url,
        a.created_at AS applied_at,
        a.created_at AS applied_date,
        a.updated_at AS status_updated_at,
        u.email AS candidate_email,
        cp.full_name,
        cp.full_name AS candidate_name,
        cp.phone,
        cp.location,
        cp.headline,
        cp.bio,
        cp.experience_years,
        cp.experience_years AS candidate_experience,
        cp.education,
        cp.skills AS candidate_skills
      FROM applications a
      JOIN users u ON a.candidate_id = u.id
      LEFT JOIN candidate_profiles cp ON a.candidate_id = cp.user_id
      WHERE a.job_id = $1
      ORDER BY a.created_at DESC
    `;

    const result = await query(sql, [jobId]);

    res.json({
      success: true,
      job: jobCheck.rows[0],
      data: result.rows,
    });
  } catch (error: any) {
    console.error('getJobApplicants error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve applicants.' });
  }
};

export const getEmployerStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employerId = req.user.userId;

    const statsSql = `
      SELECT
        COUNT(DISTINCT j.id) AS total_jobs,
        COUNT(DISTINCT CASE WHEN j.status = 'open' THEN j.id END) AS active_jobs,
        COUNT(a.id) AS total_applicants,
        COUNT(CASE WHEN a.status = 'Shortlisted' THEN 1 END) AS shortlisted_count,
        COUNT(CASE WHEN a.status = 'Interview' THEN 1 END) AS interview_count,
        COUNT(CASE WHEN a.status = 'Selected' THEN 1 END) AS hired_count
      FROM jobs j
      LEFT JOIN applications a ON j.id = a.job_id
      WHERE j.employer_id = $1
    `;

    const result = await query(statsSql, [employerId]);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error('getEmployerStats error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve stats.' });
  }
};
