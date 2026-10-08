import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db';
import { signToken } from '../utils/jwt';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role = 'candidate', fullName, companyName } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required.' });
      return;
    }

    if (!['candidate', 'employer', 'admin'].includes(role)) {
      res.status(400).json({ success: false, message: 'Invalid role specified.' });
      return;
    }

    // Check existing
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userRes = await query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, email, role, created_at`,
      [email.toLowerCase().trim(), passwordHash, role]
    );

    const newUser = userRes.rows[0];

    // Create profile according to role
    // Create profile according to role
    let profileData: any = null;
    if (role === 'candidate') {
      const pRes = await query(
        `INSERT INTO candidate_profiles (user_id, full_name)
         VALUES ($1, $2)
         RETURNING *`,
        [newUser.id, fullName || 'Candidate']
      );
      profileData = pRes.rows[0] || null;
    } else if (role === 'employer') {
      const cRes = await query(
        `INSERT INTO companies (user_id, name)
         VALUES ($1, $2)
         RETURNING *`,
        [newUser.id, companyName || 'My Company']
      );
      profileData = cRes.rows[0] || null;
    }

    const token = signToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        profile: profileData,
        fullName: role === 'candidate' ? (fullName || 'Candidate') : undefined,
        companyName: role === 'employer' ? (companyName || 'My Company') : undefined,
      },
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Failed to register user.' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required.' });
      return;
    }

    const userRes = await query(
      'SELECT id, email, password_hash, role, created_at FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (userRes.rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    // Fetch related profile
    let profileData: any = null;
    if (user.role === 'candidate') {
      const profRes = await query('SELECT * FROM candidate_profiles WHERE user_id = $1', [user.id]);
      profileData = profRes.rows[0] || null;
    } else if (user.role === 'employer') {
      const compRes = await query('SELECT * FROM companies WHERE user_id = $1', [user.id]);
      profileData = compRes.rows[0] || null;
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: profileData,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Failed to login.' });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const userRes = await query('SELECT id, email, role, created_at FROM users WHERE id = $1', [
      req.user.userId,
    ]);

    if (userRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const user = userRes.rows[0];
    let profileData: any = null;
    if (user.role === 'candidate') {
      const profRes = await query('SELECT * FROM candidate_profiles WHERE user_id = $1', [user.id]);
      profileData = profRes.rows[0] || null;
    } else if (user.role === 'employer') {
      const compRes = await query('SELECT * FROM companies WHERE user_id = $1', [user.id]);
      profileData = compRes.rows[0] || null;
    }

    res.json({
      success: true,
      user: {
        ...user,
        profile: profileData,
      },
    });
  } catch (error: any) {
    console.error('GetMe error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
  }
};
