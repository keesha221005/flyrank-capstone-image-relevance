// src/services/guard.service.js

// Tuned against your eval set later — starting points based on the brief's guidance
const SIMILARITY_THRESHOLD = 0.80;   // below this, semantic match is too weak on its own
const CONFIDENCE_THRESHOLD = 0.75;   // below this, we don't trust the image's own tagging

function subjectsMatch(expectedSubject, imageSubject) {
  const a = expectedSubject.toLowerCase().trim();
  const b = imageSubject.toLowerCase().trim();

  // Exact match, or one contains the other (e.g. "fox" vs "red fox")
  return a === b || a.includes(b) || b.includes(a);
}

function evaluateCandidate(post, image) {
  const reasons = [];

  // 1. Tag-level check — the hard boundary, independent of similarity score
  if (!subjectsMatch(post.expected_subject, image.subject)) {
    return {
      decision: 'rejected',
      reason: `Subject mismatch: expected "${post.expected_subject}", detected "${image.subject}"`,
    };
  }

  // 2. Confidence check — don't trust a low-confidence tag even if the subject looks right
  if (image.confidence < CONFIDENCE_THRESHOLD) {
    reasons.push(`low tagging confidence (${image.confidence.toFixed(2)} < ${CONFIDENCE_THRESHOLD})`);
  }

  // 3. Similarity check — the semantic distance between post and image caption
  if (image.similarity < SIMILARITY_THRESHOLD) {
    reasons.push(`similarity below threshold (${image.similarity.toFixed(4)} < ${SIMILARITY_THRESHOLD})`);
  }

  if (reasons.length > 0) {
    return {
      decision: 'rejected',
      reason: reasons.join('; '),
    };
  }

  return {
    decision: 'accepted',
    reason: `Subject match, confidence ${image.confidence.toFixed(2)}, similarity ${image.similarity.toFixed(4)}`,
  };
}

function guardRankedCandidates(post, rankedImages) {
  return rankedImages.map((image, index) => ({
    ...image,
    rank: index + 1,
    ...evaluateCandidate(post, image),
  }));
}

module.exports = { evaluateCandidate, guardRankedCandidates };