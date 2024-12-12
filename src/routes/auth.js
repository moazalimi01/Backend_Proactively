import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.js';
import { sendVerificationEmail } from '../utils/email.js';

const router = express.Router();

// Define signup validation middleware
const signupValidation = [
  body('firstName').notEmpty().trim().withMessage('First name is required'),
  body('lastName').notEmpty().trim().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('userType').isIn(['user', 'speaker']).withMessage('User type must be either user or speaker'),
];

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - password
 *               - userType
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minimum: 6
 *               userType:
 *                 type: string
 *                 enum: [user, speaker]
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid input
 */
router.post('/signup', signupValidation, async (req, res) => {
  const client = await pool.connect();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, email, password, userType } = req.body;
    const hashedPassword = await hashPassword(password);
    
    await client.query('BEGIN');
    
    // Check if email already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const userResult = await client.query(
      `INSERT INTO users (first_name, last_name, email, password, user_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [firstName, lastName, email, hashedPassword, userType]
    );
    
    const userId = userResult.rows[0].id;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    await client.query(
      `INSERT INTO otp_verifications (user_id, otp, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [userId, otp]
    );

    await client.query('COMMIT');
    await sendVerificationEmail(email, otp);

    res.status(201).json({ message: 'User created successfully. Please verify your email.' });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Email already registered' });
    } else {
      console.error('Signup error:', error);
      res.status(500).json({ error: 'Error creating user' });
    }
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    const user = result.rows[0];
    if (!user || !(await comparePassword(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_verified) {
      return res.status(403).json({ error: 'Please verify your email first' });
    }

    const token = generateToken(user.id, user.user_type);
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify email with OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired OTP
 */
router.post('/verify-otp', async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, otp } = req.body;
    
    const result = await client.query(
      `SELECT ov.* FROM otp_verifications ov
       JOIN users u ON u.id = ov.user_id
       WHERE u.email = $1 AND ov.otp = $2 AND ov.expires_at > NOW()`,
      [email, otp]
    );
    
    const verification = result.rows[0];
    if (!verification) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    await client.query('BEGIN');
    
    await client.query(
      'UPDATE users SET is_verified = true WHERE email = $1',
      [email]
    );
    
    await client.query(
      'DELETE FROM otp_verifications WHERE id = $1',
      [verification.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

export default router;