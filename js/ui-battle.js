// Tactical battle screen for battles the player commands in person.
(function () {
  const A = globalThis.A, B = A.battle, H = A.uiH, esc = A.esc;
  const $ = (q) => document.querySelector(q);
  const bu = (A.battleUI = { b: null, side: null, sel: null, resolve: null, mark: 0, confirmRetreat: false, view: [], anim: false, skip: false, skipAll: false, watch: false });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const snap = (b) => b.units.map((u) => ({ ...u }));
  const DUR = { move: 240, melee: 520, volley: 520, hold: 150, batter: 480, breach: 800, rout: 520, star: 1300 };

  // opt.watch: the player's officer fights the battle while the player looks on.
  bu.play = function (b, side, opt) {
    return new Promise((res) => {
      Object.assign(bu, { b, side, sel: null, resolve: res, mark: 0, confirmRetreat: false, anim: false, skip: false, skipAll: false, rang: false, watch: !!(opt && opt.watch) });
      b.fxOn = true; b.fx = []; bu.view = snap(b);
      $('#battle').hidden = false; A.sfx.setMode('battle'); A.sfx.play('horn');
      draw();
      if (bu.watch) runWatch();
      else if (b.turn !== side) { bu.mark = b.log.length; B.aiTurn(b); flush(); }
    });
  };

  // Play the queued battle events one at a time, moving the on-screen units from where they were to where they are.
  function apply(ev) {
    const v = bu.view, hit = (id, dmg, dm) => { const u = v[id]; u.men = Math.max(0, u.men - dmg); if (dm !== undefined) u.morale = dm; };
    if (ev.t === 'move') { v[ev.id].x = ev.x; v[ev.id].y = ev.y; v[ev.id].hold = false; }
    else if (ev.t === 'melee') { hit(ev.d, ev.dmg, ev.dm); hit(ev.a, ev.ctr, ev.am); v[ev.a].hold = false; }
    else if (ev.t === 'volley') hit(ev.d, ev.dmg, ev.dm);
    else if (ev.t === 'hold') v[ev.id].hold = true;
    else if (ev.t === 'rout') v[ev.id].routed = true;
    else if (ev.t === 'star') for (const h of ev.hit) hit(h.id, h.dmg, h.dm);
  }
  function sound(ev) {
    const v = bu.view;
    if (ev.t === 'move') A.sfx.play(v[ev.id].cls === 'cav' ? 'gallop' : 'step', 90);
    else if (ev.t === 'melee') A.sfx.play(ev.charge ? 'charge' : 'clash');
    else if (ev.t === 'volley') A.sfx.play(ev.song ? 'song' : ev.cls === 'sie' ? 'stone' : 'arrow');
    else if (ev.t === 'batter') A.sfx.play('stone');
    else A.sfx.play({ hold: 'hold', breach: 'breach', rout: 'rout', star: 'star' }[ev.t]);
  }
  async function flush() {
    const b = bu.b; if (!b || bu.anim) return;
    bu.anim = true;
    while (b.fx.length) {
      const ev = b.fx.shift(); apply(ev);
      if (bu.skip || bu.skipAll) continue;
      draw(ev); sound(ev);
      await sleep(DUR[ev.t] || 300);
      if (bu.b !== b) return;
    }
    bu.anim = false; bu.skip = false; bu.view = snap(b);
    const u = selUnit(); if (!u || u.acted || u.routed || b.over) bu.sel = null;
    draw();
    if (b.over && !bu.rang) { bu.rang = true; A.sfx.play(b.winner === bu.side ? 'win' : 'lose'); }
  }
  async function runWatch() {
    const b = bu.b; bu.watch = true; bu.sel = null; let guard = 0;
    while (bu.b === b && !b.over && guard++ < 200) { bu.mark = b.log.length; B.aiTurn(b); await flush(); if (!bu.skipAll) await sleep(120); }
    if (bu.b === b) { if (!b.over) B.autoResolve(b); await flush(); draw(); }
  }
  const color = (side) => A.fcolor(bu.b.spec[side].f);
  const selUnit = () => (bu.sel == null ? null : bu.b.units[bu.sel]);
  const myTurn = () => !bu.b.over && bu.b.turn === bu.side;

  function cannotAct(u) {
    const b = bu.b;
    if (u.routed) return 'That unit has fled the field.';
    if (u.acted) return 'That unit has already acted this round.';
    if (!u.spent && b.cpLeft <= 0) return `No command points left this round. Your commander's leadership allows ${b.cpMax[bu.side]} units to act per round. End the turn.`;
    return 'That unit cannot act now.';
  }
  function whyNoAttack(u, t) {
    const b = bu.b, d = B.dist(u, t), r = B.range(b, u);
    if (B.wallUp(b) && u.side === 'att' && t.x > B.WALLX) return 'The wall stands between you. Breach it (batter with siege crews or infantry at its foot) or strike the defenders standing on it.';
    if (B.wallUp(b) && u.side === 'att' && b.grid[t.y][t.x] === 'wall' && u.cls !== 'inf' && !r) return 'Only infantry can escalade a standing wall.';
    if (r && d > r) return `Out of range: ${d} tiles away, and ${A.UNITS[u.cls].name.toLowerCase()} reach ${r}.`;
    if (r && d < 2 && u.cls === 'sie') return 'Siege engines cannot fire at an enemy this close.';
    if (u.hasMoved) return 'Out of reach: this unit has already moved this round.';
    return 'Out of reach this round. Move closer first.';
  }

  const vAt = (x, y, ev) => bu.view.find((u) => u.x === x && u.y === y && (!u.routed || (ev && ev.t === 'rout' && ev.id === u.id)));
  const sgn = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);
  function draw(ev) {
    const b = bu.b, el = $('#battle'), live = !bu.anim && !bu.watch, u = live ? selUnit() : null, can = u && myTurn() && B.canAct(b, u);
    const V = bu.view, fxu = {}, fxt = {};
    const mark = (id, cls, style, extra) => { const o = (fxu[id] = fxu[id] || { cls: '', style: '', extra: '' }); o.cls += ' ' + cls; o.style += style || ''; o.extra += extra || ''; };
    const dmgTag = (n) => (n > 0 ? `<span class="dmg">−${n}</span>` : '');
    if (ev) {
      if (ev.t === 'move') mark(ev.id, 'fx-move', `--dx:${ev.fx - ev.x};--dy:${ev.fy - ev.y};`);
      else if (ev.t === 'melee') { const a = V[ev.a], d = V[ev.d]; mark(ev.a, ev.charge ? 'fx-lunge fx-charge' : 'fx-lunge', `--dx:${sgn(d.x - a.x)};--dy:${sgn(d.y - a.y)};`, dmgTag(ev.ctr)); mark(ev.d, 'fx-hit', '', dmgTag(ev.dmg) + (ev.flank ? '<span class="tagfx">flank!</span>' : ev.charge ? '<span class="tagfx">charge!</span>' : '')); }
      else if (ev.t === 'volley') { const a = V[ev.a], d = V[ev.d]; mark(ev.a, 'fx-loose', '', `<i class="shot ${ev.song ? 'song' : ev.cls === 'sie' ? 'rock' : ''}" style="--dx:${d.x - a.x};--dy:${d.y - a.y};--rot:${Math.atan2(d.y - a.y, d.x - a.x)}rad"></i>`); mark(ev.d, 'fx-hit late', '', dmgTag(ev.dmg)); }
      else if (ev.t === 'hold') mark(ev.id, 'fx-hold');
      else if (ev.t === 'rout') mark(ev.id, 'fx-rout', `--dx:${V[ev.id].side === 'att' ? -1 : 1};`);
      else if (ev.t === 'batter') { mark(ev.id, 'fx-lunge', '--dx:1;--dy:0;'); fxt.wall = 'fx-wallhit'; }
      else if (ev.t === 'breach') fxt.rubble = 'fx-breach';
      else if (ev.t === 'star') for (const h of ev.hit) mark(h.id, 'fx-hit fx-burn', '', dmgTag(h.dmg));
    }
    const reach = can && !u.hasMoved ? B.reach(b, u) : {};
    const tv = {}, tm = {};
    if (can) for (const e of B.live(b, bu.side === 'att' ? 'def' : 'att')) { if (B.canVolley(b, u, e)) tv[e.id] = 1; else if (B.approach(b, u, e)) tm[e.id] = 1; }
    let grid = '';
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) {
      const t = b.grid[y][x], w = vAt(x, y, ev), T = B.TILE[t];
      let cls = 't t-' + t; if (reach[x + ',' + y] !== undefined) cls += ' reach'; if (fxt[t]) cls += ' ' + fxt[t];
      let inner = '';
      if (w) {
        const mine = w.side === bu.side, ready = live && mine && myTurn() && B.canAct(b, b.units[w.id]), f = fxu[w.id] || { cls: '', style: '', extra: '' };
        if (tv[w.id]) cls += ' tgt-v'; if (tm[w.id]) cls += ' tgt-m'; if (f.cls) cls += ' top';
        inner = `<div class="u ${w.side} ${w.champ ? 'champ' : ''} ${bu.sel === w.id ? 'sel' : ''} ${live && mine && !ready && myTurn() ? 'done' : ''} ${ready ? 'ready' : ''}${f.cls}" style="--c:${color(w.side)};${f.style}"><span class="ug">${A.art.unit(w.cls, 22)}</span><span class="ub">${w.champ ? '✪' : ''}${w.leader ? '★' : ''}${w.hold ? '⛨' : ''}</span><span class="un">${w.men}</span><span class="um"><i style="width:${Math.round(w.morale)}%"></i></span>${f.extra}</div>`;
      }
      const wc = w && B.CO(w);
      const tip = `${T.name}: ${T.note}${w ? `\n${wc ? wc.name + ' (free company) — ' + wc.desc + '\n' : ''}${A.UNITS[w.cls].name} — ${w.men}/${w.start} men, morale ${Math.round(w.morale)}${w.leader ? ', commander present' : ''}${w.hold ? ', holding' : ''}` : ''}`;
      grid += `<div class="${cls}" data-a="bt" data-x="${x}" data-y="${y}" title="${esc(tip)}">${inner}</div>`;
    }
    const sideBox = (side) => { const sp = b.spec[side]; return `<div class="bside-h" style="--c:${color(side)}">${A.art.crest(sp.f, 44)}<div><b>${esc(sp.name)}</b> ${side === bu.side ? '(you)' : ''}<br><small>${side === 'att' ? 'Attacking' : 'Defending'} · ${esc(sp.cmd)} · leadership ${sp.lead} · ${b.cpMax[side]} activations/round</small><br><small>${vmen(side)} men standing in ${vn(side)} units</small></div></div>`; };
    let panel = '';
    const vmen = (side) => V.filter((x) => x.side === side && !x.routed).reduce((n, x) => n + x.men, 0), vn = (side) => V.filter((x) => x.side === side && !x.routed).length;
    if (!live && !(b.over && !bu.anim)) {
      panel = `<div class="bturn">Round <b>${b.round}</b> / ${B.MAXR}${b.fort ? ` · Wall ${b.wallHp}/${b.wallMax}` : ''} · ${bu.watch ? `${esc(b.spec[bu.side].cmd)} commands for you` : 'The battle rages…'}</div>
        <div class="bunit note">${bu.watch ? 'Your officer is fighting this battle. Watch it unfold, or skip straight to the result.' : 'Click anywhere on the field to speed this up.'}</div>
        <div class="row"><button class="go" data-a="bskip">${bu.watch ? 'Skip to the result ▶▶' : 'Speed up ▶▶'}</button></div>`;
    } else if (b.over) {
      const won = b.winner === bu.side;
      panel = `<div class="bover ${won ? 'pos' : 'neg'}"><h2>${won ? '✔ The field is yours' : '✖ The day is lost'}</h2><p>${esc(b.log[b.log.length - 1])}</p><button class="go big" data-a="bdone">Continue ▶</button></div>`;
    } else {
      const sp = b.spec.beast[bu.side];
      panel = `<div class="bturn">Round <b>${b.round}</b> / ${B.MAXR} · ${myTurn() ? `Your turn · <b>${b.cpLeft}</b> of ${b.cpMax[bu.side]} activations left` : 'Enemy turn'}${b.fort ? ` · Wall ${b.wallHp}/${b.wallMax}` : ''}</div>`;
      if (u && !u.routed) {
        const U = A.UNITS[u.cls], tile = B.TILE[b.grid[u.y][u.x]];
        panel += `<div class="bunit"><b>${U.name}</b>${u.leader ? ' ★ commander' : ''} — ${u.men}/${u.start} men, morale ${Math.round(u.morale)}<br><small>${esc(U.desc)}</small><br><small>Standing on ${tile.name.toLowerCase()}. ${u.hasMoved ? 'Has moved; may still act.' : `Moves ${U.move}.`}${U.range ? ` Range 2–${B.range(b, u)}.` : ''}</small>
          <div class="row"><button data-a="bhold" ${can ? '' : 'disabled'} title="End this unit's activation braced: it takes less damage until your next turn and gains 5 morale. Braced infantry punish cavalry.">Hold ⛨</button>
          <button data-a="bbatter" ${can && B.canBatter(b, u) ? '' : 'disabled'} title="${B.wallUp(b) ? (bu.side === 'att' ? `Damage the wall by about ${B.batterDmg(u)}. Siege crews batter from 4 tiles; infantry and cavalry must stand at its foot.` : 'Defenders do not batter their own wall.') : 'There is no standing wall.'}">Batter wall</button></div></div>`;
      } else panel += `<div class="bunit note">${myTurn() ? 'Click one of your units (bright border), then a highlighted tile to move or an enemy to attack. Hover an enemy to preview the blow.' : ''}</div>`;
      panel += `<div id="bfc" class="bfc"></div>
        <div class="row"><button class="go" data-a="bend" ${myTurn() ? '' : 'disabled'}>End turn ▶</button><button data-a="bauto" ${myTurn() ? '' : 'disabled'} title="Your commander handles the rest of this round.">Auto round</button><button data-a="bfinish" title="Hand the rest of the battle to your commander.">Delegate rest</button></div>
        <div class="row"><button data-a="bstar" ${sp && sp.avail && !b.beastUsed[bu.side] && myTurn() ? '' : 'disabled'} title="${sp && sp.avail ? (b.beastUsed[bu.side] ? 'Already used this battle.' : `Starfall: every enemy unit loses ${sp.halved ? 5 : 10}% of its men and ${sp.halved ? 11 : 22} morale${sp.halved ? ' (halved by their seal-ward)' : ''}. Costs 1 starfire charge and −4 relations with every house.`) : 'The Starwyrm is not yours to call: it must be awake with a charge remaining.'}">☄ Starfall</button>
        <button data-a="bretreat" class="${bu.confirmRetreat ? 'danger' : ''}" title="Withdraw in good order: lighter losses than a rout and your commander is safe, but the battle is lost.">${bu.confirmRetreat ? 'Confirm retreat?' : 'Retreat'}</button></div>`;
    }
    const log = b.log.map((l, i) => `<div class="${i >= bu.mark ? 'new' : ''}">${esc(l)}</div>`).join('');
    el.innerHTML = `<div class="bwrap ${ev && ev.t === 'star' ? 'fx-star' : ''} ${ev && ev.t === 'breach' ? 'fx-quake' : ''}"><div class="bhead">${sideBox('att')}<div class="vs">⚔<br><small>${esc(A.P(A.ui.s, b.spec.pid).name)}</small></div>${sideBox('def')}</div>
      <div class="bmain"><div class="bgrid">${grid}</div><div class="bpanel">${panel}<div class="blog" id="blogb">${log}</div></div></div>
      <div class="bkey">${A.CLS.map((c) => A.art.unit(c, 15) + ' ' + A.UNITS[c].name.toLowerCase()).join(' · ')} · ✪ free company · ★ commander · ⛨ holding · bar = morale · <span class="k-reach">■</span> can move · <span class="k-m">■</span> can attack · <span class="k-v">■</span> can volley</div></div>`;
    const lg = $('#blogb'); if (lg) lg.scrollTop = lg.scrollHeight;
  }

  function after() { bu.confirmRetreat = false; flush(); }
  const locked = () => { if (bu.anim || bu.watch) { if (bu.anim && !bu.watch) bu.skip = true; return true; } return false; };
  H.bskip = () => { if (bu.watch) bu.skipAll = true; else bu.skip = true; };
  H.bt = (d) => {
    const b = bu.b; if (!b || locked() || !myTurn()) return;
    const x = +d.x, y = +d.y, w = B.unitAt(b, x, y), u = selUnit();
    if (w && w.side === bu.side) { if (B.canAct(b, w)) bu.sel = w.id; else A.toast(cannotAct(w)); return draw(); }
    if (!u || !B.canAct(b, u)) { A.toast('Select one of your units first.'); A.sfx.play('deny'); return; }
    if (w) {
      if (B.canVolley(b, u, w)) { B.volley(b, u, w); return after(); }
      const ap = B.approach(b, u, w);
      if (ap) { if (ap.x !== u.x || ap.y !== u.y) B.move(b, u, ap.x, ap.y); B.attack(b, u, w); return after(); }
      A.toast(whyNoAttack(u, w)); return;
    }
    if (u.hasMoved) { A.toast('This unit has already moved this round. It can still attack, volley, hold or batter.'); return; }
    if (!B.move(b, u, x, y)) { A.toast(b.grid[y][x] === 'wall' && B.wallUp(b) && u.side === 'att' ? 'The wall is still standing; you cannot cross it.' : `Too far. ${A.UNITS[u.cls].name} move ${A.UNITS[u.cls].move}; forest, hills, marsh and rubble cost double.`); return; }
    after();
  };
  H.bhold = () => { const u = selUnit(); if (!locked() && u && B.hold(bu.b, u)) after(); };
  H.bbatter = () => { const u = selUnit(); if (!locked() && u && B.batter(bu.b, u)) after(); };
  H.bend = () => { const b = bu.b; if (locked() || !myTurn()) return; bu.mark = b.log.length; B.endTurn(b); if (!b.over) B.aiTurn(b); bu.sel = null; bu.confirmRetreat = false; flush(); };
  H.bauto = () => { const b = bu.b; if (locked() || !myTurn()) return; bu.mark = b.log.length; B.aiTurn(b, { noRetreat: true }); if (!b.over) B.aiTurn(b); bu.sel = null; flush(); };
  H.bfinish = () => { const b = bu.b; if (b.over || locked()) return; if (b.turn !== bu.side) return; runWatch(); };
  H.bstar = () => { if (!locked() && myTurn() && B.starfall(bu.b, bu.side)) { bu.sel = null; flush(); } };
  H.bretreat = () => { if (bu.b.over || locked()) return; if (!bu.confirmRetreat) { bu.confirmRetreat = true; return draw(); } B.retreat(bu.b, bu.side); flush(); };
  H.bdone = () => { const r = bu.resolve; bu.resolve = null; bu.b.fxOn = false; bu.b.fx = []; bu.b = null; bu.rang = false; A.sfx.setMode('map'); $('#battle').hidden = true; $('#battle').innerHTML = ''; if (r) r(); };

  document.addEventListener('mouseover', (e) => {
    const b = bu.b, box = $('#bfc'); if (!b || !box || b.over || bu.anim || bu.watch) return;
    const el = e.target.closest('.t'); if (!el) return;
    const u = selUnit(), w = B.unitAt(b, +el.dataset.x, +el.dataset.y);
    if (!u || !w || w.side === bu.side || !myTurn() || !B.canAct(b, u)) { box.innerHTML = ''; return; }
    let f = null, verb = '';
    if (B.canVolley(b, u, w)) { f = B.calc(b, u, w, 'volley'); verb = 'Volley'; } else { const ap = B.approach(b, u, w); if (ap) { f = ap.f; verb = f.charge ? 'Charge' : 'Attack'; } }
    box.innerHTML = f ? `<b>${verb}</b> ${A.UNITS[w.cls].name.toLowerCase()}: about <b>${f.dmg}</b> of ${w.men} fall${verb === 'Volley' ? '' : `, about <b>${f.counter}</b> of yours in return`} (±15%).<br><small>${f.notes.map(esc).join(' · ') || 'No modifiers.'}</small>` : `<span class="why">✖ ${esc(whyNoAttack(u, w))}</span>`;
  });
})();
