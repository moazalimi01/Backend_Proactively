import express from 'express';
import { body } from 'express-validator';
import pool from '../config/database.js';
import { authenticateUser, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * /api/speakers:
 *   get:
 *     summary: Get all speakers
 *     tags: [Speakers]
 *     responses:
 *       200:
 *         description: List of all speakers
 */
// Get all speakers
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, sp.expertise, sp.price_per_session
      FROM users u
      JOIN speaker_profiles sp ON u.id = sp.user_id
      WHERE u.user_type = 'speaker'
    `);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/speakers/profile:
 *   post:
 *     summary: Create or update speaker profile
 *     tags: [Speakers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - expertise
 *               - pricePerSession
 *             properties:
 *               expertise:
 *                 type: string
 *               pricePerSession:
 *                 type: number
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Unauthorized
 */
// Create/update speaker profile (protected route)
router.post('/profile', 
  authenticateUser,
  authorizeRole(['speaker']),
  [
    body('expertise').notEmpty(),
    body('pricePerSession').isFloat({ min: 0 }),
  ],
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { expertise, pricePerSession } = req.body;
      
      await client.query('BEGIN');
      
      await client.query(`
        INSERT INTO speaker_profiles (user_id, expertise, price_per_session)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET
        expertise = EXCLUDED.expertise,
        price_per_session = EXCLUDED.price_per_session`,
        [req.user.userId, expertise, pricePerSession]
      );
      
      await client.query('COMMIT');
      res.json({ message: 'Speaker profile updated successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  }
);

export default router;