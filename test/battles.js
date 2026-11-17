// Battle sanity table: node test/battles.js
const fs = require('fs'), path = require('path'), vm = require('vm');
for (const f of ['data', 'core', 'actions', 'diplomacy', 'battle', 'war', 'intrigue', 'events', 'ai', 'turn']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
const A = globalThis.A;
const T = (inf, arc, cav, sie) => ({ inf, arc: arc || 0, cav: cav || 0, sie: sie || 0 });
function run(label, att, def, o) {
  o = o || {}; let w = 0, rounds = 0, al = 0, dl = 0; const N = 200;
  for (let i = 0; i < N; i++) {
    const b = A.battle.create({ seed: 1000 + i * 37, terrain: o.terrain || 'plains', fort: o.fort || 0, att: { name: 'Att', cmd: 'a', lead: o.al || 60, troops: { ...att }, morale: 0 }, def: { name: 'Def', cmd: 'd', lead: o.dl || 60, troops: { ...def }, morale: 0 }, beast: { att: { avail: !!o.beast, auto: true, halved: !!o.ward }, def: { avail: false } } });
    A.battle.autoResolve(b); const r = A.battle.result(b);
    if (r.winner === 'att') w++; rounds += r.rounds; al += r.att.lost; dl += r.def.lost;
  }
  console.log(`${label.padEnd(52)} att wins ${String(Math.round(w / N * 100)).padStart(3)}%  rounds ${(rounds / N).toFixed(1)}  losses ${Math.round(al / N)} / ${Math.round(dl / N)}`);
}
run('800i vs 800i, plains', T(800), T(800));
run('800i vs 800i, attacker lead 90 vs 40', T(800), T(800), { al: 90, dl: 40 });
run('800i vs 800i in forest', T(800), T(800), { terrain: 'forest' });
run('600i 200a vs 600i 200a', T(600, 200), T(600, 200));
run('400c vs 600a (cav should win)', T(0, 0, 400), T(0, 600));
run('400c vs 600i (inf should win)', T(0, 0, 400), T(600));
run('500i 300a vs 800i', T(500, 300), T(800));
run('1000i vs 500i fort 1', T(1000), T(500), { fort: 1 });
run('1000i vs 500i fort 3', T(1000), T(500), { fort: 3 });
run('1000i 80s vs 500i fort 3', T(1000, 0, 0, 80), T(500), { fort: 3 });
run('1200i 300a 120s vs 500i 200a fort 3', T(1200, 300, 0, 120), T(500, 200), { fort: 3 });
run('1500i 300a vs 500i 200a 100c fort 3 (seat)', T(1500, 300), T(500, 200, 100), { fort: 3 });
run('600i vs 800i + starfall', T(600), T(800), { beast: true });
run('600i vs 800i + starfall vs ward', T(600), T(800), { beast: true, ward: true });
run('600i vs 800i no beast', T(600), T(800));
