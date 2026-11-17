// Core helpers: seeded RNG, state accessors, new game, save/load.
(function () {
  const A = (globalThis.A = globalThis.A || {});

  // mulberry32 keyed on obj.seed so the generator state lives inside the saved game.
  A.rng = {
    next(o) {
      o.seed = (o.seed + 0x6d2b79f5) | 0;
      let t = o.seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
  A.rnd = (s) => A.rng.next(s);
  A.rint = (s, a, b) => a + Math.floor(A.rnd(s) * (b - a + 1));
  A.chance = (s, pct) => A.rnd(s) * 100 < pct;
  A.pick = (s, arr) => arr[Math.floor(A.rnd(s) * arr.length)];
  A.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  A.CLS = ['inf', 'arc', 'cav', 'sie'];
  A.noTroops = () => ({ inf: 0, arc: 0, cav: 0, sie: 0 });
  A.total = (t) => t.inf + t.arc + t.cav + t.sie;
  A.power = (t) => A.CLS.reduce((n, c) => n + t[c] * A.UNITS[c].value, 0);
  A.addTroops = (a, b) => { for (const c of A.CLS) a[c] += b[c] || 0; return a; };
  A.troopStr = (t) => A.CLS.filter((c) => t[c] > 0).map((c) => `${t[c]} ${A.UNITS[c].name.toLowerCase()}`).join(', ') || 'no troops';

  A.F = (s, id) => s.factions[id];
  A.P = (s, id) => s.provinces[id];
  A.O = (s, id) => s.officers[id];
  A.provs = (s) => A.PROV_ORDER.map((id) => s.provinces[id]);
  A.provsOf = (s, f) => A.provs(s).filter((p) => p.owner === f);
  A.armiesOf = (s, f) => s.armies.filter((a) => a.faction === f);
  A.armiesAt = (s, pid, f) => s.armies.filter((a) => a.loc === pid && (f === undefined || a.faction === f));
  A.army = (s, id) => s.armies.find((a) => a.id === id);
  A.officersOf = (s, f) => Object.values(s.officers).filter((o) => o.faction === f && o.status === 'active');
  A.aliveFactions = (s) => A.FIDS.filter((f) => s.factions[f].alive);

  A.relKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  A.getRel = (s, a, b) => s.rel[A.relKey(a, b)] || 0;
  A.addRel = (s, a, b, d) => { if (!a || !b || a === b) return; const k = A.relKey(a, b); s.rel[k] = A.clamp(Math.round((s.rel[k] || 0) + d), -100, 100); };
  A.atWar = (s, a, b) => !!s.wars[A.relKey(a, b)];
  A.setWar = (s, a, b, on) => { if (!a || !b) return; if (on) s.wars[A.relKey(a, b)] = true; else delete s.wars[A.relKey(a, b)]; };
  // Strongest binding treaty between two houses: alliance > pact > truce.
  A.treaty = (s, a, b) => {
    let best = null;
    const rank = { alliance: 3, pact: 2, truce: 1 };
    for (const t of s.treaties) {
      if (!rank[t.type]) continue;
      if ((t.a === a && t.b === b) || (t.a === b && t.b === a)) if (!best || rank[t.type] > rank[best.type]) best = t;
    }
    return best;
  };
  A.allied = (s, a, b) => { const t = A.treaty(s, a, b); return !!t && t.type === 'alliance'; };
  // May `from` march through land owned by `owner`?
  A.passage = (s, from, owner) => owner === from || (owner && (A.allied(s, from, owner) || s.treaties.some((t) => t.type === 'passage' && t.a === from && t.b === owner)));

  A.strength = (s, f) => {
    let n = 0;
    for (const p of A.provsOf(s, f)) n += A.power(p.garrison) + 100;
    for (const a of A.armiesOf(s, f)) n += A.power(a.troops);
    return Math.round(n);
  };
  A.dateStr = (s, turn) => { const t = turn === undefined ? s.turn : turn; return `${A.SEASONS[t % 4]}, Year ${1 + Math.floor(t / 4)}`; };
  A.log = (s, text, kind) => { s.log.push({ t: s.turn, text, k: kind || 'sys' }); if (s.log.length > 500) s.log.splice(0, s.log.length - 500); };
  A.govAdmin = (s, p) => (p.governor && s.officers[p.governor] ? s.officers[p.governor].admin : 0);
  // Each province carries out one command per season.
  A.commandsLeft = (s, f) => A.provsOf(s, f).filter((p) => !p.acted).length;
  A.isMe = (s, f) => f === s.player && !s.autoPlayer;

  A.setGovernor = function (s, pid, oid) {
    const p = A.P(s, pid);
    if (p.governor) { const old = A.O(s, p.governor); if (old) old.job = null; p.governor = null; }
    if (oid) {
      const o = A.O(s, oid);
      if (o.job && o.job.t === 'gov') A.P(s, o.job.p).governor = null;
      o.job = { t: 'gov', p: pid }; o.loc = pid; p.governor = oid;
    }
  };
  A.clearJob = function (s, oid) {
    const o = A.O(s, oid);
    if (!o || !o.job) return;
    if (o.job.t === 'gov') { const p = A.P(s, o.job.p); if (p && p.governor === oid) p.governor = null; }
    o.job = null;
  };
  A.removeArmy = function (s, id) {
    const i = s.armies.findIndex((a) => a.id === id);
    if (i < 0) return;
    const o = A.O(s, s.armies[i].cmd);
    if (o && o.job && o.job.t === 'cmd' && o.job.a === id) o.job = null;
    s.armies.splice(i, 1);
  };

  A.newGame = function (opts) {
    const diff = A.DIFF[opts.difficulty] ? opts.difficulty : 'normal';
    const s = {
      v: 1, seed: (opts.seed >>> 0) || 1, seed0: (opts.seed >>> 0) || 1, turn: 0, difficulty: diff, player: opts.player || null, autoPlayer: !!opts.autoPlayer,
      factions: {}, provinces: {}, officers: {}, armies: [], nextId: 1, rel: {}, treaties: [], wars: {},
      log: [], inbox: [], pendingEvent: null, over: null, capital: { holder: 'val', seasons: 0 }, wanderers: A.WANDERER_DEF.map((w) => w[0]),
      stats: { battlesWon: 0, battlesLost: 0, provincesTaken: 0, provincesLost: 0, treaties: 0, goldEarned: 0, peakProvinces: 0, beastUses: 0, enemiesSlain: 0, menLost: 0 },
      tutorial: 0,
    };
    for (const f of A.FACTIONS) {
      s.factions[f.id] = { id: f.id, gold: f.gold, food: f.food, seat: f.seat, alive: true, ruler: f.ruler, heir: null, seals: f.seals.slice(), infamy: 0, beast: { awake: false, charges: 0 }, orders: 0, awe: {}, focus: null };
    }
    const nb = {};
    for (const [a, b] of A.EDGES) { (nb[a] = nb[a] || []).push(b); (nb[b] = nb[b] || []).push(a); }
    for (const d of A.PROV_DEF) {
      const [id, name, terrain, x, y, owner, pros, farms, fort, resource, landmark] = d;
      const seat = owner && A.FDEF[owner].seat === id;
      const g = A.noTroops();
      if (seat) { g.inf = 500; g.arc = 200; g.cav = 100; A.addTroops(g, A.FDEF[owner].extra); }
      else if (owner) { g.inf = 300; g.arc = 100; }
      else { g.inf = landmark ? 350 : 250; g.arc = landmark ? 150 : 100; }
      s.provinces[id] = { id, name, terrain, x, y, nb: nb[id] || [], owner, governor: null, pros, farms, loyalty: owner ? 60 : 50, unrest: 10, fort, garrison: g, resource, landmark, seal: null, sealKnown: false, searched: false, recruited: 0, levied: false, feted: false, aided: false, acted: false };
    }
    for (const d of A.OFFICER_DEF.concat(A.WANDERER_DEF)) {
      const [id, name, faction, lead, admin, dip, loyalty, trait, bio] = d;
      s.officers[id] = { id, name, faction, lead, admin, dip, loyalty, trait, bio, loc: faction ? A.FDEF[faction].seat : null, job: null, busy: false, rewarded: false, status: faction ? 'active' : 'wanderer', ruler: !!faction && A.FDEF[faction].ruler === id, until: 0 };
    }
    for (const f of A.FACTIONS) A.setGovernor(s, f.seat, f.ruler);
    // Hide three seals among the four ancient sites.
    const sites = A.SEAL_SITES.slice();
    for (let i = sites.length - 1; i > 0; i--) { const j = A.rint(s, 0, i); [sites[i], sites[j]] = [sites[j], sites[i]]; }
    ['winds', 'tides', 'embers'].forEach((seal, i) => { s.provinces[sites[i]].seal = seal; });
    for (const [a, b, v] of A.START_REL) A.addRel(s, a, b, v);
    if (s.player) s.factions[s.player].gold += A.DIFF[diff].playerGold;
    for (const f of A.FIDS) {
      if (A.isMe(s, f)) continue;
      const cands = A.officersOf(s, f).filter((o) => !o.ruler).sort((a, b) => b.loyalty - a.loyalty);
      if (cands[0]) s.factions[f].heir = cands[0].id;
    }
    A.log(s, 'The old king is dead without an heir. Six houses reach for the crown of Asterra.', 'event');
    if (s.player) { s.stats.peakProvinces = A.provsOf(s, s.player).length; A.log(s, `You lead ${A.fname(s.player)}. Unite the realm.`, 'me'); }
    return s;
  };

  // --- Save / load (localStorage). Every call is guarded so a blocked store never crashes the game.
  const KEY = 'crowns_of_asterra_';
  A.SLOTS = ['auto', '1', '2', '3'];
  A.store = {
    ok() { try { return typeof localStorage !== 'undefined' && !!localStorage; } catch (e) { return false; } },
    save(s, slot) {
      try {
        const meta = { house: A.fname(s.player), date: A.dateStr(s), provinces: A.provsOf(s, s.player).length, difficulty: A.DIFF[s.difficulty].name, at: Date.now() };
        localStorage.setItem(KEY + slot, JSON.stringify({ meta, state: s }));
        return { ok: true };
      } catch (e) { return { ok: false, reason: 'Could not write the save: ' + e.message }; }
    },
    meta(slot) { try { const raw = localStorage.getItem(KEY + slot); return raw ? JSON.parse(raw).meta : null; } catch (e) { return null; } },
    load(slot) {
      try {
        const raw = localStorage.getItem(KEY + slot);
        if (!raw) return { ok: false, reason: 'That slot is empty.' };
        const data = JSON.parse(raw);
        const s = data.state;
        if (!s || s.v !== 1 || !s.provinces || !s.factions || !s.officers) return { ok: false, reason: 'That save is damaged or from an incompatible version.' };
        return { ok: true, state: s };
      } catch (e) { return { ok: false, reason: 'Could not read the save: ' + e.message }; }
    },
    remove(slot) { try { localStorage.removeItem(KEY + slot); } catch (e) { /* ignore */ } },
  };
})();
