// src/services/posts.service.js
const { pool } = require('../db/pool');
const { embedText } = require('./embedding.service');

async function createPost({ title, body, expected_subject }) {
  const { embedding } = await embedText(`${title}. ${body}`);

  const res = await pool.query(
    `INSERT INTO posts (title, body, expected_subject, embedding)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, body, expected_subject, created_at`,
    [title, body, expected_subject, embedding]
  );

  return res.rows[0];
}

async function getPostById(id) {
  const res = await pool.query(
    `SELECT id, title, body, expected_subject, embedding FROM posts WHERE id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

module.exports = { createPost, getPostById };