// src/routes/costs.routes.js
const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT call_type, COUNT(*) as call_count, SUM(tokens_used) as total_tokens, SUM(estimated_cost) as total_cost
       FROM ai_call_costs GROUP BY call_type`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch costs' });
  }
});

module.exports = router;