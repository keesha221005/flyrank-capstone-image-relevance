# AI Image Understanding & Content Matching Engine

Automatically tags a library of images using a vision model, semantically matches images to blog posts, and — critically — refuses to suggest an image when nothing is a confident enough match. A red-fox post gets the red-fox photo. A wolf image never does, even when it looks close.

Built as a FlyRank Internship backend capstone. The core lesson: good suggestions when confident, safe rejection when not.

## What it does

1. **Tags images** — a vision model (Gemini Flash) classifies each image into a structured, schema-validated shape: subject, category, attributes, caption, confidence.
2. **Matches semantically** — image captions and post text are embedded and ranked by cosine similarity, so "red fox" and "Vulpes vulpes" are recognized as related even though the words differ.
3. **Guards against mismatches** — a safety layer combines the vision tag, similarity score, and confidence to decide whether a suggestion is actually good enough. If not, it says so, with a reason.
4. **Tracks review decisions** — a human can approve or reject any suggestion, with a full audit trail of every candidate the system considered.
5. **Tracks cost** — every vision and embedding call is logged with token counts and estimated cost, even though the whole project runs on free tiers.

## Architecture

```
Images ─(batch job)─► Vision Model ─► {tags, caption, confidence} ─► images table
                        └─► embed(caption) ──────────────────────► images.embedding

Posts ────────────────────► embed(title + body) ─────────────────► posts.embedding

GET /api/posts/:id/images
  └─► fetch all embedded images
  └─► rank by cosine similarity (matching.service.js)
  └─► guard each candidate (guard.service.js)
        ├─► subject mismatch?     → rejected, reason given
        ├─► low confidence?       → rejected, reason given
        ├─► low similarity?       → rejected, reason given
        └─► else                  → accepted
  └─► persist every candidate to suggestions (full audit trail)
  └─► POST /api/reviews approves/rejects a suggestion
```

**Layers** (routes → services → db, kept separate so business logic is unit-testable without HTTP):

```
src/
├── routes/       HTTP layer only — parse, call service, respond
├── services/     vision, embedding, matching, guard, posts, images
├── jobs/         batch ingestion (resumable, quota-aware) + embedding enrichment
├── db/           schema.sql, connection pool
├── schemas/      Zod validation
└── app.js
```

## Setup

Requires: Node.js 22+, PostgreSQL (local), a free Gemini API key (no card — [aistudio.google.com](https://aistudio.google.com/apikey)), and a free Pexels API key (no card — [pexels.com/api](https://www.pexels.com/api/)) if you want to re-download the image corpus.

```bash
npm install

# create the database
psql -U postgres -c "CREATE DATABASE image_relevance;"
psql -U postgres -d image_relevance -f src/db/schema.sql

# configure environment
cp .env.example .env
# fill in GEMINI_API_KEY, DATABASE_URL, and PEXELS_API_KEY in .env
```

## Seed the corpus

```bash
node src/jobs/fetchCorpus.js       # downloads 50 licensed-free images (fox/wolf/dog/bear/deer) from Pexels
node src/jobs/ingestImages.job.js  # tags images via Gemini vision — resumable, ~20/day on free tier
node src/jobs/embedImages.job.js   # embeds captions for matching
```

**Note on quota**: this project's free-tier Gemini account is capped at 20 requests/day for `gemini-2.5-flash`, and the quota resets on Pacific Time (not local time — worth checking [ai.dev/rate-limit](https://ai.dev/rate-limit) if a run stops early). `ingestImages.job.js` is resumable — re-run the same command daily until the corpus is fully tagged. The included corpus (50 images) took 3 daily runs to fully tag. See `BUILDLOG.md` for the full story.

**Important**: after any ingestion run, also re-run `embedImages.job.js` — the two jobs aren't automatically chained, so newly-tagged images won't participate in matching until they're embedded too (a real bug found mid-build; see `BUILDLOG.md`).

## Run

```bash
node src/app.js
```

Server starts on `http://localhost:3000`.

## Try it

```bash
# create a post
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "The behavior of red foxes", "body": "Red foxes are highly adaptable...", "expected_subject": "fox"}'

# get ranked, guarded image suggestions
curl http://localhost:3000/api/posts/1/images

# approve or reject a suggestion
curl -X POST http://localhost:3000/api/reviews \
  -H "Content-Type: application/json" \
  -d '{"suggestion_id": 1, "decision": "approved"}'
```

## Test

```bash
npm test
```

15 automated tests (Node's built-in test runner, no extra dependencies) covering schema validation, guard decision logic — including the core case: a wolf candidate is rejected on subject mismatch even when its similarity score is deliberately set higher than a real fox's — and matching math.

## Eval results

```bash
node src/jobs/runEval.js
```

Top-1 precision on the full 50-image corpus: **80% (4/5)**. Full breakdown, including the one honestly-investigated miss, in `EVIDENCE.md`.

## API

| Endpoint | Purpose |
|---|---|
| `POST /api/posts` | Create a post (embeds on creation) |
| `GET /api/posts/:id/images` | Ranked, guarded image suggestions for a post |
| `GET /api/images` | List all tagged images |
| `POST /api/images/ingest` | Trigger the vision batch job in the background |
| `POST /api/reviews` | Approve/reject a suggestion |
| `GET /api/reviews` | Review history, joined with the original suggestion |
| `GET /api/costs` | Per-call-type cost log |

## Limitations (honest, on purpose)

- **No auth, no multi-tenancy.** Single-evaluator interface, no login, no concurrent-user handling. See `docs/DESIGN.md` for the full non-goal statement.
- **Fixed local corpus.** Ingestion assumes images live in `data/images/`, not a dynamic upload pipeline.
- **Free-tier quota is 20 requests/day**, well below Google's generally published limits — likely account verification status. The ingestion job is resumable to work around this, but it means the full 50-image corpus takes several days to tag from a cold start.
- **Subject matching is substring-based**, not a separate AI classification step. This is a deliberate choice (see `docs/DESIGN.md`) but means subject phrasing inconsistencies from the vision model (mostly fixed via prompt tightening mid-build — see `BUILDLOG.md`) can occasionally produce a looser match than a true semantic subject comparison would.
- **Embedding call costs are estimated**, not exact — Gemini's embedding endpoint doesn't return the same token-usage breakdown vision calls do, so cost tracking for embeddings uses a length-based approximation.

## Docs

- `docs/DESIGN.md` — Phase 1 design doc: schema, DB, API surface, non-goal
- `BUILDLOG.md` — honest log of AI-assisted decisions, bugs found, and fixes
- `EVIDENCE.md` — proof for each Definition-of-Done checklist item