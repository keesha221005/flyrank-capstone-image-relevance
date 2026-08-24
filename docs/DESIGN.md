# Design Doc — AI Image Understanding & Content Matching Engine

## Problem

Given a library of images and a set of blog posts, automatically tag each image's contents, semantically match images to the posts they best illustrate, and — critically — refuse to suggest an image when no candidate is a confident enough match. The system must distinguish between visually similar but semantically distinct subjects (e.g. a red fox post must not be paired with a wolf image), and explain any rejection in human-readable terms.

This is not an image search engine. It is a decision system that has to know when *not* to answer.

## Data model

Five tables in PostgreSQL (`image_relevance` database), no ORM — raw `pg` with parameterized queries, matching the Flyrank pattern.

- **`images`** — one row per corpus image: filename, vision-model output (`subject`, `category`, `attributes[]`, `caption`, `confidence`), caption embedding (`FLOAT8[]`), and a `flagged_low_confidence` boolean.
- **`posts`** — blog post title, body, and body embedding.
- **`suggestions`** — every ranked candidate the matching engine considered for a post: similarity score, the guard's accept/reject decision, a mandatory human-readable reason, and rank position. This is the system's full audit trail.
- **`reviews`** — human approve/reject decisions against a suggestion, with timestamp.
- **`ai_call_costs`** — per-call cost log (vision or embedding calls), tokens used, estimated cost, and which image/post the call was for.

Embeddings are stored as plain `FLOAT8[]` columns rather than via `pgvector`, since the brief marks `pgvector` optional at this scale (~50 images) and cosine similarity computed in JS at query time is simple and fast enough here. Image attributes are stored as a `TEXT[]` column on `images` rather than a normalized join table, since attributes are free-text descriptive tags, not a controlled vocabulary queried independently.

## API surface

```
POST   /api/images/ingest      trigger batch job to tag all images in data/images/
GET    /api/images              list all images with tags + confidence
POST   /api/posts               create a post (title + body)
GET    /api/posts/:id/images    ranked image suggestions for a post (core probe)
POST   /api/reviews             approve/reject a suggestion
GET    /api/reviews             review history
GET    /api/costs               per-call cost log
GET    /api/eval                run eval script, return top-1 precision
```

## Layer architecture

```
src/
├── routes/       HTTP layer only — parse request, call service, format response
├── services/     business logic — vision calls, embedding, matching, the guard
├── jobs/         background batch processing (ingestion)
├── db/           schema.sql, connection pool
├── schemas/      Zod validation schemas
└── app.js
```

Routes stay thin; all decision logic (including the mismatch guard) lives in `services/`, so the guard's thresholds and reasoning can be unit-tested independently of HTTP.

## Non-goal

This system does not implement user authentication, multi-tenant support, or a production-grade admin UI. The Review API is a single-evaluator interface — no login, no role-based access, no concurrent-user handling. Image ingestion assumes a fixed local corpus (`data/images/`), not a dynamic upload pipeline. The goal is to prove out AI decision reliability (structured tagging, semantic matching, safe rejection), not to ship a full content-management product.

## Stack

Node.js + Express v5, PostgreSQL (local), Gemini Flash (vision + embeddings, free tier), Zod for schema validation, `dotenv` for config.

