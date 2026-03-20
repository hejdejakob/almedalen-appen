// Update speaker titles and organizations in Supabase from researched JSON files
// Usage: node update-speaker-titles.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CATEGORIES = [
  'politiker', 'media', 'offentlig_sektor', 'näringsliv',
  'civilsamhälle', 'konsult_pr', 'facklig', 'tankesmedja',
  'akademi', 'arbetsgivar_branschorg', 'okategoriserad'
];

async function main() {
  // 1. Load all updated speaker files
  const allUpdates = [];
  for (const cat of CATEGORIES) {
    const filePath = path.join(__dirname, 'tmp', `speakers-${cat}-updated.json`);
    if (!fs.existsSync(filePath)) {
      console.log(`SKIP: ${filePath} not found`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`Loaded ${data.length} speakers from ${cat}`);
    allUpdates.push(...data);
  }

  console.log(`\nTotal speakers loaded: ${allUpdates.length}`);

  // 2. Load original data for comparison
  const originalPath = path.join(__dirname, 'tmp', 'a-listan-speakers.json');
  const originals = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
  const origMap = {};
  for (const o of originals) origMap[o.id] = o;

  // 3. Filter to only those with actual changes
  const changes = [];
  const unchanged = [];
  const missing = [];

  for (const u of allUpdates) {
    if (!u.id) { missing.push(u); continue; }
    const orig = origMap[u.id];
    if (!orig) { missing.push(u); continue; }

    const hasNewTitle = u.new_title !== null && u.new_title !== undefined && u.new_title !== orig.current_title;
    const hasNewOrg = u.new_org !== null && u.new_org !== undefined && u.new_org !== orig.current_org;

    if (hasNewTitle || hasNewOrg) {
      changes.push({
        id: u.id,
        name: u.name,
        old_title: orig.current_title,
        new_title: hasNewTitle ? u.new_title : orig.current_title,
        old_org: orig.current_org,
        new_org: hasNewOrg ? u.new_org : orig.current_org,
      });
    } else {
      unchanged.push(u);
    }
  }

  console.log(`\nChanges: ${changes.length}`);
  console.log(`Unchanged: ${unchanged.length}`);
  console.log(`Missing/invalid: ${missing.length}`);

  // 4. Apply updates
  let updated = 0;
  let errors = 0;

  for (const c of changes) {
    const updateData = {};
    if (c.new_title !== c.old_title) updateData.title = c.new_title;
    if (c.new_org !== c.old_org) updateData.org_name = c.new_org;

    const { error } = await supabase
      .from('speakers')
      .update(updateData)
      .eq('id', c.id);

    if (error) {
      console.error(`ERROR [${c.id}] ${c.name}: ${error.message}`);
      errors++;
    } else {
      const titleChange = c.new_title !== c.old_title
        ? `title: "${c.old_title}" → "${c.new_title}"`
        : '';
      const orgChange = c.new_org !== c.old_org
        ? `org: "${c.old_org}" → "${c.new_org}"`
        : '';
      console.log(`[${c.id}] ${c.name}: ${[titleChange, orgChange].filter(Boolean).join(', ')}`);
      updated++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Updated: ${updated}`);
  console.log(`Unchanged: ${unchanged.length}`);
  console.log(`Errors: ${errors}`);
  console.log(`Missing: ${missing.length}`);
}

main().catch(console.error);
