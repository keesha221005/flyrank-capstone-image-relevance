// test/matching.service.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { cosineSimilarity, rankImagesForPost } = require('../src/services/matching.service');

test('identical vectors have similarity of 1', () => {
  const v = [1, 0, 0];
  assert.strictEqual(cosineSimilarity(v, v), 1);
});

test('orthogonal vectors have similarity of 0', () => {
  const a = [1, 0];
  const b = [0, 1];
  assert.strictEqual(cosineSimilarity(a, b), 0);
});

test('opposite vectors have similarity of -1', () => {
  const a = [1, 0];
  const b = [-1, 0];
  assert.strictEqual(cosineSimilarity(a, b), -1);
});

test('throws on mismatched vector dimensions', () => {
  const a = [1, 0, 0];
  const b = [1, 0];
  assert.throws(() => cosineSimilarity(a, b));
});

test('ranks images by descending similarity to post embedding', () => {
  const postEmbedding = [1, 0];
  const images = [
    { id: 1, embedding: [0, 1] },   // similarity 0
    { id: 2, embedding: [1, 0] },   // similarity 1 — should rank first
    { id: 3, embedding: [0.7, 0.7] }, // similarity ~0.7
  ];

  const ranked = rankImagesForPost(postEmbedding, images);
  assert.strictEqual(ranked[0].id, 2);
  assert.strictEqual(ranked[ranked.length - 1].id, 1);
});