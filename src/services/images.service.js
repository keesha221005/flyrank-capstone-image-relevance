// src/services/images.service.js
const { pool } = require('../db/pool');

async function getAllImagesWithEmbeddings() {
  const res = await pool.query(
    `SELECT id, filename, subject, category, attributes, caption, confidence, embedding
     FROM images
     WHERE embedding IS NOT NULL`
  );

  // pg returns NUMERIC columns as strings — convert to real numbers here,
  // once, so every downstream consumer (matching, guard) gets proper numbers.
  return res.rows.map((row) => ({
    ...row,
    confidence: Number(row.confidence),
  }));
}

async function getAllImages() {
  const res = await pool.query(
    `SELECT id, filename, subject, category, attributes, caption, confidence, flagged_low_confidence, created_at
     FROM images ORDER BY created_at DESC`
  );
  return res.rows.map((row) => ({
    ...row,
    confidence: Number(row.confidence),
  }));
}

module.exports = { getAllImagesWithEmbeddings, getAllImages };