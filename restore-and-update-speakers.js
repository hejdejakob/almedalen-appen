// Step 1: Restore all 489 speakers to their original pre-update values
// Step 2: Apply web-searched updates from the new *-updated.json files
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
  // === STEP 1: Restore original values ===
  console.log('=== STEP 1: Restoring original values ===\n');
  const originalPath = path.join(__dirname, 'tmp', 'a-listan-speakers.json');
  const originals = JSON.parse(fs.readFileSync(originalPath, 'utf8'));

  let restored = 0;
  for (const o of originals) {
    const { error } = await supabase
      .from('speakers')
      .update({ title: o.current_title, org_name: o.current_org })
      .eq('id', o.id);
    if (error) {
      console.error(`RESTORE ERROR [${o.id}] ${o.name}: ${error.message}`);
    } else {
      restored++;
    }
  }
  console.log(`Restored ${restored}/${originals.length} speakers to original values.\n`);

  // === STEP 2: Apply web-searched updates ===
  console.log('=== STEP 2: Applying web-searched updates ===\n');

  const origMap = {};
  for (const o of originals) origMap[o.id] = o;

  const allUpdates = [];
  for (const cat of CATEGORIES) {
    const filePath = path.join(__dirname, 'tmp', `speakers-${cat}-updated.json`);
    if (!fs.existsSync(filePath)) {
      console.log(`SKIP: ${cat} (file not found)`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`Loaded ${data.length} from ${cat}`);
    allUpdates.push(...data);
  }

  const changes = [];
  const unchanged = [];

  for (const u of allUpdates) {
    if (!u.id) continue;
    const orig = origMap[u.id];
    if (!orig) continue;

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

  console.log(`\nChanges to apply: ${changes.length}`);
  console.log(`Unchanged: ${unchanged.length}\n`);

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
  console.log(`Restored: ${restored}`);
  console.log(`Updated with web data: ${updated}`);
  console.log(`Unchanged: ${unchanged.length}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);
