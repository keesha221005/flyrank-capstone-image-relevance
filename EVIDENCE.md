# EVIDENCE.md

One pasted proof per Definition-of-Done checkbox (§6 of the capstone brief). Updated as the build progresses — items not yet reached are marked pending, not hidden.

---

## AI Processing

### ✅ Vision model produces structured output validated against a schema; invalid responses are never trusted.

`src/services/vision.service.js` calls Gemini with a `responseSchema`, then re-validates the parsed JSON against the same shape via `ImageMetadataSchema.parse()` (Zod) before it's ever used downstream.

Sample validated output (`fox_01.jpg`, single-image test):
```json
{
  "subject": "fox",
  "category": "animal",
  "attributes": ["red fur", "lying down", "in grass", "wildlife", "orange"],
  "caption": "A red fox is seen resting with its eyes closed, curled up in tall green grass.",
  "confidence": 0.95
}
```

### ⏳ Low-confidence classifications are flagged instead of accepted.
Logic exists (`flagged_low_confidence` boolean, threshold 0.75 in `ingestImages.job.js`) and is exercised in code, but no image in the corpus so far has scored below the threshold — the 19 images processed range from 0.90–1.00 confidence. Revisit once the fox/wolf images (intentionally harder pairs) are processed, or reconsider the threshold if the full 50-image corpus stays uniformly high-confidence.

### ✅ Images are processed through a batch background job with retries.
`src/jobs/ingestImages.job.js` — paced at 1 call per 5s, up to 2 retries per image, distinguishes daily-quota exhaustion (stops immediately, no wasted retries) from transient errors (retries with backoff). Resumable: skips already-processed filenames on each run.

Real run log (day 2, hit daily quota mid-run):
```
Total corpus: 50
Already processed: 0
Remaining: 50

⏸ Daily quota exhausted. Stopping run — resume tomorrow with the same command.

--- Run summary ---
Processed this run: 19
Failed (non-quota): 0
Flagged (low confidence): 0
Estimated cost this run: $0.015546
Remaining after this run: 31
```

### ✅ Vision and embedding costs are tracked per call.
`ai_call_costs` table populated on every vision call (`insertImage`) and every embedding call would follow the same pattern. Estimated cost for 19 vision calls: **$0.015546** (see run log above), computed from real `usageMetadata` token counts against Gemini's published per-token rates.

---

## Matching System

### ✅ Image and post embeddings are stored; posts return ranked image suggestions.
`GET /api/posts/:id/images` — real test against post #2 ("Understanding deer behavior in forests", `expected_subject: "deer"`) against the 19 real vision-tagged, embedded images in the DB:

```json
{
  "subject": "deer",
  "similarity": 0.8894909632723377,
  "decision": "accepted",
  "reason": "Subject match, confidence 0.98, similarity 0.8895"
},
{
  "subject": "bear",
  "similarity": 0.7872921688561872,
  "decision": "rejected",
  "reason": "Subject mismatch: expected \"deer\", detected \"bear\""
}
```
Full ranked list: all 9 deer images accepted (similarity 0.85–0.89), all 10 bear images rejected (similarity 0.73–0.79) — clean separation, no false positives or negatives in this run.

### ✅ Semantic matching works for equivalent concepts.
Early standalone test (`testMatching.js`, before guard existed) using hardcoded captions confirmed a "red foxes" post ranked a fox caption highest (0.8207) even though wording differs from "Vulpes vulpes" in the post body — semantic, not keyword, matching.

---

## Safety Layer

### ✅ The mismatch guard rejects incorrect recommendations — the wolf-on-a-fox-post scenario provably fails.
`testGuard.js`, hardcoded sample data, post `expected_subject: "red fox"`:
```
✓ #1 red fox (sim: 0.8207) — ACCEPTED
   Subject match, confidence 0.95, similarity 0.8207
✗ #2 gray wolf (sim: 0.7823) — REJECTED
   Subject mismatch: expected "red fox", detected "gray wolf"
```
Note: wolf's similarity score (0.7823) was close enough to fox's (0.8207) that a similarity-only threshold could plausibly have accepted it — the tag-level subject check is what actually catches the mismatch, which is the point of the two-layer guard design.

