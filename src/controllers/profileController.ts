import { Request, Response } from 'express';
import { query } from '../config/db';

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const userId = req.user.userId;
    const userRes = await query('SELECT id, email, role, created_at FROM users WHERE id = $1', [userId]);

    if (userRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const user = userRes.rows[0];

    if (user.role === 'candidate') {
      const profRes = await query('SELECT * FROM candidate_profiles WHERE user_id = $1', [userId]);
      res.json({
        success: true,
        data: {
          user,
          candidateProfile: profRes.rows[0] || null,
        },
      });
      return;
    }

    if (user.role === 'employer') {
      const compRes = await query('SELECT * FROM companies WHERE user_id = $1', [userId]);
      res.json({
        success: true,
        data: {
          user,
          companyProfile: compRes.rows[0] || null,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error: any) {
    console.error('getProfile error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const userId = req.user.userId;
    const role = req.user.role;

    if (role === 'candidate') {
      const {
        full_name,
        phone,
        location,
        headline,
        bio,
        experience_years,
        education,
        resume_url,
        skills,
      } = req.body;

      const upsertSql = `
        INSERT INTO candidate_profiles (
          user_id, full_name, phone, location, headline, bio,
          experience_years, education, resume_url, skills, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET
          full_name = COALESCE($2, candidate_profiles.full_name),
          phone = COALESCE($3, candidate_profiles.phone),
          location = COALESCE($4, candidate_profiles.location),
          headline = COALESCE($5, candidate_profiles.headline),
          bio = COALESCE($6, candidate_profiles.bio),
          experience_years = COALESCE($7, candidate_profiles.experience_years),
          education = COALESCE($8, candidate_profiles.education),
          resume_url = COALESCE($9, candidate_profiles.resume_url),
          skills = COALESCE($10, candidate_profiles.skills),
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;

      const result = await query(upsertSql, [
        userId,
        full_name || 'Candidate',
        phone || null,
        location || null,
        headline || null,
        bio || null,
        experience_years !== undefined ? Number(experience_years) : 0,
        education || null,
        resume_url || null,
        skills ? (Array.isArray(skills) ? skills : [skills]) : [],
      ]);

      res.json({
        success: true,
        message: 'Profile updated successfully.',
        data: result.rows[0],
      });
      return;
    }

    if (role === 'employer') {
      const { name, logo_url, description, website, location, industry } = req.body;

      const upsertSql = `
        INSERT INTO companies (
          user_id, name, logo_url, description, website, location, industry, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET
          name = COALESCE($2, companies.name),
          logo_url = COALESCE($3, companies.logo_url),
          description = COALESCE($4, companies.description),
          website = COALESCE($5, companies.website),
          location = COALESCE($6, companies.location),
          industry = COALESCE($7, companies.industry),
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;

      const result = await query(upsertSql, [
        userId,
        name || 'Company',
        logo_url || null,
        description || null,
        website || null,
        location || null,
        industry || null,
      ]);

      res.json({
        success: true,
        message: 'Company profile updated successfully.',
        data: result.rows[0],
      });
      return;
    }

    res.status(400).json({ success: false, message: 'Invalid role for profile update.' });
  } catch (error: any) {
    console.error('updateProfile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
};
