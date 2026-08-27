// src/jobs/runEval.js
require('dotenv').config();
const { pool } = require('../db/pool');
const { createPost } = require('../services/posts.service');
const { getAllImagesWithEmbeddings } = require('../services/images.service');
const { rankImagesForPost } = require('../services/matching.service');
const { guardRankedCandidates } = require('../services/guard.service');
const { EVAL_POSTS } = require('../../test/fixtures/evalPosts');

async function main() {
    const images = await getAllImagesWithEmbeddings();
    let correct = 0;
    const results = [];

    for (const evalCase of EVAL_POSTS) {
        const post = await createPost(evalCase);
        const ranked = rankImagesForPost(post.embedding, images);
        const guarded = guardRankedCandidates(post, ranked);
        const topAccepted = guarded.find((c) => c.decision === 'accepted');

        const isCorrect = topAccepted?.subject
            .toLowerCase()
            .includes(evalCase.expected_subject.toLowerCase());

        if (isCorrect) correct++;

        if (!isCorrect) {
            console.log(`   [debug] all candidates for "${evalCase.title}":`);
            guarded
                .filter((c) => c.subject.toLowerCase().includes(evalCase.expected_subject.toLowerCase()))
                .forEach((c) => console.log(`     ${c.subject} | sim: ${c.similarity.toFixed(4)} | ${c.decision} | ${c.reason}`));
        }

        results.push({
            post: evalCase.title,
            expected: evalCase.expected_subject,
            top_accepted_subject: topAccepted?.subject || 'NONE (no confident match)',
            correct: !!isCorrect,
        });
    }

    const precision = correct / EVAL_POSTS.length;

    console.log('\n--- Eval Results ---\n');
    results.forEach((r) => {
        const icon = r.correct ? '✓' : '✗';
        console.log(`${icon} "${r.post}"`);
        console.log(`   expected: ${r.expected} | top match: ${r.top_accepted_subject}\n`);
    });

    console.log(`Top-1 precision: ${(precision * 100).toFixed(1)}% (${correct}/${EVAL_POSTS.length})`);
    await pool.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});