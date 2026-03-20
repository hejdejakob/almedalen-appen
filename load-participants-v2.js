// V2: Improved participant parser using triple grouping with name validation
// Fixes the bug where org names were parsed as person names
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchAllDB(table, columns, filter) {
  const rows = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(columns).range(from, from + 999);
    if (filter) q = filter(q);
    const { data } = await q;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

// Common org indicators — if a "name" contains these, it's not a person
const ORG_INDICATORS = [
  'AB', 'ab', ' AB', 'Sverige', 'Swedish', 'Svensk ', 'Svenska ',
  'förbund', 'Förbund', 'förening', 'Förening', 'stiftelse', 'Stiftelse',
  'kommun', 'Kommun', 'region', 'Region', 'myndighet', 'Myndighet',
  'universitet', 'Universitet', 'högskola', 'Högskola', 'institut',
  'parti', 'Parti', 'departement', 'Departement',
  'tidning', 'Tidning', 'media', 'Media',
  'riksdag', 'Riksdag', 'regering', 'Regering',
  'bransch', 'Bransch', 'näringsliv', 'Näringsliv',
  'handel', 'Handel', 'industri', 'Industri',
  'kooperativ', 'Kooperativ', 'koncern', 'Koncern',
  'byrå', 'Byrå', 'konsult', 'Konsult',
  'demokrat', 'Demokrat', 'liberal', 'Liberal', 'moderat', 'Moderat',
  'center', 'Center', 'vänster', 'Vänster',
  'ungdom', 'Ungdom', 'grön', 'Grön',
  'kors', 'Kors', // Röda Korset
  'LO', 'TCO', 'SACO', 'SKR', 'IF ', 'HSB',
  'IVL', 'RISE', 'FOI', 'MSB', 'SCB',
  'grupp', 'Group', 'Inc', 'Ltd', 'GmbH',
  'council', 'Council', 'Commission', 'commission',
  'foundation', 'Foundation',
];

// Common title indicators
const TITLE_INDICATORS = [
  'ordförande', 'Ordförande', 'vice ordförande',
  'VD', 'vd', 'CEO', 'ceo',
  'chef', 'Chef', 'direktör', 'Direktör',
  'minister', 'Minister', 'statsråd', 'Statsråd',
  'riksdagsledamot', 'Riksdagsledamot', 'ledamot', 'Ledamot',
  'professor', 'Professor', 'docent', 'Docent', 'forskare', 'Forskare',
  'redaktör', 'Redaktör', 'journalist', 'Journalist',
  'moderator', 'Moderator', 'programledare', 'Programledare',
  'sekreterare', 'Sekreterare', 'kanslichef', 'Kanslichef',
  'talesperson', 'Talesperson',
  'generaldirektör', 'Generaldirektör', 'generalsekreterare', 'Generalsekreterare',
  'landshövding', 'Landshövding', 'borgmästare',
  'rektor', 'Rektor', 'dekan', 'Dekan',
  'ekonom', 'Ekonom', 'analytiker', 'Analytiker',
  'specialist', 'Specialist', 'expert', 'Expert',
  'ansvarig', 'Ansvarig', 'samordnare', 'Samordnare',
  'projektledare', 'Projektledare', 'verksamhetsledare',
  'kommunikation', 'Kommunikation', 'strateg', 'Strateg',
  'advokat', 'Advokat', 'jurist', 'Jurist',
  'läkare', 'Läkare', 'överläkare', 'sjuksköterska',
  'författare', 'Författare', 'debattör', 'Debattör',
  'grundare', 'Grundare', 'medgrundare',
  'styrelseledamot', 'Styrelseledamot',
];

function looksLikePersonName(text) {
  if (!text || text.length < 4) return false;

  // Must have at least 2 words (first + last name)
  const words = text.trim().split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;

  // First word should start with uppercase (not a title word)
  if (!/^[A-ZÅÄÖ]/.test(words[0])) return false;

  // Check if it contains org indicators
  for (const ind of ORG_INDICATORS) {
    if (text.includes(ind)) return false;
  }

  // Check if it looks like a title
  for (const ind of TITLE_INDICATORS) {
    if (text.toLowerCase().startsWith(ind.toLowerCase())) return false;
  }

  // Names shouldn't have parentheses (often seen in orgs)
  if (text.includes('(') || text.includes(')')) return false;

  // Each word in a name should start with uppercase (except connectors like 'von', 'af', 'de')
  const connectors = new Set(['von', 'af', 'de', 'van', 'der', 'den', 'el', 'al', 'bin', 'ibn', 'i']);
  for (const w of words) {
    if (!connectors.has(w.toLowerCase()) && !/^[A-ZÅÄÖ]/.test(w)) return false;
  }

  return true;
}

function parseParticipants(text) {
  if (!text || text.length < 5) return [];

  const parts = text.split(',').map(s => s.trim()).filter(s => s.length > 0);
  const speakers = [];

  let i = 0;
  while (i < parts.length) {
    // Current part should be a person name
    if (!looksLikePersonName(parts[i])) {
      i++;
      continue;
    }

    const name = parts[i];
    let title = null;
    let org = null;

    // Look at next parts for title and org
    if (i + 1 < parts.length) {
      const next1 = parts[i + 1];

      if (i + 2 < parts.length) {
        const next2 = parts[i + 2];

        // Check if next2 is a new person name (meaning current person has name + title + org = 3 parts)
        if (looksLikePersonName(next2)) {
          // Current person only has 2 fields: name + (title or org)
          // Determine if next1 is a title or org
          const isTitle = TITLE_INDICATORS.some(t => next1.toLowerCase().includes(t.toLowerCase()));
          if (isTitle) {
            title = next1;
          } else {
            org = next1;
          }
          i += 2;
          continue;
        }

        // Check if the part AFTER next2 is a new person (standard triple)
        if (i + 3 < parts.length && looksLikePersonName(parts[i + 3])) {
          title = next1;
          org = next2;
          i += 3;
          speakers.push({ name, title, org, role: 'panelist' });
          continue;
        }

        // Default: assume triple
        title = next1;
        org = next2;
        i += 3;
      } else {
        // Only one more part
        const isTitle = TITLE_INDICATORS.some(t => next1.toLowerCase().includes(t.toLowerCase()));
        if (isTitle) {
          title = next1;
        } else {
          org = next1;
        }
        i += 2;
      }
    } else {
      i++;
    }

    speakers.push({ name, title, org, role: 'panelist' });
  }

  return speakers;
}

async function main() {
  // First, clear old speaker data from the participants parse (keep contact persons from scraping)
  console.log('Clearing old participant-parsed speakers...');

  // Delete all event_speakers with role='panelist' (from old parse)
  // Keep role='kontaktperson' (from scraping)
  let deleted = 0;
  while (true) {
    const { data, error } = await supabase
      .from('event_speakers')
      .delete()
      .eq('role', 'panelist')
      .select('id')
      .limit(1000);
    if (error) { console.error('Delete error:', error.message); break; }
    if (!data || data.length === 0) break;
    deleted += data.length;
    process.stdout.write(`\r  Deleted ${deleted} old panelist links`);
  }
  console.log(`\nDeleted ${deleted} old panelist links`);

  // Now re-parse and load
  const data = require('./public/almedalen-all.json');

  const dbEvents = await fetchAllDB('events', 'id, source_id, year');
  const sourceMap = new Map();
  for (const e of dbEvents) {
    sourceMap.set(e.year + '_' + e.source_id, e.id);
  }
  console.log('DB events loaded:', dbEvents.length);

  // Test parser on a few examples first
  const testCases = [
    'Annika Strandhäll, Klimat och miljöminister, Socialdemokraterna, Jan-Olof Jacke, VD, Svenskt Näringsliv',
    'Oscar Sjövist, Ordförande, Unga Rörelsehindrade, Onni Karlsson, Unga Röreslehindrade, Amanda Lindestreng, Genreralsekreterare, Elevernas riksförbund',
    'Anders Mansten, Anestesi-och Ivaöverläkare',
  ];

  console.log('\n=== Parser test ===');
  for (const tc of testCases) {
    const result = parseParticipants(tc);
    console.log('Input:', tc.substring(0, 80) + '...');
    console.log('Result:', result.map(s => s.name).join(', '));
    console.log('');
  }

  // Parse all events
  let totalParsed = 0;
  let totalSpeakers = 0;
  const allResults = [];

  for (const ev of Object.values(data)) {
    if (!ev.participants || ev.participants.length < 5) continue;

    const dbId = sourceMap.get(ev.year + '_' + ev.event_id);
    if (!dbId) continue;

    const speakers = parseParticipants(ev.participants);
    if (speakers.length > 0) {
      allResults.push({ event_id: dbId, speakers });
      totalParsed++;
      totalSpeakers += speakers.length;
    }
  }

  console.log(`Parsed ${totalParsed} events with ${totalSpeakers} speaker mentions`);

  // Load into DB
  let created = 0;
  let linked = 0;
  let errors = 0;
  const speakerCache = new Map();

  for (let idx = 0; idx < allResults.length; idx++) {
    if (idx % 200 === 0) process.stdout.write(`\r  ${idx}/${allResults.length}`);

    const { event_id, speakers } = allResults[idx];

    for (const sp of speakers) {
      const normalized = sp.name.toLowerCase().trim();

      let speakerId = speakerCache.get(normalized);

      if (!speakerId) {
        const { data: existing } = await supabase
          .from('speakers')
          .select('id')
          .eq('name_normalized', normalized)
          .limit(1);

        if (existing?.length) {
          speakerId = existing[0].id;
        } else {
          const { data: inserted, error } = await supabase
            .from('speakers')
            .insert({
              name: sp.name,
              name_normalized: normalized,
              title: sp.title || null,
              org_name: sp.org || null,
            })
            .select('id');

          if (error) { errors++; continue; }
          if (inserted?.length) { speakerId = inserted[0].id; created++; }
        }

        if (speakerId) speakerCache.set(normalized, speakerId);
      }

      if (speakerId) {
        const { error } = await supabase
          .from('event_speakers')
          .upsert({
            event_id,
            speaker_id: speakerId,
            role: sp.role || 'panelist',
            raw_mention: sp.name,
          }, { onConflict: 'event_id,speaker_id', ignoreDuplicates: true });

        if (!error) linked++;
        else if (!error?.message?.includes('duplicate')) errors++;
      }
    }
  }

  console.log(`\nDone: ${created} new speakers, ${linked} links, ${errors} errors`);

  const { count: ts } = await supabase.from('speakers').select('*', { count: 'exact', head: true });
  const { count: tl } = await supabase.from('event_speakers').select('*', { count: 'exact', head: true });
  console.log(`Total: ${ts} speakers, ${tl} links`);

  // Verify: show top 20
  const allLinks = [];
  let from = 0;
  while (true) {
    const { data: d } = await supabase.from('event_speakers').select('speaker_id').range(from, from + 999);
    allLinks.push(...d);
    if (d.length < 1000) break;
    from += 1000;
  }

  const counts = {};
  for (const l of allLinks) { counts[l.speaker_id] = (counts[l.speaker_id] || 0) + 1; }
  const topIds = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 20);

  console.log('\nTop 20 speakers (verify no orgs):');
  for (const [id, count] of topIds) {
    const { data: d } = await supabase.from('speakers').select('name, org_name').eq('id', id).limit(1);
    if (d?.[0]) console.log('  ' + count + 'x  ' + d[0].name + (d[0].org_name ? ' (' + d[0].org_name + ')' : ''));
  }
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
