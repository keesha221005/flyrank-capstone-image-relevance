// src/services/matching.service.js

function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Embedding dimension mismatch');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function rankImagesForPost(postEmbedding, images) {
  // images: [{ id, caption, subject, category, confidence, embedding }, ...]
  const ranked = images
    .map((image) => ({
      ...image,
      similarity: cosineSimilarity(postEmbedding, image.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  return ranked;
}

module.exports = { cosineSimilarity, rankImagesForPost };