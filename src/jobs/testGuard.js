// src/jobs/testGuard.js
require('dotenv').config();
const { embedText } = require('../services/embedding.service');
const { rankImagesForPost } = require('../services/matching.service');
const { guardRankedCandidates } = require('../services/guard.service');

const SAMPLE_IMAGES = [
  { id: 1, subject: 'red fox', confidence: 0.95, caption: 'A red fox resting in tall green grass, eyes closed.' },
  { id: 2, subject: 'gray wolf', confidence: 0.91, caption: 'A gray wolf standing alert in a snowy forest.' },
  { id: 3, subject: 'dog', confidence: 0.93, caption: 'A golden retriever running across a sunny park.' },
  { id: 4, subject: 'brown bear', confidence: 0.88, caption: 'A brown bear wading through a shallow river.' },
  { id: 5, subject: 'deer', confidence: 0.60, caption: 'A deer grazing quietly at the edge of a forest.' }, // intentionally low confidence
];

const SAMPLE_POST = {
  title: 'The behavior of red foxes',
  body: 'Red foxes are highly adaptable animals known for their cunning hunting strategies and distinctive orange coats. Vulpes vulpes thrives in forests, grasslands, and even urban areas.',
  expected_subject: 'red fox',
};

async function main() {
  const postResult = await embedText(`${SAMPLE_POST.title}. ${SAMPLE_POST.body}`);

  for (const image of SAMPLE_IMAGES) {
    const result = await embedText(image.caption);
    image.embedding = result.embedding;
  }

  const ranked = rankImagesForPost(postResult.embedding, SAMPLE_IMAGES);
  const guarded = guardRankedCandidates(SAMPLE_POST, ranked);

  console.log(`\nPost: "${SAMPLE_POST.title}" (expected subject: ${SAMPLE_POST.expected_subject})\n`);
  guarded.forEach((img) => {
    const icon = img.decision === 'accepted' ? '✓' : '✗';
    console.log(`${icon} #${img.rank} ${img.subject} (sim: ${img.similarity.toFixed(4)}) — ${img.decision.toUpperCase()}`);
    console.log(`   ${img.reason}\n`);
  });
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});