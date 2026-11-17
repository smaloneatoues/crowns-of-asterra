// Rival houses. They use exactly the same commands (A.do, one per province per season) and marching rules as the player.
(function () {
  const A = globalThis.A;
  const ai = (A.ai = {});

  const hostile = (s, f, owner) => owner !== f && !(owner && A.treaty(s, f, owner));
  const isFront = (s, f, p) => p.nb.some((n) => hostile(s, f, A.P(s, n).owner));
  const defPower = (s, pid) => { const p = A.P(s, pid), d = A.war.defenders(s, pid); return A.power(d.troops) * (0.8 + d.lead / 250) * (1 + 0.14 * p.fort) * A.TERRAIN[p.terrain].def; };

  function quell(s, f) {
    const fac = A.F(s, f);
    for (const p of A.provsOf(s, f).sort((a, b) => b.unrest - a.unrest)) {
      if (p.unrest < 45) break;
      if (p.acted) continue;
      if (!A.do(s, f, 'festival', { p: p.id }).ok) A.do(s, f, 'aid', { p: p.id });
    }
  }

  function staff(s, f) {
    const fac = A.F(s, f);
    const os = A.officersOf(s, f).filter((o) => !o.ruler).sort((a, b) => b.lead - a.lead);
    const nCmd = Math.min(2, Math.max(1, os.length - 1));
    const cmds = os.slice(0, nCmd).map((o) => o.id);
    if (!A.P(s, fac.seat).governor) { const r = A.O(s, fac.ruler); if (r && !r.job) A.do(s, f, 'governor', { p: fac.seat, o: r.id }); }
    for (const o of os.slice(nCmd)) {
      if (o.job) continue;
      const p = A.provsOf(s, f).filter((q) => !q.governor && !q.acted).sort((a, b) => b.pros - a.pros)[0];
      if (p) A.do(s, f, 'governor', { p: p.id, o: o.id });
    }
    if (!fac.heir || !A.O(s, fac.heir) || A.O(s, fac.heir).status !== 'active' || A.O(s, fac.heir).faction !== f) { const h = os.slice().sort((a, b) => b.loyalty - a.loyalty)[0]; if (h) fac.heir = h.id; }
    for (const o of os) if (o.loyalty < 40 && fac.gold > 120) A.do(s, f, 'reward', { o: o.id });
    return cmds;
  }

  function propose(s, f, g, type, envoy, args) {
    const a = Object.assign({ type, target: g, envoy: envoy.id }, args || {});
    if (A.can(s, f, 'envoy', a)) return false;
    if (A.isMe(s, g)) {
      if (type === 'gift') { A.do(s, f, 'envoy', a); return true; }
      if (s.inbox.some((it) => it.from === f)) return false;
      s.inbox.push({ from: f, type, args: args || {}, envoy: envoy.id }); envoy.busy = true; const cp = A.commandProv(s, f, 'envoy', a); if (cp.p) cp.p.acted = true; return true;
    }
    return A.do(s, f, 'envoy', a).ok;
  }

  function diplomacy(s, f) {
    const fac = A.F(s, f), D = A.FDEF[f];
    if (A.commandsLeft(s, f) < 1 || !A.chance(s, 40)) return;
    const envoy = A.officersOf(s, f).filter((o) => !A.officerFree(s, f, o.id, { gov: true })).sort((a, b) => b.dip - a.dip)[0];
    if (!envoy) return;
    const others = A.aliveFactions(s).filter((g) => g !== f), my = A.strength(s, f);
    // Sue for peace when losing.
    for (const g of others) if (A.atWar(s, f, g) && A.strength(s, g) > my * 1.4) { if (propose(s, f, g, 'truce', envoy)) return; }
    // Contain a runaway leader.
    const L = A.dip.leader(s);
    if (L.f && L.f !== f && L.n >= 8) {
      const partners = others.filter((g) => g !== L.f && !A.allied(s, f, g) && !A.atWar(s, f, g)).sort((a, b) => A.getRel(s, f, b) - A.getRel(s, f, a));
      for (const g of partners) { if (A.getRel(s, f, g) >= 10) { if (propose(s, f, g, 'alliance', envoy)) return; } else if (fac.gold >= 150) { if (propose(s, f, g, 'gift', envoy, { amount: 50 })) return; } }
    }
    // Ask allies for help against whoever we are fighting.
    const foe = others.filter((g) => A.atWar(s, f, g)).sort((a, b) => A.strength(s, b) - A.strength(s, a))[0];
    if (foe) for (const g of others) if (A.allied(s, f, g) && !A.atWar(s, g, foe)) { if (propose(s, f, g, 'support', envoy, { against: foe })) return; }
    // The weak seek pacts with strong neighbours.
    const neigh = new Set(); for (const p of A.provsOf(s, f)) for (const n of p.nb) { const o = A.P(s, n).owner; if (o && o !== f) neigh.add(o); }
    const strongest = [...neigh].filter((g) => !A.treaty(s, f, g) && !A.atWar(s, f, g)).sort((a, b) => A.strength(s, b) - A.strength(s, a))[0];
    if (strongest && A.strength(s, strongest) > my * 1.15) { if (propose(s, f, strongest, 'pact', envoy)) return; }
    // The treacherous extort the weak.
    if (D.ai.honor < 0.4) { const weak = [...neigh].filter((g) => !A.treaty(s, f, g) && A.strength(s, g) * 1.8 < my)[0]; if (weak && propose(s, f, weak, 'tribute', envoy)) return; }
    // Finish off the broken.
    for (const g of others) if (A.atWar(s, f, g) && !A.isMe(s, g)) { if (propose(s, f, g, 'surrender', envoy)) return; }
    // Otherwise keep a friend warm.
    if (fac.gold > 280) { const friend = [...neigh].filter((g) => !A.atWar(s, f, g)).sort((a, b) => A.getRel(s, f, b) - A.getRel(s, f, a))[0]; if (friend && A.getRel(s, f, friend) < 40) propose(s, f, friend, 'gift', envoy, { amount: 50 }); }
  }

  function seals(s, f) {
    const fac = A.F(s, f);
    for (const p of A.provsOf(s, f)) {
      if (p.acted) continue;
      if (!(A.SEAL_SITES.includes(p.id) || p.seal) || (p.searched && !p.seal)) continue;
      const o = A.officersOf(s, f).filter((x) => !A.officerFree(s, f, x.id, { gov: true })).sort((a, b) => b.admin - a.admin)[0];
      if (o) A.do(s, f, 'search', { p: p.id, o: o.id });
    }
    if (!fac.beast.awake && fac.seals.length >= 3) A.do(s, f, 'awaken', {});
  }

  function economy(s, f, armyProv) {
    const fac = A.F(s, f), D = A.FDEF[f];
    let yearFood = A.econ.yearFood(s, f);
    if (fac.food < 80 && fac.gold >= 90) A.do(s, f, 'market', { mode: 'buy' });
    if (fac.food > 700 && yearFood > 0) A.do(s, f, 'market', { mode: 'sell' });
    const ps = A.provsOf(s, f);
    const spots = ps.filter((p) => p.id === armyProv).concat(ps.filter((p) => p.id !== armyProv && isFront(s, f, p)).sort((a, b) => A.total(a.garrison) - A.total(b.garrison)), ps.filter((p) => p.id !== armyProv && !isFront(s, f, p)));
    let guard = 0, k = A.rint(s, 0, 3);
    const levies = (p, cls) => Math.max(1, Math.min(A.cost.recruitCap(p), Math.floor((fac.gold - 80) / A.cost.recruit(p, cls))));
    while (A.commandsLeft(s, f) > 0 && fac.gold > 110 && guard++ < 12) {
      const cls = D.mix[k++ % D.mix.length], U = A.UNITS[cls];
      if (yearFood + fac.food * 0.5 < U.food * (U.batch / 100) * 4.5 + 40) {
        const p = ps.filter((q) => q.farms < 100 && !q.acted).sort((a, b) => a.farms - b.farms)[0];
        if (!p || !A.do(s, f, 'farms', { p: p.id }).ok) break;
        yearFood = A.econ.yearFood(s, f); continue;
      }
      let done = false;
      for (const p of spots) { if (p.acted) continue; const n = levies(p, cls); if (A.do(s, f, 'recruit', { p: p.id, cls, n }).ok) { done = true; yearFood -= U.food * (U.batch / 100) * 4.5 * n; break; } }
      if (!done) { for (const p of spots) if (!p.acted && A.do(s, f, 'recruit', { p: p.id, cls: 'inf' }).ok) { done = true; yearFood -= 18; break; } }
      if (!done) break;
    }
    if (A.commandsLeft(s, f) > 0 && fac.gold > 320) {
      const seat = A.P(s, fac.seat);
      if (seat.fort < 4 && isFront(s, f, seat) && A.do(s, f, 'fortify', { p: seat.id }).ok) return;
      const p = ps.filter((q) => !q.acted).sort((a, b) => a.pros - b.pros)[0];
      if (p) A.do(s, f, A.chance(s, 50) ? 'trade' : 'farms', { p: p.id });
    }
  }

  function reserve(s, f, p) { const front = isFront(s, f, p); return { inf: p.id === A.F(s, f).seat ? 300 : front ? 200 : 100, arc: front ? 100 : 0, cav: 0, sie: 0 }; }
  function spare(s, f, p) { const r = reserve(s, f, p), t = A.noTroops(); for (const c of A.CLS) t[c] = Math.max(0, p.garrison[c] - r[c]); return t; }

  async function military(s, f, cmds, handler) {
    const fac = A.F(s, f), D = A.FDEF[f], diff = A.DIFF[s.difficulty];
    // Muster armies under the designated commanders.
    for (const oid of cmds) {
      const o = A.O(s, oid); if (!o || o.job || o.status !== 'active') continue;
      const best = A.provsOf(s, f).map((p) => ({ p, t: spare(s, f, p) })).filter((x) => !x.p.acted && !A.armiesAt(s, x.p.id, f).length).sort((a, b) => A.power(b.t) + (isFront(s, f, b.p) ? 150 : 0) - A.power(a.t) - (isFront(s, f, a.p) ? 150 : 0))[0];
      if (best && A.power(best.t) >= 350) A.do(s, f, 'muster', { p: best.p.id, o: oid, troops: best.t });
    }
    let threshold = diff.threshold - (D.ai.agg - 0.5) * 0.4;
    for (const army of A.armiesOf(s, f).slice()) {
      if (s.over || !fac.alive) return;
      if (!A.army(s, army.id) || army.moved) continue;
      const here = A.P(s, army.loc);
      if (here.owner === f) { const t = spare(s, f, here); if (A.total(t) > 0) A.do(s, f, 'transfer', { army: army.id, troops: t }); }
      const ap = A.power(army.troops) * (0.8 + A.O(s, army.cmd).lead / 250);
      let bestT = null, bs = 0;
      for (const n of here.nb) {
        const q = A.P(s, n); if (!hostile(s, f, q.owner)) continue;
        if (A.isMe(s, q.owner) && s.turn < diff.grace) continue;
        if (!A.war.marchCheck(s, army, n).ok) continue;
        let need = threshold; if (q.fort >= 2 && army.troops.sie <= 0) need += 0.3;
        const ratio = ap / Math.max(1, defPower(s, n));
        if (ratio < need) continue;
        let sc = ratio;
        if (q.owner && A.atWar(s, f, q.owner)) sc *= 1.2;
        if (fac.focus && fac.focus.until > s.turn && q.owner === fac.focus.target) sc *= 1.4;
        if (n === A.CAPITAL) sc *= 1.3; if (q.seal || (q.owner && A.F(s, q.owner).seat === n && A.F(s, q.owner).seals.length)) sc *= 1.2; if (!q.owner) sc *= 1.1;
        if (sc > bs) { bs = sc; bestT = n; }
      }
      if (bestT) { await A.war.march(s, army.id, bestT, handler, {}); continue; }
      if (!isFront(s, f, here) || !here.nb.some((n) => { const q = A.P(s, n); return hostile(s, f, q.owner) && !(q.owner && A.treaty(s, f, q.owner)); })) {
        // Walk through our own land toward the nearest frontier.
        const prev = { [here.id]: null }, q = [here.id]; let goal = null;
        while (q.length && !goal) { const id = q.shift(); for (const n of A.P(s, id).nb) { const pn = A.P(s, n); if (pn.owner !== f || prev[n] !== undefined) continue; prev[n] = id; if (isFront(s, f, pn)) { goal = n; break; } q.push(n); } }
        if (goal) { let step = goal; while (prev[step] !== here.id && prev[step] != null) step = prev[step]; await A.war.march(s, army.id, step, handler, {}); }
      }
    }
    // The faithless denounce inconvenient pacts (openly, a season before they can strike).
    if (D.ai.honor < 0.4 && A.chance(s, 20)) {
      for (const g of A.aliveFactions(s)) { const t = g !== f && A.treaty(s, f, g); if (t && t.type === 'pact' && A.getRel(s, f, g) < 5 && A.strength(s, f) > 1.5 * A.strength(s, g)) { A.dip.breakTreaties(s, f, g, f); break; } }
    }
  }

  ai.run = async function (s, f, handler) {
    const fac = A.F(s, f); if (!fac.alive || s.over) return;
    quell(s, f);
    const cmds = staff(s, f);
    diplomacy(s, f);
    seals(s, f);
    const a0 = A.armiesOf(s, f)[0];
    economy(s, f, a0 && A.P(s, a0.loc).owner === f ? a0.loc : null);
    await military(s, f, cmds, handler);
  };
})();
