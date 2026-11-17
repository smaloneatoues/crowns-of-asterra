// Tactical battles on a 10x5 grid. One engine serves commanded battles, delegated battles and AI-vs-AI.
(function () {
  const A = globalThis.A;
  const W = 10, H = 5, WALLX = 6, MAXR = 12;
  const MATCH = {
    melee: { inf: { inf: 1, arc: 1.25, cav: 1.1, sie: 1.5 }, arc: { inf: 1, arc: 1, cav: 0.8, sie: 1.2 }, cav: { inf: 0.9, arc: 1.6, cav: 1, sie: 1.8 }, sie: { inf: 1, arc: 1, cav: 1, sie: 1 } },
    volley: { arc: { inf: 1, arc: 1, cav: 0.9, sie: 1.1 }, sie: { inf: 0.6, arc: 0.6, cav: 0.5, sie: 0.8 } },
  };
  const TILE = {
    plain: { name: 'Open ground', note: 'No effect.' },
    forest: { name: 'Forest', note: 'Defender takes −25% melee, −40% volley damage. Slow; cavalry fight at −30%.' },
    hill: { name: 'Hill', note: 'Defender takes −20% damage. Archers gain +1 range and +15% volley.' },
    marsh: { name: 'Marsh', note: 'Defender takes +10% damage. Slow, worse for cavalry.' },
    wall: { name: 'Wall', note: 'Defenders on a standing wall take far less damage. Attackers cannot pass until it is breached.' },
    rubble: { name: 'Breach', note: 'Defender takes −10% damage. Slow to cross.' },
  };
  const B = (A.battle = { W, H, WALLX, MAXR, TILE, MATCH });
  const other = (side) => (side === 'att' ? 'def' : 'att');
  const rnd = (b) => A.rng.next(b);
  const CO = (u) => (u && u.champ ? A.COMPANIES[u.champ] : null);
  const breaks = (u) => u.morale <= 10 && !(CO(u) && CO(u).steady);
  // Animation events for the battle screen. Only recorded when a screen is watching (b.fxOn).
  const fx = (b, ev) => { if (b.fxOn) b.fx.push(ev); return ev; };

  B.create = function (spec) {
    const b = { W, H, seed: spec.seed >>> 0, spec, grid: [], units: [], round: 1, turn: 'att', lead: { att: spec.att.lead, def: spec.def.lead }, cpMax: {}, cpLeft: 0,
      fx: [], fxOn: false, fort: spec.fort || 0, wallHp: 0, wallMax: 0, over: false, winner: null, reason: '', log: [], beastUsed: { att: false, def: false }, retreated: null, start: { att: { ...spec.att.troops }, def: { ...spec.def.troops } } };
    const siege = b.fort > 0;
    b.wallMax = b.wallHp = b.fort * 50;
    const mix = (A.TERRAIN[spec.terrain] || A.TERRAIN.plains).mix;
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) {
        let t = 'plain';
        if (siege && x === WALLX) t = 'wall';
        else if (x >= 2 && x <= (siege ? 5 : 7)) { const r = rnd(b); if (r < mix.forest) t = 'forest'; else if (r < mix.forest + mix.hill) t = 'hill'; else if (r < mix.forest + mix.hill + mix.marsh) t = 'marsh'; }
        row.push(t);
      }
      b.grid.push(row);
    }
    deploy(b, 'att', spec.att.troops, spec.att.morale || 0, siege, spec.att.champ);
    deploy(b, 'def', spec.def.troops, spec.def.morale || 0, siege, spec.def.champ);
    for (const side of ['att', 'def']) {
      b.cpMax[side] = A.clamp(2 + Math.floor(b.lead[side] / 30), 2, 5);
      const mine = b.units.filter((u) => u.side === side).sort((a, c) => (c.cls === 'inf') - (a.cls === 'inf') || c.men - a.men);
      if (mine[0]) mine[0].leader = true;
    }
    b.cpLeft = b.cpMax.att;
    b.log.push(`${spec.att.name} (${spec.att.cmd}) attacks ${spec.def.name} (${spec.def.cmd})${siege ? ` — walls level ${b.fort}` : ''}.`);
    return b;
  };

  function deploy(b, side, troops, moraleMod, siege, champ) {
    const list = [];
    for (const c of A.CLS) { const n = troops[c] || 0; if (n <= 0) continue; if (c === 'inf' && n > 600) { list.push([c, Math.ceil(n / 2)]); list.push([c, Math.floor(n / 2)]); } else list.push([c, n]); }
    const morale = A.clamp(Math.round(50 + b.lead[side] * 0.3 + moraleMod), 25, 100);
    const rows = [2, 1, 3, 0, 4];
    const place = (cls, men, x, dir, co) => {
      for (let k = 0; k < 3; k++) { const cx = x + dir * k; for (const y of rows) if (!B.unitAt(b, cx, y)) { b.units.push({ id: b.units.length, side, cls, men, start: men, morale: co ? Math.min(100, morale + 12) : morale, x: cx, y, spent: false, hasMoved: false, acted: false, hold: false, routed: false, leader: false, moved: 0, champ: co || null }); return; } }
    };
    if (champ && champ.men > 0 && A.COMPANIES[champ.id]) list.push([A.COMPANIES[champ.id].base, champ.men, champ.id]);
    for (const [cls, men, co] of list) {
      const front = cls === 'inf' || cls === 'cav';
      if (side === 'att') place(cls, men, front ? 1 : 0, -1, co);
      else if (siege) place(cls, men, cls === 'inf' || cls === 'arc' ? WALLX : 8, 1, co);
      else place(cls, men, front ? 8 : 9, 1, co);
    }
  }

  B.unitAt = (b, x, y) => b.units.find((u) => !u.routed && u.x === x && u.y === y);
  B.live = (b, side) => b.units.filter((u) => u.side === side && !u.routed);
  B.men = (b, side) => B.live(b, side).reduce((n, u) => n + u.men, 0);
  B.dist = (a, c) => Math.max(Math.abs(a.x - c.x), Math.abs(a.y - c.y));
  B.wallUp = (b) => b.wallHp > 0;
  B.uname = (b, u) => (CO(u) ? CO(u).name : `${u.side === 'att' ? 'Attacking' : 'Defending'} ${A.UNITS[u.cls].name.toLowerCase()}`);
  B.CO = CO;

  function stepCost(b, u, x, y) {
    const t = b.grid[y][x];
    if (t === 'wall') return B.wallUp(b) && u.side === 'att' ? Infinity : 1;
    if (t === 'plain') return 1;
    if (t === 'marsh') return u.cls === 'cav' ? 3 : 2;
    return 2;
  }
  // Reachable tiles this activation: { "x,y": cost }. A unit with movement left may always enter one more tile.
  B.reach = function (b, u) {
    const mv = A.UNITS[u.cls].move, out = {}, best = { [u.x + ',' + u.y]: 0 }, q = [[u.x, u.y, 0]];
    while (q.length) {
      q.sort((a, c) => a[2] - c[2]);
      const [x, y, c] = q.shift();
      if (c >= mv) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || B.unitAt(b, nx, ny)) continue;
        const sc = stepCost(b, u, nx, ny); if (!isFinite(sc)) continue;
        const nc = c + sc, k = nx + ',' + ny;
        if (best[k] === undefined || nc < best[k]) { best[k] = nc; out[k] = nc; q.push([nx, ny, nc]); }
      }
    }
    return out;
  };
  B.range = function (b, u) { const U = A.UNITS[u.cls]; if (!U.range) return 0; const t = b.grid[u.y][u.x]; return U.range + (u.cls === 'arc' && (t === 'hill' || t === 'wall') ? 1 : 0) + ((CO(u) && CO(u).reach) || 0); };
  B.canVolley = function (b, u, t) { const r = B.range(b, u), d = B.dist(u, t); return r > 0 && u.side !== t.side && !t.routed && d >= 2 && d <= r; };
  B.canMelee = function (b, u, t) {
    if (u.side === t.side || t.routed || B.dist(u, t) !== 1) return false;
    if (B.wallUp(b) && b.grid[t.y][t.x] === 'wall' && u.side === 'att' && u.cls !== 'inf') return false; // only infantry escalade
    return true;
  };
  B.canBatter = function (b, u) {
    if (!B.wallUp(b) || u.side !== 'att') return false;
    if (u.cls === 'sie') return WALLX - u.x <= 4;
    return (u.cls === 'inf' || u.cls === 'cav') && u.x === WALLX - 1;
  };
  B.batterDmg = (u) => Math.round(u.men * (u.cls === 'sie' ? 0.4 : u.cls === 'inf' ? 0.03 : 0.01) * ((CO(u) && CO(u).batter) || 1));

  // Expected damage (before the ±15% roll) with the reasons, so the UI can explain every number.
  B.calc = function (b, u, t, mode, moved) {
    if (moved === undefined) moved = u.moved || 0;
    const U = A.UNITS[u.cls], notes = [], C = CO(u) || {}, TC = CO(t) || {};
    let m = u.men * (mode === 'volley' ? U.ranged * (C.rng || 1) : U.power * (C.pow || 1)) * 0.11;
    if (C.name) notes.push(C.name);
    m *= 0.8 + b.lead[u.side] / 250;
    m *= 0.6 + u.morale / 200;
    const mm = MATCH[mode][u.cls][t.cls]; if (mm !== 1) notes.push(`${U.name} vs ${A.UNITS[t.cls].name.toLowerCase()} ×${mm}`);
    m *= mm;
    const tt = b.grid[t.y][t.x], ut = b.grid[u.y][u.x];
    let tm = 1;
    if (tt === 'forest') tm = mode === 'volley' ? 0.6 : 0.75; else if (tt === 'hill') tm = 0.8; else if (tt === 'marsh') tm = 1.1; else if (tt === 'rubble') tm = 0.9;
    else if (tt === 'wall' && B.wallUp(b) && t.side === 'def') tm = 1 - Math.min(0.6, 0.15 * b.fort);
    if (C.pierce && mode === 'volley' && tm < 1) { tm = 1; notes.push('Their song ignores walls and cover'); }
    if (tm !== 1) notes.push(`Target on ${TILE[tt].name.toLowerCase()} ×${tm.toFixed(2)}`);
    m *= tm;
    if (mode === 'melee' && u.cls === 'cav' && (ut === 'forest' || ut === 'marsh')) { m *= 0.7; notes.push('Cavalry in rough ground ×0.7'); }
    if (mode === 'volley' && u.cls === 'arc' && (ut === 'hill' || ut === 'wall')) { m *= 1.15; notes.push('High ground ×1.15'); }
    if (TC.armor) { m *= TC.armor; notes.push(`${TC.name} armour ×${TC.armor}`); }
    if (t.hold) { const hm = t.cls === 'inf' ? (u.cls === 'cav' && mode === 'melee' && !C.noBrace ? 0.5 : 0.7) : 0.85; m *= hm; notes.push(`Target holding ×${hm}`); }
    let charge = false, flank = false;
    if (mode === 'melee' && u.cls === 'cav' && moved >= 2 && ut !== 'forest' && ut !== 'marsh') { m *= 1.4; charge = true; notes.push('Charge ×1.4'); }
    const escalade = mode === 'melee' && tt === 'wall' && B.wallUp(b) && t.side === 'def';
    if (escalade) { m *= 0.6; notes.push('Escalade up ladders ×0.6'); }
    if (mode === 'melee' && !escalade && b.units.some((x) => x !== u && x.side === u.side && !x.routed && (x.cls === 'inf' || x.cls === 'cav') && B.dist(x, t) === 1)) { m *= 1.25; flank = true; notes.push('Flank ×1.25'); }
    if (mode === 'volley' && moved > 0 && !C.mobile) { m *= 0.75; notes.push('Moved before loosing ×0.75'); }
    let counter = 0;
    if (mode === 'melee') {
      const T = A.UNITS[t.cls];
      counter = t.men * T.power * (TC.pow || 1) * (C.armor || 1) * 0.11 * 0.6 * (0.8 + b.lead[t.side] / 250) * (0.6 + t.morale / 200) * MATCH.melee[t.cls][u.cls];
      if (t.hold && t.cls === 'inf' && u.cls === 'cav' && !C.noBrace) { counter *= 1.5; notes.push('Braced spears: counter ×1.5'); }
      if (escalade) { counter *= 1.3; notes.push('Defenders strike down from the wall: counter ×1.3'); }
      if (ut === 'forest') counter *= 0.75; else if (ut === 'hill') counter *= 0.8;
    }
    return { dmg: Math.round(Math.min(t.men, m)), counter: Math.round(Math.min(u.men, counter)), notes, charge, flank };
  };

  function say(b, text) { b.log.push(text); }
  function hurt(b, t, dmg, flank) {
    dmg = Math.min(t.men, Math.max(0, Math.round(dmg)));
    t.men -= dmg;
    t.morale = Math.max(0, t.morale - (dmg / t.start) * 130 - (flank ? 6 : 0));
    if (!t.routed && (t.men <= t.start * 0.12 || breaks(t))) rout(b, t);
    return dmg;
  }
  function rout(b, t) {
    t.routed = true; t.morale = 0; fx(b, { t: 'rout', id: t.id });
    say(b, `✖ ${B.uname(b, t)} break and flee${t.leader ? ' — their commander is swept away with them!' : '.'}`);
    for (const m of B.live(b, t.side)) { m.morale = Math.max(0, m.morale - (t.leader ? 18 : 8)); }
    for (const m of B.live(b, t.side)) if (breaks(m)) rout(b, m);
    for (const side of ['att', 'def']) if (!b.over && !B.live(b, side).length) finish(b, other(side), 'rout');
  }
  function finish(b, winner, reason) {
    if (b.over) return;
    b.over = true; b.winner = winner; b.reason = reason;
    const w = b.spec[winner].name;
    say(b, reason === 'timeout' ? `Night falls. The attackers cannot break through and withdraw — ${w} holds the field.` : reason === 'retreat' ? `The ${b.retreated === 'att' ? 'attackers' : 'defenders'} sound the retreat. ${w} holds the field.` : `${w} wins the battle.`);
  }
  B.canAct = (b, u) => !b.over && u.side === b.turn && !u.routed && !u.acted && (u.spent || b.cpLeft > 0);
  function pay(b, u) { if (u.spent) return true; if (b.cpLeft <= 0) return false; b.cpLeft--; u.spent = true; return true; }

  B.move = function (b, u, x, y) {
    if (!B.canAct(b, u) || u.hasMoved) return false;
    if (B.reach(b, u)[x + ',' + y] === undefined) return false;
    pay(b, u); u.moved = Math.max(Math.abs(x - u.x), Math.abs(y - u.y)); fx(b, { t: 'move', id: u.id, fx: u.x, fy: u.y, x, y }); u.x = x; u.y = y; u.hasMoved = true; u.hold = false;
    return true;
  };
  B.attack = function (b, u, t) {
    if (!B.canAct(b, u) || !B.canMelee(b, u, t)) return false;
    pay(b, u);
    const f = B.calc(b, u, t, 'melee'), v = () => 0.85 + rnd(b) * 0.3;
    const dmg = Math.round(f.dmg * v()), ctr = Math.round(f.counter * v());
    u.acted = true; u.hold = false;
    const d1 = Math.min(t.men, Math.max(0, dmg)), d2 = Math.min(u.men, Math.max(0, ctr));
    say(b, `${B.uname(b, u)} ${f.charge ? 'CHARGE' : 'attack'} ${B.uname(b, t).toLowerCase()}${f.flank ? ' in the flank' : ''}: ${d1} fall, ${d2} lost in return.`);
    u.morale = Math.min(100, u.morale + 3);
    const ev = fx(b, { t: 'melee', a: u.id, d: t.id, dmg: d1, ctr: d2, charge: f.charge, flank: f.flank });
    hurt(b, t, dmg, f.flank);
    hurt(b, u, ctr, false);
    ev.dm = t.morale; ev.am = u.morale;
    return true;
  };
  B.volley = function (b, u, t) {
    if (!B.canAct(b, u) || !B.canVolley(b, u, t)) return false;
    pay(b, u);
    const f = B.calc(b, u, t, 'volley'), dmg = Math.round(f.dmg * (0.85 + rnd(b) * 0.3));
    u.acted = true; u.hold = false;
    say(b, `${B.uname(b, u)} loose a volley at ${B.uname(b, t).toLowerCase()}: ${Math.min(t.men, Math.max(0, dmg))} fall.`);
    const ev = fx(b, { t: 'volley', a: u.id, d: t.id, dmg: Math.min(t.men, Math.max(0, dmg)), cls: u.cls, song: !!(CO(u) && CO(u).dread) });
    hurt(b, t, dmg, false);
    const C = CO(u);
    if (C && C.dread && !t.routed) { t.morale = Math.max(0, t.morale - C.dread); if (breaks(t)) rout(b, t); }
    ev.dm = t.morale;
    return true;
  };
  B.hold = function (b, u) {
    if (!B.canAct(b, u)) return false;
    pay(b, u); u.acted = true; u.hold = true; u.morale = Math.min(100, u.morale + 5); fx(b, { t: 'hold', id: u.id });
    return true;
  };
  B.batter = function (b, u) {
    if (!B.canAct(b, u) || !B.canBatter(b, u)) return false;
    pay(b, u); u.acted = true; u.hold = false;
    const d = B.batterDmg(u); b.wallHp = Math.max(0, b.wallHp - d); fx(b, { t: 'batter', id: u.id, dmg: d, hp: b.wallHp });
    say(b, `${B.uname(b, u)} batter the wall for ${d} (${b.wallHp}/${b.wallMax} left).`);
    if (b.wallHp <= 0) { for (let y = 0; y < H; y++) b.grid[y][WALLX] = 'rubble'; say(b, '▦ The wall is breached!'); fx(b, { t: 'breach' }); for (const m of B.live(b, 'def')) m.morale = Math.max(11, m.morale - 8); }
    return true;
  };
  // The Starwyrm: once per battle per side. Halved if the victim's house holds any seal (a ward).
  B.starfall = function (b, side) {
    const sp = b.spec.beast && b.spec.beast[side];
    if (b.over || !sp || !sp.avail || b.beastUsed[side]) return false;
    b.beastUsed[side] = true;
    const k = sp.halved ? 0.5 : 1;
    say(b, `☄ ${A.BEAST} descends for ${b.spec[side].name}! Starfire rakes the enemy${sp.halved ? ', blunted by their seal-ward' : ''}.`);
    const hit = [];
    for (const t of B.live(b, other(side))) { const lost = Math.round(t.men * 0.1 * k); t.men -= lost; t.morale = Math.max(0, t.morale - 22 * k); hit.push({ id: t.id, dmg: lost, dm: t.morale }); }
    fx(b, { t: 'star', side, hit });
    for (const t of B.live(b, other(side))) if (breaks(t)) rout(b, t);
    return true;
  };
  B.retreat = function (b, side) { if (b.over) return false; b.retreated = side; finish(b, other(side), 'retreat'); return true; };
  B.endTurn = function (b) {
    if (b.over) return;
    const next = other(b.turn);
    if (next === 'att') { b.round++; if (b.round > MAXR) { finish(b, 'def', 'timeout'); return; } }
    b.turn = next; b.cpLeft = b.cpMax[next];
    for (const u of b.units) if (u.side === next) { u.spent = false; u.hasMoved = false; u.acted = false; u.hold = false; u.moved = 0; }
  };

  // Best tile from which u can melee t this activation (current tile if adjacent). Cavalry prefer a run-up.
  B.approach = function (b, u, t) {
    const here = { x: u.x, y: u.y };
    const opts = [];
    if (B.dist(u, t) === 1) opts.push({ x: u.x, y: u.y, cost: 0, run: 0 });
    if (!u.hasMoved) { const r = B.reach(b, u); for (const k in r) { const [x, y] = k.split(',').map(Number); if (Math.max(Math.abs(x - t.x), Math.abs(y - t.y)) === 1) opts.push({ x, y, cost: r[k], run: Math.max(Math.abs(x - here.x), Math.abs(y - here.y)) }); } }
    let best = null, bs = -1e9;
    for (const o of opts) {
      u.x = o.x; u.y = o.y;
      if (B.canMelee(b, u, t)) { const f = B.calc(b, u, t, 'melee', o.run); const sc = f.dmg - 0.6 * f.counter - o.cost * 0.01; if (sc > bs) { bs = sc; best = { ...o, f, score: sc }; } }
      u.x = here.x; u.y = here.y;
    }
    return best;
  };

  // ---------- Battle AI (also used when the player delegates) ----------
  function stepToward(b, u, goal, keepAway) {
    // goal(x,y) -> score to minimise
    const r = B.reach(b, u); let best = null, bs = goal(u.x, u.y);
    for (const k in r) { const [x, y] = k.split(',').map(Number); if (keepAway && !keepAway(x, y)) continue; const sc = goal(x, y) + r[k] * 0.01; if (sc < bs - 1e-9) { bs = sc; best = [x, y]; } }
    if (best) return B.move(b, u, best[0], best[1]);
    return false;
  }
  const nearest = (b, x, y, es) => es.reduce((m, e) => Math.min(m, Math.max(Math.abs(e.x - x), Math.abs(e.y - y))), 99);

  function aiRanged(b, u, es) {
    const pickT = () => { let bt = null, bv = -1; for (const e of es) if (B.canVolley(b, u, e)) { const f = B.calc(b, u, e, 'volley'); const v = f.dmg + (e.morale < 30 ? 15 : 0); if (v > bv) { bv = v; bt = e; } } return bt; };
    if (u.cls === 'sie' && B.canBatter(b, u)) return B.batter(b, u);
    let t = pickT(); if (t) return B.volley(b, u, t);
    const anchored = u.side === 'def' && B.wallUp(b);
    if (!anchored && !u.hasMoved) {
      if (u.cls === 'sie' && u.side === 'att' && B.wallUp(b)) { stepToward(b, u, (x) => -x); if (B.canBatter(b, u)) return B.batter(b, u); return true; }
      const rg = A.UNITS[u.cls].range;
      // Move to a tile within range of an enemy, as far from enemies as possible; otherwise close the distance.
      const r = B.reach(b, u); let best = null, bs = -1;
      for (const k in r) { const [x, y] = k.split(',').map(Number); const d = nearest(b, x, y, es); if (d >= 2 && d <= rg && d > bs) { bs = d; best = [x, y]; } }
      if (best) B.move(b, u, best[0], best[1]); else stepToward(b, u, (x, y) => Math.abs(nearest(b, x, y, es) - 2));
      t = pickT(); if (t) return B.volley(b, u, t);
    }
    const adj = es.filter((e) => B.canMelee(b, u, e)); if (adj.length && !u.acted) return B.attack(b, u, adj[0]);
    if (!u.spent) return false;
    return true;
  }
  function aiMelee(b, u, es) {
    const wall = B.wallUp(b);
    let bt = null, bs = -1e9;
    if (u.side === 'def' && wall) {
      for (const e of es) if (B.canMelee(b, u, e)) { const f = B.calc(b, u, e, 'melee'); if (f.dmg > bs) { bs = f.dmg; bt = e; } }
      return bt ? B.attack(b, u, bt) : B.hold(b, u);
    }
    for (const e of es) { const o = B.approach(b, u, e); if (o) { const sc = o.score + (e.cls === 'arc' || e.cls === 'sie' ? 12 : 0) + (e.morale < 30 ? 15 : 0); if (sc > bs) { bs = sc; bt = { e, o }; } } }
    if (u.side === 'att' && wall) {
      // Escalade only when it is not suicidal; otherwise get to the wall and batter it.
      if (bt && u.cls === 'inf' && bt.o.f.dmg >= bt.o.f.counter * 0.8) { if (bt.o.x !== u.x || bt.o.y !== u.y) B.move(b, u, bt.o.x, bt.o.y); return B.attack(b, u, bt.e); }
      if (u.cls === 'cav') { if (u.x < WALLX - 2) stepToward(b, u, (x) => Math.abs(x - (WALLX - 2))); return B.hold(b, u); }
      if (u.x !== WALLX - 1) stepToward(b, u, (x, y) => Math.abs(x - (WALLX - 1)) + Math.abs(y - u.y) * 0.1);
      if (B.canBatter(b, u)) return B.batter(b, u);
      return u.spent ? true : B.hold(b, u);
    }
    if (bt) { if (bt.o.x !== u.x || bt.o.y !== u.y) B.move(b, u, bt.o.x, bt.o.y); return B.attack(b, u, bt.e); }
    if (u.side === 'def' && b.round <= 2 && nearest(b, u.x, u.y, es) > 3) return B.hold(b, u);
    const moved = stepToward(b, u, (x, y) => nearest(b, x, y, es));
    return moved ? true : B.hold(b, u);
  }
  B.aiTurn = function (b, opt) {
    if (b.over) return;
    const side = b.turn, my = B.men(b, side), en = B.men(b, other(side));
    if (!(opt && opt.noRetreat) && b.round >= 3 && ((side === 'att' && my < en * 0.4) || (side === 'def' && b.fort === 0 && my < en * 0.2))) { B.retreat(b, side); return; }
    const sp = b.spec.beast && b.spec.beast[side];
    if (sp && sp.avail && sp.auto && !b.beastUsed[side] && b.round >= 2 && en >= my * 0.8) B.starfall(b, side);
    const order = { sie: 0, arc: 1, cav: 2, inf: 3 };
    const mine = B.live(b, side).sort((a, c) => order[a.cls] - order[c.cls] || c.men - a.men);
    for (const u of mine) {
      if (b.over) return;
      if (u.routed || !B.canAct(b, u)) continue;
      const es = B.live(b, other(side)); if (!es.length) break;
      if (u.cls === 'arc' || u.cls === 'sie') aiRanged(b, u, es); else aiMelee(b, u, es);
    }
    B.endTurn(b);
  };
  B.autoResolve = function (b) { let guard = 0; while (!b.over && guard++ < 200) B.aiTurn(b); if (!b.over) finish(b, 'def', 'timeout'); };

  B.left = function (b, side) { const t = A.noTroops(); for (const u of b.units) if (u.side === side && !u.champ) t[u.cls] += u.routed ? Math.floor(u.men * 0.5) : u.men; return t; };
  // Survivors of a side's free company (null if it brought none).
  B.champLeft = function (b, side) { const u = b.units.find((x) => x.side === side && x.champ); return u ? { id: u.champ, men: u.routed ? Math.floor(u.men * 0.5) : u.men } : null; };
  B.result = function (b) {
    const r = { winner: b.winner, reason: b.reason, rounds: Math.min(b.round, MAXR), retreated: b.retreated, beastUsed: { ...b.beastUsed }, breached: b.fort > 0 && b.wallHp <= 0 };
    for (const side of ['att', 'def']) { const left = B.left(b, side), start = b.start[side]; r[side] = { start: { ...start }, left, lost: A.total(start) - A.total(left), champ: B.champLeft(b, side) }; }
    return r;
  };
})();
