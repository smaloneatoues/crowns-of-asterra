// Medieval artwork, all drawn in code: house heraldry, officer portraits, ink icons, and the territory chart.
(function () {
  const A = globalThis.A;
  const art = (A.art = {});
  const INK = '#2a1c0e';
  const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  // ---------- Heraldry ----------
  const HERALD = {
    val: { metal: '#3a2400', charge: 'crown' }, dra: { metal: '#f4ead0', charge: 'chevron' }, tho: { metal: '#f4ead0', charge: 'tree' },
    sun: { metal: '#f4ead0', charge: 'waves' }, ash: { metal: '#e9e2f2', charge: 'crescent' }, sto: { metal: '#f8f1cf', charge: 'bolt' },
  };
  const SHIELD = 'M2 2 H38 V26 C38 38 28 44 20 47 C12 44 2 38 2 26 Z';
  const CHARGE = {
    crown: (m) => `<path d="M9 31 V17 L15 24 L20 13 L25 24 L31 17 V31 Z" fill="${m}"/><rect x="9" y="33" width="22" height="3" fill="${m}"/>`,
    chevron: (m) => `<polygon points="5,33 20,13 35,33 35,40 20,21 5,40" fill="${m}"/>`,
    tree: (m) => `<polygon points="20,7 32,29 8,29" fill="${m}"/><rect x="18" y="29" width="4" height="9" fill="${m}"/>`,
    waves: (m) => [15, 24, 33].map((y) => `<path d="M6 ${y} q3.5 -6 7 0 t7 0 t7 0 t7 0" fill="none" stroke="${m}" stroke-width="3.2" stroke-linecap="round"/>`).join(''),
    crescent: (m) => `<path d="M29 10 A14 14 0 1 0 29 38 A17 17 0 0 1 29 10 Z" fill="${m}"/>`,
    bolt: (m) => `<polygon points="24,5 10,26 19,26 14,43 31,20 21,20" fill="${m}"/>`,
    free: (m) => `<path d="M12 34 V18 h3 v-4 h3 v4 h4 v-4 h3 v4 h3 V34 Z" fill="${m}"/>`,
  };
  // Shield contents in a 40x48 box, for nesting inside other SVG.
  art.crestInner = function (f) {
    const h = HERALD[f], field = A.fcolor(f);
    return `<path d="${SHIELD}" fill="${field}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M5 5 H20 V44 C13 41 5 36 5 26 Z" fill="#fff" opacity=".12"/>${h ? CHARGE[h.charge](h.metal) : CHARGE.free('#4a4336')}`;
  };
  art.crest = (f, h) => `<svg class="crest-i" viewBox="0 0 40 49" width="${Math.round((h || 20) * 0.82)}" height="${h || 20}" aria-hidden="true">${art.crestInner(f)}</svg>`;

  // ---------- Portraits ----------
  const SKIN = ['#f0c9a0', '#e2b185', '#c98f62', '#a8703f', '#f5d6b8', '#d9a577'];
  const HAIR = ['#2a1a0f', '#5a3a1c', '#8a5a2a', '#b9b3a8', '#8f3a1c', '#c9a24e', '#3b3b3b'];
  const BEARD = new Set(['garrick', 'torvald', 'anselm', 'oswin', 'dario', 'jorah', 'varek', 'grum', 'ulric', 'hakon', 'bors', 'ibram', 'corwin', 'pell']);
  const LONG = new Set(['isolde', 'lysa', 'hilda', 'maelis', 'rhosyn', 'mirelle', 'nyx', 'edda', 'brynja', 'sene', 'tamsin', 'kestrel']);
  art.portrait = function (o, size) {
    const h = hash(o.id), skin = SKIN[h % SKIN.length], hair = HAIR[(h >>> 4) % HAIR.length], col = A.fcolor(o.faction);
    const gear = o.ruler ? 'crown' : o.lead >= o.admin && o.lead >= o.dip ? 'helm' : o.admin >= o.dip ? 'coif' : 'hat';
    const brow = (h >>> 9) % 3, s = size || 56;
    let g = `<rect x="1.5" y="1.5" width="57" height="67" rx="5" fill="#d8c79b" stroke="${INK}" stroke-width="2.5"/><path d="M5 66 V22 Q5 6 30 6 Q55 6 55 22 V66 Z" fill="${col}" opacity=".35"/>`;
    if (LONG.has(o.id)) g += `<path d="M15 30 Q12 8 30 8 Q48 8 45 30 L49 54 H11 Z" fill="${hair}" stroke="${INK}" stroke-width="1"/>`;
    g += `<path d="M5 68 Q7 51 22 47 L38 47 Q53 51 55 68 Z" fill="${col}" stroke="${INK}" stroke-width="1.6"/><path d="M22 47 L30 56 L38 47" fill="none" stroke="#f4ead0" stroke-width="2"/>`;
    g += `<rect x="25" y="39" width="10" height="10" fill="${skin}" stroke="${INK}" stroke-width="1"/><ellipse cx="30" cy="28" rx="12" ry="14" fill="${skin}" stroke="${INK}" stroke-width="1.5"/>`;
    if (!LONG.has(o.id) && gear !== 'helm') g += `<path d="M18 26 Q16 11 30 11 Q44 11 42 26 Q38 17 30 17 Q22 17 18 26 Z" fill="${hair}"/>`;
    if (BEARD.has(o.id)) g += `<path d="M18.5 30 Q19 46 30 48 Q41 46 41.5 30 Q37 37 30 37 Q23 37 18.5 30 Z" fill="${hair}" stroke="${INK}" stroke-width=".8"/>`;
    g += `<circle cx="25" cy="27.5" r="1.5" fill="${INK}"/><circle cx="35" cy="27.5" r="1.5" fill="${INK}"/>`;
    g += brow === 0 ? `<path d="M22 24 L28 24.5 M32 24.5 L38 24" stroke="${INK}" stroke-width="1.3"/>` : brow === 1 ? `<path d="M22 23 L28 25 M32 25 L38 23" stroke="${INK}" stroke-width="1.5"/>` : `<path d="M22 25 Q25 22.5 28 24 M32 24 Q35 22.5 38 25" stroke="${INK}" stroke-width="1.2" fill="none"/>`;
    g += `<path d="M30 28 L29 33 H31.5" fill="none" stroke="${INK}" stroke-width="1" opacity=".7"/><path d="M26 ${BEARD.has(o.id) ? 39 : 37} Q30 ${(h >>> 13) % 2 ? 39.5 : 38} 34 ${BEARD.has(o.id) ? 39 : 37}" fill="none" stroke="${BEARD.has(o.id) ? '#f4ead0' : '#7a2e22'}" stroke-width="1.4" stroke-linecap="round"/>`;
    if (gear === 'crown') g += `<path d="M17.5 17 V6 L23 12 L30 3 L37 12 L42.5 6 V17 Z" fill="#d9ae3c" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><circle cx="30" cy="12.5" r="1.8" fill="#9c2f22"/><circle cx="22" cy="13.5" r="1.2" fill="#2c5c8f"/><circle cx="38" cy="13.5" r="1.2" fill="#2c5c8f"/>`;
    else if (gear === 'helm') g += `<path d="M16.5 30 V20 Q16.5 7 30 7 Q43.5 7 43.5 20 V30 H39 V22 H21 V30 Z" fill="#a9a9a4" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><rect x="28.7" y="20" width="2.6" height="11" fill="#8f8f8a" stroke="${INK}" stroke-width=".8"/><path d="M30 7 V3" stroke="${INK}" stroke-width="1.5"/>`;
    else if (gear === 'coif') g += `<path d="M16.5 23 Q16 8 30 8 Q44 8 43.5 23 Q30 15 16.5 23 Z" fill="#7a5a36" stroke="${INK}" stroke-width="1.4"/>`;
    else g += `<path d="M12 20 Q30 3 48 20 Q30 13 12 20 Z" fill="#5b2f4f" stroke="${INK}" stroke-width="1.4"/><path d="M41 15 Q50 1 55 6 Q48 8 43 17" fill="#f4ead0" stroke="${INK}" stroke-width="1"/>`;
    return `<svg class="portrait" viewBox="0 0 60 70" width="${Math.round(s * 0.857)}" height="${s}" aria-hidden="true">${g}</svg>`;
  };

  // ---------- Small ink icons ----------
  const ICONS = {
    coin: `<circle cx="12" cy="12" r="9" fill="#d9ae3c" stroke="${INK}" stroke-width="2"/><path d="M12 6.5 V17.5 M8.5 9.5 H15.5" stroke="${INK}" stroke-width="1.8"/>`,
    wheat: `<path d="M12 22 V7" stroke="#7a5a00" stroke-width="2"/><path d="M12 9 Q6 8 6 3 Q12 4 12 9 Q12 4 18 3 Q18 8 12 9 M12 15 Q6 14 6 9 Q12 10 12 15 Q12 10 18 9 Q18 14 12 15" fill="#d9ae3c" stroke="${INK}" stroke-width="1.2"/>`,
    scroll: `<path d="M5 5 H17 Q20 5 20 8 V19 H8 Q5 19 5 16 Z" fill="#f4ead0" stroke="${INK}" stroke-width="1.8"/><path d="M9 9.5 H16 M9 13 H16" stroke="${INK}" stroke-width="1.3"/>`,
    seal: `<circle cx="12" cy="12" r="9.5" fill="#9c2f22" stroke="${INK}" stroke-width="1.8"/><polygon points="12,5 13.8,10.2 19,10.2 14.8,13.4 16.4,18.6 12,15.4 7.6,18.6 9.2,13.4 5,10.2 10.2,10.2" fill="#f4ead0"/>`,
    flame: `<path d="M12 2 Q18 9 17 15 Q16 22 12 22 Q7 22 7 15 Q7 12 9 10 Q10 13 12 12 Q10 7 12 2 Z" fill="#d9642a" stroke="${INK}" stroke-width="1.4"/>`,
  };
  art.icon = (name, size) => `<svg class="ico" viewBox="0 0 24 24" width="${size || 16}" height="${size || 16}" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  // Unit emblems for the battlefield (drawn in currentColor).
  const UNIT = {
    inf: '<path d="M12 1.5 L14.2 5 V15 H9.8 V5 Z M5.5 15 H18.5 V17.3 H5.5 Z M10.8 17.3 H13.2 V21 H10.8 Z" fill="currentColor"/><circle cx="12" cy="22" r="1.7" fill="currentColor"/>',
    arc: '<path d="M8 2.5 Q21 12 8 21.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M8 2.5 V21.5 M3 12 H19 M15.5 8.5 L19.5 12 L15.5 15.5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    cav: '<path d="M7 22.5 V16.5 C7 11.5 10 9.5 12 6.5 L11 2 L15.2 4.2 C19.5 5 21.5 9 21.5 13.2 L17.5 15.2 L15.2 12.2 C14.2 15.2 15.2 18.6 16.4 22.5 Z" fill="currentColor"/><circle cx="16.3" cy="8.4" r="1" fill="#0008"/>',
    sie: '<path d="M3.5 21.5 H20.5 M7 21.5 L12 10.5 L17 21.5 M3.5 5.5 L19.5 14.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="17" y="13" width="4.6" height="4.6" fill="currentColor"/><circle cx="3.8" cy="5.5" r="2" fill="currentColor"/>',
  };
  art.unit = (cls, size) => `<svg class="uico" viewBox="0 0 24 24" width="${size || 18}" height="${size || 18}" aria-hidden="true">${UNIT[cls]}</svg>`;

  // Terrain drawn as cartographers' marks.
  const MARK = {
    mountain: `<path d="M-11 7 L-1 -11 L4 -2 L7 -6 L13 7 Z" fill="#cbbd96" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><path d="M-1 -11 L-4 -3 L0 -5 L2 -1" fill="none" stroke="${INK}" stroke-width="1"/>`,
    hills: `<path d="M-11 5 Q-5 -8 1 5 M-2 5 Q4 -5 11 5" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>`,
    forest: `<path d="M0 -10 L6 2 H-6 Z" fill="#5f8a4d" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><path d="M0 2 V7" stroke="${INK}" stroke-width="1.5"/>`,
    marsh: `<path d="M-6 5 V-3 M-2 5 V-7 M2 5 V-4 M6 5 V-1 M-10 6 H10" fill="none" stroke="#4b6a55" stroke-width="1.4" stroke-linecap="round"/>`,
    plains: `<path d="M-7 3 Q-5 -4 -3 3 M-1 3 Q1 -5 3 3 M5 3 Q7 -3 9 3" fill="none" stroke="#8a7a3a" stroke-width="1.3" stroke-linecap="round"/>`,
    coast: `<path d="M-10 0 q5 -6 10 0 t10 0 M-6 6 q4 -5 8 0 t8 0" fill="none" stroke="#3f6a80" stroke-width="1.4" stroke-linecap="round"/>`,
  };
  art.terrainIcon = (t, size) => `<svg class="ico" viewBox="-14 -13 28 24" width="${size || 20}" height="${Math.round((size || 20) * 0.86)}" aria-hidden="true">${MARK[t] || ''}</svg>`;

  // ---------- The chart: each province is the part of the island nearest its stronghold ----------
  art.LAND = [[60, 45], [330, 12], [600, 18], [905, 28], [972, 150], [962, 460], [865, 585], [745, 662], [450, 678], [250, 645], [90, 605], [28, 425], [22, 250]];
  art.landPoints = art.LAND.map((p) => p.join(',')).join(' ');
  function clip(poly, mx, my, dx, dy) {
    // Keep the side of the bisector where (x-mx, y-my)·(dx, dy) <= 0.
    const out = [], side = (p) => (p[0] - mx) * dx + (p[1] - my) * dy;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], sa = side(a), sb = side(b);
      if (sa <= 0) out.push(a);
      if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) { const t = sa / (sa - sb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  const inside = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  let CELLS = null;
  art.cells = function () {
    if (CELLS) return CELLS;
    CELLS = {};
    for (const p of A.PROV_DEF) {
      let poly = art.LAND.slice();
      for (const q of A.PROV_DEF) { if (q === p) continue; poly = clip(poly, (p[3] + q[3]) / 2, (p[4] + q[4]) / 2, q[3] - p[3], q[4] - p[4]); }
      // Scatter terrain marks inside the cell, clear of the stronghold and its label.
      const h = hash(p[0]); let marks = '';
      for (let i = 0; i < 9; i++) {
        const ang = ((h >>> (i * 3)) % 360) * (Math.PI / 180) + i * 0.7, r = 46 + ((h >>> (i + 5)) % 34);
        const x = p[3] + Math.cos(ang) * r, y = p[4] + Math.sin(ang) * r * 0.8;
        if (y > p[4] + 22 && Math.abs(x - p[3]) < 46) continue;
        if (![[0, 0], [12, 8], [-12, 8], [0, -12]].every(([ox, oy]) => inside(poly, x + ox, y + oy))) continue;
        if (A.PROV_DEF.some((q) => q !== p && Math.hypot(q[3] - x, q[4] - y) < 52)) continue;
        marks += `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">${MARK[p[2]]}</g>`;
      }
      CELLS[p[0]] = { points: poly.map((v) => v[0].toFixed(1) + ',' + v[1].toFixed(1)).join(' '), marks };
    }
    return CELLS;
  };
  art.mapDefs = () => `<defs>
    <filter id="rough" x="-4%" y="-4%" width="108%" height="108%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="8" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="5"/><feColorMatrix values="0 0 0 0 .32  0 0 0 0 .22  0 0 0 0 .08  0 0 0 .2 0"/></filter>
    <pattern id="waves" width="54" height="26" patternUnits="userSpaceOnUse"><path d="M5 14 q5 -6 10 0 t10 0" fill="none" stroke="#48707a" stroke-width="1.1" opacity=".5"/><path d="M34 4 q4 -5 8 0" fill="none" stroke="#48707a" stroke-width="1" opacity=".35"/></pattern>
    <radialGradient id="vig" cx="50%" cy="50%" r="70%"><stop offset="60%" stop-color="#3a2616" stop-opacity="0"/><stop offset="100%" stop-color="#3a2616" stop-opacity=".45"/></radialGradient>
  </defs>`;
  art.compass = (x, y) => `<g class="compass" transform="translate(${x},${y})"><circle r="30" fill="#ecdfbd" stroke="${INK}" stroke-width="1.6"/><circle r="23" fill="none" stroke="${INK}" stroke-width=".8"/>
    <polygon points="0,-36 6,0 0,36 -6,0" fill="${INK}"/><polygon points="-36,0 0,-6 36,0 0,6" fill="#9c2f22" stroke="${INK}" stroke-width=".8"/><polygon points="0,-36 6,0 0,0" fill="#ecdfbd" stroke="${INK}" stroke-width=".8"/>
    <text y="-40" text-anchor="middle" class="ctext">N</text></g>`;
})();
