-- Aktivera Row Level Security på alla tabeller
-- Tillåt bara SELECT för anon-rollen
-- Kör detta manuellt i Supabase Dashboard → SQL Editor

-- Lager 1: Rådata
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_events" ON events FOR SELECT TO anon USING (true);

ALTER TABLE arrangers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_arrangers" ON arrangers FOR SELECT TO anon USING (true);

ALTER TABLE speakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_speakers" ON speakers FOR SELECT TO anon USING (true);

ALTER TABLE event_arrangers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_event_arrangers" ON event_arrangers FOR SELECT TO anon USING (true);

ALTER TABLE event_speakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_event_speakers" ON event_speakers FOR SELECT TO anon USING (true);

-- Lager 2: Enrichment
ALTER TABLE arranger_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_arranger_classifications" ON arranger_classifications FOR SELECT TO anon USING (true);

ALTER TABLE event_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_event_topics" ON event_topics FOR SELECT TO anon USING (true);

ALTER TABLE event_sentiment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_event_sentiment" ON event_sentiment FOR SELECT TO anon USING (true);

-- Lager 3: Aggregat
ALTER TABLE arranger_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_arranger_stats" ON arranger_stats FOR SELECT TO anon USING (true);

ALTER TABLE speaker_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_speaker_stats" ON speaker_stats FOR SELECT TO anon USING (true);

ALTER TABLE topic_year_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_topic_year_stats" ON topic_year_stats FOR SELECT TO anon USING (true);
