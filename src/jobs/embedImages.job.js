// src/jobs/embedImages.job.js
require('dotenv').config();
const { pool } = require('../db/pool');
const { embedText } = require('../services/embedding.service');

const COST_PER_1M_EMBEDDING_TOKENS = 0.15; // Gemini embedding pricing reference

async function main() {
  const res = await pool.query(
    `SELECT id, caption FROM images WHERE embedding IS NULL`
  );

  console.log(`${res.rows.length} images need embeddings.\n`);

  for (const row of res.rows) {
    const { embedding, estimatedTokens } = await embedText(row.caption);
    await pool.query(`UPDATE images SET embedding = $1 WHERE id = $2`, [embedding, row.id]);

    const cost = (estimatedTokens / 1_000_000) * COST_PER_1M_EMBEDDING_TOKENS;
    await pool.query(
      `INSERT INTO ai_call_costs (call_type, reference_id, tokens_used, estimated_cost)
       VALUES ($1, $2, $3, $4)`,
      ['embedding', row.id, estimatedTokens, cost]
    );

    console.log(`  embedded image #${row.id}`);
  }

  console.log('\nDone.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});