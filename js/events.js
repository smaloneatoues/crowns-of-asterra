// Seasonal events. Every event offers choices, so nothing is simply taken from the player.
(function () {
  const A = globalThis.A;
  const cl = A.clamp;
  const others = (s, f) => A.officersOf(s, f).filter((o) => !o.ruler);
  const goldWhy = (n) => (s, f) => (A.F(s, f).gold >= n ? null : `Needs ${n} gold.`);
  const foodWhy = (n) => (s, f) => (A.F(s, f).food >= n ? null : `Needs ${n} food.`);

  const DEFS = [
    { id: 'blight', title: 'Blight in the Fields', w: 10,
      pick(s, f) { const q = s.turn % 4; if (q !== 1 && q !== 2) return null; const ps = A.provsOf(s, f); return ps.length ? { p: A.pick(s, ps).id } : null; },
      text: (s, f, c) => `Blight creeps through the fields of ${A.P(s, c.p).name}. Without help, the farmers there face a hungry year.`,
      choices: [
        { label: 'Buy seed grain from merchants', hint: '−60 gold. No other effect.', why: goldWhy(60), run(s, f, c) { A.F(s, f).gold -= 60; return `Merchant grain saves the harvest in ${A.P(s, c.p).name}.`; } },
        { label: 'Open the granaries', hint: '−80 food, loyalty +4 there.', why: foodWhy(80), run(s, f, c) { const p = A.P(s, c.p); A.F(s, f).food -= 80; p.loyalty = cl(p.loyalty + 4, 0, 100); return `Your stores feed ${p.name}; the people remember it.`; } },
        { label: 'Let the province fend for itself', hint: 'Farms −3, loyalty −10, unrest +12 there.', run(s, f, c) { const p = A.P(s, c.p); p.farms = Math.max(5, p.farms - 3); p.loyalty = cl(p.loyalty - 10, 0, 100); p.unrest = cl(p.unrest + 12, 0, 100); return `${p.name} goes hungry and blames its lord.`; } },
      ] },
    { id: 'bounty', title: 'A Golden Harvest', w: 8,
      pick(s, f) { if (s.turn % 4 !== 2) return null; const ps = A.provsOf(s, f); return ps.length ? { p: A.pick(s, ps).id } : null; },
      text: (s, f, c) => `The barns of ${A.P(s, c.p).name} overflow. Your steward asks what should be done with the surplus.`,
      choices: [
        { label: 'Store it for winter', hint: '+90 food.', run(s, f) { A.F(s, f).food += 90; return 'The surplus is laid up against the winter (+90 food).'; } },
        { label: 'Hold a harvest fair', hint: 'Loyalty +10, unrest −8 there.', run(s, f, c) { const p = A.P(s, c.p); p.loyalty = cl(p.loyalty + 10, 0, 100); p.unrest = cl(p.unrest - 8, 0, 100); return `${p.name} feasts in your name.`; } },
        { label: 'Sell it', hint: '+50 gold.', run(s, f) { A.F(s, f).gold += 50; return 'The surplus is sold at market (+50 gold).'; } },
      ] },
    { id: 'riot', title: 'Riot!', w: 12,
      pick(s, f) { const ps = A.provsOf(s, f).filter((p) => p.unrest >= 40).sort((a, b) => b.unrest - a.unrest); return ps.length ? { p: ps[0].id } : null; },
      text: (s, f, c) => `Crowds fill the streets of ${A.P(s, c.p).name} (unrest ${A.P(s, c.p).unrest}). Stones are thrown at the tax house.`,
      choices: [
        { label: 'Send in the garrison', hint: 'Unrest −20, loyalty −8, lose 5% of the garrison infantry.', run(s, f, c) { const p = A.P(s, c.p); p.unrest = cl(p.unrest - 20, 0, 100); p.loyalty = cl(p.loyalty - 8, 0, 100); p.garrison.inf = Math.floor(p.garrison.inf * 0.95); return `The streets of ${p.name} are cleared by force.`; } },
        { label: 'Hear their grievances', hint: '−50 gold. Unrest −15, loyalty +6.', why: goldWhy(50), run(s, f, c) { const p = A.P(s, c.p); A.F(s, f).gold -= 50; p.unrest = cl(p.unrest - 15, 0, 100); p.loyalty = cl(p.loyalty + 6, 0, 100); return `Petitions are heard and debts forgiven in ${p.name}.`; } },
        { label: 'Wait it out', hint: 'Unrest +8.', run(s, f, c) { const p = A.P(s, c.p); p.unrest = cl(p.unrest + 8, 0, 100); return `The riot in ${p.name} burns itself out, for now.`; } },
      ] },
    { id: 'dispute', title: 'A Quarrel at Court', w: 9,
      pick(s, f) { const os = others(s, f); if (os.length < 2) return null; const a = A.pick(s, os); const b = A.pick(s, os.filter((o) => o.id !== a.id)); return { a: a.id, b: b.id }; },
      text: (s, f, c) => `${A.O(s, c.a).name} and ${A.O(s, c.b).name} have quarrelled bitterly over precedence. Both demand you take their side.`,
      choices: [
        { label: (s, f, c) => `Side with ${A.O(s, c.a).name}`, hint: 'Their loyalty +6; the other −12.', run(s, f, c) { const a = A.O(s, c.a), b = A.O(s, c.b); a.loyalty = cl(a.loyalty + 6, 0, 100); b.loyalty = cl(b.loyalty - 12, 0, 100); return `You rule for ${a.name}. ${b.name} leaves the hall in silence.`; } },
        { label: (s, f, c) => `Side with ${A.O(s, c.b).name}`, hint: 'Their loyalty +6; the other −12.', run(s, f, c) { const a = A.O(s, c.a), b = A.O(s, c.b); b.loyalty = cl(b.loyalty + 6, 0, 100); a.loyalty = cl(a.loyalty - 12, 0, 100); return `You rule for ${b.name}. ${a.name} leaves the hall in silence.`; } },
        { label: 'Reconcile them with gifts', hint: '−60 gold. Both +3 loyalty.', why: goldWhy(60), run(s, f, c) { const a = A.O(s, c.a), b = A.O(s, c.b); A.F(s, f).gold -= 60; a.loyalty = cl(a.loyalty + 3, 0, 100); b.loyalty = cl(b.loyalty + 3, 0, 100); return 'Gold soothes pride; the quarrel is mended.'; } },
      ] },
    { id: 'border', title: 'Border Incident', w: 9,
      pick(s, f) { const gs = new Set(); for (const p of A.provsOf(s, f)) for (const n of p.nb) { const o = A.P(s, n).owner; if (o && o !== f && !A.allied(s, f, o) && !A.atWar(s, f, o)) gs.add(o); } const list = [...gs]; return list.length ? { g: A.pick(s, list) } : null; },
      text: (s, f, c) => `Your patrols and riders of ${A.fname(c.g)} have come to blows over a boundary stone. Three men are dead and both sides claim the insult.`,
      choices: [
        { label: 'Send an apology and compensation', hint: '−40 gold. Relations +10.', why: goldWhy(40), run(s, f, c) { A.F(s, f).gold -= 40; A.addRel(s, f, c.g, 10); return `${A.fname(c.g)} accepts your apology.`; } },
        { label: 'Demand satisfaction', hint: (s, f) => `${cl(30 + Math.round(A.O(s, A.F(s, f).ruler).dip * 0.5), 5, 90)}% (ruler's diplomacy): +40 gold. Otherwise relations −15.`, run(s, f, c) { if (A.chance(s, cl(30 + Math.round(A.O(s, A.F(s, f).ruler).dip * 0.5), 5, 90))) { A.F(s, f).gold += 40; A.addRel(s, f, c.g, -3); return `${A.fname(c.g)} grudgingly pays 40 gold in blood-price.`; } A.addRel(s, f, c.g, -15); return `${A.fname(c.g)} rejects your demand with contempt (relations −15).`; } },
        { label: 'Ignore it', hint: 'Relations −6.', run(s, f, c) { A.addRel(s, f, c.g, -6); return 'The matter is left to fester.'; } },
      ] },
    { id: 'heir', title: 'The Question of Succession', w: 7,
      pick(s, f) { const fac = A.F(s, f); if (fac.heir && A.O(s, fac.heir).status === 'active' && A.O(s, fac.heir).faction === f) return null; const os = others(s, f).sort((a, b) => b.loyalty - a.loyalty); return os.length >= 2 ? { a: os[0].id, b: os[1].id } : null; },
      text: (s, f, c) => `Your council presses you: the house has no named heir. Should you fall, the realm may fracture. ${A.O(s, c.a).name} and ${A.O(s, c.b).name} are the leading candidates.`,
      choices: [
        { label: (s, f, c) => `Name ${A.O(s, c.a).name}`, hint: 'Their loyalty +12, other officers −4. Needed for a recognized succession.', run(s, f, c) { return A.actions.heir.run(s, f, { o: c.a }, A.F(s, f)); } },
        { label: (s, f, c) => `Name ${A.O(s, c.b).name}`, hint: 'Their loyalty +12, other officers −4. Needed for a recognized succession.', run(s, f, c) { return A.actions.heir.run(s, f, { o: c.b }, A.F(s, f)); } },
        { label: 'Not yet', hint: 'No effect. You can name an heir later from the Officers tab.', run() { return 'The question of succession is left open.'; } },
      ] },
    { id: 'rumor', title: 'A Pilgrim’s Tale', w: 10,
      pick(s) { const ps = A.provs(s).filter((p) => p.seal && !p.sealKnown); return ps.length ? { p: A.pick(s, ps).id } : null; },
      text: () => `A ragged pilgrim claims to have seen star-fire burning under old stones — one of the lost seals of ${A.BEAST}. For a price, she will say where.`,
      choices: [
        { label: 'Pay for the full tale', hint: '−40 gold. Reveals a seal site and gives +25% to searches there.', why: goldWhy(40), run(s, f, c) { const p = A.P(s, c.p); A.F(s, f).gold -= 40; p.sealKnown = true; return `She swears a seal lies beneath ${p.landmark} in ${p.name}. Whoever holds that province can search for it.`; } },
        { label: 'Send her away', hint: 'No effect.', run() { return 'The pilgrim shrugs and takes her tale elsewhere.'; } },
      ] },
    { id: 'wanderer', title: 'A Sword for Hire', w: 8,
      pick(s) { const w = s.wanderers.filter((id) => s.officers[id].status === 'wanderer'); return w.length ? { o: A.pick(s, w) } : null; },
      text: (s, f, c) => { const o = A.O(s, c.o); return `${o.name} seeks a place at your court. ${o.bio} (Leadership ${o.lead}, Administration ${o.admin}, Diplomacy ${o.dip}.)`; },
      choices: [
        { label: 'Welcome them', hint: '−50 gold. Gain an officer.', why: goldWhy(50), run(s, f, c) { const o = A.O(s, c.o); A.F(s, f).gold -= 50; o.faction = f; o.status = 'active'; o.loc = A.F(s, f).seat; o.job = null; s.wanderers = s.wanderers.filter((x) => x !== o.id); if (!A.isMe(s, f)) A.log(s, `${o.name} enters the service of ${A.fname(f)}.`, 'event'); return `${o.name} swears to your banner.`; } },
        { label: 'Decline', hint: 'No effect.', run(s, f, c) { return `${A.O(s, c.o).name} rides on.`; } },
      ] },
    { id: 'caravan', title: 'The Great Caravan', w: 8,
      pick(s, f) { return { p: A.F(s, f).seat }; },
      text: (s, f, c) => `A caravan of foreign merchants reaches ${A.P(s, c.p).name} and petitions for the right to trade.`,
      choices: [
        { label: 'Grant them a charter', hint: '+60 gold now, prosperity +3 there.', run(s, f, c) { const p = A.P(s, c.p); A.F(s, f).gold += 60; p.pros = Math.min(100, p.pros + 3); return 'The charter is sealed; trade flows.'; } },
        { label: 'Tax them heavily', hint: '+130 gold now, prosperity −4 and loyalty −4 there.', run(s, f, c) { const p = A.P(s, c.p); A.F(s, f).gold += 130; p.pros = Math.max(5, p.pros - 4); p.loyalty = cl(p.loyalty - 4, 0, 100); return 'The merchants pay and swear never to return.'; } },
      ] },
    { id: 'turmoil', title: 'A Rival Court Divided', w: 7, playerOnly: true,
      pick(s, f) { const gs = A.aliveFactions(s).filter((g) => g !== f && others(s, g).length >= 2); return gs.length ? { g: A.pick(s, gs) } : null; },
      text: (s, f, c) => `Word arrives that the court of ${A.fname(c.g)} is split by a succession dispute. Their envoys quietly ask where you stand.`,
      choices: [
        { label: 'Back the rightful heir', hint: '−60 gold. Relations +18.', why: goldWhy(60), run(s, f, c) { A.F(s, f).gold -= 60; A.addRel(s, f, c.g, 18); return `${A.fname(c.g)} will remember your support.`; } },
        { label: 'Fan the flames', hint: 'Their provinces unrest +8, their officers loyalty −6, relations −12.', run(s, f, c) { for (const p of A.provsOf(s, c.g)) p.unrest = cl(p.unrest + 8, 0, 100); for (const o of others(s, c.g)) o.loyalty = cl(o.loyalty - 6, 0, 100); A.addRel(s, f, c.g, -12); return `Your agents spread whispers through the lands of ${A.fname(c.g)}.`; } },
        { label: 'Stay out of it', hint: 'No effect.', run() { return 'You keep your own counsel.'; } },
      ] },
  ];

  const ev = (A.events = { DEFS, BY: {} });
  for (const d of DEFS) ev.BY[d.id] = d;

  ev.roll = function (s, f, forAI) {
    // The same event never returns to the player within two years.
    const cool = forAI ? {} : (s.evCool = s.evCool || {});
    const pool = [];
    for (const d of DEFS) { if (forAI && d.playerOnly) continue; if (cool[d.id] !== undefined && s.turn - cool[d.id] < 8) continue; const c = d.pick(s, f); if (c) pool.push([d, c]); }
    if (!pool.length) return null;
    let sum = pool.reduce((n, x) => n + x[0].w, 0), r = A.rnd(s) * sum, hit = pool[0];
    for (const x of pool) { r -= x[0].w; if (r <= 0) { hit = x; break; } }
    cool[hit[0].id] = s.turn;
    return { id: hit[0].id, ctx: hit[1] };
  };
  const val = (v, s, f, c) => (typeof v === 'function' ? v(s, f, c) : v);
  ev.view = function (s, e, f) {
    f = f || s.player; const d = ev.BY[e.id];
    return { title: d.title, text: d.text(s, f, e.ctx), choices: d.choices.map((ch) => ({ label: val(ch.label, s, f, e.ctx), hint: val(ch.hint, s, f, e.ctx), why: ch.why ? ch.why(s, f, e.ctx) : null })) };
  };
  ev.choose = function (s, i) {
    const e = s.pendingEvent; if (!e) return { ok: false, reason: 'No event is pending.' };
    const d = ev.BY[e.id], ch = d.choices[i]; if (!ch) return { ok: false, reason: 'No such choice.' };
    const why = ch.why ? ch.why(s, s.player, e.ctx) : null; if (why) return { ok: false, reason: why };
    const text = ch.run(s, s.player, e.ctx);
    s.pendingEvent = null; A.log(s, `${d.title}: ${text}`, 'me');
    return { ok: true, text };
  };
  // AI houses (and an auto-played player) take the first choice they can afford.
  ev.auto = function (s, f) {
    const e = ev.roll(s, f, true); if (!e) return;
    const d = ev.BY[e.id];
    for (const ch of d.choices) { if (ch.why && ch.why(s, f, e.ctx)) continue; ch.run(s, f, e.ctx); return; }
  };
})();
