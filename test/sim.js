// Headless campaign simulation: node test/sim.js [campaigns] [maxSeasons]
// Plays whole campaigns with every house under AI control and checks the rules never corrupt the state.
const fs = require('fs'), path = require('path'), vm = require('vm');
for (const f of ['data', 'core', 'actions', 'diplomacy', 'battle', 'war', 'intrigue', 'glory', 'events', 'ai', 'turn']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
}
const A = globalThis.A;

function check(s, where) {
  const bad = (m) => { throw new Error(`[${where}, ${A.dateStr(s)}] ${m}`); };
  for (const p of A.provs(s)) {
    for (const c of A.CLS) if (!Number.isInteger(p.garrison[c]) || p.garrison[c] < 0) bad(`${p.name} garrison ${c}=${p.garrison[c]}`);
    for (const k of ['pros', 'farms', 'loyalty', 'unrest', 'fort']) if (!Number.isFinite(p[k]) || p[k] < 0 || p[k] > 100) bad(`${p.name} ${k}=${p[k]}`);
    if (p.owner && !A.F(s, p.owner).alive) bad(`${p.name} owned by dead house ${p.owner}`);
    if (p.governor) { const o = A.O(s, p.governor); if (!o || o.status !== 'active' || o.faction !== p.owner || !o.job || o.job.t !== 'gov' || o.job.p !== p.id) bad(`${p.name} governor inconsistent (${p.governor})`); }
  }
  for (const a of s.armies) {
    const o = A.O(s, a.cmd);
    if (!o || o.status !== 'active' || o.faction !== a.faction || !o.job || o.job.t !== 'cmd' || o.job.a !== a.id) bad(`army ${a.id} commander inconsistent`);
    if (A.P(s, a.loc).owner !== a.faction) bad(`army ${a.id} of ${a.faction} stands in foreign ${a.loc}`);
    for (const c of A.CLS) if (!Number.isInteger(a.troops[c]) || a.troops[c] < 0) bad(`army ${a.id} ${c}=${a.troops[c]}`);
  }
  for (const o of Object.values(s.officers)) {
    if (o.job && o.job.t === 'gov' && A.P(s, o.job.p).governor !== o.id) bad(`${o.name} thinks they govern ${o.job.p}`);
    if (o.job && o.job.t === 'cmd' && !A.army(s, o.job.a)) bad(`${o.name} commands a missing army`);
    if (!Number.isFinite(o.loyalty) || o.loyalty < 0 || o.loyalty > 100) bad(`${o.name} loyalty ${o.loyalty}`);
  }
  const seen = {};
  for (const f of A.FIDS) {
    const fac = A.F(s, f);
    if (!Number.isFinite(fac.gold) || fac.gold < 0 || !Number.isFinite(fac.food) || fac.food < 0) bad(`${f} gold=${fac.gold} food=${fac.food}`);
    if (fac.alive) { if (!A.provsOf(s, f).length) bad(`${f} alive with no land`); if (A.P(s, fac.seat).owner !== f) bad(`${f} seat ${fac.seat} not owned`); const r = A.O(s, fac.ruler); if (!r || r.status !== 'active' || r.faction !== f) bad(`${f} has no living ruler`); }
    for (const x of fac.seals) { if (seen[x]) bad(`seal ${x} duplicated`); seen[x] = 1; }
  }
  for (const p of A.provs(s)) if (p.seal) { if (seen[p.seal]) bad(`seal ${p.seal} duplicated at ${p.name}`); seen[p.seal] = 1; }
  for (const [id, c] of Object.entries(A.champ.all(s))) {
    if (!c.f) continue;
    if (!A.F(s, c.f).alive) bad(`company ${id} serves dead house ${c.f}`);
    if (!Number.isInteger(c.men) || c.men <= 0) bad(`company ${id} men=${c.men}`);
    if (c.army != null) { const a = A.army(s, c.army); if (!a || a.faction !== c.f) bad(`company ${id} rides with a missing army`); }
    else if (!A.P(s, c.p) || A.P(s, c.p).owner !== c.f) bad(`company ${id} garrisons foreign ${c.p}`);
  }
  if (Object.keys(seen).length !== 5) bad(`seals in play: ${Object.keys(seen).join(',')}`);
}

async function campaign(seed, opts, maxTurns) {
  const s = A.newGame(Object.assign({ seed }, opts));
  check(s, 'start');
  while (!s.over && s.turn < maxTurns) {
    await A.turn.endSeason(s, null);
    check(s, 'season');
  }
  return s;
}

(async () => {
  const n = parseInt(process.argv[2] || '8', 10), maxTurns = parseInt(process.argv[3] || '240', 10);
  let battles = 0, finished = 0;
  for (let i = 1; i <= n; i++) {
    const diff = ['easy', 'normal', 'hard'][i % 3];
    const s = await campaign(i * 7919, { difficulty: diff }, maxTurns);
    const fights = s.log.filter((l) => l.k === 'war').length; battles += fights;
    if (s.over) finished++;
    const lands = A.aliveFactions(s).map((f) => `${A.FDEF[f].short} ${A.provsOf(s, f).length}`).join(', ');
    console.log(`seed ${i * 7919} [${diff}] ${s.over ? `ENDED ${A.dateStr(s)}: ${A.fname(s.over.winner)} by ${s.over.kind}` : `ran ${maxTurns} seasons`} | ${lands} | war entries ${fights}`);
  }
  // The same rules with a house flagged as the player but driven by the AI, to exercise victory and defeat states.
  const outcomes = {};
  for (let i = 1; i <= n; i++) {
    const player = A.FIDS[i % A.FIDS.length];
    const s = await campaign(i * 104729, { difficulty: 'normal', player, autoPlayer: true }, maxTurns);
    const key = s.over ? `${s.over.result}/${s.over.kind}` : 'unfinished';
    outcomes[key] = (outcomes[key] || 0) + 1;
  }
  console.log('auto-played player outcomes:', JSON.stringify(outcomes));
  console.log(`OK — ${n * 2} campaigns, ${finished}/${n} all-AI campaigns reached a crowned victor, ${battles} war chronicle entries, no invariant violations.`);
})().catch((e) => { console.error('FAILED:', e.stack || e.message); process.exit(1); });
