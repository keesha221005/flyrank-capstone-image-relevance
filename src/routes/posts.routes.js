// src/routes/posts.routes.js
const express = require('express');
const { z } = require('zod');
const { createPost, getPostById } = require('../services/posts.service');
const { getAllImagesWithEmbeddings } = require('../services/images.service');
const { rankImagesForPost } = require('../services/matching.service');
const { guardRankedCandidates } = require('../services/guard.service');
const { pool } = require('../db/pool');

const router = express.Router();

const CreatePostSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  expected_subject: z.string().min(1),
});

router.post('/', async (req, res) => {
  const parsed = CreatePostSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
  }

  try {
    const post = await createPost(parsed.data);
    res.status(201).json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

router.get('/:id/images', async (req, res) => {
  const postId = Number(req.params.id);
  if (!Number.isInteger(postId)) {
    return res.status(400).json({ error: 'Invalid post id' });
  }

  try {
    const post = await getPostById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const images = await getAllImagesWithEmbeddings();
    if (images.length === 0) {
      return res.json({ post_id: postId, suggestions: [], note: 'No images with embeddings available yet.' });
    }

    const ranked = rankImagesForPost(post.embedding, images);
    const guarded = guardRankedCandidates(post, ranked);

    // Persist every candidate considered — full audit trail
    for (const candidate of guarded) {
      await pool.query(
        `INSERT INTO suggestions (post_id, image_id, similarity_score, guard_decision, guard_reason, rank)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [postId, candidate.id, candidate.similarity, candidate.decision, candidate.reason, candidate.rank]
      );
    }

    const accepted = guarded.filter((c) => c.decision === 'accepted');

    res.json({
      post_id: postId,
      expected_subject: post.expected_subject,
      best_match: accepted[0] || null,
      no_confident_match: accepted.length === 0,
      candidates: guarded,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to rank images' });
  }
});

module.exports = router;