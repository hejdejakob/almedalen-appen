// Merges duplicate arrangers caused by case differences (e.g. "BRIS"/"Bris", "SAAB"/"Saab").
//
// USAGE:
//   node scripts/merge-arranger-duplicates.js          # dry-run (no changes)
//   node scripts/merge-arranger-duplicates.js --write  # execute merges
//
// For each duplicate group (same LOWER(name)):
//   - Keeps the row with the lowest ID as canonical
//   - Reroutes event_arrangers, arranger_classifications, arranger_stats to canonical ID
//   - Deletes the higher-ID duplicate row(s)

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WRITE = process.argv.includes('--write');

// ---------- helpers ----------

async function fetchAll(table, columns, filterFn) {
  const rows = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(columns).range(from, from + 999);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) throw new Error(`fetchAll ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

// ---------- main ----------

async function main() {
  console.log(`Mode: ${WRITE ? 'WRITE (changes will be applied)' : 'DRY-RUN (no changes)'}\n`);

  // 1. Load all arrangers
  console.log('Loading arrangers...');
  const arrangers = await fetchAll('arrangers', 'id, name');
  console.log(`  ${arrangers.length} arrangers loaded`);

  // 2. Group by LOWER(name)
  const byLower = new Map(); // lower_name -> [arranger, ...]
  for (const a of arrangers) {
    const key = a.name.toLowerCase().trim();
    if (!byLower.has(key)) byLower.set(key, []);
    byLower.get(key).push(a);
  }

  // 3. Find groups with 2+ IDs (duplicates)
  const duplicateGroups = [];
  for (const [lower, group] of byLower) {
    if (group.length >= 2) {
      // Sort ascending by ID — lowest ID is canonical
      group.sort((a, b) => a.id - b.id);
      duplicateGroups.push({ lower, group });
    }
  }

  console.log(`\nFound ${duplicateGroups.length} duplicate groups:\n`);

  if (duplicateGroups.length === 0) {
    console.log('Nothing to merge.');
    return;
  }

  // 4. Process each group
  let totalEventArrangersMoved = 0;
  let totalEventArrangersDeleted = 0;
  let totalClassificationsDeleted = 0;
  let totalStatsDeleted = 0;
  let totalArrangersDeleted = 0;

  for (const { lower, group } of duplicateGroups) {
    const keep = group[0]; // lowest ID = canonical
    const removes = group.slice(1);

    for (const remove of removes) {
      console.log(`  Merging: "${remove.name}" (ID ${remove.id}) → "${keep.name}" (ID ${keep.id})`);

      // --- event_arrangers: handle conflicts ---

      // Find all event_ids linked to both keep and remove
      const keepLinks = await fetchAll(
        'event_arrangers', 'event_id',
        q => q.eq('arranger_id', keep.id)
      );
      const removeLinks = await fetchAll(
        'event_arrangers', 'event_id',
        q => q.eq('arranger_id', remove.id)
      );

      const keepEventIds = new Set(keepLinks.map(l => l.event_id));
      const conflictEventIds = removeLinks
        .map(l => l.event_id)
        .filter(eid => keepEventIds.has(eid));

      const nonConflictCount = removeLinks.length - conflictEventIds.length;

      if (WRITE) {
        // Delete conflicting remove-ID links (would violate unique constraint)
        if (conflictEventIds.length > 0) {
          for (const eid of conflictEventIds) {
            const { error } = await supabase
              .from('event_arrangers')
              .delete()
              .eq('arranger_id', remove.id)
              .eq('event_id', eid);
            if (error) throw new Error(`delete event_arrangers conflict: ${error.message}`);
          }
        }

        // Update remaining links to canonical ID
        if (nonConflictCount > 0) {
          const { error } = await supabase
            .from('event_arrangers')
            .update({ arranger_id: keep.id })
            .eq('arranger_id', remove.id);
          if (error) throw new Error(`update event_arrangers: ${error.message}`);
        }
      }

      if (conflictEventIds.length > 0) {
        console.log(`    event_arrangers: ${nonConflictCount} moved, ${conflictEventIds.length} conflict(s) deleted`);
      } else {
        console.log(`    event_arrangers: ${nonConflictCount} moved`);
      }
      totalEventArrangersMoved += nonConflictCount;
      totalEventArrangersDeleted += conflictEventIds.length;

      // --- arranger_classifications: delete remove row(s) ---

      const classRows = await fetchAll(
        'arranger_classifications', 'arranger_id',
        q => q.eq('arranger_id', remove.id)
      );
      console.log(`    arranger_classifications: ${classRows.length} row(s) to delete`);

      if (WRITE && classRows.length > 0) {
        const { error } = await supabase
          .from('arranger_classifications')
          .delete()
          .eq('arranger_id', remove.id);
        if (error) throw new Error(`delete arranger_classifications: ${error.message}`);
      }
      totalClassificationsDeleted += classRows.length;

      // --- arranger_stats: delete all rows for remove ID ---

      const statsRows = await fetchAll(
        'arranger_stats', 'arranger_id, year',
        q => q.eq('arranger_id', remove.id)
      );
      console.log(`    arranger_stats: ${statsRows.length} row(s) to delete`);

      if (WRITE && statsRows.length > 0) {
        const { error } = await supabase
          .from('arranger_stats')
          .delete()
          .eq('arranger_id', remove.id);
        if (error) throw new Error(`delete arranger_stats: ${error.message}`);
      }
      totalStatsDeleted += statsRows.length;

      // --- arrangers: delete the duplicate row ---
      console.log(`    arrangers: delete ID ${remove.id}`);

      if (WRITE) {
        const { error } = await supabase
          .from('arrangers')
          .delete()
          .eq('id', remove.id);
        if (error) throw new Error(`delete arranger: ${error.message}`);
      }
      totalArrangersDeleted++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`  Duplicate groups:              ${duplicateGroups.length}`);
  console.log(`  Arrangers to delete:           ${totalArrangersDeleted}`);
  console.log(`  event_arrangers moved:         ${totalEventArrangersMoved}`);
  console.log(`  event_arrangers deleted (dup): ${totalEventArrangersDeleted}`);
  console.log(`  arranger_classifications del:  ${totalClassificationsDeleted}`);
  console.log(`  arranger_stats deleted:        ${totalStatsDeleted}`);

  if (!WRITE) {
    console.log('\nDry-run complete. Run with --write to apply changes.');
  } else {
    console.log('\nAll merges applied successfully.');
    console.log('Next step: node build-aggregates.js');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
