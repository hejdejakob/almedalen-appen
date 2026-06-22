// Merga v2 + v3 panel-bedömningar → source/bs_panels.json (med kundens facit).
import fs from 'fs';
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8')).result.recommended;
const v2 = read('/private/tmp/claude-501/-Users-jakobohlsson-valpejl/997e09f8-8cf1-4b35-90c4-f0efcc2b24b4/tasks/w3bme6c0q.output');
const v3 = read('/private/tmp/claude-501/-Users-jakobohlsson-valpejl/997e09f8-8cf1-4b35-90c4-f0efcc2b24b4/tasks/wdvi0jod6.output');

// dedup på eventId, behåll högsta fit (v3 först → vinner vid lika)
const byId = new Map();
for (const x of [...v3, ...v2]) { const e = byId.get(x.eventId); if (!e || x.fit > e.fit) byId.set(x.eventId, x); }
let rec = [...byId.values()];

// kundens facit
const NO = new Set([25587, 34611, 35215, 25117, 24763]);
rec = rec.filter((x) => !NO.has(x.eventId));
// deras EGNA arenor ska bort (Better Shelter som arrangör — inget att "armbåga sig in i")
rec = rec.filter((x) => !(x.arrangers || []).some((a) => /better shelter/i.test(a)));
for (const x of rec) if (x.eventId === 34316) x.tier = 'bubblare';

// räkna om "room" från talarantal (agenternas room-fält var ibland skräp)
const roomOf = (n) => (n == null ? 'medel' : n <= 3 ? 'hög' : n <= 6 ? 'medel' : 'låg');
for (const x of rec) x.room = roomOf(x.speakerCount);

// dedup på titel (bästa fit, sen utrymme)
const rk = { hög: 3, medel: 2, låg: 1 };
const byTitle = new Map();
for (const x of rec) { const k = (x.title || '').toLowerCase().trim(); const e = byTitle.get(k); if (!e || x.fit > e.fit || (x.fit === e.fit && (rk[x.room] || 0) > (rk[e.room] || 0))) byTitle.set(k, x); }
rec = [...byTitle.values()].sort((a, b) => (b.fit - a.fit) || ((rk[b.room] || 0) - (rk[a.room] || 0)));

const panels = rec.map((x) => ({ eventId: x.eventId, fit: x.fit, niche: x.niche, room: x.room, tier: x.tier, angle: x.angle, pitch: x.pitch || null }));
fs.writeFileSync('/Users/jakobohlsson/almedalen-appen/source/bs_panels.json', JSON.stringify(panels, null, 1));

console.log(`MERGAD: ${panels.length} pass · topp ${panels.filter((p) => p.tier === 'topp').length} · bubblare ${panels.filter((p) => p.tier === 'bubblare').length}`);
const own = rec.filter((x) => (x.arrangers || []).some((a) => /better shelter/i.test(a)));
console.log(`\nBetter Shelters EGNA scener (${own.length}):`);
own.forEach((x) => console.log(`  ${x.eventId} ${(x.title || '').slice(0, 56)}`));
console.log(`\nFit 5 (${rec.filter((x) => x.fit === 5).length}):`);
rec.filter((x) => x.fit === 5).forEach((x) => console.log(`  ${x.eventId} ${(x.title || '').slice(0, 58)}`));
