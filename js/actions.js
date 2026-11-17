// Commands: each province carries out ONE command per season. Province commands (recruit, build, levy...) use the
// command of the province they happen in; court commands (envoys, rewards, the market, the rite...) are sent from a
// province and use up its command. Marching and troop transfers are free.
// Every command has a check (returns the reason it is unavailable, or null) and a run.
// The player UI and the AI both go through A.can / A.do, so impossible orders are rejected in one place.
(function () {
  const A = globalThis.A;
  const acts = (A.actions = {});

  // ---------- Economy ----------
  A.econ = {
    FOOD_SEASON: [0.5, 0.9, 1.6, 0.1],
    provGold(s, p) {
      if (!p.owner) return 0;
      let g = p.pros * 0.8 * (1 - p.unrest / 150) * (1 + A.govAdmin(s, p) / 250);
      if (p.resource === 'trade') g += 15;
      if (!A.isMe(s, p.owner)) g *= A.DIFF[s.difficulty].aiIncome;
      return Math.round(g);
    },
    provFood(s, p, season) {
      if (!p.owner) return 0;
      let f = p.farms * A.econ.FOOD_SEASON[season] * (1 - p.unrest / 200) * (1 + A.govAdmin(s, p) / 400);
      if (p.resource === 'grain') f *= 1.5;
      return Math.round(f);
    },
    troops(s, f) {
      const t = A.noTroops();
      for (const p of A.provsOf(s, f)) A.addTroops(t, p.garrison);
      for (const a of A.armiesOf(s, f)) A.addTroops(t, a.troops);
      return t;
    },
    forecast(s, f, season) {
      if (season === undefined) season = s.turn % 4;
      let gold = 0, food = 0;
      for (const p of A.provsOf(s, f)) { gold += A.econ.provGold(s, p); food += A.econ.provFood(s, p, season); }
      const t = A.econ.troops(s, f);
      let upGold = 0, upFood = 0;
      for (const c of A.CLS) { upGold += (t[c] / 100) * A.UNITS[c].gold; upFood += (t[c] / 100) * A.UNITS[c].food; }
      if (season === 3) upFood *= 1.5;
      upGold = Math.round(upGold); upFood = Math.round(upFood);
      return { gold, food, upGold, upFood, netGold: gold - upGold, netFood: food - upFood, troops: t };
    },
    // Food balance over a whole year, used by the AI and the realm panel.
    yearFood(s, f) { let n = 0; for (let q = 0; q < 4; q++) n += A.econ.forecast(s, f, q).netFood; return n; },
  };

  A.cost = {
    recruit(p, cls) {
      let c = A.UNITS[cls].cost;
      if (cls === 'inf' && p.resource === 'iron') c *= 0.75;
      if (cls === 'cav' && p.resource === 'horses') c *= 0.8;
      if (cls === 'sie' && p.resource === 'timber') c *= 0.7;
      return Math.round(c);
    },
    recruitCap: (p) => 1 + Math.floor(p.pros / 30),
    fortify: (p) => 60 + 60 * p.fort,
    farms: 50, trade: 60, festival: 50, aid: 60, reward: 40, levy: (p) => Math.round(p.pros * 1.2),
    awakenGold: 300, awakenFood: 150, marketBuy: 40, marketSell: 20,
  };

  function own(s, f, pid) {
    const p = A.P(s, pid);
    if (!p) return 'No such province.';
    return p.owner === f ? null : `${A.fname(f)} does not control ${p.name}.`;
  }
  const gold = (fac, n) => (fac.gold >= n ? null : `Costs ${n} gold; the treasury holds ${fac.gold}.`);
  const food = (fac, n) => (fac.food >= n ? null : `Costs ${n} food; the granaries hold ${fac.food}.`);
  // Is an officer free for a task? opts.gov: governors may do it; opts.busy: ignore the once-per-season mission limit.
  A.officerFree = function (s, f, oid, opts) {
    opts = opts || {};
    const o = A.O(s, oid);
    if (!o || o.faction !== f) return 'That officer does not serve you.';
    if (o.status !== 'active') return `${o.name} is ${o.status} and cannot act.`;
    if (o.job && o.job.t === 'cmd') return `${o.name} is in the field commanding an army.`;
    if (o.job && o.job.t === 'gov' && !opts.gov) return `${o.name} governs ${A.P(s, o.job.p).name}; relieve them of that post first.`;
    if (o.busy && !opts.busy) return `${o.name} has already carried out a mission this season.`;
    return null;
  };

  // Which province's command would this use? Returns { p } or { why }.
  A.commandProv = function (s, f, id, args) {
    const act = acts[id]; if (!act || !act.cost) return { p: null };
    if (act.scope === 'prov') {
      const p = A.P(s, args.p); if (!p || p.owner !== f) return { p: null };
      return p.acted ? { why: `${p.name} has already carried out its command this season. Each province acts once.` } : { p };
    }
    if (args.from) { const p = A.P(s, args.from); if (p && p.owner === f && !p.acted) return { p }; }
    const free = A.provsOf(s, f).filter((p) => !p.acted).sort((a, b) => a.pros - b.pros)[0];
    return free ? { p: free } : { why: 'Every one of your provinces has already acted this season. End the season to command them again.' };
  };
  A.can = function (s, f, id, args) {
    if (s.over) return 'The campaign is over.';
    const act = acts[id];
    if (!act) return 'Unknown order.';
    const fac = A.F(s, f);
    if (!fac || !fac.alive) return 'This house has fallen.';
    const cp = A.commandProv(s, f, id, args || {}); if (cp.why) return cp.why;
    try { return act.check(s, f, args || {}, fac) || null; } catch (e) { return 'That order is not possible (' + e.message + ').'; }
  };
  A.do = function (s, f, id, args) {
    const why = A.can(s, f, id, args);
    if (why) return { ok: false, reason: why };
    const act = acts[id], fac = A.F(s, f), cp = A.commandProv(s, f, id, args || {});
    let msg = act.run(s, f, args || {}, fac);
    if (cp.p) { cp.p.acted = true; if (act.scope !== 'prov' && msg) msg += ` (${cp.p.name}'s command)`; }
    if (msg && A.isMe(s, f)) A.log(s, msg, 'me');
    return { ok: true, msg };
  };

  // ---------- Province orders ----------
  acts.levy = { cost: 1, label: 'Levy emergency tax',
    check(s, f, a) { const e = own(s, f, a.p); if (e) return e; const p = A.P(s, a.p); if (p.levied) return 'Already levied this season.'; if (p.unrest >= 80) return 'Unrest is too high; the collectors would be driven out.'; return null; },
    run(s, f, a, fac) { const p = A.P(s, a.p), g = A.cost.levy(p); fac.gold += g; p.unrest = A.clamp(p.unrest + 12, 0, 100); p.loyalty = A.clamp(p.loyalty - 8, 0, 100); p.levied = true; if (A.isMe(s, f)) s.stats.goldEarned += g; return `Levied ${g} gold from ${p.name} (unrest +12, loyalty −8).`; } };

  acts.recruit = { cost: 1, label: 'Recruit',
    check(s, f, a, fac) {
      const e = own(s, f, a.p); if (e) return e;
      const p = A.P(s, a.p), U = A.UNITS[a.cls]; if (!U) return 'Unknown troop class.';
      if (p.unrest >= 70) return 'The people refuse the muster while unrest is 70 or more.';
      const n = a.n || 1; if (!Number.isInteger(n) || n < 1) return 'Choose how many levies to raise.';
      if (n > A.cost.recruitCap(p)) return `At most ${A.cost.recruitCap(p)} levies can be raised here in one command (grows with prosperity).`;
      if (a.cls === 'cav' && p.resource !== 'horses' && p.pros < 45) return 'Cavalry needs prosperity 45+ or a Horses province.';
      if (a.cls === 'sie' && p.resource !== 'timber' && p.pros < 40) return 'Siege crews need prosperity 40+ or a Timber province.';
      if (p.pros - n < 6) return 'The province is too impoverished to give up that many hands.';
      return gold(fac, A.cost.recruit(p, a.cls) * n);
    },
    run(s, f, a, fac) { const p = A.P(s, a.p), U = A.UNITS[a.cls], n = a.n || 1, c = A.cost.recruit(p, a.cls) * n; fac.gold -= c; p.garrison[a.cls] += U.batch * n; p.recruited += n; p.pros = Math.max(5, p.pros - n); return `Raised ${U.batch * n} ${U.name.toLowerCase()} in ${p.name} for ${c} gold (prosperity −${n}).`; } };

  acts.disband = { cost: 1, label: 'Disband',
    check(s, f, a) { const e = own(s, f, a.p); if (e) return e; const p = A.P(s, a.p), U = A.UNITS[a.cls]; if (!U) return 'Unknown troop class.'; return p.garrison[a.cls] >= U.batch ? null : `Fewer than ${U.batch} ${U.name.toLowerCase()} in the garrison.`; },
    run(s, f, a) { const p = A.P(s, a.p), U = A.UNITS[a.cls]; p.garrison[a.cls] -= U.batch; p.pros = Math.min(100, p.pros + 1); return `Disbanded ${U.batch} ${U.name.toLowerCase()} in ${p.name}; they return to their fields (prosperity +1).`; } };

  acts.fortify = { cost: 1, label: 'Fortify',
    check(s, f, a, fac) { const e = own(s, f, a.p); if (e) return e; const p = A.P(s, a.p); if (p.fort >= 5) return 'The walls are already at their greatest height (5).'; return gold(fac, A.cost.fortify(p)); },
    run(s, f, a, fac) { const p = A.P(s, a.p), c = A.cost.fortify(p); fac.gold -= c; p.fort++; return `Raised the walls of ${p.name} to level ${p.fort} for ${c} gold.`; } };

  acts.farms = { cost: 1, label: 'Improve farms',
    check(s, f, a, fac) { const e = own(s, f, a.p); if (e) return e; if (A.P(s, a.p).farms >= 100) return 'Farmland is fully developed.'; return gold(fac, A.cost.farms); },
    run(s, f, a, fac) { const p = A.P(s, a.p), g = 4 + Math.round(A.govAdmin(s, p) / 20); fac.gold -= A.cost.farms; p.farms = Math.min(100, p.farms + g); return `Cleared new fields in ${p.name}: farms +${g}.`; } };

  acts.trade = { cost: 1, label: 'Develop markets',
    check(s, f, a, fac) { const e = own(s, f, a.p); if (e) return e; if (A.P(s, a.p).pros >= 100) return 'Prosperity is at its peak.'; return gold(fac, A.cost.trade); },
    run(s, f, a, fac) { const p = A.P(s, a.p), g = 3 + Math.round(A.govAdmin(s, p) / 25); fac.gold -= A.cost.trade; p.pros = Math.min(100, p.pros + g); return `Invested in the markets of ${p.name}: prosperity +${g}.`; } };

  acts.festival = { cost: 1, label: 'Hold festival',
    check(s, f, a, fac) { const e = own(s, f, a.p); if (e) return e; if (A.P(s, a.p).feted) return 'A festival was already held here this season.'; return gold(fac, A.cost.festival); },
    run(s, f, a, fac) { const p = A.P(s, a.p); fac.gold -= A.cost.festival; p.loyalty = A.clamp(p.loyalty + 12, 0, 100); p.unrest = A.clamp(p.unrest - 10, 0, 100); p.feted = true; return `A festival in ${p.name} lifts spirits (loyalty +12, unrest −10).`; } };

  acts.aid = { cost: 1, label: 'Distribute aid',
    check(s, f, a, fac) { const e = own(s, f, a.p); if (e) return e; if (A.P(s, a.p).aided) return 'Aid was already distributed here this season.'; return food(fac, A.cost.aid); },
    run(s, f, a, fac) { const p = A.P(s, a.p); fac.food -= A.cost.aid; p.loyalty = A.clamp(p.loyalty + 6, 0, 100); p.unrest = A.clamp(p.unrest - 14, 0, 100); p.aided = true; return `Grain is shared out in ${p.name} (unrest −14, loyalty +6).`; } };

  acts.market = { cost: 1, label: 'Trade grain',
    check(s, f, a, fac) { if (a.mode === 'buy') return gold(fac, A.cost.marketBuy); if (a.mode === 'sell') return food(fac, 100); return 'Choose to buy or sell.'; },
    run(s, f, a, fac) { if (a.mode === 'buy') { fac.gold -= A.cost.marketBuy; fac.food += 100; return `Bought 100 food for ${A.cost.marketBuy} gold.`; } fac.food -= 100; fac.gold += A.cost.marketSell; return `Sold 100 food for ${A.cost.marketSell} gold.`; } };

  acts.governor = { cost: 1, label: 'Appoint governor',
    check(s, f, a) {
      const e = own(s, f, a.p); if (e) return e;
      const p = A.P(s, a.p);
      if (!a.o) return p.governor ? null : 'There is no governor to dismiss.';
      if (p.governor === a.o) return 'They already govern this province.';
      return A.officerFree(s, f, a.o, { gov: true, busy: true });
    },
    run(s, f, a) {
      const p = A.P(s, a.p), old = p.governor ? A.O(s, p.governor) : null;
      if (old && !old.ruler) old.loyalty = A.clamp(old.loyalty - 6, 0, 100);
      A.setGovernor(s, a.p, a.o || null);
      if (!a.o) return `${old.name} is dismissed as governor of ${p.name} (their loyalty −6).`;
      return `${A.O(s, a.o).name} now governs ${p.name}` + (old ? `, replacing ${old.name} (their loyalty −6).` : '.');
    } };

  // ---------- Armies ----------
  function validTroops(t, pool) {
    if (!t) return 'Choose troops.';
    let n = 0;
    for (const c of A.CLS) { const v = t[c] || 0; if (!Number.isInteger(v) || v < 0) return 'Troop numbers must be whole and positive.'; if (v > pool[c]) return `Only ${pool[c]} ${A.UNITS[c].name.toLowerCase()} are available.`; n += v; }
    return n > 0 ? null : 'An army needs at least some troops.';
  }
  acts.muster = { cost: 1, label: 'Muster army',
    check(s, f, a) { const e = own(s, f, a.p); if (e) return e; if (!a.o) return 'Choose a commander.'; return A.officerFree(s, f, a.o, { busy: true }) || validTroops(a.troops, A.P(s, a.p).garrison); },
    run(s, f, a) {
      const p = A.P(s, a.p), o = A.O(s, a.o), t = A.noTroops();
      for (const c of A.CLS) { t[c] = a.troops[c] || 0; p.garrison[c] -= t[c]; }
      const army = { id: s.nextId++, faction: f, cmd: o.id, troops: t, loc: p.id, moved: false };
      s.armies.push(army); o.job = { t: 'cmd', a: army.id }; o.loc = p.id;
      return `${o.name} musters an army at ${p.name}: ${A.troopStr(t)}.`;
    } };

  // Free: shift troops between an army and the garrison of the owned province it stands in. Positive = into the army.
  acts.transfer = { cost: 0, label: 'Transfer troops',
    check(s, f, a) {
      const army = A.army(s, a.army); if (!army || army.faction !== f) return 'That is not your army.';
      const p = A.P(s, army.loc); if (p.owner !== f) return 'The army must stand in one of your provinces.';
      let any = false;
      for (const c of A.CLS) { const v = (a.troops && a.troops[c]) || 0; if (!Number.isInteger(v)) return 'Troop numbers must be whole.'; if (v > p.garrison[c]) return `Only ${p.garrison[c]} ${A.UNITS[c].name.toLowerCase()} in the garrison.`; if (-v > army.troops[c]) return `Only ${army.troops[c]} ${A.UNITS[c].name.toLowerCase()} in the army.`; if (v) any = true; }
      return any ? null : 'Nothing to transfer.';
    },
    run(s, f, a) { const army = A.army(s, a.army), p = A.P(s, army.loc); for (const c of A.CLS) { const v = a.troops[c] || 0; army.troops[c] += v; p.garrison[c] -= v; } return `Troops reassigned at ${p.name}; ${A.O(s, army.cmd).name} now leads ${A.total(army.troops)}.`; } };

  acts.standDown = { cost: 0, label: 'Stand down army',
    check(s, f, a) { const army = A.army(s, a.army); if (!army || army.faction !== f) return 'That is not your army.'; return A.P(s, army.loc).owner === f ? null : 'The army must stand in one of your provinces.'; },
    run(s, f, a) { const army = A.army(s, a.army), p = A.P(s, army.loc), o = A.O(s, army.cmd); A.addTroops(p.garrison, army.troops); A.removeArmy(s, army.id); return `${o.name}'s army stands down into the garrison of ${p.name}.`; } };

  // ---------- Officers ----------
  acts.reward = { cost: 1, label: 'Reward officer',
    check(s, f, a, fac) { const o = A.O(s, a.o); if (!o || o.faction !== f || o.status !== 'active') return 'That officer does not serve you.'; if (o.ruler) return 'A ruler does not reward themself.'; if (o.rewarded) return 'Already rewarded this season.'; if (o.loyalty >= 100) return 'Their loyalty is already absolute.'; return gold(fac, A.cost.reward); },
    run(s, f, a, fac) { const o = A.O(s, a.o); fac.gold -= A.cost.reward; o.loyalty = A.clamp(o.loyalty + 10, 0, 100); o.rewarded = true; return `${o.name} receives lands and honours (loyalty +10).`; } };

  acts.heir = { cost: 1, label: 'Name heir',
    check(s, f, a, fac) { const o = A.O(s, a.o); if (!o || o.faction !== f || o.status !== 'active') return 'That officer does not serve you.'; if (o.ruler) return 'The ruler cannot be their own heir.'; if (fac.heir === o.id) return 'They are already your named heir.'; return null; },
    run(s, f, a, fac) { const o = A.O(s, a.o); for (const x of A.officersOf(s, f)) if (!x.ruler && x.id !== o.id) x.loyalty = A.clamp(x.loyalty - 4, 0, 100); o.loyalty = A.clamp(o.loyalty + 12, 0, 100); fac.heir = o.id; return `${o.name} is proclaimed heir (their loyalty +12, other officers −4).`; } };

  for (const id of ['levy', 'recruit', 'disband', 'fortify', 'farms', 'trade', 'festival', 'aid', 'governor', 'muster']) acts[id].scope = 'prov';

  // ---------- Seals and the Starwyrm ----------
  A.beast = {
    sync(s, f) { const fac = A.F(s, f); if (!fac) return; if (fac.beast.awake && fac.seals.length < 3) { fac.beast.awake = false; fac.beast.charges = 0; A.log(s, `${A.fname(f)} holds too few seals; ${A.BEAST} sinks back into slumber.`, 'event'); } fac.beast.charges = Math.min(fac.beast.charges, fac.seals.length); },
    give(s, f, seal, from) { if (from) { const ff = A.F(s, from); ff.seals = ff.seals.filter((x) => x !== seal); A.beast.sync(s, from); } const fac = A.F(s, f); if (!fac.seals.includes(seal)) fac.seals.push(seal); },
    dread(s, f) { for (const g of A.aliveFactions(s)) if (g !== f) A.addRel(s, f, g, -4); },
    searchChance(s, p, o) { return A.clamp(Math.round(30 + o.admin * 0.4 + (p.sealKnown ? 25 : 0)), 5, 95); },
    holder(s, seal) { for (const f of A.FIDS) if (s.factions[f].seals.includes(seal)) return f; return null; },
  };

  acts.search = { cost: 1, label: 'Search the ancient site',
    check(s, f, a) { const e = own(s, f, a.p); if (e) return e; const p = A.P(s, a.p); if (!A.SEAL_SITES.includes(p.id) && !p.seal) return 'There is no ancient site to search here.'; if (p.searched && !p.seal) return 'The site has been searched; nothing remains.'; if (!a.o) return 'Choose an officer to lead the search.'; return A.officerFree(s, f, a.o, { gov: true }); },
    run(s, f, a) {
      const p = A.P(s, a.p), o = A.O(s, a.o); o.busy = true;
      if (!p.seal) { p.searched = true; return `${o.name} searches ${p.landmark} in ${p.name} and finds only dust. No seal lies here.`; }
      if (A.chance(s, A.beast.searchChance(s, p, o))) { const seal = p.seal; p.seal = null; p.searched = true; A.beast.give(s, f, seal, null); A.log(s, `${A.fname(f)} has recovered the ${A.SEALS[seal]} from ${p.landmark}.`, 'event'); return `${o.name} unearths the ${A.SEALS[seal]}!`; }
      p.sealKnown = true;
      return `${o.name} finds star-marked stones at ${p.landmark} — a seal is surely here, but it eludes them this season (next search +25%).`;
    } };

  acts.search.scope = 'prov';

  acts.awaken = { cost: 1, label: 'Awaken the Starwyrm',
    check(s, f, a, fac) { if (fac.beast.awake) return `${A.BEAST} is already awake.`; if (fac.seals.length < 3) return `The rite needs 3 seals; you hold ${fac.seals.length}.`; return gold(fac, A.cost.awakenGold) || food(fac, A.cost.awakenFood); },
    run(s, f, a, fac) { fac.gold -= A.cost.awakenGold; fac.food -= A.cost.awakenFood; fac.beast.awake = true; fac.beast.charges = fac.seals.length; for (const g of A.aliveFactions(s)) if (g !== f) A.addRel(s, f, g, -12); A.log(s, `The sky splits over Asterra: ${A.fname(f)} has awakened ${A.BEAST}! Every other court trembles (relations −12).`, 'event'); return `The rite is complete. ${A.BEAST} answers to you, with ${fac.beast.charges} starfire charges.`; } };

  acts.omen = { cost: 1, label: 'Celestial omen',
    check(s, f, a, fac) {
      if (!fac.beast.awake) return `${A.BEAST} sleeps.`; if (fac.beast.charges < 1) return 'No starfire charges remain; one returns each spring.';
      if (a.mode === 'calm') { const e = own(s, f, a.p); if (e) return e; return A.P(s, a.p).unrest < 5 && A.P(s, a.p).loyalty >= 90 ? 'This province is already calm and loyal.' : null; }
      if (a.mode === 'awe') { const g = A.F(s, a.target); if (!g || !g.alive || a.target === f) return 'Choose a living rival house.'; if (fac.awe[a.target]) return 'They are already awed; your next proposal to them has +25%.'; return null; }
      return 'Choose an omen.';
    },
    run(s, f, a, fac) {
      fac.beast.charges--; A.beast.dread(s, f); if (A.isMe(s, f)) s.stats.beastUses++;
      if (a.mode === 'calm') { const p = A.P(s, a.p); p.unrest = 0; p.loyalty = A.clamp(p.loyalty + 20, 0, 100); return `The Starwyrm circles ${p.name}; awed, the people fall quiet (unrest 0, loyalty +20). Other courts mutter (−4 relations).`; }
      fac.awe[a.target] = true; return `A comet hangs over ${A.fname(a.target)}'s seat. Your next proposal to them gains +25% (other courts −4 relations).`;
    } };
})();
