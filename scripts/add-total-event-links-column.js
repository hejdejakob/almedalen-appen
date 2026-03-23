// Adds total_event_links column to arranger_stats.
//
// This column stores the raw count of ALL event_arrangers links for an arranger per year,
// as opposed to events_count which uses weighted counting (primary=1, co-arranger=0.3).
//
// USAGE:
//   node scripts/add-total-event-links-column.js
//
// If the script cannot run the DDL automatically (requires Supabase personal access token
// or direct Postgres access), it will print the SQL to run manually.
//
// MANUAL FALLBACK — run this in the Supabase dashboard SQL editor:
//   https://supabase.com/dashboard/project/dyjinvyawfmnfovlnfsp/sql
//
//   ALTER TABLE arranger_stats
//   ADD COLUMN IF NOT EXISTS total_event_links INTEGER DEFAULT 0;
//
// Then run: node build-aggregates.js
// Then run: node scripts/verify-total-event-links.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DDL = 'ALTER TABLE arranger_stats ADD COLUMN IF NOT EXISTS total_event_links INTEGER DEFAULT 0;';

async function checkColumnExists() {
  const { data, error } = await supabase
    .from('arranger_stats')
    .select('total_event_links')
    .limit(1);
  return !error;
}

async function main() {
  console.log('Checking if total_event_links column already exists...');

  if (await checkColumnExists()) {
    console.log('Column already exists. No action needed.');
    console.log('Run: node build-aggregates.js');
    return;
  }

  console.log('Column does not exist. Attempting to add it...\n');

  // Try via rpc exec_sql if available
  const { error: rpcError } = await supabase.rpc('exec_sql', { sql: DDL });

  if (!rpcError) {
    console.log('Column added successfully via exec_sql RPC.');
    console.log('Run: node build-aggregates.js');
    return;
  }

  // RPC not available — print manual instructions
  console.log('Automatic DDL failed (no exec_sql RPC available).');
  console.log('');
  console.log('Please run the following SQL manually in the Supabase dashboard SQL editor:');
  console.log('  https://supabase.com/dashboard/project/dyjinvyawfmnfovlnfsp/sql');
  console.log('');
  console.log('  ' + DDL);
  console.log('');
  console.log('Then run:');
  console.log('  node build-aggregates.js');
  console.log('  node scripts/verify-total-event-links.js');
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
