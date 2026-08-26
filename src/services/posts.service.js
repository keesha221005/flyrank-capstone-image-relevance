// src/services/posts.service.js
const { pool } = require('../db/pool');
const { embedText } = require('./embedding.service');

const COST_PER_1M_EMBEDDING_TOKENS = 0.15;

async function createPost({ title, body, expected_subject }) {
  const { embedding, estimatedTokens } = await embedText(`${title}. ${body}`);

  const res = await pool.query(
    `INSERT INTO posts (title, body, expected_subject, embedding)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, body, expected_subject, embedding, created_at`,
    [title, body, expected_subject, embedding]
  );

  const post = res.rows[0];
  const cost = (estimatedTokens / 1_000_000) * COST_PER_1M_EMBEDDING_TOKENS;

  await pool.query(
    `INSERT INTO ai_call_costs (call_type, reference_id, tokens_used, estimated_cost)
     VALUES ($1, $2, $3, $4)`,
    ['embedding', post.id, estimatedTokens, cost]
  );

  return post;
}

async function getPostById(id) {
  const res = await pool.query(
    `SELECT id, title, body, expected_subject, embedding FROM posts WHERE id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

module.exports = { createPost, getPostById };