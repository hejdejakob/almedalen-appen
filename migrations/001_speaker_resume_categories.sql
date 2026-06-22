-- Resumé-kommunikationsbranschen: finkornig 17-kategori-klassning av talare.
-- Additiv. Rör INTE speaker_classifications (10 breda sektorer, läses av
-- ~12 ställen i app/api). Denna tabell är separat och har inga befintliga
-- beroenden. Multi-label: en talare kan tillhöra flera kategorier.
--
-- Kör i Supabase SQL-editor (eller psql). Backup tas innan migration enligt
-- projektets regler (delad instans med almedalsdata.se).

CREATE TABLE IF NOT EXISTS speaker_resume_categories (
  id          BIGSERIAL PRIMARY KEY,
  speaker_id  BIGINT REFERENCES speakers(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,           -- en av de 17 Resumé-kategorierna
  confidence  REAL,
  method      TEXT DEFAULT 'claude',   -- claude | claude+linkedin | manual
  verified_by TEXT,                    -- t.ex. 'linkedin' vid titelverifiering
  enriched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (speaker_id, category)
);

CREATE INDEX IF NOT EXISTS idx_src_speaker  ON speaker_resume_categories (speaker_id);
CREATE INDEX IF NOT EXISTS idx_src_category ON speaker_resume_categories (category);
