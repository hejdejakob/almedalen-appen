-- ===========================================
-- Lager 1 — Rådata
-- ===========================================

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  source_id TEXT,
  year SMALLINT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  extended_description TEXT DEFAULT '',
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  day_of_week TEXT,
  location_name TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  event_type TEXT,
  topic_pdf_original TEXT,
  secondary_topic TEXT,
  language TEXT DEFAULT 'Svenska',
  refreshments BOOLEAN DEFAULT FALSE,
  url TEXT,
  source TEXT,
  raw_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (year, source_id)
);

CREATE TABLE IF NOT EXISTS arrangers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_normalized TEXT,
  org_number TEXT,
  website TEXT,
  first_seen_year SMALLINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS speakers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_normalized TEXT,
  title TEXT,
  org_name TEXT,
  first_seen_year SMALLINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_arrangers (
  event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
  arranger_id BIGINT REFERENCES arrangers(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (event_id, arranger_id)
);

CREATE TABLE IF NOT EXISTS event_speakers (
  event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
  speaker_id BIGINT REFERENCES speakers(id) ON DELETE CASCADE,
  role TEXT,
  raw_mention TEXT,
  PRIMARY KEY (event_id, speaker_id)
);

-- ===========================================
-- Lager 2 — Enrichment
-- ===========================================

CREATE TABLE IF NOT EXISTS arranger_classifications (
  id BIGSERIAL PRIMARY KEY,
  arranger_id BIGINT REFERENCES arrangers(id) ON DELETE CASCADE,
  sector TEXT,
  sub_sector TEXT,
  confidence REAL,
  method TEXT DEFAULT 'claude',
  verified_by TEXT,
  enriched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (arranger_id)
);

CREATE TABLE IF NOT EXISTS event_topics (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
  topic_primary TEXT,
  topic_secondary TEXT[],
  keywords TEXT[],
  confidence REAL,
  enriched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id)
);

CREATE TABLE IF NOT EXISTS event_sentiment (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
  score REAL CHECK (score >= -1 AND score <= 1),
  label TEXT CHECK (label IN ('positiv', 'neutral', 'negativ')),
  urgency_score REAL CHECK (urgency_score >= 0 AND urgency_score <= 1),
  framing TEXT CHECK (framing IN ('problem', 'solution', 'neutral')),
  confidence REAL,
  enriched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id)
);

-- ===========================================
-- Lager 3 — Aggregat
-- ===========================================

CREATE TABLE IF NOT EXISTS arranger_stats (
  arranger_id BIGINT REFERENCES arrangers(id) ON DELETE CASCADE,
  year SMALLINT NOT NULL,
  events_count INT DEFAULT 0,
  panel_slots_given INT DEFAULT 0,
  panel_slots_received INT DEFAULT 0,
  agenda_power_index REAL DEFAULT 0,
  PRIMARY KEY (arranger_id, year)
);

CREATE TABLE IF NOT EXISTS speaker_stats (
  speaker_id BIGINT REFERENCES speakers(id) ON DELETE CASCADE,
  year SMALLINT NOT NULL,
  panel_count INT DEFAULT 0,
  unique_arrangers INT DEFAULT 0,
  years_active INT DEFAULT 0,
  breadth_score REAL DEFAULT 0,
  PRIMARY KEY (speaker_id, year)
);

CREATE TABLE IF NOT EXISTS topic_year_stats (
  topic TEXT NOT NULL,
  year SMALLINT NOT NULL,
  event_count INT DEFAULT 0,
  yoy_change_pct REAL,
  avg_sentiment REAL,
  top_arrangers JSONB,
  PRIMARY KEY (topic, year)
);

-- ===========================================
-- Index för snabba queries
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_events_year ON events(year);
CREATE INDEX IF NOT EXISTS idx_events_source_id ON events(source_id);
CREATE INDEX IF NOT EXISTS idx_arrangers_name_normalized ON arrangers(name_normalized);
CREATE INDEX IF NOT EXISTS idx_speakers_name_normalized ON speakers(name_normalized);

-- ===========================================
-- Full-text search på speakers
-- ===========================================

ALTER TABLE speakers ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE speakers SET search_vector =
  to_tsvector('swedish',
    COALESCE(name, '') || ' ' ||
    COALESCE(title, '') || ' ' ||
    COALESCE(org_name, '')
  );

CREATE INDEX IF NOT EXISTS idx_speakers_fts ON speakers USING gin(search_vector);

CREATE OR REPLACE FUNCTION speakers_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('swedish',
    COALESCE(NEW.name, '') || ' ' ||
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.org_name, '')
  );
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_speakers_search ON speakers;
CREATE TRIGGER trg_speakers_search
  BEFORE INSERT OR UPDATE ON speakers
  FOR EACH ROW EXECUTE FUNCTION speakers_search_trigger();
