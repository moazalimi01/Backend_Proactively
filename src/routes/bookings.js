import express from 'express';
import { body } from 'express-validator';
import pool from '../config/database.js';
import { authenticateUser } from '../middleware/auth.js';
import { sendBookingConfirmation } from '../utils/email.js';
import { createCalendarEvent } from '../utils/calender.js';

const router = express.Router();

/**
 * @swagger
 * /api/bookings/available-slots/{speakerId}/{date}:
 *   get:
 *     summary: Get available time slots for a speaker
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: speakerId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of available time slots
 * 
 * /api/bookings/book:
 *   post:
 *     summary: Book a session with a speaker
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - speakerId
 *               - date
 *               - timeSlot
 *             properties:
 *               speakerId:
 *                 type: integer
 *               date:
 *                 type: string
 *                 format: date
 *               timeSlot:
 *                 type: string
 *                 pattern: '^([0-9]|1[0-5]):[0]{2}$'
 *     responses:
 *       200:
 *         description: Session booked successfully
 *       400:
 *         description: Invalid input or slot already booked
 *       401:
 *         description: Unauthorized
 */

// Get available time slots for a speaker
router.get('/available-slots/:speakerId/:date', async (req, res) => {
  try {
    const { speakerId, date } = req.params;
    
    const result = await pool.query(
      `SELECT to_char(time_slot, 'HH24:MI') as formatted_time_slot
       FROM session_bookings
       WHERE speaker_id = $1 AND booking_date = $2`,
      [speakerId, date]
    );
    
    const bookedSlots = result.rows.map(row => row.formatted_time_slot);
    const allSlots = Array.from({ length: 8 }, (_, i) => `${i + 9}:00`);
    const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot));
    
    res.json(availableSlots);
  } catch (error) {
    console.error('Error in available slots:', error);
    res.status(500).json({ error: error.message });
  }
});

// Book a session
router.post('/book',
  authenticateUser,
  [
    body('speakerId').isInt(),
    body('date').isDate(),
    body('timeSlot')
      .matches(/^([0-9]|1[0-5]):[0]{2}$/)
      .withMessage('Time slot must be on the hour between 9:00 and 15:00'),
  ],
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { speakerId, date, timeSlot } = req.body;
      
      // Validate time slot format and range
      const hour = parseInt(timeSlot.split(':')[0]);
      if (hour < 9 || hour > 15) {
        return res.status(400).json({ error: 'Time slot must be between 9 AM and 4 PM' });
      }
      
      await client.query('BEGIN');
      
      // Check if slot is available
      const checkResult = await client.query(
        `SELECT COUNT(*) as count
         FROM session_bookings
         WHERE speaker_id = $1 AND booking_date = $2 AND time_slot = $3`,
        [speakerId, date, timeSlot]
      );
      
      if (checkResult.rows[0].count > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Time slot already booked' });
      }
      
      // Create booking
      await client.query(
        `INSERT INTO session_bookings (speaker_id, user_id, booking_date, time_slot, status)
         VALUES ($1, $2, $3, $4, 'confirmed')`,
        [speakerId, req.user.userId, date, timeSlot]
      );
      
      // Get user and speaker emails
      const emailResult = await client.query(
        `SELECT email, user_type FROM users WHERE id IN ($1, $2)`,
        [req.user.userId, speakerId]
      );
      
      const emails = emailResult.rows;
      const userEmail = emails.find(e => e.user_type === 'user').email;
      const speakerEmail = emails.find(e => e.user_type === 'speaker').email;
      
      await client.query('COMMIT');
      
      // Send confirmation emails and calendar invites
      await Promise.all([
        sendBookingConfirmation(userEmail, speakerEmail, { date, time: timeSlot }),
        createCalendarEvent(userEmail, speakerEmail, { date, time: timeSlot })
      ]);
      
      res.json({ message: 'Session booked successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  }
);

export default router;