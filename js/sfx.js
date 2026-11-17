// Sound and music, synthesised in the browser (no audio files). Everything is optional: if audio is blocked the game is silent.
(function () {
  const A = globalThis.A;
  const KEY = 'crowns_of_asterra_audio';
  const pref = { sound: true, music: true };
  try { Object.assign(pref, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
  let ctx = null, out = null, mus = null, timer = null, nextBar = 0, bar = 0, last = {};
  const sfx = (A.sfx = { pref, mode: 'map' });

  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      try { ctx = new C(); } catch (e) { return null; }
      out = ctx.createGain(); out.gain.value = 0.45; out.connect(ctx.destination);
      mus = ctx.createGain(); mus.gain.value = 0.13; mus.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(f, t, dur, type, vol, to, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || out); o.start(t); o.stop(t + dur + 0.05);
  }
  let nbuf = null;
  function noise(t, dur, vol, type, f0, f1, q) {
    if (!nbuf) { nbuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = nbuf; s.loop = true; fl.type = type || 'bandpass'; fl.Q.value = q || 1;
    fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  const seq = (notes, t, step, dur, type, vol) => notes.forEach((f, i) => f && tone(f, t + i * step, dur, type, vol));

  const SOUNDS = {
    click: (t) => tone(520, t, 0.05, 'triangle', 0.12),
    deny: (t) => { tone(180, t, 0.12, 'square', 0.08); tone(140, t + 0.09, 0.14, 'square', 0.08); },
    coin: (t) => { tone(1568, t, 0.09, 'sine', 0.16); tone(2093, t + 0.07, 0.16, 'sine', 0.14); },
    scroll: (t) => noise(t, 0.16, 0.12, 'bandpass', 2600, 900, 0.8),
    build: (t) => { for (let i = 0; i < 3; i++) { noise(t + i * 0.13, 0.05, 0.25, 'bandpass', 1800, 900, 3); tone(240, t + i * 0.13, 0.06, 'square', 0.07); } },
    recruit: (t) => { for (let i = 0; i < 4; i++) tone(95, t + i * 0.11, 0.09, 'sine', 0.3, 60); noise(t, 0.4, 0.05, 'highpass', 3000); },
    march: (t) => { for (let i = 0; i < 4; i++) { tone(80, t + i * 0.16, 0.12, 'sine', 0.34, 50); noise(t + i * 0.16, 0.05, 0.08, 'lowpass', 500); } },
    step: (t) => { tone(110, t, 0.07, 'sine', 0.2, 70); noise(t, 0.05, 0.06, 'lowpass', 700); },
    gallop: (t) => { for (let i = 0; i < 4; i++) tone(i % 2 ? 150 : 120, t + i * 0.055, 0.045, 'sine', 0.22, 80); },
    clash: (t) => { noise(t, 0.16, 0.34, 'bandpass', 4200, 1800, 2.5); tone(1240, t, 0.2, 'square', 0.06, 880); tone(1870, t + 0.01, 0.16, 'square', 0.04, 1500); tone(90, t, 0.1, 'sine', 0.25, 50); },
    charge: (t) => { SOUNDS.gallop(t); SOUNDS.clash(t + 0.2); },
    arrow: (t) => { noise(t, 0.22, 0.18, 'bandpass', 900, 5200, 4); noise(t + 0.24, 0.06, 0.14, 'lowpass', 900); },
    song: (t) => { [440, 554.4, 659.3].forEach((f, i) => { tone(f, t + i * 0.05, 0.6, 'sine', 0.09); tone(f * 2.01, t + i * 0.05, 0.6, 'sine', 0.035); }); },
    stone: (t) => { noise(t, 0.26, 0.24, 'bandpass', 400, 1600, 2); tone(70, t + 0.26, 0.22, 'sine', 0.4, 38); noise(t + 0.26, 0.2, 0.3, 'lowpass', 600, 120); },
    breach: (t) => { tone(60, t, 0.6, 'sine', 0.5, 30); noise(t, 0.8, 0.4, 'lowpass', 1200, 90); for (let i = 0; i < 5; i++) noise(t + 0.15 + i * 0.1, 0.07, 0.16, 'bandpass', 700 + Math.random() * 900, 0, 3); },
    hold: (t) => { tone(300, t, 0.07, 'triangle', 0.1); noise(t, 0.05, 0.08, 'bandpass', 1500, 0, 2); },
    rout: (t) => { tone(392, t, 0.5, 'sawtooth', 0.07, 196); noise(t, 0.4, 0.07, 'bandpass', 1200, 400); },
    star: (t) => { tone(220, t, 1.1, 'sawtooth', 0.07, 1760); noise(t, 1.0, 0.1, 'highpass', 6000, 1500); tone(55, t + 1.0, 0.9, 'sine', 0.55, 28); noise(t + 1.0, 0.9, 0.45, 'lowpass', 2000, 80); },
    horn: (t) => { [196, 196, 293.7].forEach((f, i) => { tone(f, t + i * 0.28, i === 2 ? 0.7 : 0.24, 'sawtooth', 0.08); tone(f * 0.5, t + i * 0.28, i === 2 ? 0.7 : 0.24, 'triangle', 0.1); }); },
    win: (t) => { seq([392, 523.3, 659.3, 784], t, 0.14, 0.3, 'sawtooth', 0.07); seq([196, 261.6, 329.6, 392], t, 0.14, 0.3, 'triangle', 0.1); tone(1046.5, t + 0.56, 0.9, 'triangle', 0.1); },
    lose: (t) => { seq([392, 349.2, 311.1, 233.1], t, 0.26, 0.45, 'triangle', 0.11); tone(58, t + 0.78, 1.0, 'sine', 0.3, 40); },
    bell: (t) => { [523.3, 1046.5, 1569, 2093].forEach((f, i) => tone(f, t, 1.4 - i * 0.25, 'sine', 0.1 / (i + 1))); },
    crown: (t) => { SOUNDS.win(t); SOUNDS.bell(t + 0.9); SOUNDS.bell(t + 1.5); },
    plot: (t) => { tone(233, t, 0.3, 'triangle', 0.1, 220); tone(277, t + 0.18, 0.5, 'triangle', 0.09, 262); noise(t, 0.5, 0.03, 'highpass', 5000); },
    event: (t) => { tone(440, t, 0.3, 'triangle', 0.1); tone(587.3, t + 0.16, 0.5, 'triangle', 0.1); },
  };
  sfx.play = function (name, gap) {
    if (!pref.sound || !SOUNDS[name]) return;
    const now = Date.now(); if (last[name] && now - last[name] < (gap || 60)) return; last[name] = now;
    try { if (ac()) SOUNDS[name](ctx.currentTime + 0.01); } catch (e) { /* ignore */ }
  };

  // Builds every sound once and reports any that fail (used when testing).
  sfx.selfTest = function () { const bad = []; if (!ac()) return ['no audio']; for (const k in SOUNDS) { try { SOUNDS[k](ctx.currentTime + 0.01); } catch (e) { bad.push(k + ': ' + e.message); } } try { const m = pref.music; pref.music = true; nextBar = ctx.currentTime; schedule(); sfx.mode = 'battle'; nextBar = ctx.currentTime; schedule(); sfx.mode = 'map'; pref.music = m; } catch (e) { bad.push('music: ' + e.message); } return bad; };
  // ---------- Music: a slow plucked round in a Dorian mode; drums join in during battles. ----------
  const N = { D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33 };
  const BARS = [
    { bass: N.D3, ch: [N.D4, N.F4, N.A4, N.D5] }, { bass: N.C4 / 2, ch: [N.C4, N.E4, N.G4, N.C5] },
    { bass: N.G3, ch: [N.D4, N.G4, N.B4, N.D5] }, { bass: N.D3, ch: [N.D4, N.F4, N.A4, N.C5] },
    { bass: N.F3, ch: [N.C4, N.F4, N.A4, N.C5] }, { bass: N.C4 / 2, ch: [N.E4, N.G4, N.C5, N.E4] },
    { bass: N.A3 / 1, ch: [N.E4, N.A4, N.C5, N.E4] }, { bass: N.D3, ch: [N.D4, N.A4, N.D5, N.A4] },
  ];
  const PAT = [[0, 2, 1, 2, 3, 2, 1, 2], [0, 1, 2, 3, 2, 1, 2, 1], [0, 2, 3, 2, 1, 3, 2, 0]];
  function pluck(f, t, vol) { tone(f, t, 0.9, 'triangle', vol, 0, mus); tone(f * 2, t, 0.25, 'sine', vol * 0.35, 0, mus); }
  function schedule() {
    if (!ctx || !pref.music) return;
    const battle = sfx.mode === 'battle', step = battle ? 0.24 : 0.34;
    while (nextBar < ctx.currentTime + 0.6) {
      const B = BARS[bar % BARS.length], P = PAT[Math.floor(bar / BARS.length) % PAT.length], t = Math.max(nextBar, ctx.currentTime + 0.05);
      tone(B.bass, t, step * 7.5, 'triangle', 0.5, 0, mus);
      for (let i = 0; i < 8; i++) { if (!battle && i % 2 && Math.random() < 0.25) continue; pluck(B.ch[P[i]], t + i * step, i === 0 ? 0.42 : 0.26); }
      if (battle) for (let i = 0; i < 8; i++) if (i % 4 === 0 || i === 3 || i === 6) tone(i % 4 === 0 ? 70 : 96, t + i * step, 0.16, 'sine', 0.9, 42, mus);
      nextBar = t + step * 8; bar++;
    }
  }
  sfx.startMusic = function () { if (!pref.music || timer || !ac()) return; nextBar = ctx.currentTime + 0.1; timer = setInterval(schedule, 200); schedule(); };
  sfx.stopMusic = function () { if (timer) { clearInterval(timer); timer = null; } };
  sfx.setMode = function (m) { if (sfx.mode === m) return; sfx.mode = m; if (ctx) nextBar = Math.min(nextBar, ctx.currentTime + 0.4); };
  function save() { try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch (e) { /* ignore */ } }
  sfx.toggle = function (k) { pref[k] = !pref[k]; save(); if (k === 'music') { if (pref.music) sfx.startMusic(); else sfx.stopMusic(); } else if (pref.sound) sfx.play('click'); };
  // Browsers only allow audio after the first click or key press.
  const wake = () => { if (pref.sound || pref.music) { ac(); sfx.startMusic(); } };
  document.addEventListener('pointerdown', wake); document.addEventListener('keydown', wake);
})();
