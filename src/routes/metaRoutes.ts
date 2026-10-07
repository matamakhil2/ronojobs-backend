import { Router, Request, Response } from 'express';
import { query } from '../config/db';

const router = Router();

// Master skills list
router.get('/skills', async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT id, name FROM skills ORDER BY name ASC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve skills' });
  }
});

// Categories list
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT DISTINCT category, COUNT(id) as count 
      FROM jobs 
      WHERE status = 'open' 
      GROUP BY category 
      ORDER BY count DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve categories' });
  }
});

export default router;
