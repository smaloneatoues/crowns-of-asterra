// Strategic interface: title, map, side panels, dialogs, turn flow.
(function () {
  const A = globalThis.A;
  const $ = (q) => document.querySelector(q);
  const ui = (A.ui = { screen: 'title', sel: null, tab: 'province', mode: null, busy: false, dip: { target: null, envoy: null, against: null }, opts: { player: 'dra', difficulty: 'normal', seed: '' }, resolve: null, toastT: 0 });
  const H = (A.uiH = {});
  let S = null;
  const me = () => S.player;
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  A.esc = esc;
  const sign = (n) => (n > 0 ? '+' + n : String(n).replace('-', '−'));
  const chip = (f) => `<span class="chip" style="--c:${A.fcolor(f)}">${A.art.crest(f, 15)}${esc(f ? A.FDEF[f].short : 'Free')}</span>`;
  const meter = (v, cls) => `<span class="meter ${cls || ''}"><i style="width:${A.clamp(v, 0, 100)}%"></i></span>`;
  const troopCells = (t) => A.CLS.map((c) => `<td>${t[c]}</td>`).join('');
  const troopHead = () => '<tr><th></th>' + A.CLS.map((c) => `<th title="${esc(A.UNITS[c].desc)}">${A.UNITS[c].name.split(' ')[0]}</th>`).join('') + '</tr>';

  // ---------- Toast and modal ----------
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(ui.toastT); ui.toastT = setTimeout(() => { t.hidden = true; }, 4200); }
  A.toast = toast;
  function modal(html, cls) { const m = $('#modal'); m.innerHTML = `<div class="mbox ${cls || ''}">${html}</div>`; m.hidden = false; }
  function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
  function ask(html, cls) { return new Promise((res) => { ui.resolve = res; modal(html, cls); }); }
  A.ask = ask;
  H.ans = (d) => {
    const form = {};
    for (const el of document.querySelectorAll('#modal [name]')) form[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    const r = ui.resolve; ui.resolve = null; closeModal(); if (r) r({ v: d.v, form });
  };
  const btn = (label, v, cls) => `<button class="${cls || ''}" data-a="ans" data-v="${esc(v)}">${label}</button>`;

  // An order button that always shows its cost or the reason it is unavailable.
  function actBtn(label, id, args, note) {
    const why = A.can(S, me(), id, args);
    return `<div class="act"><button data-a="do" data-id="${id}" data-args="${esc(JSON.stringify(args))}" ${why ? 'disabled' : ''}>${label}</button><span class="${why ? 'why' : 'note'}">${why ? '✖ ' + esc(why) : note || ''}</span></div>`;
  }
  // Court commands (envoys, rewards, the market...) are sent from the selected province when it is free to act.
  function withFrom(id, args) {
    const act = A.actions[id];
    if (act && act.cost && act.scope !== 'prov' && !args.from) { const p = A.P(S, ui.sel); if (p && p.owner === me() && !p.acted) return Object.assign({}, args, { from: p.id }); }
    return args;
  }
  function courtNote() {
    const cp = A.commandProv(S, me(), 'market', withFrom('market', { mode: 'buy' })), left = A.commandsLeft(S, me());
    return `<div class="cmd ${cp.p ? '' : 'done'}">${cp.p ? `✒ Court commands are carried from a province and use its command for the season. Next: <b>${esc(cp.p.name)}</b> (${left} yet to act). Select another free province to send from there.` : '✔ Every province has acted; no court commands can be sent until next season.'}</div>`;
  }
  H.do = (d) => { const r = A.do(S, me(), d.id, withFrom(d.id, JSON.parse(d.args))); toast(r.ok ? r.msg : r.reason); render(); };
  H.nextProv = () => {
    const ps = A.provsOf(S, me()).filter((p) => !p.acted); if (!ps.length) { toast('Every province has acted this season.'); return; }
    const i = ps.findIndex((p) => p.id === ui.sel); ui.sel = ps[(i + 1) % ps.length].id; ui.tab = 'province'; ui.mode = null; render();
  };

  // ---------- Title and new campaign ----------
  function renderTitle() {
    const auto = A.store.meta('auto');
    $('#app').innerHTML = `<div class="title">
      <div class="crests">${A.FIDS.map((f) => A.art.crest(f, 64)).join('')}</div><h1>Crowns of Asterra</h1>
      <p class="tag">The king is dead. Six houses. One throne. And something vast, asleep beneath the stars.</p>
      <div class="menu">
        <button class="big" data-a="newScreen">New Campaign</button>
        <button class="big" data-a="continue" ${auto ? '' : 'disabled'}>Continue${auto ? ` <small>${esc(auto.house)} · ${esc(auto.date)}</small>` : ' <small>no autosave yet</small>'}</button>
        <button class="big" data-a="saves">Load Game</button>
        <button class="big" data-a="guide">How to Play</button>
      </div>
      ${A.store.ok() ? '' : '<p class="why">This browser is blocking local storage, so saving is unavailable.</p>'}
    </div>`;
  }
  function renderNew() {
    const o = ui.opts;
    const cards = A.FACTIONS.map((f) => {
      const r = A.OFFICER_DEF.find((x) => x[0] === f.ruler), lands = A.PROV_DEF.filter((p) => p[5] === f.id).map((p) => p[1]).join(', ');
      return `<div class="hcard ${o.player === f.id ? 'on' : ''}" data-a="pickHouse" data-id="${f.id}" style="--c:${f.color}">
        <div class="hhead">${A.art.crest(f.id, 46)}<div class="grow"><h3>${esc(f.name)}</h3><div class="sub2">${esc(r[1])} · ${f.rating}</div></div>${A.art.portrait({ id: r[0], faction: f.id, lead: r[3], admin: r[4], dip: r[5], ruler: true }, 56)}</div><p>${esc(f.blurb)}</p>
        <div class="sub2">Lands: ${esc(lands)} · L${r[3]} A${r[4]} D${r[5]} · ${f.gold} gold${f.seals.length ? ' · holds the ' + A.SEALS[f.seals[0]] : ''}</div></div>`;
    }).join('');
    const diffs = Object.entries(A.DIFF).map(([k, d]) => `<label class="dcard ${o.difficulty === k ? 'on' : ''}" data-a="pickDiff" data-id="${k}"><b>${d.name}</b><span>${esc(d.blurb)}</span></label>`).join('');
    $('#app').innerHTML = `<div class="newgame"><h1>Choose your house</h1><div class="hgrid">${cards}</div>
      <h2>Difficulty</h2><div class="dgrid">${diffs}</div>
      <div class="row"><label>Campaign seed <input id="seed" value="${esc(o.seed)}" placeholder="random" size="12" inputmode="numeric"></label>
      <span class="note">The same seed and the same choices replay the same campaign.</span></div>
      <div class="row"><button data-a="title">◀ Back</button><button class="big go" data-a="start">Begin as ${esc(A.fname(o.player))} ▶</button></div></div>`;
  }
  H.title = () => { ui.screen = 'title'; S = null; ui.s = null; render(); };
  H.newScreen = () => { ui.screen = 'new'; render(); };
  H.pickHouse = (d) => { ui.opts.seed = ($('#seed') || {}).value || ''; ui.opts.player = d.id; render(); };
  H.pickDiff = (d) => { ui.opts.seed = ($('#seed') || {}).value || ''; ui.opts.difficulty = d.id; render(); };
  H.start = async () => {
    const raw = ($('#seed').value || '').trim();
    let seed = parseInt(raw, 10); if (!Number.isFinite(seed) || seed <= 0) seed = (Date.now() % 2147483000) + 1;
    setState(A.newGame({ player: ui.opts.player, difficulty: ui.opts.difficulty, seed }));
    ui.sel = A.F(S, me()).seat; render();
    await tutorial(); await turnStart();
  };
  H.continue = () => loadSlot('auto');
  function setState(s) { S = s; ui.s = s; ui.screen = 'game'; ui.mode = null; ui.busy = false; ui.tab = 'province'; ui.sel = s.player ? A.F(s, s.player).seat : null; ui.dip = { target: null, envoy: null, against: null }; }
  async function loadSlot(slot) {
    const r = A.store.load(slot); if (!r.ok) { toast(r.reason); return; }
    setState(r.state); render(); toast(`Loaded: ${A.fname(S.player)}, ${A.dateStr(S)}.`);
    if (S.over) await summary(); else await turnStart();
  }

  // ---------- Top bar ----------
  function renderTop() {
    const fac = A.F(S, me()), fc = A.econ.forecast(S, me()), max = A.provsOf(S, me()).length, left = A.commandsLeft(S, me());
    const beast = fac.beast.awake ? `☄ ${fac.beast.charges} starfire` : `${fac.seals.length}/5 seals`;
    return `<header class="top">
      <div class="brand"><span class="crest">♛</span> Crowns of Asterra</div>
      ${chip(me())}
      <div class="stat" title="The season. Winter: food upkeep ×1.5 and attackers fight at −10 morale."><b>${A.dateStr(S)}</b></div>
      <div class="stat" title="Treasury. This season: +${fc.gold} income, −${fc.upGold} upkeep.">${A.art.icon('coin')} <b>${fac.gold}</b> <small class="${fc.netGold < 0 ? 'neg' : 'pos'}">${sign(fc.netGold)}</small></div>
      <div class="stat" title="Granaries. This season: +${fc.food} harvest, −${fc.upFood} eaten. Harvests peak in autumn and almost stop in winter.">${A.art.icon('wheat')} <b>${fac.food}</b> <small class="${fc.netFood < 0 ? 'neg' : 'pos'}">${sign(fc.netFood)}</small></div>
      <div class="stat" title="Provinces that have not yet carried out their command. Each province acts once per season. Court business (envoys, rewards, the market) is carried from a province and uses its command. Marching and troop transfers are free.">${A.art.icon('scroll')} <b>${left}</b>/${max} to act <button class="mini" data-a="nextProv" ${left && !S.over && !ui.busy ? '' : 'disabled'} title="Jump to the next province awaiting a command (N)">Next ▶</button></div>
      <div class="stat" title="Celestial seals held. Three awaken the Starwyrm.">${A.art.icon('seal')} ${beast}</div>
      <div class="grow"></div>
      <button data-a="saves" ${ui.busy ? 'disabled' : ''}>Save / Load</button>
      <button data-a="menu" ${ui.busy ? 'disabled' : ''}>Menu</button>
      ${S.over ? '<button class="go" data-a="summary">Campaign Summary</button>' : `<button class="go" data-a="endSeason" ${ui.busy ? 'disabled' : ''}>${ui.busy ? 'Rivals are moving…' : 'End Season ▶'}</button>`}
    </header>`;
  }

  // ---------- Map ----------
  function mapSVG() {
    const art = A.art, cells = art.cells();
    let o = `<svg id="map" class="season-${S.turn % 4}" viewBox="-34 -22 1068 734" preserveAspectRatio="xMidYMid meet">${art.mapDefs()}
      <rect class="sea" x="-34" y="-22" width="1068" height="734"/><rect x="-34" y="-22" width="1068" height="734" fill="url(#waves)"/>
      <g filter="url(#rough)"><polygon class="shore2" points="${art.landPoints}"/><polygon class="shore" points="${art.landPoints}"/><polygon class="land" points="${art.landPoints}"/>`;
    const targets = {};
    if (ui.mode && ui.mode.t === 'march') { const army = A.army(S, ui.mode.army); if (army) for (const p of A.provs(S)) { const c = A.war.marchCheck(S, army, p.id); if (c.ok) targets[p.id] = c.kind; } }
    for (const p of A.provs(S)) o += `<polygon class="cell ${p.owner ? '' : 'free'} ${ui.sel === p.id ? 'sel' : ''} ${targets[p.id] ? 'ctgt-' + targets[p.id] : ''}" data-a="prov" data-id="${p.id}" points="${cells[p.id].points}" fill="${A.fcolor(p.owner)}"/>`;
    o += `</g><g class="marks">${A.provs(S).map((p) => cells[p.id].marks).join('')}</g>`;
    for (const [a, b] of A.EDGES) { const p = A.P(S, a), q = A.P(S, b); const hot = ui.sel && (a === ui.sel || b === ui.sel); o += `<line class="road ${hot ? 'hot' : ''}" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/>`; }
    o += `<rect class="grain" x="-34" y="-22" width="1068" height="734" filter="url(#grain)"/>${art.compass(985, 655)}<text class="cartouche" x="-14" y="700">The Realm of Asterra</text>`;
    for (const p of A.provs(S)) {
      const g = A.total(p.garrison), seat = p.owner && A.F(S, p.owner).seat === p.id, cap = p.id === A.CAPITAL, T = A.TERRAIN[p.terrain];
      const tip = `${p.name} — ${p.owner ? A.fname(p.owner) : 'Free province'}\n${T.name}, walls ${p.fort}, garrison ${g}\nProsperity ${p.pros}, loyalty ${p.loyalty}, unrest ${p.unrest}`;
      const bw = String(g).length * 7.2 + 10;
      o += `<g class="pnode ${ui.sel === p.id ? 'sel' : ''} ${targets[p.id] ? 'tgt tgt-' + targets[p.id] : ''} ${ui.mode && !targets[p.id] ? 'dim' : ''}" data-a="prov" data-id="${p.id}" transform="translate(${p.x},${p.y})"><title>${esc(tip)}</title>
        <circle class="ring" r="35"/>${p.owner === me() && !p.acted && !S.over ? '<circle class="await" cx="-25" cy="-27" r="5.5"/>' : ''}
        ${seat || cap ? '<path class="stone" d="M-27 19 V-13 h4 v-5 h3.5 v5 h4 v-5 h3.5 v5 h3 V19 Z M9 19 V-13 h3 v-5 h3.5 v5 h4 v-5 h3.5 v5 h4 V19 Z M-27 19 V9 H27 V19 Z"/>' : '<path class="stone" d="M-17 20 V12 h5 v-3 h5 v3 h14 v-3 h5 v3 h5 V20 Z"/>'}
        <g transform="translate(-15,-19) scale(0.75)">${art.crestInner(p.owner)}</g>
        ${cap ? '<path class="crown" d="M-10 -24 V-35 L-5 -29 L0 -38 L5 -29 L10 -35 V-24 Z"/>' : ''}
        ${p.landmark && !cap ? '<polygon class="lmark" transform="translate(27,16)" points="0,-9 2.4,-2.8 9,-2.8 3.6,1.2 5.6,8 0,3.8 -5.6,8 -3.6,1.2 -9,-2.8 -2.4,-2.8"/>' : ''}
        ${p.unrest >= 50 ? '<path class="flame" transform="translate(-33,6)" d="M0 -11 Q7 -3 6 3 Q5 10 0 10 Q-6 10 -6 3 Q-6 0 -3.5 -2 Q-2.5 1 0 0 Q-2.5 -5 0 -11 Z"/>' : ''}
        ${Array.from({ length: p.fort }, (_, i) => `<rect class="pip" x="${-p.fort * 4 + i * 8}" y="24" width="6" height="6"/>`).join('')}
        <text class="pname" y="${p.fort ? 45 : 38}">${esc(p.name)}</text>
        <g transform="translate(15,-36)"><rect class="badge" width="${bw}" height="16" rx="2"/><text class="btxt" x="5" y="12.5">${g}</text></g></g>`;
      A.armiesAt(S, p.id).forEach((a, i) => {
        const n = A.total(a.troops), on = ui.mode && ui.mode.army === a.id, w = String(n).length * 7.2 + 16;
        o += `<g class="army ${on ? 'on' : ''} ${a.moved ? 'moved' : ''}" data-a="armySel" data-id="${a.id}" transform="translate(${p.x - 34},${p.y - 8 + i * 25})"><title>${esc(A.O(S, a.cmd).name)}'s army: ${esc(A.troopStr(a.troops))}${a.moved ? ' (has marched)' : ''}</title>
          <line class="pole" x1="0" y1="-13" x2="0" y2="14"/><polygon class="flag" points="0,-12 ${-w},-12 ${-w + 6},-3.5 ${-w},5 0,5" fill="${A.fcolor(a.faction)}"/><text x="-4" y="1" text-anchor="end">${n}</text></g>`;
      });
    }
    return o + '<rect class="vig" x="-34" y="-22" width="1068" height="734" fill="url(#vig)"/></svg>';
  }
  function legend() {
    const rows = A.FIDS.filter((f) => A.F(S, f).alive).map((f) => {
      const st = f === me() ? 'you' : A.dip.status(S, me(), f).type;
      return `<div class="lrow" data-a="dipSel" data-id="${f}">${chip(f)}<b>${A.provsOf(S, f).length}</b><span class="st-${st}">${st === 'neutral' ? '' : st}</span></div>`;
    }).join('');
    const free = A.provs(S).filter((p) => !p.owner).length;
    return `<div class="legend">${rows}${free ? `<div class="lrow">${chip(null)}<b>${free}</b></div>` : ''}<div class="key">towers: house seat · crown: capital · ★ ancient site · ▪ walls · pennant: army · flame: unrest · gold dot: awaiting your command</div></div>`;
  }
  function modeBanner() {
    if (!ui.mode) return '';
    const a = A.army(S, ui.mode.army); if (!a) return '';
    return `<div class="banner">Choose where <b>${esc(A.O(S, a.cmd).name)}</b> marches. <span class="k-move">Green</span>: your land. <span class="k-attack">Red</span>: attack. <span class="k-betray">Orange</span>: attack that breaks a treaty. Click any other province to learn why it is out of reach. <button data-a="cancelMode">Cancel</button></div>`;
  }
  H.cancelMode = () => { ui.mode = null; render(); };
  H.prov = async (d) => {
    if (ui.mode && ui.mode.t === 'march') { const a = A.army(S, ui.mode.army); if (a) return tryMarch(a, d.id); ui.mode = null; }
    ui.sel = d.id; ui.tab = 'province'; render();
  };
  H.armySel = (d) => { const a = A.army(S, +d.id); if (!a) return; ui.sel = a.loc; ui.tab = 'province'; if (a.faction === me() && !a.moved && !S.over) ui.mode = { t: 'march', army: a.id }; else ui.mode = null; render(); };
  H.march = (d) => { const a = A.army(S, +d.id); if (!a) return; if (a.moved) { toast('This army has already marched this season.'); return; } ui.mode = { t: 'march', army: a.id }; render(); };
  H.marchTo = (d) => { const a = A.army(S, +d.id); if (a) return tryMarch(a, d.to); };

  const oddsWord = (r) => (r >= 2 ? 'Overwhelming' : r >= 1.4 ? 'Favourable' : r >= 1 ? 'Even' : r >= 0.7 ? 'Risky' : 'Desperate');
  function forceTable(rows) { return `<table class="tt">${troopHead()}${rows.map(([n, t]) => `<tr><th>${n}</th>${troopCells(t)}</tr>`).join('')}</table>`; }
  async function tryMarch(army, pid) {
    const chk = A.war.marchCheck(S, army, pid);
    if (!chk.ok) { toast(chk.reason); return; }
    const dest = A.P(S, pid), cmd = A.O(S, army.cmd);
    let opts = {};
    if (chk.kind !== 'move') {
      const est = A.war.estimate(S, army, pid), fac = A.F(S, me()), winter = S.turn % 4 === 3;
      const beastOk = fac.beast.awake && fac.beast.charges > 0;
      const warn = [];
      if (chk.kind === 'betray') warn.push(`<b>This breaks your ${chk.treaty} with ${esc(A.fname(dest.owner))}.</b> Betrayal costs −40 relations with them, −10 with every other house, and −8% on all your future proposals.`);
      if (dest.owner && chk.kind === 'attack' && !A.atWar(S, me(), dest.owner)) warn.push(`This starts a war with ${esc(A.fname(dest.owner))}; their allies may join them.`);
      if (winter) warn.push('Winter: your soldiers attack at −10 morale.');
      if (dest.fort > 0) warn.push(`Walls level ${dest.fort}: only infantry can escalade (at a heavy penalty). Siege crews breach walls quickly${army.troops.sie ? '' : ' — you have none'}. If the walls stand after 12 rounds, you must withdraw.`);
      if (cmd.ruler) warn.push('Your ruler leads this army. If it is routed there is a small chance they are slain or captured — name an heir first.');
      if (cmd.loyalty < 30 && !cmd.ruler) warn.push(`${esc(cmd.name)}'s loyalty is ${cmd.loyalty}: there is a 40% chance they refuse to attack.`);
      const ans = await ask(`<h2>⚔ Attack ${esc(dest.name)}?</h2>
        <p>${esc(cmd.name)} (leadership ${cmd.lead}) against ${esc(est.def.cmdName)} (leadership ${est.def.lead}) — ${A.TERRAIN[dest.terrain].name.toLowerCase()}, walls ${dest.fort}.</p>
        ${forceTable([['Your army', army.troops], ['Defenders', est.def.troops]])}
        <p>Advisor's estimate: <b class="odds-${oddsWord(est.ratio).toLowerCase()}">${oddsWord(est.ratio)}</b> <span class="note">(strength ratio ${est.ratio.toFixed(2)}, counting commanders, walls and terrain — tactics can beat the estimate)</span></p>
        ${warn.map((w) => `<p class="warn">⚠ ${w}</p>`).join('')}
        ${beastOk ? `<label class="chk"><input type="checkbox" name="beast"> If delegated, let ${esc(cmd.name)} call down the Starwyrm (1 of ${fac.beast.charges} charges)</label>` : ''}
        <div class="row">${btn('Command in person', 'command', 'go')}${btn(`Delegate to ${esc(cmd.name)}`, 'delegate')}${btn('Cancel', 'cancel')}</div>`);
      if (ans.v === 'cancel') return;
      opts = { mode: ans.v, beast: !!ans.form.beast };
    }
    ui.mode = null; ui.busy = true; render();
    try {
      const r = await A.war.march(S, army.id, pid, handler, opts);
      if (!r.ok) toast(r.reason); else if (r.msg) toast(r.msg);
      if (r.kind === 'battle' && r.rep.won) ui.sel = pid; else if (r.kind === 'move') ui.sel = pid;
      A.turn.checkVictory(S);
    } finally { ui.busy = false; }
    render();
    if (S.over) await summary();
  }

  // Battles that involve the player: command in person or delegate, then a report.
  const handler = {
    async fight(b, ctx) {
      let mode = ctx.mode, useBeast = ctx.beast;
      const sp = b.spec.beast[ctx.side];
      if (ctx.side === 'def') {
        render();
        const p = ctx.province;
        const ans = await ask(`<h2>⛨ ${esc(p.name)} is under attack!</h2>
          <p>${esc(b.spec.att.name)} marches on ${esc(p.name)} under ${esc(b.spec.att.cmd)} (leadership ${b.spec.att.lead}). Your defence is led by ${esc(b.spec.def.cmd)} (leadership ${b.spec.def.lead}) — ${A.TERRAIN[p.terrain].name.toLowerCase()}, walls ${p.fort}.</p>
          ${forceTable([['Attackers', b.spec.att.troops], ['Your defenders', b.spec.def.troops]])}
          ${sp.avail ? `<label class="chk"><input type="checkbox" name="beast"> If delegated, allow the Starwyrm to be called down (1 charge)</label>` : ''}
          <div class="row">${btn('Command the defence', 'command', 'go')}${btn(`Delegate to ${esc(b.spec.def.cmd)}`, 'delegate')}</div>`);
        mode = ans.v; useBeast = !!ans.form.beast;
      }
      if (mode === 'command') await A.battleUI.play(b, ctx.side);
      else { sp.auto = !!useBeast; A.battle.autoResolve(b); }
    },
    async report(rep) {
      const mine = rep.attF === me() ? 'att' : 'def', won = (mine === 'att') === rep.won;
      let body;
      if (rep.walkover) body = `<p>${esc(rep.name)} had no defenders and was occupied without a fight.</p>`;
      else {
        const r = rep.res, row = (side, label) => `<tr><th>${label}</th><td>${A.total(r[side].start)}</td><td>${A.total(r[side].left)}</td><td class="neg">−${r[side].lost}</td></tr>`;
        const why = r.reason === 'timeout' ? 'The assault ran out of daylight after 12 rounds.' : r.reason === 'retreat' ? `The ${r.retreated === 'att' ? 'attackers' : 'defenders'} withdrew in good order.` : `The ${r.winner === 'att' ? 'defenders' : 'attackers'} broke and fled.`;
        body = `<p>${esc(rep.attCmd)} (${esc(A.fname(rep.attF))}) against ${esc(rep.defCmd)} (${esc(A.fname(rep.defF))}). ${why} ${r.rounds} round${r.rounds > 1 ? 's' : ''}${r.breached ? '; the walls were breached' : ''}.</p>
          <table class="tt"><tr><th></th><th>Began</th><th>Survive</th><th>Lost</th></tr>${row('att', 'Attackers')}${row('def', 'Defenders')}</table>
          <p class="note">Survivors include half of each routed unit; the beaten side loses more in the pursuit.</p>
          ${rep.notes.map((n) => `<p>• ${esc(n)}</p>`).join('')}
          <details><summary>Battle log (${rep.log.length} entries)</summary><div class="blog">${rep.log.map((l) => `<div>${esc(l)}</div>`).join('')}</div></details>`;
      }
      await ask(`<h2 class="${won ? 'pos' : 'neg'}">${won ? '✔ Victory' : '✖ Defeat'} at ${esc(rep.name)}</h2>${body}<div class="row">${btn('Continue', 'ok', 'go')}</div>`);
    },
  };

  // ---------- Side panel ----------
  const TABS = [['province', 'Province'], ['realm', 'Realm'], ['officers', 'Officers'], ['diplomacy', 'Diplomacy'], ['beast', 'Starwyrm'], ['guide', 'Guide']];
  H.tab = (d) => { ui.tab = d.id; render(); };
  function advisor() {
    if (S.over) return 'The campaign is over. Open the summary from the top bar.';
    const f = me(), fac = A.F(S, f), ps = A.provsOf(S, f), free = A.officersOf(S, f).filter((o) => !o.job);
    const hot = ps.find((p) => p.unrest >= 60);
    if (hot) return `Unrest in ${hot.name} is ${hot.unrest}. Hold a festival or distribute aid before it revolts.`;
    if (A.econ.yearFood(S, f) + fac.food < 0) return 'Your armies eat more than your farms grow over a year. Improve farms, buy grain (Realm tab) or disband troops before winter.';
    const waiting = ps.filter((p) => !p.acted);
    if (free.length && ps.some((p) => !p.governor && !p.acted)) return `${free[0].name} has no post. A governor raises a province's income, calms it and leads its defence.`;
    if (!A.armiesOf(S, f).length) return 'You have no field army. Select a province with a garrison and use Muster Army; a free officer must command it.';
    const idle = A.armiesOf(S, f).find((a) => !a.moved);
    if (idle) return `${A.O(S, idle.cmd).name}'s army has not marched. Click its pennant on the map — grey free provinces are the softest targets.`;
    if (waiting.length) return `${waiting.length} province${waiting.length > 1 ? 's have' : ' has'} yet to act this season: ${waiting.slice(0, 4).map((p) => p.name).join(', ')}${waiting.length > 4 ? '…' : ''}. Press Next ▶ to step through them.`;
    if (!fac.heir) return 'You have no named heir. If your ruler falls in battle the house may fracture (Officers tab).';
    return 'All is in order. End the season when ready.';
  }
  function renderSide() {
    const tabs = TABS.map(([id, n]) => `<button class="${ui.tab === id ? 'on' : ''}" data-a="tab" data-id="${id}">${n}</button>`).join('');
    const body = { province: provincePanel, realm: realmPanel, officers: officersPanel, diplomacy: diplomacyPanel, beast: beastPanel, guide: guidePanel }[ui.tab]();
    return `<aside class="side"><nav class="tabs">${tabs}</nav><div class="advisor"><b>Advisor:</b> ${esc(advisor())}</div><div class="panel">${body}</div></aside>`;
  }
  const kv = (k, v, tip) => `<div class="kv" ${tip ? `title="${esc(tip)}"` : ''}><span>${k}</span><b>${v}</b></div>`;

  function provincePanel() {
    const p = A.P(S, ui.sel); if (!p) return '<p class="note">Select a province on the map.</p>';
    const f = me(), mine = p.owner === f, T = A.TERRAIN[p.terrain], seat = p.owner && A.F(S, p.owner).seat === p.id, gov = p.governor ? A.O(S, p.governor) : null;
    let h = `<h2>${A.art.crest(p.owner, 28)} ${esc(p.name)}${p.id === A.CAPITAL ? ' ♛' : ''}</h2>
      <div class="sub2">${A.art.terrainIcon(p.terrain, 22)} ${T.name} · ${p.owner ? esc(A.fname(p.owner)) : 'Free province'}${seat ? ' · house seat' : ''}${p.id === A.CAPITAL ? ' · royal capital' : ''}</div>`;
    if (p.resource) h += `<div class="tagline">◆ ${A.RESOURCES[p.resource].name}: ${A.RESOURCES[p.resource].note}</div>`;
    if (p.landmark) h += `<div class="tagline">✦ ${esc(p.landmark)}${p.id === A.CAPITAL ? ': holding Aurelion is required for every victory.' : p.seal && p.sealKnown ? ': a seal is known to lie here.' : p.searched ? ': searched; nothing remains.' : ': an ancient site. A seal may be hidden here.'}</div>`;
    h += `<div class="kvs">
      ${kv('Prosperity', `${p.pros} ${meter(p.pros)}`, 'Drives gold income and how many levies can be raised per season.')}
      ${kv('Farms', `${p.farms} ${meter(p.farms, 'green')}`, 'Drives food production. Autumn harvests are largest; winter yields almost nothing.')}
      ${kv('Loyalty', `${p.loyalty} ${meter(p.loyalty, 'blue')}`, 'Drifts toward 55. At 30 or less with unrest 85+, the province may revolt.')}
      ${kv('Unrest', `${p.unrest} ${meter(p.unrest, 'red')}`, 'Cuts income. 70+: no recruiting, prosperity falls. Falls by 2 a season, faster under an able governor.')}
      ${kv('Walls', `${p.fort} / 5`, 'Each level protects defenders on the wall and gives the wall 50 hit points.')}
      ${kv('Yields now', p.owner ? `${A.art.icon('coin', 14)} ${A.econ.provGold(S, p)} · ${A.art.icon('wheat', 14)} ${A.econ.provFood(S, p, S.turn % 4)}` : '—', 'Gold and food this province will pay at the end of this season.')}
      ${kv('Governor', gov ? `${esc(gov.name)} <small>(adm ${gov.admin})</small>` : '<span class="note">none</span>', 'A governor adds income, calms unrest, and leads the defence.')}
    </div>`;
    h += `<h3>Garrison</h3>${forceTable([['Men', p.garrison]])}`;
    const armies = A.armiesAt(S, p.id);
    if (armies.length) {
      h += '<h3>Armies here</h3>';
      for (const a of armies) {
        const o = A.O(S, a.cmd), own = a.faction === f;
        h += `<div class="armyrow"><div><b>⚑ ${esc(o.name)}</b> <small>lead ${o.lead}${own ? `, loyalty ${o.loyalty}` : ''}</small><br><small>${esc(A.troopStr(a.troops))}${a.moved ? ' · has marched' : ''}</small></div>`;
        if (own) h += `<div class="btns"><button data-a="march" data-id="${a.id}" ${a.moved || S.over ? 'disabled' : ''} title="${a.moved ? 'Already marched this season.' : 'Choose a destination on the map.'}">March…</button><button data-a="transfer" data-id="${a.id}">Transfer…</button><button data-a="standDown" data-id="${a.id}">Stand down</button></div>`;
        h += '</div>';
      }
    }
    h += `<div class="sub2">Roads to: ${p.nb.map((n) => `<a data-a="prov" data-id="${n}">${esc(A.P(S, n).name)}</a>`).join(', ')}</div>`;
    if (S.over) return h;
    // March-here shortcuts with reasons
    const mineArmies = A.armiesOf(S, f).filter((a) => a.loc !== p.id);
    if (mineArmies.length) {
      h += `<h3>${mine ? 'Move an army here' : 'Attack with an army'}</h3>`;
      for (const a of mineArmies) { const c = A.war.marchCheck(S, a, p.id), o = A.O(S, a.cmd); h += `<div class="act"><button data-a="marchTo" data-id="${a.id}" data-to="${p.id}" ${c.ok ? '' : 'disabled'}>${c.ok && c.kind !== 'move' ? '⚔' : '➜'} ${esc(o.name)} (${A.total(a.troops)}) from ${esc(A.P(S, a.loc).name)}</button><span class="${c.ok ? 'note' : 'why'}">${c.ok ? (c.kind === 'betray' ? 'Breaks a treaty!' : c.via ? `via ${esc(A.P(S, c.via).name)}` : '') : '✖ ' + esc(c.reason)}</span></div>`; }
    }
    if (!mine) {
      const st = p.owner ? A.dip.status(S, f, p.owner) : null;
      h += `<h3>Why can't I command here?</h3><p class="note">Commands can only be given in provinces you control. ${p.owner ? `${esc(A.fname(p.owner))} holds ${esc(p.name)}${st.type !== 'neutral' ? ` (you are ${st.type === 'war' ? 'at war' : 'bound by ' + st.type})` : ''}.` : 'This free province answers to no house and is defended by local militia.'} To take it, march an army into it from a neighbouring province${mineArmies.length ? '' : ' — first muster one in a province of your own'}.</p>`;
      return h;
    }
    const cap = A.cost.recruitCap(p);
    h += `<div class="cmd ${p.acted ? 'done' : ''}">${p.acted ? '✔ ' + esc(p.name) + ' has carried out its command this season.' : '✒ ' + esc(p.name) + ' awaits your command — choose one this season.'}</div>`;
    if (p.acted) return h + '<p class="note">It can act again next season. Armies here can still march, and troop transfers remain free.</p>';
    h += '<h3>Recruit</h3><div class="grid2">';
    for (const c of A.CLS) {
      h += actBtn(`${A.UNITS[c].name} +${A.UNITS[c].batch}`, 'recruit', { p: p.id, cls: c }, `${A.cost.recruit(p, c)} gold · upkeep ${A.UNITS[c].gold}g ${A.UNITS[c].food}f per 100`);
      h += cap > 1 ? actBtn(`${A.UNITS[c].name} +${A.UNITS[c].batch * cap}`, 'recruit', { p: p.id, cls: c, n: cap }, `${A.cost.recruit(p, c) * cap} gold · the largest levy here`) : '<div></div>';
    }
    h += `</div><div class="note">One command raises up to ${cap} lev${cap > 1 ? 'ies' : 'y'} here (1 + prosperity÷30). Each costs 1 prosperity.</div>`;
    h += '<h3>Administration</h3>';
    h += actBtn('Levy emergency tax', 'levy', { p: p.id }, `+${A.cost.levy(p)} gold · unrest +12, loyalty −8`);
    h += actBtn('Hold festival', 'festival', { p: p.id }, `${A.cost.festival} gold · loyalty +12, unrest −10`);
    h += actBtn('Distribute aid', 'aid', { p: p.id }, `${A.cost.aid} food · unrest −14, loyalty +6`);
    h += actBtn('Improve farms', 'farms', { p: p.id }, `${A.cost.farms} gold · farms +${4 + Math.round(A.govAdmin(S, p) / 20)}`);
    h += actBtn('Develop markets', 'trade', { p: p.id }, `${A.cost.trade} gold · prosperity +${3 + Math.round(A.govAdmin(S, p) / 25)}`);
    h += actBtn('Raise walls', 'fortify', { p: p.id }, `${A.cost.fortify(p)} gold · walls ${p.fort} → ${p.fort + 1}`);
    h += `<div class="act"><button data-a="govPick" data-id="${p.id}" ${p.acted ? 'disabled' : ''}>${gov ? 'Replace governor…' : 'Appoint governor…'}</button><span class="${p.acted ? 'why' : 'note'}">${p.acted ? '✖ ' + esc(p.name) + ' has already acted this season.' : 'Adds income and calm, and leads the defence'}</span></div>`;
    if (gov) h += actBtn('Dismiss governor', 'governor', { p: p.id, o: null }, 'Frees them for other duties (loyalty −6)');
    h += '<h3>Military</h3>';
    const freeOff = A.officersOf(S, f).filter((o) => !A.officerFree(S, f, o.id, { busy: true }));
    const mWhy = p.acted ? p.name + ' has already acted this season.' : A.total(p.garrison) < 1 ? 'There are no troops in the garrison to muster.' : !freeOff.length ? 'No free officer to command: all are governing, commanding or away. Dismiss a governor or stand down an army.' : null;
    h += `<div class="act"><button data-a="muster" data-id="${p.id}" ${mWhy ? 'disabled' : ''}>Muster army…</button><span class="${mWhy ? 'why' : 'note'}">${mWhy ? '✖ ' + mWhy : 'forms a field army from this garrison'}</span></div>`;
    if (A.SEAL_SITES.includes(p.id) || p.seal) {
      const sWhy = A.can(S, f, 'search', { p: p.id, o: (A.officersOf(S, f).find((o) => !A.officerFree(S, f, o.id, { gov: true })) || {}).id });
      h += `<div class="act"><button data-a="searchPick" data-id="${p.id}" ${sWhy ? 'disabled' : ''}>Search ${esc(p.landmark || 'the site')}…</button><span class="${sWhy ? 'why' : 'note'}">${sWhy ? '✖ ' + esc(sWhy) : 'an officer hunts for a celestial seal'}</span></div>`;
    }
    h += '<details><summary>Disband troops</summary><div class="grid2">';
    for (const c of A.CLS) h += actBtn(`Disband ${A.UNITS[c].batch} ${A.UNITS[c].name.toLowerCase()}`, 'disband', { p: p.id, cls: c }, 'prosperity +1');
    h += '</div></details>';
    return h;
  }

  // Officer picker that lists everyone and says why the unavailable ones are unavailable.
  async function pickOfficer(title, whyFn, extraFn, allowNone) {
    const os = A.officersOf(S, me()).sort((a, b) => (whyFn(a) ? 1 : 0) - (whyFn(b) ? 1 : 0));
    const rows = os.map((o) => { const why = whyFn(o); return `<div class="orow ${why ? 'off' : ''}">${A.art.portrait(o, 46)}<div class="grow"><b>${esc(o.name)}</b> <small>${esc(o.trait)}${o.ruler ? ' · ruler' : ''}</small><br><small>Lead ${o.lead} · Adm ${o.admin} · Dip ${o.dip} · Loyalty ${o.loyalty} · ${esc(jobText(o))}</small>${why ? `<br><span class="why">✖ ${esc(why)}</span>` : extraFn ? `<br><span class="note">${esc(extraFn(o))}</span>` : ''}</div><button data-a="ans" data-v="${o.id}" ${why ? 'disabled' : ''}>Choose</button></div>`; }).join('');
    const ans = await ask(`<h2>${title}</h2>${rows}<div class="row">${allowNone ? btn(allowNone, 'none') : ''}${btn('Cancel', 'cancel')}</div>`);
    return ans.v;
  }
  function jobText(o) { if (o.status !== 'active') return o.status; if (!o.job) return `unassigned, at ${A.P(S, o.loc) ? A.P(S, o.loc).name : 'court'}`; if (o.job.t === 'gov') return `governor of ${A.P(S, o.job.p).name}`; const a = A.army(S, o.job.a); return `commanding ${a ? A.total(a.troops) : 0} at ${a ? A.P(S, a.loc).name : '?'}`; }
  H.govPick = async (d) => {
    const p = A.P(S, d.id);
    const v = await pickOfficer(`Governor of ${esc(p.name)}`, (o) => A.can(S, me(), 'governor', { p: p.id, o: o.id }), (o) => `Administration ${o.admin}: income +${Math.round(o.admin / 2.5)}%, unrest −${2 + Math.floor(o.admin / 30)} per season`);
    if (v === 'cancel') return;
    const r = A.do(S, me(), 'governor', { p: p.id, o: v }); toast(r.ok ? r.msg : r.reason); render();
  };
  H.searchPick = async (d) => {
    const p = A.P(S, d.id);
    const v = await pickOfficer(`Who searches ${esc(p.landmark || p.name)}?`, (o) => A.can(S, me(), 'search', { p: p.id, o: o.id }), (o) => `${A.beast.searchChance(S, p, o)}% to find a seal if one is here (30 + 0.4 × administration${p.sealKnown ? ' + 25 for the known site' : ''})`);
    if (v === 'cancel') return;
    const r = A.do(S, me(), 'search', { p: p.id, o: v }); render(); await ask(`<h2>✦ ${esc(p.landmark || p.name)}</h2><p>${esc(r.ok ? r.msg : r.reason)}</p><div class="row">${btn('Continue', 'ok', 'go')}</div>`); render();
  };
  H.muster = async (d) => {
    const p = A.P(S, d.id), os = A.officersOf(S, me()).filter((o) => !A.officerFree(S, me(), o.id, { busy: true })).sort((a, b) => a.ruler - b.ruler || b.lead - a.lead);
    const ans = await ask(`<h2>Muster an army at ${esc(p.name)}</h2>
      <label>Commander <select name="o">${os.map((o) => `<option value="${o.id}">${esc(o.name)} — lead ${o.lead}, loyalty ${o.loyalty}${o.ruler ? ' (your ruler!)' : ''}</option>`).join('')}</select></label>
      <p class="note">Leadership sets morale, damage and how many units can act each battle round (2 + leadership÷30). Troops left behind keep order and defend the province.</p>
      <table class="tt"><tr><th></th><th>In garrison</th><th>Take</th></tr>${A.CLS.map((c) => `<tr><th>${A.UNITS[c].name}</th><td>${p.garrison[c]}</td><td><input type="number" name="${c}" min="0" max="${p.garrison[c]}" step="10" value="${c === 'inf' ? Math.max(0, p.garrison[c] - 100) : p.garrison[c]}"></td></tr>`).join('')}</table>
      <div class="row">${btn('Muster', 'ok', 'go')}${btn('Cancel', 'cancel')}</div>`);
    if (ans.v !== 'ok') return;
    const troops = {}; for (const c of A.CLS) troops[c] = A.clamp(parseInt(ans.form[c], 10) || 0, 0, p.garrison[c]);
    const r = A.do(S, me(), 'muster', { p: p.id, o: ans.form.o, troops }); toast(r.ok ? r.msg : r.reason); render();
  };
  H.transfer = async (d) => {
    const a = A.army(S, +d.id); if (!a) return; const p = A.P(S, a.loc);
    const why = A.P(S, a.loc).owner !== me() ? 'The army must stand in one of your provinces.' : null; if (why) { toast(why); return; }
    const ans = await ask(`<h2>Transfer troops at ${esc(p.name)}</h2><p class="note">Free. Set how many of each class ${esc(A.O(S, a.cmd).name)}'s army should hold; the rest stay in the garrison.</p>
      <table class="tt"><tr><th></th><th>Army</th><th>Garrison</th><th>Army should have</th></tr>${A.CLS.map((c) => `<tr><th>${A.UNITS[c].name}</th><td>${a.troops[c]}</td><td>${p.garrison[c]}</td><td><input type="number" name="${c}" min="0" max="${a.troops[c] + p.garrison[c]}" step="10" value="${a.troops[c]}"></td></tr>`).join('')}</table>
      <div class="row">${btn('Take everything', 'all')}${btn('Confirm', 'ok', 'go')}${btn('Cancel', 'cancel')}</div>`);
    if (ans.v === 'cancel') return;
    const troops = {}; for (const c of A.CLS) { const want = ans.v === 'all' ? a.troops[c] + p.garrison[c] : A.clamp(parseInt(ans.form[c], 10) || 0, 0, a.troops[c] + p.garrison[c]); troops[c] = want - a.troops[c]; }
    const r = A.do(S, me(), 'transfer', { army: a.id, troops }); toast(r.ok ? r.msg : r.reason);
    const a2 = A.army(S, a.id); if (a2 && A.total(a2.troops) < 1) A.do(S, me(), 'standDown', { army: a.id });
    render();
  };
  H.standDown = (d) => { const r = A.do(S, me(), 'standDown', { army: +d.id }); toast(r.ok ? r.msg : r.reason); if (ui.mode && ui.mode.army === +d.id) ui.mode = null; render(); };

  function victoryBox() {
    const pr = A.turn.progress(S, me());
    const li = (ok, t) => `<li class="${ok ? 'ok' : ''}">${ok ? '✔' : '○'} ${t}</li>`;
    return `<h3>Paths to the crown</h3><div class="vbox"><b>Unification</b><ul>${li(pr.cap, 'Hold Aurelion, the royal capital')}${li(pr.n >= A.WIN_PROVINCES, `Control ${A.WIN_PROVINCES} of 24 provinces (you hold ${pr.n})`)}</ul><span class="note">…or outlast every rival house.</span></div>
      <div class="vbox"><b>Recognized succession</b><ul>${li(pr.cap && pr.capSeasons >= A.RECOG_SEASONS, `Hold Aurelion for ${A.RECOG_SEASONS} seasons running (${pr.capSeasons})`)}${li(pr.n >= A.RECOG_PROVINCES, `Control ${A.RECOG_PROVINCES} provinces (${pr.n})`)}${li(pr.heirOk, 'Have a named, living heir')}${li(!pr.unrecognized.length, `A pact or alliance with every surviving house${pr.unrecognized.length ? ' — missing: ' + pr.unrecognized.map((g) => A.FDEF[g].short).join(', ') : ''}`)}</ul></div>
      <div class="vbox bad"><b>You lose if</b><ul><li>you lose your last province;</li><li>your ruler is slain or captured with no named heir and no officer of loyalty 50+;</li><li>a rival completes either path first.</li></ul></div>`;
  }
  function realmPanel() {
    const f = me(), fac = A.F(S, f), fc = A.econ.forecast(S, f), yf = A.econ.yearFood(S, f);
    let h = `<h2>${esc(A.fname(f))}</h2><div class="kvs">
      ${kv('Gold this season', `+${fc.gold} income − ${fc.upGold} upkeep = <span class="${fc.netGold < 0 ? 'neg' : 'pos'}">${sign(fc.netGold)}</span>`)}
      ${kv('Food this season', `+${fc.food} harvest − ${fc.upFood} eaten = <span class="${fc.netFood < 0 ? 'neg' : 'pos'}">${sign(fc.netFood)}</span>`)}
      ${kv('Food over a full year', `<span class="${yf < 0 ? 'neg' : 'pos'}">${sign(yf)}</span>`, 'Harvests: spring ×0.5, summer ×0.9, autumn ×1.6, winter ×0.1. Winter upkeep ×1.5.')}
      ${kv('Soldiers', `${A.total(fc.troops)} <small>(${esc(A.troopStr(fc.troops))})</small>`)}
      ${kv('Strength', A.strength(S, f), 'Troop value plus 100 per province. Used in diplomacy odds.')}
    </div>
    <p class="note">Unpaid soldiers: 6% desert and officers lose loyalty. Unfed soldiers: 10% desert (18% in winter) and provinces lose loyalty.</p>
    <h3>Court commands</h3>${S.over ? '' : courtNote()}<h3>Grain market</h3><div class="grid2">${actBtn('Buy 100 food', 'market', { mode: 'buy' }, `${A.cost.marketBuy} gold`)}${actBtn('Sell 100 food', 'market', { mode: 'sell' }, `+${A.cost.marketSell} gold`)}</div>
    ${victoryBox()}<h3>Your provinces</h3><table class="tt click"><tr><th>Province</th><th title="Prosperity">Pro</th><th title="Loyalty">Loy</th><th title="Unrest">Unr</th><th>Walls</th><th>Men</th><th>Governor</th><th title="Has this province used its command this season?">Cmd</th></tr>`;
    for (const p of A.provsOf(S, f)) h += `<tr data-a="prov" data-id="${p.id}"><th>${esc(p.name)}</th><td>${p.pros}</td><td class="${p.loyalty <= 30 ? 'neg' : ''}">${p.loyalty}</td><td class="${p.unrest >= 60 ? 'neg' : ''}">${p.unrest}</td><td>${p.fort}</td><td>${A.total(p.garrison)}</td><td>${p.governor ? esc(A.O(S, p.governor).name.split(' ').slice(-1)[0]) : '<span class="why">none</span>'}</td><td>${p.acted ? '✔' : '✒'}</td></tr>`;
    return h + '</table>';
  }

  function officersPanel() {
    const f = me(), fac = A.F(S, f);
    let h = `<h2>Officers of ${esc(A.fname(f))}</h2><p class="note">Leadership commands armies. Administration governs provinces and searches sites. Diplomacy carries proposals. Below loyalty 30 a commander may refuse to attack; below 25 an officer may defect.</p>${S.over ? '' : courtNote()}`;
    const all = Object.values(S.officers).filter((o) => o.faction === f && (o.status === 'active' || o.status === 'captured')).sort((a, b) => b.ruler - a.ruler || b.lead + b.admin + b.dip - a.lead - a.admin - a.dip);
    for (const o of all) {
      h += `<div class="ocard"><div class="ohead">${A.art.portrait(o, 70)}<div><b>${esc(o.name)}</b> <small>${esc(o.trait)}${o.ruler ? ' · Ruler' : ''}${fac.heir === o.id ? ' · Heir' : ''}</small><div class="obio">${esc(o.bio)}</div></div></div>
        <div class="ostats">${kv('Leadership', `${o.lead} ${meter(o.lead)}`)}${kv('Administration', `${o.admin} ${meter(o.admin, 'green')}`)}${kv('Diplomacy', `${o.dip} ${meter(o.dip, 'blue')}`)}${kv('Loyalty', `<span class="${o.loyalty < 35 ? 'neg' : ''}">${o.loyalty}</span> ${meter(o.loyalty, o.loyalty < 35 ? 'red' : 'blue')}`)}</div>
        <div class="sub2">${esc(jobText(o))}${o.busy ? ' · on a mission this season' : ''}${o.status === 'captured' ? ` · prisoner until ${A.dateStr(S, o.until)}` : ''}</div>`;
      if (!o.ruler && o.status === 'active' && !S.over) h += `<div class="grid2">${actBtn('Reward', 'reward', { o: o.id }, `${A.cost.reward} gold · loyalty +10`)}${actBtn('Name heir', 'heir', { o: o.id }, 'their loyalty +12, others −4')}</div>`;
      h += '</div>';
    }
    return h;
  }

  function relBar(v) { const w = Math.abs(v) / 2; return `<span class="rel"><i class="${v < 0 ? 'n' : 'p'}" style="width:${w}%;${v < 0 ? `right:50%` : `left:50%`}"></i></span>`; }
  function statusBadge(st) { const names = { war: 'At war', alliance: 'Alliance', pact: 'Pact', truce: 'Truce', neutral: 'No treaty' }; return `<span class="badge2 st-${st.type}">${names[st.type]}${st.until !== undefined ? ` · ${st.until - S.turn} seasons left` : ''}</span>`; }
  H.dipSel = (d) => { if (d.id === me()) { ui.tab = 'realm'; } else { ui.dip.target = d.id; ui.tab = 'diplomacy'; } render(); };
  function diplomacyPanel() {
    const f = me(), others = A.FIDS.filter((g) => g !== f);
    let h = '<h2>The Houses of Asterra</h2>';
    for (const g of others) {
      const fg = A.F(S, g);
      if (!fg.alive) { h += `<div class="drow dead">${chip(g)} <span class="note">fallen</span></div>`; continue; }
      const rel = A.getRel(S, f, g), st = A.dip.status(S, f, g);
      h += `<div class="drow ${ui.dip.target === g ? 'on' : ''}" data-a="dipSel" data-id="${g}">${chip(g)} <span class="grow"><small>${esc(A.O(S, fg.ruler).name)}</small></span> ${statusBadge(st)}<br>
        <small>Relations <b class="${rel < 0 ? 'neg' : 'pos'}">${sign(rel)}</b></small> ${relBar(rel)} <small>${A.provsOf(S, g).length} prov · strength ${A.strength(S, g)} · ✦${fg.seals.length}${fg.beast.awake ? ' ☄' : ''}</small></div>`;
    }
    const g = ui.dip.target;
    if (!g || !A.F(S, g) || !A.F(S, g).alive || S.over) return h + '<p class="note">Select a house to see what you can propose. Your strength: ' + A.strength(S, f) + '.</p>';
    const envoys = A.officersOf(S, f).sort((a, b) => b.dip - a.dip);
    const freeE = envoys.filter((o) => !A.officerFree(S, f, o.id, { gov: true }));
    if (!ui.dip.envoy || !freeE.some((o) => o.id === ui.dip.envoy)) ui.dip.envoy = freeE[0] ? freeE[0].id : null;
    const third = A.aliveFactions(S).filter((x) => x !== f && x !== g);
    if (!third.includes(ui.dip.against)) ui.dip.against = third[0] || null;
    const ties = A.aliveFactions(S).filter((x) => x !== f && x !== g).map((x) => { const st = A.dip.status(S, g, x); return st.type === 'neutral' ? null : `${st.type === 'war' ? 'at war with' : st.type + ' with'} ${A.FDEF[x].short}`; }).filter(Boolean);
    h += `<h3>Proposals to ${esc(A.fname(g))}</h3>${courtNote()}<div class="sub2">${ties.length ? 'They are ' + esc(ties.join('; ')) + '.' : 'They have no treaties or wars with other houses.'} ${A.F(S, f).awe[g] ? 'They are awed by your omen (+25% on your next proposal).' : ''}</div>
      <label>Envoy <select data-c="envoy">${envoys.map((o) => { const why = A.officerFree(S, f, o.id, { gov: true }); return `<option value="${o.id}" ${why ? 'disabled' : ''} ${ui.dip.envoy === o.id ? 'selected' : ''}>${esc(o.name)} — diplomacy ${o.dip}${why ? ' (unavailable)' : ''}</option>`; }).join('')}</select></label>
      ${freeE.length ? '' : '<p class="why">✖ No officer is free to act as envoy this season (each can carry one mission per season; commanders in the field cannot).</p>'}`;
    const prop = (type, extra, labelX) => {
      const args = Object.assign({ type, target: g, envoy: ui.dip.envoy }, extra || {}), T = A.dip.TYPES[type];
      const why = A.can(S, f, 'envoy', args);
      let odds = '';
      if (!why && type !== 'gift') { const ch = A.dip.chance(S, f, args); odds = `<span class="pct ${ch.pct >= 60 ? 'pos' : ch.pct < 35 ? 'neg' : ''}" title="${esc(ch.parts.map((p) => `${p[0]}: ${sign(p[1])}`).join('\n'))}">${ch.pct}%</span><details><summary>why?</summary>${ch.parts.map((p) => `<div class="kv"><span>${esc(p[0])}</span><b>${sign(p[1])}</b></div>`).join('')}<div class="kv"><span>Chance (3–95%)</span><b>${ch.pct}%</b></div></details>`; }
      return `<div class="prop"><div class="act"><button data-a="do" data-id="envoy" data-args="${esc(JSON.stringify(args))}" ${why ? 'disabled' : ''}>${T.label}${labelX || ''}</button>${odds}<span class="${why ? 'why' : 'note'}">${why ? '✖ ' + esc(why) : ''}</span></div><div class="note">${esc(T.desc)}</div></div>`;
    };
    h += `<div class="prop"><div class="note">${esc(A.dip.TYPES.gift.desc)}</div><div class="grid3">${[50, 100, 200].map((n) => { const args = { type: 'gift', target: g, envoy: ui.dip.envoy, amount: n }, why = A.can(S, f, 'envoy', args); return `<button data-a="do" data-id="envoy" data-args="${esc(JSON.stringify(args))}" ${why ? `disabled title="${esc(why)}"` : ''}>Gift ${n} gold</button>`; }).join('')}</div></div>`;
    h += prop('pact') + prop('alliance') + prop('truce') + prop('passage') + prop('tribute');
    h += `<label>March against <select data-c="against">${third.map((x) => `<option value="${x}" ${ui.dip.against === x ? 'selected' : ''}>${esc(A.fname(x))}</option>`).join('')}</select></label>` + prop('support', { against: ui.dip.against }, ui.dip.against ? ` vs ${A.FDEF[ui.dip.against].short}` : '');
    h += prop('surrender') + prop('seal');
    return h;
  }
  document.addEventListener('change', (e) => { const el = e.target.closest('[data-c]'); if (!el || !S) return; ui.dip[el.dataset.c] = el.value; render(); });

  function beastPanel() {
    const f = me(), fac = A.F(S, f);
    let h = `<h2>☄ ${A.BEAST}</h2><p class="note">A celestial beast bound to the crown by five seals. Whoever holds three may wake it. It turns battles and awes courts — but only a few times a year, at a price, and never alone.</p><h3>The five seals</h3>`;
    for (const k of Object.keys(A.SEALS)) {
      const holder = A.beast.holder(S, k), site = A.provs(S).find((p) => p.seal === k);
      h += `<div class="kv"><span>✦ ${A.SEALS[k]}</span><b>${holder ? chip(holder) : site && site.sealKnown ? `Hidden at <a data-a="prov" data-id="${site.id}">${esc(site.landmark)}, ${esc(site.name)}</a>` : '<span class="note">Lost — at one of the ancient sites</span>'}</b></div>`;
    }
    const unsearched = A.SEAL_SITES.map((id) => A.P(S, id)).filter((p) => !p.searched);
    h += `<p class="note">Ancient sites not yet cleared: ${unsearched.map((p) => `<a data-a="prov" data-id="${p.id}">${esc(p.name)}</a>`).join(', ') || 'none'}. Three of the four hide a seal. Hold the province and send an officer to search (rumours raise the odds). A house's seals are captured with its seat, or can be bought through diplomacy.</p>`;
    if (S.over) return h;
    h += `<h3>The rite</h3>${courtNote()}${actBtn('Awaken the Starwyrm', 'awaken', {}, `${A.cost.awakenGold} gold, ${A.cost.awakenFood} food · every court −12 relations`)}`;
    h += `<div class="kvs">${kv('Status', fac.beast.awake ? 'Awake' : 'Slumbering')}${kv('Starfire charges', `${fac.beast.charges} / ${fac.seals.length}`, 'One charge returns each spring, up to the number of seals you hold.')}</div>`;
    h += '<h3>Celestial omens <small>(1 charge)</small></h3>';
    const p = A.P(S, ui.sel);
    h += actBtn(`Calm ${p && p.owner === f ? esc(p.name) : 'the selected province'}`, 'omen', { mode: 'calm', p: ui.sel }, 'unrest → 0, loyalty +20');
    for (const g of A.aliveFactions(S)) if (g !== f) h += actBtn(`Awe ${A.FDEF[g].short}`, 'omen', { mode: 'awe', target: g }, '+25% on your next proposal to them');
    h += `<h3>Rules</h3><ul class="rules"><li><b>Starfall</b> (in battle, once per battle, 1 charge): every enemy unit loses 10% of its men and 22 morale. It breaks wavering armies; it does not win battles outright.</li><li><b>Seal-ward:</b> a house holding even one seal halves Starfall against it.</li><li><b>Dread:</b> every use costs −4 relations with all other houses.</li><li><b>Slumber:</b> fall below three seals (for example by losing your seat) and the beast sleeps again.</li><li>Rivals can gather seals and wake it too — watch the chronicle.</li></ul>`;
    return h;
  }

  function guideHTML() {
    return `<h3>The goal</h3><p>You are the boss of one house. Five other houses want the same crown. Grab land, beat them or make friends with them, and become king or queen.</p>
      <h3>Your turn</h3><ol class="rules"><li><b>Look at the map.</b> Click a province to see it. Your land is in your colour.</li><li><b>Give each province one job.</b> Every province you own can do <b>one thing</b> per turn: get more soldiers, build stuff, cheer people up, pick a governor, or make an army. Sending messengers, giving gifts to your officers, and other "king stuff" also uses up one province's job.</li><li><b>Gold dot = not done yet.</b> Press <b>Next ▶</b> (or the N key) to jump to the next province that still needs a job.</li><li><b>Moving is free.</b> Marching an army and moving soldiers around do not use up a job.</li><li><b>Press End Season.</b> The other houses take their turns, fights happen, and you get paid. One turn is one season. Four seasons make a year.</li></ol><p class="note">Can't click a button? Look under it. It always tells you why.</p>
      <h3>Money and food</h3><ul class="rules"><li><b>Gold</b> buys things. <b>Food</b> feeds your soldiers. Every soldier costs both, every turn.</li><li>You get lots of food in <b>autumn</b> and almost none in <b>winter</b>. Save up before winter!</li><li>The top bar shows if you are gaining or losing this turn.</li><li>Keep your people happy. If <b>unrest</b> gets very high and <b>loyalty</b> gets very low, the province rebels and you lose it. Parties (festivals), food aid and a good governor fix that.</li></ul>
      <h3>Fighting</h3><ul class="rules"><li>Soldiers sitting in a province only <b>defend</b> it. To attack, you need an <b>army</b>.</li><li>Press <b>Muster Army</b> to make one. You need soldiers and an officer who isn't busy.</li><li>Click the army's little flag on the map, then click where to go. <b>Green</b> = safe move. <b>Red</b> = attack!</li><li>Armies move 1 province per turn, or 2 if they stay on friendly land.</li><li>Before a fight you see both sides and who is likely to win. Then pick: <b>fight it yourself</b>, or let your officer <b>fight for you</b>.</li></ul>
      <h3>In a battle</h3><ul class="rules"><li>Each round you get to use a few units. A better leader lets you use more.</li><li>A unit can move, then do one thing: attack, shoot, hold still, or smash a wall.</li><li><b>Infantry</b> (foot soldiers): tough all-rounders. They can climb walls.</li><li><b>Archers</b>: shoot from far away. Weak up close.</li><li><b>Cavalry</b> (horses): fast. They hit extra hard after a running start and they wreck archers. Don't run them into infantry that is holding still.</li><li><b>Siege crews</b>: slow, but they knock down walls.</li><li><b>Gang up!</b> If two of your units are touching the same enemy, you hit harder.</li><li>Units that get scared or lose most of their men <b>run away</b>.</li><li>The attacker has <b>12 rounds</b> to win. If time runs out, the defender wins. Attacking in winter is harder.</li></ul>
      <h3>Making friends</h3><ul class="rules"><li>Open the <b>Diplomacy</b> tab to make deals. Every deal shows your <b>chance</b> of a yes and why.</li><li><b>Gifts</b> always work and make a house like you more.</li><li>A <b>pact</b> or <b>alliance</b> stops a house from attacking you.</li><li>Don't break a deal. Everyone remembers, and everyone trusts you less.</li></ul>
      <h3>The Starwyrm (the dragon)</h3><p class="note">There are 5 magic seals. Find them at old ruins (gold stars on the map), take them from a house by capturing its home castle, or trade for them. Get <b>3 seals</b> and pay a big price to wake the dragon. Then you can use its power in battle. The <b>Starwyrm</b> tab has the details.</p>
      <h3>How you lose</h3><ul class="rules"><li>You lose all your land.</li><li>Your ruler dies and there is nobody to take over. Name an <b>heir</b> so that can't happen.</li><li>Another house wins first.</li></ul>`;
  }
  function guidePanel() { return `<h2>Guide</h2><div class="row"><button data-a="tutorial">Replay the tutorial</button></div>${guideHTML()}${victoryBox()}`; }
  H.guide = async () => { await ask(`<h2>How to Play</h2>${guideHTML()}<div class="row">${btn('Close', 'ok', 'go')}</div>`, 'wide'); };

  // ---------- Tutorial ----------
  const TUT = [
    ['Welcome to Asterra', (s) => `<p>You are the boss of <b>${esc(A.fname(s.player))}</b>. The old king is gone, and six houses all want the crown. You are one of them. Go get it!</p><p>Your land is in your colour. Each province shows the shield of whoever owns it. A <b>grey shield</b> means nobody owns it — those are the easy ones to grab first. Two towers mark a house's home castle. The crown marks the capital. A gold star marks old ruins.</p>`],
    ['One job per province', () => '<p>Every turn, each province you own can do <b>one thing</b>: get soldiers, build, cheer people up, pick a governor, or make an army.</p><p>A <b>gold dot</b> means that province hasn\'t done its job yet. Press <b>Next ▶</b> at the top to jump to the next one.</p><p>More land = more jobs per turn. And if a button is greyed out, it always says <b>why</b> right under it.</p>'],
    ['Armies', () => '<p>Soldiers in a province only <b>defend</b>. To attack, press <b>Muster Army</b> to make an army with an officer in charge.</p><p>Then click the army\'s flag on the map and click where to go. <b>Green</b> is a safe move. <b>Red</b> is an attack.</p><p>Before a fight you see who is likely to win. You can <b>fight it yourself</b> or let your officer <b>fight for you</b>.</p>'],
    ['Gold, food and happy people', () => '<p>Soldiers cost <b>gold</b> and <b>food</b> every turn. You get lots of food in autumn and almost none in winter, so save up!</p><p>The top bar shows if you are gaining or losing this turn.</p><p>If people get too unhappy, the province <b>rebels</b> and you lose it. Throw a festival, hand out food, or put a good governor in charge.</p>'],
    ['Friends and the dragon', () => '<p>In the <b>Diplomacy</b> tab you can make deals with other houses. Every deal shows your chance of getting a yes. They will send deals to you too.</p><p>There are 5 magic seals in the world. Collect <b>3</b> to wake a sleeping dragon, the <b>Starwyrm</b>, and use its power in battle.</p>'],
    ['How to win', () => `<p><b>Way 1 — Take over:</b> own the capital, Aurelion, and ${A.WIN_PROVINCES} of the 24 provinces.</p><p><b>Way 2 — Be the king everyone agrees on:</b> hold Aurelion for ${A.RECOG_SEASONS} turns, own ${A.RECOG_PROVINCES} provinces, name an heir, and have a pact or alliance with every house still alive.</p><p>Stuck? The <b>Advisor</b> line above the panel always tells you a good next move. Have fun!</p>`],
  ];
  async function tutorial(force) {
    if (!force && S.tutorial) return;
    for (let i = 0; i < TUT.length; i++) {
      const ans = await ask(`<div class="sub2">Tutorial ${i + 1} / ${TUT.length}</div><h2>${TUT[i][0]}</h2>${TUT[i][1](S)}<div class="row">${btn(i === TUT.length - 1 ? 'Begin' : 'Next ▶', 'next', 'go')}${i < TUT.length - 1 ? btn('Skip tutorial', 'skip') : ''}</div>`);
      if (ans.v === 'skip') break;
    }
    S.tutorial = 1;
  }
  H.tutorial = () => tutorial(true);

  // ---------- Turn flow ----------
  async function turnStart() {
    if (!S || S.over) return;
    while (S.inbox.length) {
      const it = S.inbox[0];
      if (!A.dip.inboxValid(S, it)) { S.inbox.shift(); continue; }
      const rel = A.getRel(S, me(), it.from);
      const ans = await ask(`<div class="sub2">An envoy arrives</div><h2>${chip(it.from)} ${esc(A.dip.TYPES[it.type].label)}</h2><p>${esc(A.dip.inboxText(S, it))}</p><p class="note">${esc(A.dip.TYPES[it.type].desc)} Relations with them: ${sign(rel)}. Their strength ${A.strength(S, it.from)}, yours ${A.strength(S, me())}. Refusing costs ${it.type === 'tribute' ? '12 relations and means war' : '3 relations'}.</p><div class="row">${btn('Accept', 'yes', 'go')}${btn('Refuse', 'no')}</div>`);
      const text = A.dip.answer(S, 0, ans.v === 'yes'); if (text) toast(text); render();
    }
    if (S.pendingEvent) {
      const v = A.events.view(S, S.pendingEvent);
      const ans = await ask(`<div class="sub2">${A.dateStr(S)} · Event</div><h2>${esc(v.title)}</h2><p>${esc(v.text)}</p>${v.choices.map((c, i) => `<div class="act"><button data-a="ans" data-v="${i}" ${c.why ? 'disabled' : ''}>${esc(c.label)}</button><span class="${c.why ? 'why' : 'note'}">${c.why ? '✖ ' + esc(c.why) + ' ' : ''}${esc(c.hint || '')}</span></div>`).join('')}`);
      const r = A.events.choose(S, +ans.v); render();
      await ask(`<h2>${esc(v.title)}</h2><p>${esc(r.ok ? r.text : r.reason)}</p><div class="row">${btn('Continue', 'ok', 'go')}</div>`);
    }
    autosave(); render();
  }
  function autosave() { if (S && A.store.ok()) A.store.save(S, 'auto'); }
  H.endSeason = async () => {
    if (ui.busy || S.over) return;
    const fac = A.F(S, me()), idle = A.armiesOf(S, me()).filter((a) => !a.moved).length;
    const waiting = A.provsOf(S, me()).filter((p) => !p.acted);
    if (waiting.length && S.turn < 4) { const ans = await ask(`<h2>End the season?</h2><p><b>${waiting.length}</b> province${waiting.length > 1 ? 's have' : ' has'} not yet acted (${esc(waiting.map((p) => p.name).join(', '))})${idle ? `, and ${idle} army has not marched` : ''}. Unused commands are lost.</p><p class="note">(This reminder stops after your first year.)</p><div class="row">${btn('End season', 'yes', 'go')}${btn('Keep commanding', 'no')}</div>`); if (ans.v !== 'yes') return; }
    ui.mode = null; ui.busy = true; render();
    try { await A.turn.endSeason(S, handler); } finally { ui.busy = false; }
    render();
    if (S.over) { autosave(); await summary(); } else await turnStart();
  };

  // ---------- Save / load / menu / summary ----------
  H.saves = async () => {
    if (ui.busy) return;
    const names = { auto: 'Autosave', 1: 'Slot 1', 2: 'Slot 2', 3: 'Slot 3' };
    const rows = A.SLOTS.map((k) => { const m = A.store.meta(k); return `<div class="orow"><div><b>${names[k]}</b><br><small>${m ? `${esc(m.house)} · ${esc(m.date)} · ${m.provinces} provinces · ${esc(m.difficulty)} · saved ${new Date(m.at).toLocaleString()}` : 'empty'}</small></div><div class="btns">${S && k !== 'auto' ? `<button data-a="ans" data-v="save:${k}">Save</button>` : ''}<button data-a="ans" data-v="load:${k}" ${m ? '' : 'disabled'}>Load</button>${m && k !== 'auto' ? `<button data-a="ans" data-v="del:${k}">Delete</button>` : ''}</div></div>`; }).join('');
    const ans = await ask(`<h2>Save / Load</h2>${A.store.ok() ? '' : '<p class="why">Local storage is unavailable in this browser, so saves cannot be written.</p>'}<p class="note">The game autosaves at the start of every season. Saves live in this browser.</p>${rows}<div class="row">${btn('Close', 'close')}</div>`);
    const [op, k] = ans.v.split(':');
    if (op === 'save') { const r = A.store.save(S, k); toast(r.ok ? `Saved to ${names[k]}.` : r.reason); }
    else if (op === 'load') { if (S && !S.over) { const c = await ask(`<h2>Load ${names[k]}?</h2><p>Unsaved progress in the current campaign will be lost.</p><div class="row">${btn('Load', 'yes', 'go')}${btn('Cancel', 'no')}</div>`); if (c.v !== 'yes') return; } await loadSlot(k); }
    else if (op === 'del') { A.store.remove(k); toast(`${names[k]} deleted.`); return H.saves(); }
  };
  H.menu = async () => {
    const ans = await ask(`<h2>Menu</h2><p class="note">${esc(A.fname(me()))} · ${A.dateStr(S)} · ${A.DIFF[S.difficulty].name} · seed ${S.seed0}</p><div class="menu">${btn('Resume', 'resume', 'big go')}${btn('How to play', 'guide', 'big')}${btn('Quit to title (autosaves)', 'quit', 'big')}</div>`);
    if (ans.v === 'guide') return H.guide();
    if (ans.v === 'quit') { if (!S.over) autosave(); H.title(); }
  };
  async function summary() {
    const o = S.over; if (!o) return;
    const st = S.stats, won = o.result === 'victory';
    const stands = A.FIDS.map((f) => `<div class="kv"><span>${chip(f)} ${A.F(S, f).alive ? '' : '<small>fallen</small>'}</span><b>${A.provsOf(S, f).length} provinces</b></div>`).join('');
    const story = S.log.filter((l) => l.k === 'event').slice(-10).map((l) => `<div><small>${A.dateStr(S, l.t)}</small> ${esc(l.text)}</div>`).join('');
    const ans = await ask(`<div class="sub2">${A.dateStr(S)} · ${A.DIFF[S.difficulty].name} · seed ${S.seed0}</div><h2 class="${won ? 'pos' : 'neg'}">${won ? '♛ Victory — ' + (o.kind === 'unification' ? 'Asterra United' : 'A Recognized Succession') : '✖ Defeat'}</h2><p>${esc(o.text)}</p>
      <div class="cols"><div><h3>Your reign</h3>${kv('Seasons ruled', S.turn)}${kv('Provinces at the end', A.provsOf(S, me()).length)}${kv('Most provinces held', st.peakProvinces)}${kv('Battles won / lost', `${st.battlesWon} / ${st.battlesLost}`)}${kv('Provinces taken / lost', `${st.provincesTaken} / ${st.provincesLost}`)}${kv('Soldiers lost / enemies felled', `${st.menLost} / ${st.enemiesSlain}`)}${kv('Treaties sealed', st.treaties)}${kv('Gold collected', st.goldEarned)}${kv('Starwyrm called upon', st.beastUses)}</div>
      <div><h3>The realm</h3>${stands}</div></div><h3>Chronicle</h3><div class="blog">${story}</div>
      <div class="row">${btn('New campaign', 'new', 'go')}${btn('Look over the map', 'map')}${btn('Title screen', 'title')}</div>`, 'wide');
    if (ans.v === 'new') { ui.screen = 'new'; S = null; ui.s = null; render(); } else if (ans.v === 'title') H.title(); else render();
  }
  H.summary = () => summary();

  // ---------- Render ----------
  function renderLog() {
    const rows = S.log.slice(-80).map((l) => `<div class="l-${l.k}"><small>${A.dateStr(S, l.t)}</small> ${esc(l.text)}</div>`).join('');
    return `<footer class="log" id="log"><div class="logt">Chronicle</div>${rows}</footer>`;
  }
  function render() {
    if (ui.screen === 'title') return renderTitle();
    if (ui.screen === 'new') return renderNew();
    const side = $('.panel'), keep = side ? side.scrollTop : 0, keepTab = side ? side.dataset.tab : null;
    $('#app').innerHTML = `<div class="game ${ui.busy ? 'busy' : ''}">${renderTop()}<div class="mapwrap">${modeBanner()}${mapSVG()}${legend()}</div>${renderSide()}${renderLog()}</div>`;
    const np = $('.panel'); np.dataset.tab = ui.tab + ':' + ui.sel + ':' + ui.dip.target; if (keepTab === np.dataset.tab) np.scrollTop = keep;
    const lg = $('#log'); lg.scrollTop = lg.scrollHeight;
  }
  A.render = render;

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
    const fn = H[el.dataset.a]; if (!fn) return;
    if (ui.busy && !el.closest('#modal') && !el.closest('#battle')) return;
    Promise.resolve().then(() => fn(el.dataset, el, e)).catch((err) => { console.error(err); ui.busy = false; toast('Something went wrong: ' + err.message); try { render(); } catch (e2) { /* ignore */ } });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.mode) { ui.mode = null; render(); }
    if ((e.key === 'n' || e.key === 'N') && S && ui.screen === 'game' && !ui.busy && !S.over && $('#modal').hidden && $('#battle').hidden && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) H.nextProv();
  });
  window.addEventListener('error', (e) => { toast('Unexpected error: ' + e.message); });
  render();
})();
