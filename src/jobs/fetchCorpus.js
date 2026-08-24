// src/jobs/fetchCorpus.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.PEXELS_API_KEY;
const OUT_DIR = path.join(__dirname, '../../data/images');

// Roughly 10 images per category, ~50 total.
// Mix of "clean" and a few visually-ambiguous shots on purpose —
// the guard needs hard cases to actually prove itself.
const CATEGORIES = [
  { query: 'red fox', label: 'fox', count: 10 },
  { query: 'gray wolf', label: 'wolf', count: 10 },
  { query: 'dog outdoors', label: 'dog', count: 10 },
  { query: 'brown bear', label: 'bear', count: 10 },
  { query: 'deer forest', label: 'deer', count: 10 },
];

async function searchPhotos(query, perPage) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}`;
  const res = await fetch(url, { headers: { Authorization: API_KEY } });
  if (!res.ok) {
    throw new Error(`Pexels search failed for "${query}": ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.photos;
}

async function downloadImage(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${url} (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

async function main() {
  if (!API_KEY) {
    console.error('Missing PEXELS_API_KEY in .env');
    process.exit(1);
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const manifest = [];

  for (const { query, label, count } of CATEGORIES) {
    console.log(`\nFetching "${query}"...`);
    const photos = await searchPhotos(query, count);

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const filename = `${label}_${String(i + 1).padStart(2, '0')}.jpg`;
      const destPath = path.join(OUT_DIR, filename);

      await downloadImage(photo.src.large, destPath);
      console.log(`  saved ${filename}`);

      manifest.push({
        filename,
        label,
        pexels_id: photo.id,
        photographer: photo.photographer,
        pexels_url: photo.url,
      });

      // Be polite to the free tier — small delay between downloads
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\nDone. ${manifest.length} images saved to ${OUT_DIR}`);
  console.log('manifest.json written with source attribution.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});