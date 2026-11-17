// Free companies (hired elite units, one per house) and dirty tricks (plots against a neighbour's province).
(function () {
  const A = globalThis.A, acts = A.actions;

  // base = the troop class it moves and matches up as. pow/rng multiply melee/volley damage, armor multiplies damage taken.
  A.COMPANIES = {
    lances: { name: 'The Ashen Lances', base: 'cav', men: 120, hire: 160, fee: 14, pow: 1.5, armor: 0.85, noBrace: true,
      desc: 'Heavy lancers. They hit half again as hard, and braced spears do not blunt their charge.' },
    wardens: { name: 'The Greywall Wardens', base: 'inf', men: 220, hire: 140, fee: 12, pow: 1.3, armor: 0.7, steady: true,
      desc: 'Halberdiers in plate. They take 30% less damage and never run from fear alone.' },
    rangers: { name: 'The Wyld Rangers', base: 'arc', men: 150, hire: 150, fee: 12, rng: 1.5, reach: 1, mobile: true,
      desc: 'Longbowmen. +1 range, half again the damage, and no penalty for moving before they loose.' },
    wrights: { name: 'The Thunderwrights', base: 'sie', men: 50, hire: 170, fee: 14, rng: 1.4, batter: 2.5,
      desc: 'Master engineers. Their engines break walls two and a half times as fast.' },
    choir: { name: 'The Veiled Choir', base: 'arc', men: 60, hire: 180, fee: 16, rng: 0.8, reach: 1, pierce: true, dread: 14,
      desc: 'Star-singers. Their song ignores walls and cover, and shakes the courage of whoever hears it.' },
  };

  const ch = (A.champ = {
    // Lazily created so campaigns saved before free companies existed still load.
    all(s) { if (!s.companies) { s.companies = {}; for (const id in A.COMPANIES) s.companies[id] = { f: null, men: A.COMPANIES[id].men, p: null, army: null }; } return s.companies; },
    of(s, f) { const all = ch.all(s); for (const id in all) if (all[id].f === f) return { id, c: all[id], D: A.COMPANIES[id] }; return null; },
    loc(s, c) { if (c.army != null) { const a = A.army(s, c.army); if (a) return a.loc; } return c.p; },
    at(s, f, pid) { const x = ch.of(s, f); return x && ch.loc(s, x.c) === pid ? x : null; },
    withArmy(s, army) { const x = ch.of(s, army.faction); return x && x.c.army === army.id ? x : null; },
    release(s, id, why) {
      const c = ch.all(s)[id]; if (!c.f) return;
      const f = c.f; c.f = null; c.p = null; c.army = null; c.men = A.COMPANIES[id].men;
      if (why) A.log(s, `${A.COMPANIES[id].name} (${A.fname(f)}) ${why}`, A.isMe(s, f) ? 'me' : 'event');
    },
    // Keep every company attached to a living house and standing on that house's land.
    sync(s) {
      const all = ch.all(s);
      for (const id in all) {
        const c = all[id]; if (!c.f) continue;
        if (!A.F(s, c.f).alive) { ch.release(s, id, null); continue; }
        if (c.army != null) { const a = A.army(s, c.army); if (a && a.faction === c.f) { c.p = a.loc; continue; } c.army = null; }
        const p = A.P(s, c.p);
        if (!p || p.owner !== c.f) ch.release(s, id, 'are cut off from their paymaster and ride away; their contract is void.');
      }
    },
    // Paid companies replace a quarter of their losses each season.
    season(s) { const all = ch.all(s); for (const id in all) { const c = all[id], D = A.COMPANIES[id]; if (c.f) c.men = Math.min(D.men, c.men + Math.ceil(D.men * 0.25)); } },
  });
  const oldCleanup = A.war.cleanup;
  A.war.cleanup = function (s) { oldCleanup(s); ch.sync(s); };

  const own = (s, f, pid) => { const p = A.P(s, pid); return !p ? 'No such province.' : p.owner === f ? null : `${A.fname(f)} does not control ${p.name}.`; };
  const gold = (fac, n) => (fac.gold >= n ? null : `Costs ${n} gold; the treasury holds ${fac.gold}.`);

  acts.hire = { cost: 1, scope: 'prov', label: 'Hire a free company',
    check(s, f, a, fac) {
      const e = own(s, f, a.p); if (e) return e;
      const D = A.COMPANIES[a.id]; if (!D) return 'Unknown company.';
      const c = ch.all(s)[a.id], mine = ch.of(s, f);
      if (c.f === f) return `${D.name} already serve you.`;
      if (c.f) return `${D.name} are under contract to ${A.fname(c.f)}.`;
      if (mine) return `You already retain ${mine.D.name}. A house may keep one free company; dismiss them first.`;
      return gold(fac, D.hire);
    },
    run(s, f, a, fac) { const D = A.COMPANIES[a.id], c = ch.all(s)[a.id]; fac.gold -= D.hire; c.f = f; c.p = a.p; c.army = null; c.men = D.men; A.log(s, `${D.name} take the coin of ${A.fname(f)}.`, 'event'); return `${D.name} (${D.men} men) join the garrison of ${A.P(s, a.p).name} for ${D.hire} gold, then ${D.fee} gold a season.`; } };

  acts.coDismiss = { cost: 0, label: 'Dismiss the company',
    check(s, f) { return ch.of(s, f) ? null : 'You retain no free company.'; },
    run(s, f) { const x = ch.of(s, f); ch.release(s, x.id, null); return `${x.D.name} are paid off and ride away.`; } };

  acts.coJoin = { cost: 0, label: 'Join an army',
    check(s, f, a) {
      const x = ch.of(s, f); if (!x) return 'You retain no free company.';
      const army = A.army(s, a.army); if (!army || army.faction !== f) return 'That is not your army.';
      if (x.c.army === army.id) return 'They already ride with that army.';
      return ch.loc(s, x.c) === army.loc ? null : `${x.D.name} are at ${A.P(s, ch.loc(s, x.c)).name}; the army must be in the same province.`;
    },
    run(s, f, a) { const x = ch.of(s, f), army = A.army(s, a.army); x.c.army = army.id; x.c.p = army.loc; return `${x.D.name} now ride with ${A.O(s, army.cmd).name}'s army.`; } };

  acts.coLeave = { cost: 0, label: 'Return to garrison',
    check(s, f) { const x = ch.of(s, f); if (!x) return 'You retain no free company.'; if (x.c.army == null) return 'They are already in garrison.'; return A.P(s, ch.loc(s, x.c)).owner === f ? null : 'The army must stand in one of your provinces.'; },
    run(s, f) { const x = ch.of(s, f); x.c.p = ch.loc(s, x.c); x.c.army = null; return `${x.D.name} take up quarters in ${A.P(s, x.c.p).name} and will defend it.`; } };

  // ---------- Dirty tricks ----------
  A.PLOTS = {
    raid: { label: 'Raid the countryside', gold: 0, stat: 'lead', statName: 'leadership', desc: 'Riders plunder the farms. You take gold; the province loses prosperity and calm.' },
    sabotage: { label: 'Sabotage', gold: 40, stat: 'admin', statName: 'administration', desc: 'Agents undermine the walls (−1 level), or burn the granary if there are no walls.' },
    incite: { label: 'Incite unrest', gold: 40, stat: 'dip', statName: 'diplomacy', desc: 'Agitators stir up the people: unrest +20, loyalty −12.' },
    bribe: { label: 'Bribe an officer', gold: 100, stat: 'dip', statName: 'diplomacy', desc: 'Gold and promises for the governor or a commander stationed here. If it works, they join you.' },
  };
  const plot = (A.plot = {
    // The officer a bribe would be aimed at: the least loyal governor or army commander here who is not a ruler.
    bribeTarget(s, p) {
      const ids = []; if (p.governor) ids.push(p.governor);
      for (const a of A.armiesAt(s, p.id, p.owner)) ids.push(a.cmd);
      return ids.map((id) => A.O(s, id)).filter((o) => o && !o.ruler && o.status === 'active').sort((a, b) => a.loyalty - b.loyalty)[0] || null;
    },
    chance(s, f, a) {
      const P = A.PLOTS[a.type], p = A.P(s, a.p), o = A.O(s, a.o), parts = [['Base chance', 40]];
      const add = (label, v) => { v = Math.round(v); if (v) parts.push([label, v]); };
      add(`${o.name}'s ${P.statName} (${o[P.stat]})`, (o[P.stat] - 50) * 0.5);
      if (p.governor) add(`Watchful governor (${A.O(s, p.governor).name})`, -A.O(s, p.governor).admin / 5);
      if (a.type === 'raid' || a.type === 'sabotage') add(`Walls level ${p.fort}`, -3 * p.fort);
      if (a.type === 'incite') add(`Unrest already ${p.unrest}`, p.unrest / 5);
      if (a.type === 'bribe') { const t = plot.bribeTarget(s, p); if (t) add(`${t.name}'s loyalty (${t.loyalty})`, (50 - t.loyalty) * 0.8); }
      const pct = A.clamp(parts.reduce((n, x) => n + x[1], 0), 5, 90);
      return { pct, parts };
    },
  });

  acts.plot = { cost: 1, label: 'Dirty trick',
    check(s, f, a, fac) {
      const P = A.PLOTS[a.type]; if (!P) return 'Choose a plot.';
      const p = A.P(s, a.p); if (!p) return 'No such province.';
      if (p.owner === f) return 'You do not plot against your own land.';
      if (!p.owner) return 'A free province has no court to plot against. Take it with an army.';
      if (!p.nb.some((n) => A.P(s, n).owner === f)) return 'Your agents can only reach provinces that border your land.';
      if (a.type === 'bribe') { const t = plot.bribeTarget(s, p); if (!t) return 'No officer here can be bought: there is no governor or commander, or only a ruler.'; if (t.loyalty >= 75) return `${t.name} is too loyal (75+) to listen.`; }
      if (!a.o) return 'Choose an agent.';
      const o = A.O(s, a.o); if (o && o.faction === f && o.ruler) return 'A ruler does not skulk in the dark. Send another officer.';
      return A.officerFree(s, f, a.o, { gov: true }) || gold(fac, P.gold);
    },
    run(s, f, a, fac) {
      const P = A.PLOTS[a.type], p = A.P(s, a.p), o = A.O(s, a.o), v = p.owner, vf = A.F(s, v), mineV = A.isMe(s, v);
      const ok = A.chance(s, plot.chance(s, f, a).pct);
      o.busy = true; fac.gold -= P.gold;
      let msg;
      if (ok) {
        if (a.type === 'raid') { const g = Math.min(vf.gold, Math.round(p.pros * 0.7)); vf.gold -= g; fac.gold += g; p.pros = Math.max(5, p.pros - 3); p.unrest = A.clamp(p.unrest + 6, 0, 100); if (A.isMe(s, f)) s.stats.goldEarned += g; msg = `${o.name}'s riders plunder ${p.name}: ${g} gold taken (its prosperity −3, unrest +6).`; }
        else if (a.type === 'sabotage') { if (p.fort > 0) { p.fort--; msg = `${o.name}'s sappers bring down a stretch of wall at ${p.name} (walls now ${p.fort}).`; } else { const n = Math.min(vf.food, 80); vf.food -= n; msg = `${o.name}'s agents burn the granary at ${p.name}: ${n} food lost.`; } }
        else if (a.type === 'incite') { p.unrest = A.clamp(p.unrest + 20, 0, 100); p.loyalty = A.clamp(p.loyalty - 12, 0, 100); msg = `${o.name}'s agitators set ${p.name} seething (unrest +20, loyalty −12).`; }
        else { const t = plot.bribeTarget(s, p); A.clearArmyOf(s, t); A.clearJob(s, t.id); if (vf.heir === t.id) vf.heir = null; t.faction = f; t.loyalty = 55; t.loc = fac.seat; t.busy = true; msg = `${t.name} takes your gold and rides for your court, abandoning ${A.fname(v)}.`; A.log(s, `${t.name} deserts ${A.fname(v)} for ${A.fname(f)}.`, mineV ? 'me' : 'event'); }
      } else msg = `${o.name}'s plot at ${p.name} fails.`;
      const traced = !ok || A.chance(s, 35);
      if (traced) {
        const pen = (A.treaty(s, f, v) ? 30 : ok ? 15 : 10); A.addRel(s, f, v, -pen);
        msg += ` ${A.fname(v)} traces it to you (relations −${pen}).`;
        if (mineV) A.log(s, ok ? `⚠ ${A.fname(f)} is behind foul play in ${p.name}: ${P.label.toLowerCase()}.` : `Your guards foil a plot by ${A.fname(f)} in ${p.name}.`, 'me');
        if (!ok && A.chance(s, 25)) { if (A.F(s, f).heir === o.id) A.F(s, f).heir = null; A.clearJob(s, o.id); o.status = 'captured'; o.until = s.turn + 3; msg += ` ${o.name} is caught and held prisoner for 3 seasons.`; }
      } else { msg += ' No one can prove whose hand it was.'; if (mineV && ok) A.log(s, `⚠ Foul play in ${p.name} (${P.label.toLowerCase()}). No one knows who is behind it.`, 'me'); }
      return msg;
    } };
})();
