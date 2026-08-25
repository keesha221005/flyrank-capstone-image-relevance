// src/routes/reviews.routes.js
const express = require('express');
const { z } = require('zod');
const { pool } = require('../db/pool');

const router = express.Router();

const ReviewSchema = z.object({
  suggestion_id: z.number().int(),
  decision: z.enum(['approved', 'rejected']),
});

router.post('/', async (req, res) => {
  const parsed = ReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
  }

  try {
    const result = await pool.query(
      `INSERT INTO reviews (suggestion_id, decision) VALUES ($1, $2) RETURNING *`,
      [parsed.data.suggestion_id, parsed.data.decision]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record review' });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, s.post_id, s.image_id, s.guard_decision, s.guard_reason
       FROM reviews r JOIN suggestions s ON r.suggestion_id = s.id
       ORDER BY r.reviewed_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

module.exports = router;