// src/routes/images.routes.js
const express = require('express');
const { getAllImages } = require('../services/images.service');
const { spawn } = require('child_process');
const path = require('path');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const images = await getAllImages();
    res.json(images);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

router.post('/ingest', (req, res) => {
  // Fire-and-forget: the ingestion job is long-running and quota-paced,
  // so we kick it off as a detached process rather than blocking the request.
  const jobPath = path.join(__dirname, '../jobs/ingestImages.job.js');
  const child = spawn('node', [jobPath], { detached: true, stdio: 'ignore' });
  child.unref();

  res.status(202).json({ message: 'Ingestion job started in background. Check logs/DB for progress.' });
});

module.exports = router;