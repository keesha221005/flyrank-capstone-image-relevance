// src/jobs/ingestImages.job.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { classifyImage } = require('../services/vision.service');
const { pool } = require('../db/pool');

const IMAGES_DIR = path.join(__dirname, '../../data/images');
const DELAY_BETWEEN_CALLS_MS = 5000;
const MAX_RETRIES = 2; // fewer retries — quota errors won't resolve within seconds anyway
const RETRY_BASE_DELAY_MS = 3000;
const LOW_CONFIDENCE_THRESHOLD = 0.75;

const COST_PER_1M_INPUT_TOKENS = 0.30;
const COST_PER_1M_OUTPUT_TOKENS = 2.50;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuotaExhausted(err) {
  // Daily quota errors mention "PerDay" in the message — distinct from a
  // transient per-minute rate limit, which IS worth retrying.
  return err.message?.includes('429') && err.message?.includes('PerDay');
}

function estimateCost(usage) {
  const inputTokens = usage.promptTokenCount || 0;
  const outputTokens = (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0);
  const cost =
    (inputTokens / 1_000_000) * COST_PER_1M_INPUT_TOKENS +
    (outputTokens / 1_000_000) * COST_PER_1M_OUTPUT_TOKENS;
  return { inputTokens, outputTokens, cost };
}

async function getAlreadyProcessedFilenames() {
  const res = await pool.query('SELECT filename FROM images');
  return new Set(res.rows.map((r) => r.filename));
}

async function classifyWithRetry(imagePath, filename) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await classifyImage(imagePath);
    } catch (err) {
      lastError = err;

      if (isQuotaExhausted(err)) {
        // No point retrying — surface immediately so the caller can stop the whole run
        throw Object.assign(new Error('DAILY_QUOTA_EXHAUSTED'), { cause: err });
      }

      console.warn(`  attempt ${attempt}/${MAX_RETRIES} failed for ${filename}: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        const backoff = RETRY_BASE_DELAY_MS * attempt;
        console.warn(`  retrying in ${backoff}ms...`);
        await sleep(backoff);
      }
    }
  }

  throw new Error(`All ${MAX_RETRIES} attempts failed for ${filename}: ${lastError.message}`);
}

async function insertImage(filename, result) {
  const { data, usage } = result;
  const flagged = data.confidence < LOW_CONFIDENCE_THRESHOLD;

  const insertRes = await pool.query(
    `INSERT INTO images (filename, subject, category, attributes, caption, confidence, flagged_low_confidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [filename, data.subject, data.category, data.attributes, data.caption, data.confidence, flagged]
  );

  const imageId = insertRes.rows[0].id;
  const { inputTokens, outputTokens, cost } = estimateCost(usage);

  await pool.query(
    `INSERT INTO ai_call_costs (call_type, reference_id, tokens_used, estimated_cost)
     VALUES ($1, $2, $3, $4)`,
    ['vision', imageId, inputTokens + outputTokens, cost]
  );

  return { imageId, flagged, cost };
}

async function main() {
  const allFiles = fs
    .readdirSync(IMAGES_DIR)
    .filter((f) => /\.(jpe?g|png)$/i.test(f));

  const alreadyDone = await getAlreadyProcessedFilenames();
  const remaining = allFiles.filter((f) => !alreadyDone.has(f));

  console.log(`Total corpus: ${allFiles.length}`);
  console.log(`Already processed: ${alreadyDone.size}`);
  console.log(`Remaining: ${remaining.length}\n`);

  if (remaining.length === 0) {
    console.log('Nothing left to process. All images done.');
    await pool.end();
    return;
  }

  const results = { success: 0, failed: 0, flagged: 0, totalCost: 0 };
  let quotaHit = false;

  for (let i = 0; i < remaining.length; i++) {
    const filename = remaining[i];
    const imagePath = path.join(IMAGES_DIR, filename);

    console.log(`[${i + 1}/${remaining.length}] Processing ${filename}...`);

    try {
      const result = await classifyWithRetry(imagePath, filename);
      const { flagged, cost } = await insertImage(filename, result);

      results.success++;
      results.totalCost += cost;
      if (flagged) {
        results.flagged++;
        console.log(`  ⚠ flagged (confidence ${result.data.confidence} < ${LOW_CONFIDENCE_THRESHOLD})`);
      } else {
        console.log(`  ✓ ${result.data.subject} (confidence ${result.data.confidence})`);
      }
    } catch (err) {
      if (err.message === 'DAILY_QUOTA_EXHAUSTED') {
        console.log(`\n⏸ Daily quota exhausted. Stopping run — resume tomorrow with the same command.`);
        quotaHit = true;
        break;
      }
      results.failed++;
      console.error(`  ✗ FAILED: ${err.message}`);
    }

    if (i < remaining.length - 1 && !quotaHit) {
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }
  }

  console.log('\n--- Run summary ---');
  console.log(`Processed this run: ${results.success}`);
  console.log(`Failed (non-quota): ${results.failed}`);
  console.log(`Flagged (low confidence): ${results.flagged}`);
  console.log(`Estimated cost this run: $${results.totalCost.toFixed(6)}`);
  console.log(`Remaining after this run: ${remaining.length - results.success - results.failed}`);
  if (quotaHit) console.log(`\nRe-run tomorrow to continue.`);

  await pool.end();
}

main().catch((err) => {
  console.error('Batch job crashed:', err);
  process.exit(1);
});