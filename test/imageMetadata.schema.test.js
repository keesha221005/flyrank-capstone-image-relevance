// test/imageMetadata.schema.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { ImageMetadataSchema } = require('../src/schemas/imageMetadata.schema');

test('accepts a valid image metadata object', () => {
  const valid = {
    subject: 'red fox',
    category: 'animal',
    attributes: ['orange fur', 'wild', 'forest'],
    caption: 'A red fox standing in a forest',
    confidence: 0.94,
  };
  assert.doesNotThrow(() => ImageMetadataSchema.parse(valid));
});

test('rejects an invalid category', () => {
  const invalid = {
    subject: 'red fox',
    category: 'mythical_creature', // not in enum
    attributes: ['orange fur'],
    caption: 'A red fox standing in a forest',
    confidence: 0.94,
  };
  assert.throws(() => ImageMetadataSchema.parse(invalid));
});

test('rejects confidence outside 0-1 range', () => {
  const invalid = {
    subject: 'red fox',
    category: 'animal',
    attributes: ['orange fur'],
    caption: 'A red fox standing in a forest',
    confidence: 1.5,
  };
  assert.throws(() => ImageMetadataSchema.parse(invalid));
});

test('rejects more than 8 attributes', () => {
  const invalid = {
    subject: 'red fox',
    category: 'animal',
    attributes: Array(9).fill('tag'), // one over the limit
    caption: 'A red fox standing in a forest',
    confidence: 0.9,
  };
  assert.throws(() => ImageMetadataSchema.parse(invalid));
});

test('rejects caption shorter than 10 characters', () => {
  const invalid = {
    subject: 'red fox',
    category: 'animal',
    attributes: ['orange fur'],
    caption: 'fox',
    confidence: 0.9,
  };
  assert.throws(() => ImageMetadataSchema.parse(invalid));
});