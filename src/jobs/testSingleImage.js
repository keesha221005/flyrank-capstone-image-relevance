// src/jobs/testSingleImage.js
require('dotenv').config();
const path = require('path');
const { classifyImage } = require('../services/vision.service');

async function main() {
  const testImagePath = path.join(__dirname, '../../data/images/fox_01.jpg');

  console.log('Classifying fox_01.jpg...\n');
  const result = await classifyImage(testImagePath);

  console.log('Validated output:');
  console.log(JSON.stringify(result.data, null, 2));

  console.log('\nToken usage:');
  console.log(result.usage);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});