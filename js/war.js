// Strategic warfare: marching, battle setup and aftermath, conquest, elimination, succession.
(function () {
  const A = globalThis.A;
  const war = (A.war = {});

  // Everything defending a province: garrison plus the owner's armies standing there.
  war.defenders = function (s, pid) {
    const p = A.P(s, pid), troops = { ...p.garrison };
    const armies = p.owner ? A.armiesAt(s, pid, p.owner) : [];
    let lead = 30, cmdName = p.owner ? 'the garrison captain' : 'a militia captain', cmd = null;
    if (p.governor && A.O(s, p.governor)) { const g = A.O(s, p.governor); lead = g.lead; cmdName = g.name; cmd = g.id; }
    for (const a of armies) { A.addTroops(troops, a.troops); const o = A.O(s, a.cmd); if (o && o.lead > lead) { lead = o.lead; cmdName = o.name; cmd = o.id; } }
    return { troops, armies, lead, cmdName, cmd };
  };

  // Can this army march to `to`? Returns { ok, reason, kind: move|attack|betray, via }.
  war.marchCheck = function (s, army, to) {
    const f = army.faction, from = A.P(s, army.loc), dest = A.P(s, to);
    const no = (reason) => ({ ok: false, reason });
    if (s.over) return no('The campaign is over.');
    if (!dest) return no('No such province.');
    if (army.moved) return no('This army has already marched this season.');
    if (to === army.loc) return no('The army is already there.');
    if (A.total(army.troops) <= 0) return no('The army has no soldiers.');
    let via = null;
    if (!from.nb.includes(to)) {
      via = from.nb.find((m) => A.P(s, m).nb.includes(to) && A.passage(s, f, A.P(s, m).owner));
      if (!via) return no(`${dest.name} is not next to ${from.name}, and no friendly province links them. Armies march one province at a time (two through land you own, an ally's, or where you hold passage).`);
    }
    if (dest.owner === f) return { ok: true, kind: 'move', via };
    if (A.F(s, f).food <= 0) return no('Your granaries are empty; the army will not march to war unfed.');
    if (dest.owner) { const t = A.treaty(s, f, dest.owner); if (t) return { ok: true, kind: 'betray', treaty: t.type, via }; }
    return { ok: true, kind: 'attack', via };
  };

  function beastSpec(s, f, enemy, auto) {
    if (!f) return { avail: false };
    const fac = A.F(s, f);
    return { avail: fac.beast.awake && fac.beast.charges > 0, halved: !!(enemy && A.F(s, enemy).seals.length), auto };
  }
  // Rough odds for the UI's pre-battle briefing.
  war.estimate = function (s, army, pid) {
    const p = A.P(s, pid), d = war.defenders(s, pid);
    const ap = A.power(army.troops) * (0.8 + A.O(s, army.cmd).lead / 250);
    const dp = A.power(d.troops) * (0.8 + d.lead / 250) * (1 + 0.14 * p.fort) * A.TERRAIN[p.terrain].def;
    return { ratio: dp > 0 ? ap / dp : 99, def: d };
  };

  // handler = { fight(battle, ctx) -> Promise, report(rep) -> Promise } for battles that involve the human player.
  war.march = async function (s, armyId, to, handler, opts) {
    const army = A.army(s, armyId); if (!army) return { ok: false, reason: 'That army no longer exists.' };
    const chk = war.marchCheck(s, army, to); if (!chk.ok) return chk;
    const f = army.faction, cmd = A.O(s, army.cmd), dest = A.P(s, to);
    if (chk.kind === 'move') { army.loc = to; army.moved = true; cmd.loc = to; const msg = `${cmd.name} marches to ${dest.name}.`; if (A.isMe(s, f)) A.log(s, msg, 'me'); return { ok: true, kind: 'move', msg }; }
    if (cmd.loyalty < 30 && !cmd.ruler && A.chance(s, 40)) { army.moved = true; const msg = `${cmd.name} (loyalty ${cmd.loyalty}) finds reasons not to march on ${dest.name}. The order is wasted.`; A.log(s, msg, A.isMe(s, f) ? 'me' : 'war'); return { ok: true, kind: 'refused', msg }; }
    if (chk.kind === 'betray') A.dip.breakTreaties(s, f, dest.owner, f);
    const rep = await war.attack(s, army, to, handler, opts || {});
    return { ok: true, kind: 'battle', rep };
  };

  war.attack = async function (s, army, pid, handler, opts) {
    const f = army.faction, p = A.P(s, pid), defF = p.owner, from = army.loc, cmd = A.O(s, army.cmd);
    const d = war.defenders(s, pid);
    army.moved = true;
    if (defF) {
      A.setWar(s, f, defF, true); A.addRel(s, f, defF, -15);
      for (const g of A.aliveFactions(s)) if (g !== f && g !== defF && A.allied(s, g, defF)) { A.addRel(s, g, f, -20); if (!A.treaty(s, g, f) && !A.atWar(s, g, f)) { A.setWar(s, g, f, true); A.log(s, `${A.fname(g)} stands by its ally ${A.fname(defF)} and declares war on ${A.fname(f)}.`, 'dip'); } }
    }
    const rep = { pid, name: p.name, attF: f, defF, attCmd: cmd.name, defCmd: d.cmdName, notes: [], walkover: false };
    const meAtt = A.isMe(s, f), meDef = A.isMe(s, defF);
    if (A.total(d.troops) <= 0) {
      rep.walkover = true; rep.won = true;
      war.conquer(s, pid, f, {}); army.loc = pid; cmd.loc = pid;
      A.log(s, `${A.fname(f)} occupies undefended ${p.name}.`, 'war');
      if ((meAtt || meDef) && handler && handler.report) await handler.report(rep);
      return rep;
    }
    const season = s.turn % 4;
    const aCo = A.champ.withArmy(s, army), dCo = defF ? A.champ.at(s, defF, pid) : null;
    const coSpec = (x) => (x ? { id: x.id, men: x.c.men } : null);
    const spec = { seed: A.rint(s, 1, 2147483000), terrain: p.terrain, fort: p.fort, pid,
      att: { f, name: A.fname(f), cmd: cmd.name, lead: cmd.lead, troops: { ...army.troops }, champ: coSpec(aCo), morale: (season === 3 ? -10 : 0) + (A.F(s, f).food <= 0 ? -10 : 0) },
      def: { f: defF, name: A.fname(defF), cmd: d.cmdName, lead: d.lead, troops: { ...d.troops }, champ: coSpec(dCo), morale: (p.fort > 0 ? 5 : 0) + (p.loyalty >= 70 ? 5 : p.loyalty <= 30 ? -5 : 0) },
      beast: { att: beastSpec(s, f, defF, !meAtt), def: beastSpec(s, defF, f, !meDef) } };
    const b = A.battle.create(spec);
    if ((meAtt || meDef) && handler && handler.fight) await handler.fight(b, { side: meAtt ? 'att' : 'def', mode: opts.mode, beast: opts.beast, province: p, rep });
    if (!b.over) A.battle.autoResolve(b);
    const res = A.battle.result(b); rep.res = res; rep.log = b.log;
    const attWon = (rep.won = res.winner === 'att');

    // --- Attacker's survivors
    const scale = (t, k) => { for (const c of A.CLS) t[c] = Math.floor(t[c] * k); return t; };
    const aLeft = { ...res.att.left }; if (!attWon) scale(aLeft, res.retreated === 'att' ? 0.9 : 0.75);
    army.troops = aLeft;
    if (aCo && res.att.champ) aCo.c.men = Math.floor(res.att.champ.men * (attWon ? 1 : res.retreated === 'att' ? 0.9 : 0.75));
    if (dCo && res.def.champ) dCo.c.men = Math.floor(res.def.champ.men * (!attWon ? 1 : res.retreated === 'def' ? 0.85 : 0.6));
    // --- Defender's survivors, as a per-class ratio applied to garrison and armies
    const r = {}; for (const c of A.CLS) r[c] = d.troops[c] > 0 ? res.def.left[c] / d.troops[c] : 0;
    if (attWon) for (const c of A.CLS) r[c] *= res.retreated === 'def' ? 0.85 : 0.6;
    const defCmds = d.armies.map((a) => a.cmd);
    if (!attWon) {
      for (const c of A.CLS) { p.garrison[c] = Math.floor(p.garrison[c] * r[c]); for (const a of d.armies) a.troops[c] = Math.floor(a.troops[c] * r[c]); }
    } else {
      const pooled = A.noTroops(); for (const c of A.CLS) pooled[c] = Math.floor(d.troops[c] * r[c]);
      const dest = defF ? p.nb.map((n) => A.P(s, n)).filter((q) => q.owner === defF).sort((a, c) => A.total(c.garrison) - A.total(a.garrison))[0] : null;
      if (dest && A.total(pooled) > 0) {
        if (d.armies.length) { const first = d.armies[0]; first.troops = pooled; first.loc = dest.id; first.moved = true; A.O(s, first.cmd).loc = dest.id; for (const a of d.armies.slice(1)) { const o = A.O(s, a.cmd); A.removeArmy(s, a.id); if (o) o.loc = dest.id; } }
        else A.addTroops(dest.garrison, pooled);
        rep.notes.push(`${A.total(pooled)} defenders fall back to ${dest.name}.`);
      } else { for (const a of d.armies.slice()) A.removeArmy(s, a.id); if (A.total(pooled) > 0) rep.notes.push('The surviving defenders have nowhere to retreat and scatter.'); }
      if (dCo) { if (dest) { dCo.c.p = dest.id; dCo.c.army = d.armies.length && A.total(pooled) > 0 ? d.armies[0].id : null; } else A.champ.release(s, dCo.id, `are scattered in the fall of ${p.name}; their contract is void.`); }
      p.garrison = A.noTroops();
      war.conquer(s, pid, f, { siege: res.breached });
      army.loc = pid; cmd.loc = pid;
    }
    for (const x of [aCo, dCo]) if (x && x.c.f && x.c.men < x.D.men * 0.15) { A.champ.release(s, x.id, `are broken at ${p.name}; the survivors disband.`); rep.notes.push(`${x.D.name} are broken and disband.`); }
    // --- Starwyrm charges
    for (const side of ['att', 'def']) { const ff = side === 'att' ? f : defF; if (res.beastUsed[side] && ff) { const fac = A.F(s, ff); fac.beast.charges = Math.max(0, fac.beast.charges - 1); A.beast.dread(s, ff); if (A.isMe(s, ff)) s.stats.beastUses++; rep.notes.push(`${A.fname(ff)} spent a starfire charge (${fac.beast.charges} left); other courts grow fearful.`); } }
    // --- Commanders
    cmd.loyalty = A.clamp(cmd.loyalty + (attWon ? 3 : -3), 0, 100);
    A.glory.learn(s, cmd, 'lead', attWon ? 2 : 1); for (const oid of defCmds) A.glory.learn(s, A.O(s, oid), 'lead', attWon ? 1 : 2);
    const loserF = attWon ? defF : f, winnerF = attWon ? f : defF;
    const losers = attWon ? defCmds : [army.cmd];
    for (const oid of losers) { const note = war.loserFate(s, oid, winnerF, res.retreated && res.retreated === (attWon ? 'def' : 'att')); if (note) rep.notes.push(note); }
    war.cleanup(s);
    // --- Chronicle and statistics
    const line = attWon
      ? `${A.fname(f)} takes ${p.name} from ${A.fname(defF)} (${cmd.name} defeats ${d.cmdName}; losses ${res.att.lost} to ${res.def.lost}).`
      : `${A.fname(defF)} holds ${p.name} against ${A.fname(f)} (${d.cmdName} repels ${cmd.name}; losses ${res.def.lost} to ${res.att.lost}).`;
    A.log(s, line, 'war');
    if (s.player) {
      const st = s.stats;
      if (f === s.player) { attWon ? st.battlesWon++ : st.battlesLost++; st.menLost += res.att.lost; st.enemiesSlain += res.def.lost; }
      if (defF === s.player) { attWon ? st.battlesLost++ : st.battlesWon++; st.menLost += res.def.lost; st.enemiesSlain += res.att.lost; }
    }
    rep.loserF = loserF;
    if ((meAtt || meDef) && handler && handler.report) await handler.report(rep);
    return rep;
  };

  // What happens to a beaten commander. Orderly retreats are safe.
  war.loserFate = function (s, oid, victorF, retreated) {
    const o = A.O(s, oid); if (!o || o.status !== 'active' || retreated) return null;
    const roll = A.rnd(s) * 100, f = o.faction;
    o.loyalty = A.clamp(o.loyalty - (o.ruler ? 0 : 3), 0, 100);
    if (roll < (o.ruler ? 5 : 7)) { A.clearArmyOf(s, o); o.status = 'dead'; A.clearJob(s, oid); A.log(s, `${o.name} of ${A.fname(f)} is slain in the rout.`, 'war'); if (o.ruler) war.succession(s, f, 'slain'); return `${o.name} is slain in the rout.`; }
    if (roll < (o.ruler ? 12 : 19) && victorF) {
      A.clearArmyOf(s, o); A.clearJob(s, oid);
      if (!o.ruler && o.loyalty < 45) { o.faction = victorF; o.loyalty = 50; o.loc = A.F(s, victorF).seat; o.busy = true; A.log(s, `${o.name} is captured and changes sides, joining ${A.fname(victorF)}.`, 'war'); return `${o.name} is captured and, having little love for their old master, joins ${A.fname(victorF)}.`; }
      o.status = 'captured'; o.until = s.turn + 3; A.log(s, `${o.name} of ${A.fname(f)} is taken prisoner by ${A.fname(victorF)}.`, 'war');
      if (o.ruler) war.succession(s, f, 'captured');
      return `${o.name} is taken prisoner${o.ruler ? '' : ' (ransomed home in 3 seasons)'}.`;
    }
    return null;
  };
  // If an officer leading an army is lost, the army's soldiers fall in with the local garrison.
  A.clearArmyOf = function (s, o) {
    if (!o.job || o.job.t !== 'cmd') return;
    const a = A.army(s, o.job.a); if (!a) { o.job = null; return; }
    const p = A.P(s, a.loc); if (p.owner === a.faction) A.addTroops(p.garrison, a.troops);
    A.removeArmy(s, a.id);
  };
  war.cleanup = function (s) {
    for (const a of s.armies.slice()) {
      const o = A.O(s, a.cmd), p = A.P(s, a.loc);
      if (A.total(a.troops) < 1) { A.removeArmy(s, a.id); continue; }
      if (!o || o.status !== 'active' || o.faction !== a.faction || !A.F(s, a.faction).alive) { if (p.owner === a.faction) A.addTroops(p.garrison, a.troops); A.removeArmy(s, a.id); }
    }
  };

  war.conquer = function (s, pid, newF, opt) {
    const p = A.P(s, pid), old = p.owner;
    if (p.governor) { const g = A.O(s, p.governor); A.clearJob(s, g.id); }
    p.owner = newF; p.governor = null; p.acted = true; // a province taken this season cannot also act
    p.settle = newF ? s.turn + (old ? A.SETTLE_HOUSE : A.SETTLE_FREE) : 0; // conquered land takes time to follow its new master's orders
    p.loyalty = old ? 30 : 42; p.unrest = old ? 35 : 22; p.pros = Math.max(5, p.pros - 4);
    if (opt && opt.siege && p.fort > 0) p.fort--;
    if (pid === A.CAPITAL) { s.capital.holder = newF; s.capital.seasons = 0; A.log(s, newF ? `♛ ${A.fname(newF)} now holds Aurelion, the royal capital.` : 'Aurelion has thrown off all masters.', 'event'); }
    if (newF && newF === s.player) s.stats.provincesTaken++;
    if (old && old === s.player) s.stats.provincesLost++;
    if (old) {
      const of = A.F(s, old), rest = A.provsOf(s, old);
      if (!rest.length) war.eliminate(s, old, newF, {});
      else if (of.seat === pid) {
        if (newF && of.seals.length) { for (const seal of of.seals.slice()) { A.beast.give(s, newF, seal, old); A.log(s, `The ${A.SEALS[seal]} is seized from the fallen seat of ${A.fname(old)} by ${A.fname(newF)}.`, 'event'); } }
        of.seat = rest.sort((a, b) => b.pros - a.pros)[0].id;
        for (const o of A.officersOf(s, old)) { if (!o.ruler) o.loyalty = A.clamp(o.loyalty - 8, 0, 100); if (!o.job) o.loc = of.seat; }
        A.log(s, `${A.fname(old)} loses its seat and moves its court to ${A.P(s, of.seat).name}.`, 'war');
      } else for (const o of A.officersOf(s, old)) if (!o.job && o.loc === pid) o.loc = of.seat;
    }
    if (newF) A.beast.sync(s, newF);
  };

  war.eliminate = function (s, fid, by, opt) {
    const fac = A.F(s, fid); if (!fac.alive) return;
    fac.alive = false;
    for (const a of A.armiesOf(s, fid).slice()) A.removeArmy(s, a.id);
    for (const o of Object.values(s.officers)) {
      if (o.faction !== fid || (o.status !== 'active' && o.status !== 'captured')) continue;
      A.clearJob(s, o.id);
      if (o.ruler) { o.status = 'exiled'; continue; }
      if (by && A.F(s, by).alive && (opt.peaceful || A.chance(s, 50))) { o.faction = by; o.status = 'active'; o.loyalty = opt.peaceful ? 55 : 45; o.loc = A.F(s, by).seat; o.busy = true; }
      else o.status = 'gone';
    }
    for (const seal of fac.seals.slice()) {
      if (by && A.F(s, by).alive) A.beast.give(s, by, seal, null);
      else { const spots = A.provs(s).filter((p) => !p.seal); const p = A.pick(s, spots); p.seal = seal; p.sealKnown = true; p.searched = false; p.landmark = p.landmark || 'Hidden Reliquary'; A.log(s, `The ${A.SEALS[seal]} is lost in the chaos; rumour places it in ${p.name}.`, 'event'); }
    }
    fac.seals = []; fac.beast = { awake: false, charges: 0 };
    s.treaties = s.treaties.filter((t) => t.a !== fid && t.b !== fid);
    for (const k of Object.keys(s.wars)) if (k.split('|').includes(fid)) delete s.wars[k];
    s.inbox = s.inbox.filter((it) => it.from !== fid);
    if (by) A.beast.sync(s, by);
    A.log(s, `☠ ${A.fname(fid)} is no more${by ? ` — its last lands fall to ${A.fname(by)}` : ''}.`, 'event');
    if (fid === s.player && !s.over) s.over = { result: 'defeat', kind: 'eliminated', text: 'Your house has lost its last province. The banners of ' + A.fname(fid) + ' are burned.' };
  };

  // A ruler is slain or captured: the named heir (or the most loyal officer) takes the seat, or the house fractures.
  war.succession = function (s, f, cause) {
    const fac = A.F(s, f); if (!fac.alive) return;
    const old = A.O(s, fac.ruler); old.ruler = false; if (old.status === 'captured') old.status = 'gone';
    const cands = A.officersOf(s, f).filter((o) => o.id !== old.id);
    let heir = fac.heir && cands.find((o) => o.id === fac.heir), named = !!heir;
    if (!heir) heir = cands.filter((o) => o.loyalty >= 50).sort((a, b) => b.loyalty - a.loyalty)[0];
    if (!heir) {
      A.log(s, `With ${old.name} ${cause} and no accepted heir, ${A.fname(f)} tears itself apart.`, 'event');
      if (f === s.player && !s.over) { s.over = { result: 'defeat', kind: 'succession', text: `${old.name} was ${cause} with no named heir and no officer loyal enough to hold the house together. Your realm dissolves in a succession crisis.` }; return; }
      for (const p of A.provsOf(s, f)) { if (p.governor) A.clearJob(s, p.governor); for (const a of A.armiesAt(s, p.id, f)) A.addTroops(p.garrison, a.troops); p.owner = null; p.governor = null; p.loyalty = 50; p.unrest = 25; if (p.id === A.CAPITAL) { s.capital.holder = null; s.capital.seasons = 0; } }
      war.eliminate(s, f, null, {});
      return;
    }
    heir.ruler = true; heir.loyalty = 100; fac.ruler = heir.id; fac.heir = null;
    if (heir.job && heir.job.t === 'cmd') { /* keeps the army */ } else if (!A.P(s, fac.seat).governor) A.setGovernor(s, fac.seat, heir.id);
    for (const p of A.provsOf(s, f)) { p.loyalty = A.clamp(p.loyalty - (named ? 3 : 8), 0, 100); p.unrest = A.clamp(p.unrest + (named ? 4 : 12), 0, 100); }
    for (const o of cands) if (o.id !== heir.id) o.loyalty = A.clamp(o.loyalty - (named ? 2 : 10), 0, 100);
    A.log(s, `${old.name} is ${cause}. ${heir.name} ${named ? 'succeeds as the named heir' : 'seizes the seat amid dispute'} and now rules ${A.fname(f)}.`, 'event');
  };
})();
