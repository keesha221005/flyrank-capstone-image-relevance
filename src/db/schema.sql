-- src/db/schema.sql

CREATE TABLE images (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  attributes TEXT[] NOT NULL,
  caption TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL,
  embedding FLOAT8[],              -- caption embedding, filled in Phase 3
  flagged_low_confidence BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  embedding FLOAT8[],              -- post text embedding
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE suggestions (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  image_id INTEGER NOT NULL REFERENCES images(id),
  similarity_score NUMERIC(5,4) NOT NULL,
  guard_decision TEXT NOT NULL CHECK (guard_decision IN ('accepted', 'rejected')),
  guard_reason TEXT NOT NULL,      -- human-readable explanation, always present
  rank INTEGER NOT NULL,           -- position among candidates for this post
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  suggestion_id INTEGER NOT NULL REFERENCES suggestions(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reviewed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ai_call_costs (
  id SERIAL PRIMARY KEY,
  call_type TEXT NOT NULL CHECK (call_type IN ('vision', 'embedding')),
  reference_id INTEGER,            -- image_id or post_id, depending on call_type
  tokens_used INTEGER,
  estimated_cost NUMERIC(10,6),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for the query patterns you'll actually run
CREATE INDEX idx_suggestions_post_id ON suggestions(post_id);
CREATE INDEX idx_suggestions_guard_decision ON suggestions(guard_decision);
CREATE INDEX idx_images_category ON images(category);
CREATE INDEX idx_reviews_suggestion_id ON reviews(suggestion_id);