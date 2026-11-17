// Tactical battle screen for battles the player commands in person.
(function () {
  const A = globalThis.A, B = A.battle, H = A.uiH, esc = A.esc;
  const $ = (q) => document.querySelector(q);
  const bu = (A.battleUI = { b: null, side: null, sel: null, resolve: null, mark: 0, confirmRetreat: false });

  bu.play = function (b, side) {
    return new Promise((res) => {
      Object.assign(bu, { b, side, sel: null, resolve: res, mark: 0, confirmRetreat: false });
      $('#battle').hidden = false;
      if (b.turn !== side) { bu.mark = b.log.length; B.aiTurn(b); }
      draw();
    });
  };
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

  function draw() {
    const b = bu.b, el = $('#battle'), u = selUnit(), can = u && myTurn() && B.canAct(b, u);
    const reach = can && !u.hasMoved ? B.reach(b, u) : {};
    const tv = {}, tm = {};
    if (can) for (const e of B.live(b, bu.side === 'att' ? 'def' : 'att')) { if (B.canVolley(b, u, e)) tv[e.id] = 1; else if (B.approach(b, u, e)) tm[e.id] = 1; }
    let grid = '';
    for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) {
      const t = b.grid[y][x], w = B.unitAt(b, x, y), T = B.TILE[t];
      let cls = 't t-' + t; if (reach[x + ',' + y] !== undefined) cls += ' reach';
      let inner = '';
      if (w) {
        const U = A.UNITS[w.cls], mine = w.side === bu.side, ready = mine && myTurn() && B.canAct(b, w);
        if (tv[w.id]) cls += ' tgt-v'; if (tm[w.id]) cls += ' tgt-m';
        inner = `<div class="u ${w.side} ${bu.sel === w.id ? 'sel' : ''} ${mine && !ready && myTurn() ? 'done' : ''} ${ready ? 'ready' : ''}" style="--c:${color(w.side)}"><span class="ug">${A.art.unit(w.cls, 22)}</span><span class="ub">${w.leader ? '★' : ''}${w.hold ? '⛨' : ''}</span><span class="un">${w.men}</span><span class="um"><i style="width:${Math.round(w.morale)}%"></i></span></div>`;
      }
      const tip = `${T.name}: ${T.note}${w ? `\n${A.UNITS[w.cls].name} — ${w.men}/${w.start} men, morale ${Math.round(w.morale)}${w.leader ? ', commander present' : ''}${w.hold ? ', holding' : ''}` : ''}`;
      grid += `<div class="${cls}" data-a="bt" data-x="${x}" data-y="${y}" title="${esc(tip)}">${inner}</div>`;
    }
    const sideBox = (side) => { const sp = b.spec[side]; return `<div class="bside-h" style="--c:${color(side)}">${A.art.crest(sp.f, 44)}<div><b>${esc(sp.name)}</b> ${side === bu.side ? '(you)' : ''}<br><small>${side === 'att' ? 'Attacking' : 'Defending'} · ${esc(sp.cmd)} · leadership ${sp.lead} · ${b.cpMax[side]} activations/round</small><br><small>${B.men(b, side)} men standing in ${B.live(b, side).length} units</small></div></div>`; };
    let panel = '';
    if (b.over) {
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
    el.innerHTML = `<div class="bwrap"><div class="bhead">${sideBox('att')}<div class="vs">⚔<br><small>${esc(A.P(A.ui.s, b.spec.pid).name)}</small></div>${sideBox('def')}</div>
      <div class="bmain"><div class="bgrid">${grid}</div><div class="bpanel">${panel}<div class="blog" id="blogb">${log}</div></div></div>
      <div class="bkey">${A.CLS.map((c) => A.art.unit(c, 15) + ' ' + A.UNITS[c].name.toLowerCase()).join(' · ')} · ★ commander · ⛨ holding · bar = morale · <span class="k-reach">■</span> can move · <span class="k-m">■</span> can attack · <span class="k-v">■</span> can volley</div></div>`;
    const lg = $('#blogb'); if (lg) lg.scrollTop = lg.scrollHeight;
  }

  function after() { const u = selUnit(); if (!u || u.acted || u.routed || bu.b.over) bu.sel = null; bu.confirmRetreat = false; draw(); }
  H.bt = (d) => {
    const b = bu.b; if (!b || !myTurn()) return;
    const x = +d.x, y = +d.y, w = B.unitAt(b, x, y), u = selUnit();
    if (w && w.side === bu.side) { if (B.canAct(b, w)) bu.sel = w.id; else A.toast(cannotAct(w)); return draw(); }
    if (!u || !B.canAct(b, u)) { A.toast('Select one of your units first.'); return; }
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
  H.bhold = () => { const u = selUnit(); if (u && B.hold(bu.b, u)) after(); };
  H.bbatter = () => { const u = selUnit(); if (u && B.batter(bu.b, u)) after(); };
  H.bend = () => { const b = bu.b; if (!myTurn()) return; bu.mark = b.log.length; B.endTurn(b); if (!b.over) B.aiTurn(b); bu.sel = null; bu.confirmRetreat = false; draw(); };
  H.bauto = () => { const b = bu.b; if (!myTurn()) return; bu.mark = b.log.length; B.aiTurn(b, { noRetreat: true }); if (!b.over) B.aiTurn(b); bu.sel = null; draw(); };
  H.bfinish = () => { const b = bu.b; if (b.over) return; bu.mark = b.log.length; B.autoResolve(b); bu.sel = null; draw(); };
  H.bstar = () => { if (myTurn() && B.starfall(bu.b, bu.side)) { bu.sel = null; draw(); } };
  H.bretreat = () => { if (bu.b.over) return; if (!bu.confirmRetreat) { bu.confirmRetreat = true; return draw(); } B.retreat(bu.b, bu.side); draw(); };
  H.bdone = () => { const r = bu.resolve; bu.resolve = null; $('#battle').hidden = true; $('#battle').innerHTML = ''; if (r) r(); };

  document.addEventListener('mouseover', (e) => {
    const b = bu.b, box = $('#bfc'); if (!b || !box || b.over) return;
    const el = e.target.closest('.t'); if (!el) return;
    const u = selUnit(), w = B.unitAt(b, +el.dataset.x, +el.dataset.y);
    if (!u || !w || w.side === bu.side || !myTurn() || !B.canAct(b, u)) { box.innerHTML = ''; return; }
    let f = null, verb = '';
    if (B.canVolley(b, u, w)) { f = B.calc(b, u, w, 'volley'); verb = 'Volley'; } else { const ap = B.approach(b, u, w); if (ap) { f = ap.f; verb = f.charge ? 'Charge' : 'Attack'; } }
    box.innerHTML = f ? `<b>${verb}</b> ${A.UNITS[w.cls].name.toLowerCase()}: about <b>${f.dmg}</b> of ${w.men} fall${verb === 'Volley' ? '' : `, about <b>${f.counter}</b> of yours in return`} (±15%).<br><small>${f.notes.map(esc).join(' · ') || 'No modifiers.'}</small>` : `<span class="why">✖ ${esc(whyNoAttack(u, w))}</span>`;
  });
})();
