import { Request, Response } from 'express';
import { query } from '../config/db';

export const saveJob = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id: jobId } = req.params;
    const userId = req.user.userId;

    // Check job existence
    const jobCheck = await query('SELECT id FROM jobs WHERE id = $1', [jobId]);
    if (jobCheck.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Job not found.' });
      return;
    }

    await query(
      `INSERT INTO saved_jobs (user_id, job_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, job_id) DO NOTHING`,
      [userId, jobId]
    );

    res.status(200).json({
      success: true,
      message: 'Job saved successfully.',
      isSaved: true,
    });
  } catch (error: any) {
    console.error('saveJob error:', error);
    res.status(500).json({ success: false, message: 'Failed to save job.' });
  }
};

export const unsaveJob = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id: jobId } = req.params;
    const userId = req.user.userId;

    await query('DELETE FROM saved_jobs WHERE user_id = $1 AND job_id = $2', [userId, jobId]);

    res.status(200).json({
      success: true,
      message: 'Job removed from saved list.',
      isSaved: false,
    });
  } catch (error: any) {
    console.error('unsaveJob error:', error);
    res.status(500).json({ success: false, message: 'Failed to unsave job.' });
  }
};

export const getSavedJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const sql = `
      SELECT 
        j.id,
        j.company_id,
        j.employer_id,
        j.title,
        j.description,
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
        c.name AS company_name,
        c.logo_url AS company_logo,
        sj.created_at AS saved_at,
        TRUE AS is_saved,
        EXISTS (SELECT 1 FROM applications a WHERE a.job_id = j.id AND a.candidate_id = $1) AS has_applied
      FROM saved_jobs sj
      JOIN jobs j ON sj.job_id = j.id
      LEFT JOIN companies c ON j.company_id = c.id
      WHERE sj.user_id = $1
      ORDER BY sj.created_at DESC
    `;

    const result = await query(sql, [req.user.userId]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    console.error('getSavedJobs error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve saved jobs.' });
  }
};
