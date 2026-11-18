// Diplomacy: proposals, visible odds, treaties, betrayal.
(function () {
  const A = globalThis.A;

  const TYPES = {
    gift: { label: 'Send a gift', base: 100, desc: 'Always accepted. Improves relations by roughly one point per 8 gold, more with a skilled envoy.' },
    pact: { label: 'Non-aggression pact', base: 35, dur: 8, desc: 'Neither house may attack the other for 8 seasons without betrayal.' },
    alliance: { label: 'Alliance', base: 10, dur: 12, desc: '12 seasons. Allies cannot attack each other, grant passage, and may be asked for military support. Needs relations of +10.' },
    truce: { label: 'Truce', base: 30, dur: 4, desc: 'Ends a war for 4 seasons.' },
    tribute: { label: 'Demand tribute', base: -5, desc: 'They pay a fifth of their treasury. Sours relations whether or not they pay.' },
    passage: { label: 'Request passage', base: 30, dur: 4, desc: 'For 4 seasons your armies may march through their land to reach a province beyond it.' },
    support: { label: 'Request military support', base: 25, desc: 'An ally declares war on a house you name and turns its armies on it for 6 seasons.' },
    surrender: { label: 'Demand surrender', base: -35, desc: 'A broken house (3 provinces or fewer, half your strength) swears fealty: its lands, armies and officers become yours.' },
    seal: { label: 'Bargain for a seal', base: -25, desc: 'Offer 300 gold for one of their celestial seals.' },
  };

  const dip = (A.dip = { TYPES, SEAL_PRICE: 300 });

  dip.leader = function (s) { let best = null, n = 0; for (const f of A.aliveFactions(s)) { const c = A.provsOf(s, f).length; if (c > n) { n = c; best = f; } } return { f: best, n }; };
  dip.sharedEnemy = (s, a, b) => A.aliveFactions(s).some((h) => h !== a && h !== b && A.atWar(s, a, h) && A.atWar(s, b, h));
  dip.status = function (s, a, b) { const t = A.treaty(s, a, b); if (t) return { type: t.type, until: t.until }; if (A.atWar(s, a, b)) return { type: 'war' }; return { type: 'neutral' }; };

  dip.check = function (s, f, a) {
    const T = TYPES[a.type]; if (!T) return 'Choose a proposal.';
    const to = A.F(s, a.target), fac = A.F(s, f);
    if (!to || a.target === f) return 'Choose another house.';
    if (!to.alive) return `${A.fname(a.target)} has fallen.`;
    if (!a.envoy) return 'Choose an envoy.';
    const e = A.officerFree(s, f, a.envoy, { gov: true }); if (e) return e;
    const t = A.treaty(s, f, a.target), rel = A.getRel(s, f, a.target);
    switch (a.type) {
      case 'gift': if (!(a.amount > 0)) return 'Choose an amount.'; return fac.gold >= a.amount ? null : `You have only ${fac.gold} gold.`;
      case 'pact': if (t && t.type !== 'truce') return `You already have ${t.type === 'alliance' ? 'an alliance' : 'a pact'} with them.`; if (A.atWar(s, f, a.target)) return 'You are at war; propose a truce first.'; return null;
      case 'alliance': if (t && t.type === 'alliance') return 'You are already allied.'; if (A.atWar(s, f, a.target)) return 'You are at war; propose a truce first.'; if (rel < 10) return `They will not hear of alliance while relations are below +10 (now ${rel}).`; return null;
      case 'truce': return A.atWar(s, f, a.target) ? null : 'You are not at war with them.';
      case 'tribute': if (t && t.type === 'alliance') return 'You cannot extort an ally.'; if (to.gold < 30) return 'Their treasury is empty.'; return null;
      case 'passage': if (A.passage(s, f, a.target)) return 'You already have passage through their land.'; if (A.atWar(s, f, a.target)) return 'You are at war with them.'; return null;
      case 'support': {
        if (!t || t.type !== 'alliance') return 'Only an ally can be asked for military support.';
        const g = A.F(s, a.against); if (!g || !g.alive || a.against === f || a.against === a.target) return 'Name a living third house to march against.';
        if (A.treaty(s, a.target, a.against)) return `${A.fname(a.target)} is bound by treaty to ${A.fname(a.against)}.`;
        if (A.atWar(s, a.target, a.against)) return 'They are already at war with that house.';
        return null;
      }
      case 'surrender': if (A.provsOf(s, a.target).length > 3) return 'They still hold more than 3 provinces and will not consider it.'; if (A.strength(s, f) < 2 * A.strength(s, a.target)) return 'You need at least twice their strength.'; return null;
      case 'seal': if (!to.seals.length) return 'They hold no seals (that you know of).'; return fac.gold >= dip.SEAL_PRICE ? null : `You need ${dip.SEAL_PRICE} gold to make the offer.`;
    }
    return null;
  };

  // Returns { pct, parts: [[label, value], ...] } so the player can see exactly why.
  dip.chance = function (s, f, a) {
    const T = TYPES[a.type], to = a.target, fac = A.F(s, f);
    if (a.type === 'gift') return { pct: 100, parts: [['Gifts are always accepted', 100]] };
    const o = A.O(s, a.envoy), parts = [];
    const add = (l, v) => { v = Math.round(v); if (v) parts.push([l, v]); };
    add('Base for this proposal', T.base);
    add('Relations', A.getRel(s, f, to) * 0.4);
    add(o ? `Envoy ${o.name} (diplomacy ${o.dip})` : 'Envoy', ((o ? o.dip : 50) - 50) * 0.5);
    add('Your record of betrayal', -8 * fac.infamy);
    const ratio = A.strength(s, f) / Math.max(1, A.strength(s, to));
    const cl = A.clamp;
    const atWarElse = A.aliveFactions(s).some((h) => h !== f && h !== to && A.atWar(s, to, h));
    if (a.type === 'pact') { if (atWarElse) add('They are busy with another war', 12); if (ratio > 1.3) add('They fear your strength', 10); }
    if (a.type === 'alliance') { if (dip.sharedEnemy(s, f, to)) add('Shared enemy', 20); const L = dip.leader(s); if (L.f === f && L.n >= 8) add('Wary of your dominance', -15); }
    if (a.type === 'truce') { add('Balance of strength', cl((ratio - 1) * 25, -25, 30)); if (atWarElse) add('They are busy with another war', 10); }
    if (a.type === 'tribute') { add('Balance of strength', cl((ratio - 1) * 30, -40, 40)); if (A.treaty(s, f, to)) add('Demanding from a treaty partner', -10); }
    if (a.type === 'passage') { const t = A.treaty(s, f, to); if (t && t.type === 'pact') add('Existing pact', 10); }
    if (a.type === 'support') { if (dip.sharedEnemy(s, f, to)) add('Shared enemy', 20); if (A.strength(s, a.against) > A.strength(s, to)) add('The target is stronger than they are', -15); add('Their dislike of the target', -A.getRel(s, to, a.against) * 0.2); }
    if (a.type === 'surrender') { add('Balance of strength', cl((ratio - 2) * 20, -30, 50)); if (A.provsOf(s, to).length === 1) add('They hold a single province', 15); }
    if (a.type === 'seal') { if (A.F(s, to).beast.awake) add('They have awakened the Starwyrm', -40); if (A.F(s, to).seals.length >= 2) add('They are gathering seals themselves', -10); }
    if (fac.awe[to]) add('Celestial omen', 25);
    const sum = parts.reduce((n, p) => n + p[1], 0);
    return { pct: A.clamp(sum, 3, 95), parts };
  };

  function addTreaty(s, type, a, b) {
    s.treaties = s.treaties.filter((t) => !(t.type === type && ((t.a === a && t.b === b) || (type !== 'passage' && t.a === b && t.b === a))));
    s.treaties.push({ type, a, b, until: s.turn + TYPES[type].dur });
    if (a === s.player || b === s.player) s.stats.treaties++;
  }

  // Apply an accepted proposal from `from` to `to`. Returns chronicle text.
  dip.apply = function (s, from, to, type, args) {
    const fa = A.F(s, from), fb = A.F(s, to), A_ = A.fname(from), B_ = A.fname(to);
    args = args || {};
    switch (type) {
      case 'gift': { const amt = Math.min(args.amount, fa.gold), o = A.O(s, args.envoy), up = Math.round((amt / 8) * (1 + ((o ? o.dip : 50) - 50) / 100)); fa.gold -= amt; fb.gold += amt; A.addRel(s, from, to, up); return `${A_} sends ${amt} gold to ${B_} (relations +${up}).`; }
      case 'pact': addTreaty(s, 'pact', from, to); A.addRel(s, from, to, 8); return `${A_} and ${B_} seal a non-aggression pact for 8 seasons.`;
      case 'alliance': s.treaties = s.treaties.filter((t) => !(['pact', 'truce'].includes(t.type) && ((t.a === from && t.b === to) || (t.a === to && t.b === from)))); addTreaty(s, 'alliance', from, to); A.setWar(s, from, to, false); A.addRel(s, from, to, 15); return `${A_} and ${B_} swear an alliance for 12 seasons.`;
      case 'truce': A.setWar(s, from, to, false); addTreaty(s, 'truce', from, to); A.addRel(s, from, to, 5); return `${A_} and ${B_} agree a truce for 4 seasons.`;
      case 'tribute': { const amt = Math.min(fb.gold, Math.max(30, Math.round(fb.gold * 0.2))); fb.gold -= amt; fa.gold += amt; A.addRel(s, from, to, -8); return `${B_} pays ${amt} gold in tribute to ${A_} (relations −8).`; }
      case 'passage': addTreaty(s, 'passage', from, to); return `${B_} grants ${A_} passage through its lands for 4 seasons.`;
      case 'support': A.setWar(s, to, args.against, true); A.addRel(s, to, args.against, -30); A.addRel(s, from, to, 5); fb.focus = { target: args.against, until: s.turn + 6 }; return `${B_} honours its alliance with ${A_} and declares war on ${A.fname(args.against)}.`;
      case 'surrender': { for (const p of A.provsOf(s, to)) { for (const a of A.armiesAt(s, p.id, to)) A.addTroops(p.garrison, a.troops); if (p.governor) A.clearJob(s, p.governor); p.owner = from; p.acted = true; p.loyalty = 45; p.unrest = 20; if (p.id === A.CAPITAL) { s.capital.holder = from; s.capital.seasons = 0; } if (from === s.player) s.stats.provincesTaken++; } A.war.eliminate(s, to, from, { peaceful: true }); return `${B_} bends the knee: its lands, soldiers and officers pass to ${A_}.`; }
      case 'seal': { const seal = fb.seals[0]; fa.gold -= dip.SEAL_PRICE; fb.gold += dip.SEAL_PRICE; A.beast.give(s, from, seal, to); A.addRel(s, from, to, -5); return `${B_} parts with the ${A.SEALS[seal]} for ${dip.SEAL_PRICE} gold; it passes to ${A_}.`; }
    }
    return '';
  };

  dip.refuse = function (s, from, to, type) {
    const harsh = type === 'tribute' || type === 'surrender';
    A.addRel(s, from, to, harsh ? -12 : -3);
    return `${A.fname(to)} refuses ${A.fname(from)}'s ${TYPES[type].label.toLowerCase()} (relations ${harsh ? '−12' : '−3'}).`;
  };

  A.actions.envoy = { cost: 1, label: 'Send envoy',
    check: (s, f, a) => dip.check(s, f, a),
    run(s, f, a, fac) {
      const o = A.O(s, a.envoy); o.busy = true;
      const ch = dip.chance(s, f, a);
      const ok = a.type === 'gift' || A.chance(s, ch.pct);
      if (a.type !== 'gift') A.glory.learn(s, o, 'dip', ok ? 2 : 1);
      if (a.type !== 'gift' && fac.awe[a.target]) delete fac.awe[a.target];
      const text = ok ? dip.apply(s, f, a.target, a.type, a) : dip.refuse(s, f, a.target, a.type);
      if (!A.isMe(s, f) && (a.type !== 'gift' || a.target === s.player)) A.log(s, text, 'dip');
      return text;
    } };

  // Break every agreement between a and b. If `betrayer` is set they pay for it in reputation.
  dip.breakTreaties = function (s, a, b, betrayer) {
    const had = A.treaty(s, a, b);
    s.treaties = s.treaties.filter((t) => !((t.a === a && t.b === b) || (t.a === b && t.b === a)));
    if (betrayer && had) {
      const other = betrayer === a ? b : a;
      A.F(s, betrayer).infamy++;
      A.addRel(s, a, b, -40);
      for (const g of A.aliveFactions(s)) if (g !== betrayer && g !== other) A.addRel(s, betrayer, g, -10);
      A.log(s, `${A.fname(betrayer)} breaks its ${had.type} with ${A.fname(other)}! Every court takes note (relations −10 with all, −40 with the betrayed).`, 'dip');
    }
  };

  dip.expire = function (s) {
    const keep = [];
    for (const t of s.treaties) {
      if (t.until > s.turn) { keep.push(t); continue; }
      if (t.a === s.player || t.b === s.player) A.log(s, `Your ${t.type === 'passage' ? 'right of passage' : t.type} with ${A.fname(t.a === s.player ? t.b : t.a)} has expired.`, 'dip');
      else if (t.type === 'alliance') A.log(s, `The alliance between ${A.fname(t.a)} and ${A.fname(t.b)} has lapsed.`, 'dip');
    }
    s.treaties = keep;
  };

  // --- Proposals the AI makes to the human player wait in s.inbox until answered.
  dip.inboxText = function (s, it) {
    const F_ = A.fname(it.from), o = A.O(s, it.envoy), who = o ? o.name : 'An envoy';
    const m = {
      pact: `${who} arrives from ${F_} proposing a non-aggression pact for 8 seasons.`,
      alliance: `${who} arrives from ${F_} proposing a full alliance for 12 seasons.`,
      truce: `${who} arrives under a white banner: ${F_} asks for a 4-season truce.`,
      tribute: `${who} delivers a demand: ${F_} requires tribute of a fifth of your treasury (${Math.min(A.F(s, s.player).gold, Math.max(30, Math.round(A.F(s, s.player).gold * 0.2)))} gold). Refusal means war.`,
      passage: `${who} asks that the armies of ${F_} be allowed to march through your lands for 4 seasons.`,
      support: `${who} invokes your alliance: ${F_} asks you to declare war on ${A.fname(it.args && it.args.against)}.`,
    };
    return m[it.type] || `${F_} sends an envoy.`;
  };
  dip.inboxValid = function (s, it) {
    const from = A.F(s, it.from); if (!from || !from.alive) return false;
    if (it.type === 'truce') return A.atWar(s, it.from, s.player);
    if (it.type === 'pact' || it.type === 'alliance') { const t = A.treaty(s, it.from, s.player); return !A.atWar(s, it.from, s.player) && !(t && (t.type === 'alliance' || t.type === it.type)); }
    if (it.type === 'support') return A.allied(s, it.from, s.player) && A.F(s, it.args.against).alive && !A.atWar(s, s.player, it.args.against);
    if (it.type === 'tribute') return !A.treaty(s, it.from, s.player);
    return true;
  };
  dip.answer = function (s, i, accept) {
    const it = s.inbox.splice(i, 1)[0]; if (!it) return '';
    if (!dip.inboxValid(s, it)) return '';
    let text;
    if (accept) {
      if (it.type === 'support' && A.treaty(s, s.player, it.args.against)) dip.breakTreaties(s, s.player, it.args.against, s.player);
      text = dip.apply(s, it.from, s.player, it.type, it.args); if (it.type !== 'tribute') A.addRel(s, it.from, s.player, 4);
    } else {
      text = dip.refuse(s, it.from, s.player, it.type);
      if (it.type === 'tribute') { A.setWar(s, it.from, s.player, true); text += ` ${A.fname(it.from)} declares war.`; }
    }
    A.log(s, text, 'dip');
    return text;
  };
  dip.autoAnswer = function (s) {
    while (s.inbox.length) {
      const it = s.inbox[0];
      const pct = dip.inboxValid(s, it) ? dip.chance(s, it.from, { type: it.type, target: s.player, envoy: it.envoy, against: it.args && it.args.against }).pct : 0;
      dip.answer(s, 0, A.chance(s, pct));
    }
  };
})();
