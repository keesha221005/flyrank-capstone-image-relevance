// test/guard.service.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { evaluateCandidate } = require('../src/services/guard.service');

test('accepts when subject matches, confidence and similarity clear thresholds', () => {
  const post = { expected_subject: 'red fox' };
  const image = { subject: 'red fox', confidence: 0.95, similarity: 0.85 };

  const result = evaluateCandidate(post, image);
  assert.strictEqual(result.decision, 'accepted');
});

test('rejects the wolf-on-fox-post scenario on subject mismatch, even with high similarity', () => {
  const post = { expected_subject: 'red fox' };
  // Deliberately high similarity to prove subject check overrides it
  const image = { subject: 'gray wolf', confidence: 0.95, similarity: 0.95 };

  const result = evaluateCandidate(post, image);
  assert.strictEqual(result.decision, 'rejected');
  assert.match(result.reason, /subject mismatch/i);
});

test('rejects on low confidence even when subject matches', () => {
  const post = { expected_subject: 'deer' };
  const image = { subject: 'deer', confidence: 0.5, similarity: 0.9 };

  const result = evaluateCandidate(post, image);
  assert.strictEqual(result.decision, 'rejected');
  assert.match(result.reason, /confidence/i);
});

test('rejects on low similarity even when subject and confidence are fine', () => {
  const post = { expected_subject: 'deer' };
  const image = { subject: 'deer', confidence: 0.95, similarity: 0.3 };

  const result = evaluateCandidate(post, image);
  assert.strictEqual(result.decision, 'rejected');
  assert.match(result.reason, /similarity/i);
});

test('subject matching is case-insensitive and tolerant of substrings', () => {
  const post = { expected_subject: 'deer' };
  const image = { subject: 'Two Red Deer Stags', confidence: 0.95, similarity: 0.85 };

  const result = evaluateCandidate(post, image);
  assert.strictEqual(result.decision, 'accepted');
});