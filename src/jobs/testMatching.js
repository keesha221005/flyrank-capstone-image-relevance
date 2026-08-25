// src/jobs/testMatching.js
require('dotenv').config();
const { embedText } = require('../services/embedding.service');
const { rankImagesForPost } = require('../services/matching.service');

// Stand-in for real vision-tagged images, until quota resets
const SAMPLE_IMAGES = [
  { id: 1, subject: 'red fox', caption: 'A red fox resting in tall green grass, eyes closed.' },
  { id: 2, subject: 'gray wolf', caption: 'A gray wolf standing alert in a snowy forest.' },
  { id: 3, subject: 'dog', caption: 'A golden retriever running across a sunny park.' },
  { id: 4, subject: 'brown bear', caption: 'A brown bear wading through a shallow river.' },
  { id: 5, subject: 'deer', caption: 'A deer grazing quietly at the edge of a forest.' },
];

const SAMPLE_POST = {
  title: 'The behavior of red foxes',
  body: 'Red foxes are highly adaptable animals known for their cunning hunting strategies and distinctive orange coats. Vulpes vulpes thrives in forests, grasslands, and even urban areas.',
};

async function main() {
  console.log('Embedding post...');
  const postResult = await embedText(`${SAMPLE_POST.title}. ${SAMPLE_POST.body}`);
  console.log('Post embedded. Dimensions:', postResult.embedding.length);

  console.log('\nEmbedding sample images...');
  for (const image of SAMPLE_IMAGES) {
    const result = await embedText(image.caption);
    image.embedding = result.embedding;
    console.log(`  ${image.subject} embedded`);
  }

  console.log('\nRanking images for post...\n');
  const ranked = rankImagesForPost(postResult.embedding, SAMPLE_IMAGES);

  ranked.forEach((img, i) => {
    console.log(`${i + 1}. ${img.subject} — similarity: ${img.similarity.toFixed(4)}`);
  });
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});