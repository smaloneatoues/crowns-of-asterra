// Glory: ambitions (short goals with rewards), veteran officers, rival taunts, campaign score, deeds and the hall of kings.
(function () {
  const A = globalThis.A;
  const G = (A.glory = {});
  const cl = A.clamp;

  // ---------- Ambitions: one short goal at a time for the player, with a deadline and a reward. ----------
  const n = (s, f) => A.provsOf(s, f).length;
  const round = (v, k) => Math.ceil(v / k) * k;
  A.AMBITIONS = {
    expand: { name: 'New banners', seasons: 6, reward: { gold: 220 }, ok: (s, f) => n(s, f) < 20,
      make: (s, f) => ({ goal: n(s, f) + 2 }), text: (x) => `Hold ${x.goal} provinces`, prog: (s, f, x) => [n(s, f), x.goal] },
    victor: { name: 'Blood and glory', seasons: 6, reward: { loyal: 6 }, ok: (s, f) => A.armiesOf(s, f).length > 0,
      make: (s) => ({ from: s.stats.battlesWon, goal: 2 }), text: () => 'Win 2 battles', prog: (s, f, x) => [s.stats.battlesWon - x.from, x.goal] },
    granary: { name: 'Fat granaries', seasons: 5, reward: { gold: 150 }, ok: () => true,
      make: (s, f) => ({ goal: Math.max(900, round(A.F(s, f).food + 500, 100)) }), text: (x) => `Have ${x.goal} food in store`, prog: (s, f, x) => [A.F(s, f).food, x.goal] },
    chest: { name: 'A full war chest', seasons: 5, reward: { men: 200 }, ok: () => true,
      make: (s, f) => ({ goal: Math.max(800, round(A.F(s, f).gold + 450, 50)) }), text: (x) => `Have ${x.goal} gold in the treasury`, prog: (s, f, x) => [A.F(s, f).gold, x.goal] },
    builder: { name: 'Stone and mortar', seasons: 6, reward: { gold: 100, calm: 5 }, ok: (s, f) => A.provsOf(s, f).some((p) => p.fort < 5),
      make: (s, f) => ({ from: G.walls(s, f), goal: 2 }), text: () => 'Raise your walls by 2 levels in total', prog: (s, f, x) => [G.walls(s, f) - x.from, x.goal] },
    beloved: { name: 'A happy people', seasons: 6, reward: { gold: 200 }, ok: (s, f) => A.provsOf(s, f).some((p) => p.loyalty < 60),
      make: () => ({ goal: 60 }), text: (x) => `Get loyalty to ${x.goal} or more in every province you hold`, prog: (s, f, x) => [Math.min(...A.provsOf(s, f).map((p) => p.loyalty)), x.goal] },
    friends: { name: 'Friends at court', seasons: 6, reward: { food: 300 }, ok: (s, f) => A.aliveFactions(s).length > 1,
      make: (s) => ({ from: s.stats.treaties, goal: 1 }), text: () => 'Sign a treaty with another house', prog: (s, f, x) => [s.stats.treaties - x.from, x.goal] },
    stewards: { name: 'A steward in every hall', seasons: 5, reward: { gold: 160 }, ok: (s, f) => A.provsOf(s, f).some((p) => !p.governor) && A.officersOf(s, f).some((o) => !o.job),
      make: (s, f) => ({ goal: Math.min(n(s, f), A.provsOf(s, f).filter((p) => p.governor).length + 1) }), text: (x) => `Have ${x.goal} provinces with a governor`, prog: (s, f, x) => [A.provsOf(s, f).filter((p) => p.governor).length, x.goal] },
    capital: { name: 'The royal city', seasons: 8, reward: { gold: 400 }, ok: (s, f) => s.capital.holder !== f && n(s, f) >= 5,
      make: () => ({ goal: 1 }), text: () => 'Capture Aurelion, the capital', prog: (s, f) => [s.capital.holder === f ? 1 : 0, 1] },
  };
  G.walls = (s) => s.stats.wallsBuilt || 0;
  { const act = A.actions.fortify, run = act.run; act.run = function (s, f, a, fac) { const r = run.call(act, s, f, a, fac); if (f === s.player) s.stats.wallsBuilt = (s.stats.wallsBuilt || 0) + 1; return r; }; }
  G.rewardText = (r) => [r.gold && `${r.gold} gold`, r.food && `${r.food} food`, r.men && `${r.men} infantry join your home castle`, r.loyal && `officer loyalty +${r.loyal}`, r.calm && `province loyalty +${r.calm}`].filter(Boolean).join(', ');
  function reward(s, f, r) {
    const fac = A.F(s, f);
    if (r.gold) fac.gold += r.gold;
    if (r.food) fac.food += r.food;
    if (r.men) A.P(s, fac.seat).garrison.inf += r.men;
    if (r.loyal) for (const o of A.officersOf(s, f)) if (!o.ruler) o.loyalty = cl(o.loyalty + r.loyal, 0, 100);
    if (r.calm) for (const p of A.provsOf(s, f)) p.loyalty = cl(p.loyalty + r.calm, 0, 100);
  }
  // What the player sees: name, goal text, progress, seasons left, reward.
  G.ambView = function (s) {
    const x = s.amb; if (!x || !s.player) return null;
    const D = A.AMBITIONS[x.id], pr = D.prog(s, s.player, x);
    return { name: D.name, text: D.text(x), have: Math.max(0, pr[0]), goal: pr[1], done: pr[0] >= pr[1], left: x.until - s.turn, reward: G.rewardText(D.reward) };
  };
  // Runs at the start of every season: pay out or expire the current ambition, then set a new one.
  G.ambTick = function (s) {
    const f = s.player; if (!f || !A.F(s, f).alive || s.over) return;
    s.ambDone = s.ambDone || 0;
    if (s.amb) {
      const D = A.AMBITIONS[s.amb.id], v = G.ambView(s);
      if (v.done) { reward(s, f, D.reward); s.ambDone++; s.ambNews = { name: D.name, text: v.text, reward: v.reward }; A.log(s, `⚑ Ambition fulfilled — ${D.name}: ${v.reward}.`, 'me'); s.ambLast = s.amb.id; s.amb = null; s.ambNext = s.turn; }
      else if (s.turn >= s.amb.until) { A.log(s, `⚑ The ambition "${D.name}" was not met in time. No harm done; a new one will come.`, 'me'); s.ambLast = s.amb.id; s.amb = null; s.ambNext = s.turn; }
    }
    if (!s.amb && s.turn >= (s.ambNext === undefined ? 1 : s.ambNext)) {
      const ids = Object.keys(A.AMBITIONS).filter((id) => id !== s.ambLast && A.AMBITIONS[id].ok(s, f));
      if (!ids.length) return;
      const id = ids[(s.seed0 + s.turn * 7 + s.ambDone * 3) % ids.length], D = A.AMBITIONS[id];
      s.amb = Object.assign({ id, start: s.turn, until: s.turn + D.seasons }, D.make(s, f));
      A.log(s, `⚑ New ambition — ${D.name}: ${D.text(s.amb)} within ${D.seasons} seasons. Reward: ${G.rewardText(D.reward)}.`, 'me');
    }
  };

  // ---------- Veterans: officers get better at what they actually do. ----------
  const STAT = { lead: 'leadership', admin: 'administration', dip: 'diplomacy' };
  G.MAX_GAIN = 8;
  G.gains = (o) => (o.up ? o.up.lead + o.up.admin + o.up.dip : 0);
  G.rank = (o) => { const g = G.gains(o); return g >= 12 ? 'Legendary' : g >= 7 ? 'Renowned' : g >= 3 ? 'Veteran' : ''; };
  G.learn = function (s, o, stat, pts) {
    if (!o || o.status !== 'active') return;
    o.xp = o.xp || { lead: 0, admin: 0, dip: 0 }; o.up = o.up || { lead: 0, admin: 0, dip: 0 };
    o.xp[stat] += pts;
    for (;;) {
      const need = 3 + 2 * o.up[stat];
      if (o.xp[stat] < need || o.up[stat] >= G.MAX_GAIN || o[stat] >= 99) break;
      o.xp[stat] -= need; o.up[stat]++; o[stat]++;
      if (A.isMe(s, o.faction)) A.log(s, `★ ${o.name} has learned from experience: ${STAT[stat]} is now ${o[stat]}.${G.gains(o) === 3 ? ' They are now a Veteran.' : G.gains(o) === 7 ? ' They are now Renowned.' : G.gains(o) === 12 ? ' They are now Legendary!' : ''}`, 'me');
    }
  };
  G.season = function (s) { for (const o of Object.values(s.officers)) if (o.status === 'active' && o.job && o.job.t === 'gov' && A.F(s, o.faction).alive) G.learn(s, o, 'admin', 1); };

  // ---------- Rival taunts: rulers speak up when land changes hands between them and the player. ----------
  const BARK = {
    lostBold: ['You will choke on %p. I am coming to take it back.', 'Enjoy %p while you can. My riders already know the road.', 'One province! You have only made me angry.'],
    lostCold: ['%p was mine yesterday. It will be mine again; I am patient.', 'A bold move. I will remember it when you ask me for mercy.', 'So that is how you wish to play. Very well.'],
    tookBold: ['%p flies my banner now. Which one shall I take next?', 'Your soldiers ran well at %p. Teach them to fight.', 'Was that all the defence %p had? I expected more.'],
    tookCold: ['%p is safer in my keeping. Do not take it personally.', 'I have relieved you of %p. You were not using it well.', 'Nothing personal. %p was simply in my way.'],
  };
  const oldConquer = A.war.conquer;
  A.war.conquer = function (s, pid, newF, opt) {
    const p = A.P(s, pid), old = p.owner;
    oldConquer(s, pid, newF, opt);
    if (!s.player || s.over || !old || !newF || old === newF) return;
    const other = newF === s.player ? old : old === s.player ? newF : null;
    if (!other || !A.F(s, other).alive || !A.F(s, s.player).alive) return;
    const bold = (A.FDEF[other].ai || {}).agg >= 0.6, set = BARK[(newF === s.player ? 'lost' : 'took') + (bold ? 'Bold' : 'Cold')];
    const r = A.O(s, A.F(s, other).ruler); if (!r) return;
    A.log(s, `❝ ${r.name} of ${A.fname(other)}: "${set[(s.barks = (s.barks || 0) + 1) % set.length].replace('%p', p.name)}"`, 'dip');
  };

  // ---------- Score, rank, deeds ----------
  G.DIFF_MULT = { easy: 0.8, normal: 1, hard: 1.3 };
  G.score = function (s) {
    const st = s.stats, o = s.over, won = o && o.result === 'victory';
    const parts = [['Most provinces held', st.peakProvinces * 40], ['Battles won', st.battlesWon * 25], ['Provinces taken', st.provincesTaken * 30], ['Treaties', st.treaties * 20],
      ['Ambitions fulfilled', (s.ambDone || 0) * 60], ['Seals held', (s.player ? A.F(s, s.player).seals.length : 0) * 50]];
    if (won) { parts.push(['The crown', 1500]); parts.push(['Speed (before Year 20)', Math.max(0, 800 - s.turn * 10)]); }
    const mult = G.DIFF_MULT[s.difficulty] || 1, total = Math.round(parts.reduce((t, x) => t + x[1], 0) * mult);
    const rank = won ? (total >= 4200 ? 'High King of Legend' : total >= 3400 ? 'Great King' : 'King') : total >= 1600 ? 'Duke' : total >= 1000 ? 'Earl' : total >= 500 ? 'Baron' : 'Hedge Knight';
    return { parts, mult, total, rank };
  };
  const mine = (s) => s.player && A.F(s, s.player);
  const won = (s) => s.over && s.over.result === 'victory';
  A.DEEDS = [
    ['blood', 'First Blood', 'Win a battle.', (s) => s.stats.battlesWon >= 1],
    ['eight', 'Lord of Eight', 'Hold 8 provinces at once.', (s) => s.stats.peakProvinces >= 8],
    ['twelve', 'Half the Realm', 'Hold 12 provinces at once.', (s) => s.stats.peakProvinces >= 12],
    ['goal3', 'Go-Getter', 'Fulfil 3 ambitions in one campaign.', (s) => (s.ambDone || 0) >= 3],
    ['goal8', 'Unstoppable', 'Fulfil 8 ambitions in one campaign.', (s) => (s.ambDone || 0) >= 8],
    ['vet', 'Old Guard', 'Have a Renowned officer in your house.', (s) => A.officersOf(s, s.player).some((o) => G.gains(o) >= 7)],
    ['steel', 'Coin for Steel', 'Hire a free company.', (s) => !!A.champ.of(s, s.player)],
    ['tongue', 'Silver Tongue', 'Sign 5 treaties in one campaign.', (s) => s.stats.treaties >= 5],
    ['rich', 'Dragon Hoard', 'Have 3000 gold at once.', (s) => mine(s).gold >= 3000],
    ['wyrm', 'Starcaller', 'Wake the Starwyrm.', (s) => mine(s).beast.awake],
    ['crown', 'Crowned', 'Win a campaign.', (s) => won(s)],
    ['sword', 'By the Sword', 'Win by uniting the realm.', (s) => won(s) && s.over.kind === 'unification'],
    ['quill', 'The Quiet Crown', 'Win by recognized succession.', (s) => won(s) && s.over.kind === 'succession'],
    ['swift', 'Lightning Reign', 'Win before Year 12.', (s) => won(s) && s.turn < 44],
    ['warlord', 'Warlord', 'Win on the hardest difficulty.', (s) => won(s) && s.difficulty === 'hard'],
    ['underdog', 'Underdog', 'Win as a house with a hard start.', (s) => won(s) && /hard/i.test(A.FDEF[s.player].rating || '')],
  ];
  G.deedsMet = function (s) { if (!mine(s)) return []; return A.DEEDS.filter((d) => { try { return d[3](s); } catch (e) { return false; } }).map((d) => d[0]); };

  // ---------- Hall of kings (kept in this browser, across campaigns). Every call is guarded. ----------
  const KEY = 'crowns_of_asterra_hall';
  G.hall = {
    load() { try { const h = JSON.parse(localStorage.getItem(KEY) || '{}'); return { deeds: h.deeds || {}, runs: h.runs || [] }; } catch (e) { return { deeds: {}, runs: [] }; } },
    save(h) { try { localStorage.setItem(KEY, JSON.stringify(h)); } catch (e) { /* ignore */ } },
    // Marks newly met deeds as earned and returns their definitions.
    unlock(s) { const h = G.hall.load(), fresh = []; for (const id of G.deedsMet(s)) if (!h.deeds[id]) { h.deeds[id] = Date.now(); fresh.push(A.DEEDS.find((d) => d[0] === id)); } if (fresh.length) G.hall.save(h); return fresh; },
    record(s) {
      const h = G.hall.load(), sc = G.score(s);
      h.runs.push({ house: A.fname(s.player), won: won(s), kind: s.over ? s.over.kind : '', score: sc.total, rank: sc.rank, date: A.dateStr(s), diff: A.DIFF[s.difficulty].name, at: Date.now() });
      h.runs.sort((a, b) => b.score - a.score); h.runs = h.runs.slice(0, 10); G.hall.save(h);
    },
  };
})();
