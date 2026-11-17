// Pacing report: node test/pace.js [campaigns]. How fast do houses fall and how big is the leader, with every house AI-run?
const fs = require('fs'), path = require('path'), vm = require('vm');
for (const f of ['data', 'core', 'actions', 'diplomacy', 'battle', 'war', 'intrigue', 'events', 'ai', 'turn']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
const A = globalThis.A;
(async () => {
  const n = parseInt(process.argv[2] || '12', 10), marks = [12, 24, 40, 60], agg = {}, ends = [];
  for (const m of marks) agg[m] = { alive: 0, top: 0, k: 0 };
  for (let i = 1; i <= n; i++) {
    const s = A.newGame({ seed: i * 7919, difficulty: 'normal' });
    while (!s.over && s.turn < 160) {
      await A.turn.endSeason(s, null);
      if (agg[s.turn]) { const a = agg[s.turn]; a.alive += A.aliveFactions(s).length; a.top += Math.max(...A.aliveFactions(s).map((f) => A.provsOf(s, f).length)); a.k++; }
    }
    ends.push(s.over ? 1 + Math.floor(s.turn / 4) : 99);
  }
  for (const m of marks) { const a = agg[m]; console.log(`Year ${m / 4}: houses alive ${(a.alive / a.k).toFixed(1)}, leader holds ${(a.top / a.k).toFixed(1)} provinces (${a.k} campaigns still running)`); }
  ends.sort((a, b) => a - b); console.log('crowned in year:', ends.map((e) => (e === 99 ? '40+' : e)).join(', '));
})();
