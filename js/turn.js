// Season flow: rival turns -> income and upkeep -> loyalty, unrest, rebellion -> new season -> victory check -> events.
(function () {
  const A = globalThis.A;
  const turn = (A.turn = {});
  const cl = A.clamp;

  function desert(s, f, k) {
    for (const p of A.provsOf(s, f)) for (const c of A.CLS) p.garrison[c] = Math.floor(p.garrison[c] * (1 - k));
    for (const a of A.armiesOf(s, f)) for (const c of A.CLS) a.troops[c] = Math.floor(a.troops[c] * (1 - k));
  }

  turn.revolt = function (s, p) {
    const old = p.owner, name = A.fname(old);
    const home = p.nb.map((n) => A.P(s, n)).filter((q) => q.owner === old)[0];
    for (const a of A.armiesAt(s, p.id, old).slice()) { if (home) { a.loc = home.id; A.O(s, a.cmd).loc = home.id; } else A.removeArmy(s, a.id); }
    A.log(s, `✹ ${p.name} rises in revolt and casts off ${name}!`, 'event');
    A.war.conquer(s, p.id, null, {});
    p.garrison = { inf: 200 + p.pros * 2, arc: 80, cav: 0, sie: 0 }; p.loyalty = 50; p.unrest = 30;
  };

  function settle(s) {
    const season = s.turn % 4;
    for (const f of A.FIDS) {
      const fac = A.F(s, f); if (!fac.alive) continue;
      const fc = A.econ.forecast(s, f, season);
      fac.gold += fc.gold - fc.upGold; fac.food += fc.food - fc.upFood;
      if (f === s.player) s.stats.goldEarned += fc.gold;
      if (fac.gold < 0) { const co = A.champ.of(s, f); if (co) A.champ.release(s, co.id, 'go unpaid and ride away; their contract is void.');
        fac.gold = 0; desert(s, f, 0.06); for (const o of A.officersOf(s, f)) if (!o.ruler) o.loyalty = cl(o.loyalty - 4, 0, 100); if (A.isMe(s, f)) A.log(s, 'The treasury is empty and the soldiers go unpaid: 6% desert and your officers grumble (loyalty −4).', 'me'); }
      if (fac.food < 0) { fac.food = 0; desert(s, f, season === 3 ? 0.18 : 0.1); for (const p of A.provsOf(s, f)) p.loyalty = cl(p.loyalty - 4, 0, 100); if (A.isMe(s, f)) A.log(s, `The granaries are empty: ${season === 3 ? 18 : 10}% of your soldiers desert and the provinces lose faith (loyalty −4).`, 'me'); }
    }
    for (const p of A.provs(s)) {
      if (!p.owner) continue;
      const adm = A.govAdmin(s, p), mine = A.isMe(s, p.owner);
      if (p.loyalty < 55) p.loyalty = cl(p.loyalty + 1 + Math.floor(adm / 50), 0, 100); else if (p.loyalty > 75) p.loyalty--;
      let du = -2 - Math.floor(adm / 30);
      if (p.loyalty < 35) du += 4;
      if (A.total(p.garrison) + A.armiesAt(s, p.id, p.owner).reduce((n, a) => n + A.total(a.troops), 0) < 100) du += 3;
      p.unrest = cl(p.unrest + du, 0, 100);
      if (p.unrest >= 70) p.pros = Math.max(5, p.pros - 2);
      if (season === 0 && p.unrest < 30 && p.pros < 70) p.pros++;
      if (p.unrest >= 85 && p.loyalty <= 30) { if (A.chance(s, 50)) turn.revolt(s, p); else if (mine) A.log(s, `⚠ ${p.name} is on the brink of revolt (unrest ${p.unrest}, loyalty ${p.loyalty}).`, 'me'); }
      else if (mine && p.unrest >= 70) A.log(s, `⚠ Unrest in ${p.name} is ${p.unrest}. At 85 with loyalty 30 or less it may revolt.`, 'me');
    }
    for (const o of Object.values(s.officers)) {
      if (o.status !== 'active' || o.ruler || !A.F(s, o.faction).alive) continue;
      if (o.job && o.loyalty < 90) o.loyalty++;
      if (!o.job && o.trait === 'Ambitious') o.loyalty = cl(o.loyalty - 2, 0, 100);
      if (o.trait === 'Mercenary' && !o.rewarded) o.loyalty = cl(o.loyalty - 1, 0, 100);
      const mine = A.isMe(s, o.faction);
      if (o.loyalty < 25 && A.chance(s, 35)) {
        const to = A.aliveFactions(s).filter((g) => g !== o.faction);
        if (!to.length) continue;
        const g = A.pick(s, to), old = o.faction;
        A.clearArmyOf(s, o); if (o.job && o.job.t === 'gov') { const p = A.P(s, o.job.p); p.unrest = cl(p.unrest + 15, 0, 100); } A.clearJob(s, o.id);
        if (A.F(s, old).heir === o.id) A.F(s, old).heir = null;
        o.faction = g; o.loyalty = 55; o.loc = A.F(s, g).seat; o.busy = true;
        A.log(s, `${o.name} abandons ${A.fname(old)} and defects to ${A.fname(g)}.`, mine ? 'me' : 'event');
      } else if (mine && o.loyalty < 35) A.log(s, `⚠ ${o.name} is discontent (loyalty ${o.loyalty}). Below 25 they may defect; a reward or a post would help.`, 'me');
    }
    A.champ.season(s);
    A.glory.season(s);
    A.war.cleanup(s);
    if (s.capital.holder && A.F(s, s.capital.holder).alive) s.capital.seasons++;
  }

  // Progress toward each victory, with the unmet conditions spelled out.
  turn.progress = function (s, f) {
    const fac = A.F(s, f), n = A.provsOf(s, f).length, cap = s.capital.holder === f;
    const rivals = A.aliveFactions(s).filter((g) => g !== f);
    const heirOk = !!(fac.heir && A.O(s, fac.heir) && A.O(s, fac.heir).status === 'active' && A.O(s, fac.heir).faction === f);
    const unrecognized = rivals.filter((g) => { const t = A.treaty(s, f, g); return !(t && (t.type === 'alliance' || t.type === 'pact')); });
    return { n, cap, capSeasons: cap ? s.capital.seasons : 0, heirOk, rivals, unrecognized,
      unify: (n >= A.WIN_PROVINCES && cap) || rivals.length === 0,
      recog: cap && s.capital.seasons >= A.RECOG_SEASONS && heirOk && n >= A.RECOG_PROVINCES && unrecognized.length === 0 };
  };
  turn.checkVictory = function (s) {
    if (s.over) return;
    const order = s.player ? [s.player].concat(A.FIDS.filter((f) => f !== s.player)) : A.FIDS;
    for (const f of order) {
      if (!A.F(s, f).alive) continue;
      const pr = turn.progress(s, f); if (!pr.unify && !pr.recog) continue;
      const kind = pr.unify ? 'unification' : 'succession';
      if (f === s.player) s.over = { result: 'victory', kind, winner: f, text: pr.unify ? (pr.rivals.length ? `With ${pr.n} provinces and the royal capital in your hands, no house can deny you. You are crowned sovereign of a united Asterra.` : 'Every rival house has fallen. Asterra is yours alone.') : `For ${s.capital.seasons} seasons you have held Aurelion in peace, your heir is acknowledged, and every surviving house has set its seal to your succession. The crown passes to your line without another drop of blood.` };
      else s.over = { result: s.player ? 'defeat' : 'ai', kind: 'rival', winner: f, text: `${A.fname(f)} has ${pr.unify ? 'united the realm by the sword' : 'secured a recognized succession'} and taken the crown of Asterra. Your claim is ended.` };
      A.log(s, `♛ ${A.fname(f)} claims the crown of Asterra.`, 'event');
      return;
    }
  };

  function begin(s) {
    for (const p of A.provs(s)) { p.acted = (p.settle || 0) > s.turn; p.recruited = 0; p.levied = false; p.feted = false; p.aided = false; }
    for (const a of s.armies) a.moved = false;
    for (const o of Object.values(s.officers)) {
      o.busy = false; o.rewarded = false;
      if (o.status === 'captured' && o.until <= s.turn) { if (A.F(s, o.faction).alive) { o.status = 'active'; o.loc = A.F(s, o.faction).seat; A.log(s, `${o.name} is ransomed and returns to ${A.fname(o.faction)}.`, 'event'); } else o.status = 'gone'; }
    }
    A.dip.expire(s);
    // Fear of a runaway leader: once a house holds twelve provinces the other courts cool toward it and draw together.
    { const L = A.dip.leader(s); if (L.f && L.n >= 12) { const rest = A.aliveFactions(s).filter((g) => g !== L.f); for (const g of rest) { A.addRel(s, g, L.f, -1); for (const h of rest) if (g < h) A.addRel(s, g, h, 1); } } }
    for (const f of A.aliveFactions(s)) {
      const fac = A.F(s, f);
      fac.courtUsed = false;
      if (s.turn % 4 === 0 && fac.beast.awake && fac.beast.charges < fac.seals.length) fac.beast.charges++;
      if (fac.focus && fac.focus.until <= s.turn) fac.focus = null;
    }
    if (s.player && A.F(s, s.player).alive) s.stats.peakProvinces = Math.max(s.stats.peakProvinces, A.provsOf(s, s.player).length);
    turn.checkVictory(s);
    if (s.over) return;
    for (const f of A.aliveFactions(s)) {
      if (A.isMe(s, f)) { if (A.chance(s, 60)) s.pendingEvent = A.events.roll(s, f, false); }
      else if (A.chance(s, 20)) A.events.auto(s, f);
    }
    A.glory.ambTick(s);
    if (s.autoPlayer) A.dip.autoAnswer(s);
    A.champ.sync(s);
  }

  // Ends the current season. `handler` lets the UI stage battles that involve the human player.
  turn.endSeason = async function (s, handler) {
    if (s.over) return;
    for (const f of A.FIDS) {
      if (A.isMe(s, f)) continue;
      const fac = A.F(s, f); if (!fac.alive) continue;
      await A.ai.run(s, f, handler);
      if (s.over) return;
    }
    settle(s);
    turn.checkVictory(s); if (s.over) return;
    s.turn++;
    begin(s);
  };
})();
