import { Request, Response } from 'express';
import { query } from '../config/db';

export const getJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      q,
      location,
      skills,
      experience,
      employment_type,
      category,
      status = 'open',
      page = 1,
      limit = 20,
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const conditions: string[] = [];
    const params: any[] = [];

    // Filter by open/closed status
    if (status !== 'all') {
      params.push(status);
      conditions.push(`j.status = $${params.length}`);
    }

    if (q) {
      params.push(`%${String(q).trim()}%`);
      conditions.push(`(j.title ILIKE $${params.length} OR j.description ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
    }

    if (location) {
      params.push(`%${String(location).trim()}%`);
      conditions.push(`j.location ILIKE $${params.length}`);
    }

    if (category) {
      params.push(String(category).trim());
      conditions.push(`j.category ILIKE $${params.length}`);
    }

    if (experience) {
      params.push(String(experience).trim());
      conditions.push(`j.experience_level ILIKE $${params.length}`);
    }

    if (employment_type) {
      params.push(String(employment_type).trim());
      conditions.push(`j.employment_type ILIKE $${params.length}`);
    }

    if (skills) {
      const skillsArray = String(skills)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (skillsArray.length > 0) {
        params.push(skillsArray);
        conditions.push(`EXISTS (
          SELECT 1 FROM unnest(j.skills) s
          WHERE lower(s) = ANY($${params.length})
        )`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const currentUserId = req.user?.userId;
    let savedSelect = 'FALSE AS is_saved';
    let appliedSelect = 'FALSE AS has_applied';

    if (currentUserId) {
      params.push(currentUserId);
      const userParamIdx = params.length;
      savedSelect = `EXISTS (SELECT 1 FROM saved_jobs sj WHERE sj.job_id = j.id AND sj.user_id = $${userParamIdx}) AS is_saved`;
      appliedSelect = `EXISTS (SELECT 1 FROM applications a WHERE a.job_id = j.id AND a.candidate_id = $${userParamIdx}) AS has_applied`;
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      ${whereClause}
    `;

    const countRes = await query(countQuery, params.slice(0, currentUserId ? params.length - 1 : params.length));
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const jobsQuery = `
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
        c.website AS company_website,
        c.location AS company_location,
        c.industry AS company_industry,
        (SELECT COUNT(*) FROM applications WHERE job_id = j.id) AS applications_count,
        ${savedSelect},
        ${appliedSelect}
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      ${whereClause}
      ORDER BY j.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const jobParams = [...params, Number(limit), offset];
    const jobsRes = await query(jobsQuery, jobParams);

    res.json({
      success: true,
      data: jobsRes.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('getJobs error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve jobs.' });
  }
};

export const getJobById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.userId;

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(id)) {
      res.status(404).json({ success: false, message: 'Job not found.' });
      return;
    }

    let savedSelect = 'FALSE AS is_saved';
    let appliedSelect = 'FALSE AS has_applied';
    let applicationStatus = 'NULL AS application_status';
    const params: any[] = [id];

    if (currentUserId) {
      params.push(currentUserId);
      savedSelect = `EXISTS (SELECT 1 FROM saved_jobs sj WHERE sj.job_id = j.id AND sj.user_id = $2) AS is_saved`;
      appliedSelect = `EXISTS (SELECT 1 FROM applications a WHERE a.job_id = j.id AND a.candidate_id = $2) AS has_applied`;
      applicationStatus = `(SELECT a.status FROM applications a WHERE a.job_id = j.id AND a.candidate_id = $2) AS application_status`;
    }

    const jobQuery = `
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
        c.description AS company_description,
        c.website AS company_website,
        c.location AS company_location,
        c.industry AS company_industry,
        (SELECT COUNT(*) FROM applications WHERE job_id = j.id) AS applications_count,
        ${savedSelect},
        ${appliedSelect},
        ${applicationStatus}
      FROM jobs j
      LEFT JOIN companies c ON j.company_id = c.id
      WHERE j.id = $1
    `;

    const result = await query(jobQuery, params);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Job not found.' });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error('getJobById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve job details.' });
  }
};

export const createJob = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const {
      title,
      description,
      category = 'Engineering',
      employment_type = 'Full-time',
      location = 'Remote',
      experience_level = 'Mid',
      salary_min,
      salary_max,
      salary_currency = 'USD',
      skills = [],
    } = req.body;

    if (!title || !description) {
      res.status(400).json({ success: false, message: 'Title and description are required.' });
      return;
    }

    // Get company for this employer
    let compRes = await query('SELECT id FROM companies WHERE user_id = $1', [req.user.userId]);
    let companyId: string;

    if (compRes.rows.length === 0) {
      // Auto-create company record if not yet created
      const newComp = await query(
        `INSERT INTO companies (user_id, name) VALUES ($1, $2) RETURNING id`,
        [req.user.userId, 'Company']
      );
      companyId = newComp.rows[0].id;
    } else {
      companyId = compRes.rows[0].id;
    }

    const insertQuery = `
      INSERT INTO jobs (
        company_id, employer_id, title, description, category,
        employment_type, location, experience_level, salary_min,
        salary_max, salary_currency, skills, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'open')
      RETURNING *
    `;

    const jobRes = await query(insertQuery, [
      companyId,
      req.user.userId,
      title,
      description,
      category,
      employment_type,
      location,
      experience_level,
      salary_min ? Number(salary_min) : null,
      salary_max ? Number(salary_max) : null,
      salary_currency,
      Array.isArray(skills) ? skills : [],
    ]);

    res.status(201).json({
      success: true,
      message: 'Job posted successfully.',
      data: jobRes.rows[0],
    });
  } catch (error: any) {
    console.error('createJob error:', error);
    res.status(500).json({ success: false, message: 'Failed to create job.' });
  }
};

export const updateJob = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    // Check ownership
    const checkRes = await query('SELECT employer_id FROM jobs WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Job not found.' });
      return;
    }

    if (checkRes.rows[0].employer_id !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ success: false, message: 'You can only edit your own jobs.' });
      return;
    }

    const {
      title,
      description,
      category,
      employment_type,
      location,
      experience_level,
      salary_min,
      salary_max,
      salary_currency,
      skills,
      status,
    } = req.body;

    const updateQuery = `
      UPDATE jobs
      SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        employment_type = COALESCE($4, employment_type),
        location = COALESCE($5, location),
        experience_level = COALESCE($6, experience_level),
        salary_min = COALESCE($7, salary_min),
        salary_max = COALESCE($8, salary_max),
        salary_currency = COALESCE($9, salary_currency),
        skills = COALESCE($10, skills),
        status = COALESCE($11, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING *
    `;

    const result = await query(updateQuery, [
      title,
      description,
      category,
      employment_type,
      location,
      experience_level,
      salary_min !== undefined ? Number(salary_min) : null,
      salary_max !== undefined ? Number(salary_max) : null,
      salary_currency,
      skills ? (Array.isArray(skills) ? skills : [skills]) : null,
      status,
      id,
    ]);

    res.json({
      success: true,
      message: 'Job updated successfully.',
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error('updateJob error:', error);
    res.status(500).json({ success: false, message: 'Failed to update job.' });
  }
};

export const deleteJob = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const checkRes = await query('SELECT employer_id FROM jobs WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Job not found.' });
      return;
    }

    if (checkRes.rows[0].employer_id !== req.user.userId && req.user.role !== 'admin') {
      res.status(403).json({ success: false, message: 'You can only delete your own jobs.' });
      return;
    }

    await query('DELETE FROM jobs WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Job deleted successfully.',
    });
  } catch (error: any) {
    console.error('deleteJob error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete job.' });
  }
};
