# BUILDLOG.md

Honest log of where AI assistance helped, where it was wrong or incomplete, and what I changed. Per the ground rules: "The AI wrote it" is not an answer — this documents the actual decisions.

---

## Phase 1 — Design

AI helped draft the initial Zod schema for image metadata, the database schema (5 tables), API surface, and layer architecture, based on the capstone brief's requirements. I reviewed each field/table and asked for reasoning before accepting — e.g. why `category` is an enum but `subject` is free text, why embeddings are stored as `FLOAT8[]` instead of pgvector at this scale, why attributes live on `images` directly instead of a separate normalized `tags` table.

**One place worth flagging**: AI proposed folding `tags` into `images.attributes` rather than a literal separate `tags` table, flagging it as a deviation from a literal noun-for-noun reading of the brief's table list. I accepted this reasoning — attributes are free-text descriptive tags, not a controlled vocabulary needing independent queries — but it's a design choice, not a fixed requirement.

## Phase 2 — Vision pipeline

### What went wrong initially: quota assumptions
The first batch job design assumed Gemini's generally-published free-tier rate limits (~1,500 requests/day per public docs) applied to my account. They didn't — my actual project is capped at **20 requests/day** for `gemini-2.5-flash` (and the same for Flash-Lite), confirmed via the AI Studio rate-limit dashboard, likely due to account verification status with no visible unlock path. This was a real gap between general documentation and account-specific reality.

**What changed**: redesigned the ingestion job to be resumable — it checks the `images` table for already-processed filenames before calling the vision API, and distinguishes a daily-quota-exhaustion error (`PerDay` in the error message) from a transient rate-limit error, stopping cleanly on the former instead of burning retries that can't succeed. This meant tagging 50 images took 3 daily runs (19 + 17 + remainder) instead of one continuous batch — a real production-style constraint, not a shortcut.

### A real validation bug caught by the pipeline
On day 2 of ingestion, `dog_01.jpg` failed because Gemini returned more than 8 attributes, which the Zod schema correctly rejected (`"Too big: expected array to have <=8 items"`). This is the schema-validation principle working as intended — bad output was never silently accepted. However, the initial retry logic just retried the same prompt, which doesn't fix a model tendency to over-list attributes for a given image. **Fix**: added `maxItems: 8` directly to the Gemini structured-output schema (not just the post-hoc Zod check), so the constraint is enforced at the source going forward.

### Subject-field inconsistency, caught mid-build
After the first 19 images processed, I noticed wildly inconsistent `subject` formatting: `"bear"`, `"Bear"`, `"Two brown bears"`, `"Deer in a forest enclosure"` — descriptions, not canonical subjects. This risked weakening the guard's subject-matching logic (which relies on substring comparison). **Fix**: tightened the vision prompt to explicitly request "a short canonical noun phrase, 1-2 words, singular" and to put descriptive detail in `attributes` instead. Confirmed via a single-image test that later images (`fox_01.jpg` onward) came back clean (`"red fox"` instead of a full sentence).

**Honest gap**: the 19 images processed before this fix keep their inconsistent subject field. Reprocessing them would cost quota for no real benefit — the guard's fuzzy substring matching handles the older, messier data fine in practice (verified: `"Two Red Deer Stags"` still correctly matches an `expected_subject` of `"deer"`). Documented rather than silently left unexplained.

### A real infrastructure bug: NUMERIC returned as strings
The first live test of `/api/posts/:id/images` against real DB data crashed with `TypeError: image.confidence.toFixed is not a function`. Root cause: Postgres's `pg` driver returns `NUMERIC` columns as JavaScript strings (to avoid floating-point precision loss), not numbers. This didn't surface earlier because standalone tests (`testGuard.js`) used hardcoded JS objects, not real DB rows. **Fix**: convert `confidence` to `Number()` once, at the DB read boundary in `images.service.js`, rather than scattered throughout the codebase.

## Phase 3 — Matching & guard

### Embedding-only similarity isn't enough — proven, not assumed
Before building the guard, I tested pure cosine similarity ranking on hardcoded sample data. Result: a fox post scored the fox caption highest (0.8207), but the wolf caption scored close behind (0.7823) — only ~0.04 apart. This concretely demonstrated why similarity alone is an insufficient safety layer, motivating the two-part guard design (tag-level subject check + similarity threshold + confidence threshold), rather than taking the brief's word for it on faith.

### Design decision: explicit `expected_subject` instead of AI-inferred post topic
Rather than using another Gemini call to infer what a post is "about" from its body text, posts require an explicit `expected_subject` field on creation. This was a deliberate choice to avoid adding a second AI inference step (and second point of failure/quota cost) to a system whose entire purpose is trustworthy decision-making. A real editorial team publishing a post already knows its subject; inferring it via AI would trade reliability for convenience.

### Estimated vs. exact token counts — an honest limitation
Vision calls return exact `usageMetadata` token counts from Gemini. Embedding calls do not return the same breakdown, so embedding cost tracking uses an estimate (`text.length / 4`, a standard rough approximation) rather than an exact count. This is flagged in code comments and here rather than presented as precise when it isn't.

## Testing

15 automated tests written using Node's built-in test runner (zero new dependencies) covering schema validation, guard decision logic, and matching math. The most important test explicitly proves the guard's core safety property: a wolf candidate is rejected on subject mismatch *even when its similarity score is deliberately set to 0.95* (higher than a real fox would likely score) — confirming the subject check is a hard override, not just one input among several that could be outweighed by a strong similarity score.

---

## Summary of real constraints encountered (not hidden)

- Free-tier Gemini quota is 20 requests/day on this project, not the ~1,500/day general docs suggest — redesigned around it rather than treating it as a blocker.
- Vision output needed a second validation pass even with structured output requested — Gemini doesn't perfectly enforce array-length constraints without an explicit `maxItems` in the schema.
- Real database data surfaces bugs hardcoded test fixtures don't — the NUMERIC-string issue only appeared once real Postgres rows hit the guard.