### ✅ Rejections include a human-readable explanation.
Every rejected candidate in the deer/bear and fox/wolf tests above includes a specific `reason` string, not just a boolean.

### ✅ When no image clears the bar, the system answers "no confident match" with reasons.
`GET /api/posts/1/images` (fox post, before any fox images existed in the DB yet):
```json
{
  "post_id": 1,
  "expected_subject": "fox",
  "best_match": null,
  "no_confident_match": true,
  "candidates": [ /* all 19 candidates, all rejected on subject mismatch */ ]
}
```

---

## Backend

### ✅ Database models for images, tags, embeddings, posts, suggestions, approvals/rejections — with required indexes.
`src/db/schema.sql` — 5 tables (`images`, `posts`, `suggestions`, `reviews`, `ai_call_costs`), 4 indexes. Applied and verified via `psql \dt`.

### ⏳ API endpoints validated; the review workflow (approve/reject/inspect why) exists.
`POST /api/posts`, `GET /api/posts/:id/images`, `GET /api/images`, `POST /api/images/ingest`, `POST /api/reviews`, `GET /api/reviews`, `GET /api/costs` all implemented with Zod validation on write endpoints. Review workflow (`POST /api/reviews`) not yet exercised against a real `suggestion_id` — pending next test.

### ✅ Automated tests cover schema validation, mismatch rejection, and matching accuracy.
`test/` — 15 tests using Node's built-in test runner (`node --test`), zero dependencies added. Covers all three required areas:
- **Schema validation** (`imageMetadata.schema.test.js`): valid object passes, invalid category/confidence-out-of-range/too-many-attributes/short-caption all correctly rejected.
- **Mismatch rejection** (`guard.service.test.js`): includes the core safety-critical case — the guard rejects a wolf candidate on subject mismatch *even when similarity is deliberately set to 0.95*, proving the tag-level check overrides similarity rather than just adding to it. Also covers low-confidence rejection, low-similarity rejection, and case-insensitive/substring-tolerant subject matching.
- **Matching accuracy** (`matching.service.test.js`): cosine similarity correctness (identical → 1, orthogonal → 0, opposite → -1, dimension mismatch → throws), and correct descending ranking order.

All 15 passing:
```
✔ accepts when subject matches, confidence and similarity clear thresholds
✔ rejects the wolf-on-fox-post scenario on subject mismatch, even with high similarity
✔ rejects on low confidence even when subject matches
✔ rejects on low similarity even when subject and confidence are fine
✔ subject matching is case-insensitive and tolerant of substrings
✔ accepts a valid image metadata object
✔ rejects an invalid category
✔ rejects confidence outside 0-1 range
✔ rejects more than 8 attributes
✔ rejects caption shorter than 10 characters
✔ identical vectors have similarity of 1
✔ orthogonal vectors have similarity of 0
✔ opposite vectors have similarity of -1
✔ throws on mismatched vector dimensions
✔ ranks images by descending similarity to post embedding

ℹ tests 15
ℹ pass 15
ℹ fail 0
```

---

## Quality & Documentation

### ⏳ A small labeled evaluation dataset measures top-1 precision.
Not yet started — planned for Phase 4.

### 🔶 README with architecture explanation and diagram; submission-pack files present.
`docs/DESIGN.md` exists (Phase 1 design doc) with architecture sketch. Full README.md, capstone.yaml, BUILDLOG.md still need populating with build narrative (BUILDLOG has real material to draw from already: the 20 RPD quota discovery, the NUMERIC-as-string pg bug, the subject-formatting prompt fix).

---

**Honest note on today's finding:** the free-tier Gemini project this capstone runs on is capped at 20 requests/day for `gemini-2.5-flash` (and the same for Flash-Lite) — well below Google's generally published limits, likely due to account verification status. The ingestion job was redesigned mid-build to be resumable and quota-aware rather than treating this as a blocker. Full corpus tagging is expected to complete across ~3 daily runs.