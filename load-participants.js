// Parses the 'participants' field from almedalen-all.json and loads into speakers + event_speakers
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
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

function parseParticipants(text) {
  // Format: "Förnamn Efternamn, Titel, Organisation, Förnamn2 Efternamn2, Titel2, Org2, ..."
  // The tricky part is that name/title/org are comma-separated AND multiple people are comma-separated
  // Pattern: name starts with a capital letter after org ends
  // Heuristic: split by comma, then group into (name, title, org) triples

  if (!text || text.length < 3) return [];

  const parts = text.split(',').map(s => s.trim()).filter(s => s.length > 0);
  const speakers = [];

  let i = 0;
  while (i < parts.length) {
    // First part should be a name (Förnamn Efternamn)
    const namePart = parts[i];

    // Check if this looks like a person name (has at least 2 words, starts with uppercase)
    if (!namePart || !/^[A-ZÅÄÖ]/.test(namePart)) {
      i++;
      continue;
    }

    // Collect title and org (next 1-2 parts before the next name)
    let title = null;
    let org = null;
    let j = i + 1;

    // Look ahead for title and org
    while (j < parts.length) {
      const next = parts[j];
      // If next part looks like a new person name (2+ words, starts uppercase,
      // doesn't look like a title/org), break
      const words = next.split(/\s+/);
      const looksLikeName = words.length >= 2 &&
        /^[A-ZÅÄÖ]/.test(words[0]) &&
        /^[A-ZÅÄÖ]/.test(words[words.length - 1]) &&
        !next.includes('ordförande') && !next.includes('Ordförande') &&
        !next.includes('chef') && !next.includes('Chef') &&
        !next.includes('minister') && !next.includes('Minister') &&
        !next.includes('direktör') && !next.includes('Direktör') &&
        !next.includes('VD') && !next.includes('vd') &&
        !next.includes('ledamot') && !next.includes('Ledamot') &&
        !next.includes('professor') && !next.includes('Professor') &&
        !next.includes('docent') && !next.includes('Docent') &&
        !next.includes('sekreterare') && !next.includes('Sekreterare') &&
        !next.includes('riksdags') && !next.includes('Riksdags') &&
        !next.includes('kommunal') && !next.includes('Kommunal') &&
        !next.includes('region') && !next.includes('Region') &&
        !next.includes('stiftelse') && !next.includes('Stiftelse') &&
        !next.includes('förbund') && !next.includes('Förbund') &&
        !next.includes('förening') && !next.includes('Förening') &&
        next.length < 40;

      if (looksLikeName && j > i + 1) {
        // This is a new person
        break;
      }

      // Assign to title or org
      if (!title) {
        title = next;
      } else if (!org) {
        org = next;
      } else {
        // Could be continuation of org, or a new person
        // If it looks like a name, break
        if (looksLikeName) break;
        // Otherwise append to org
        org += ', ' + next;
      }
      j++;
    }

    // Only add if the name looks valid (has space = first + last name)
    if (namePart.includes(' ') && namePart.length >= 5) {
      speakers.push({
        name: namePart,
        title: title,
        org: org,
        role: 'panelist',
      });
    }

    i = j;
  }

  return speakers;
}

async function main() {
  const data = require('./public/almedalen-all.json');

  // Get DB events to map event_id + year -> db id
  const dbEvents = await fetchAllDB('events', 'id, source_id, year');
  const sourceMap = new Map();
  for (const e of dbEvents) {
    sourceMap.set(e.year + '_' + e.source_id, e.id);
  }
  console.log('DB events loaded:', dbEvents.length);

  // Parse participants from all events
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

  // Speaker name cache to avoid repeated lookups
  const speakerCache = new Map();

  for (let idx = 0; idx < allResults.length; idx++) {
    if (idx % 200 === 0) process.stdout.write(`\r  ${idx}/${allResults.length}`);

    const { event_id, speakers } = allResults[idx];

    for (const sp of speakers) {
      const normalized = sp.name.toLowerCase().trim();

      let speakerId = speakerCache.get(normalized);

      if (!speakerId) {
        // Check DB
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
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
