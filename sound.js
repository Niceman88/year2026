// 사운드 엔진 — 모든 효과음과 배경음악을 Web Audio로 직접 합성합니다 (외부 음원 없음, 저작권 걱정 없음)
window.Sound = (function () {
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function makeNoise(ctx, sec) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function makeImpulse(ctx, sec, decay) {
    const len = ctx.sampleRate * sec; const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }

  // ---------- 엔진 (실시간·녹음 공용) ----------
  function Engine(ctx, dest) {
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = .005; comp.release.value = .2; comp.connect(dest);
    const sfxBus = ctx.createGain(); sfxBus.gain.value = .85; sfxBus.connect(comp);
    const bgmBus = ctx.createGain(); bgmBus.gain.value = .4; bgmBus.connect(comp);
    const rev = ctx.createConvolver(); rev.buffer = makeImpulse(ctx, 2.4, 2.6);
    const revOut = ctx.createGain(); revOut.gain.value = .32; rev.connect(revOut); revOut.connect(comp);
    const noiseBuf = makeNoise(ctx, 6);

    function out(g, o) { g.connect(o.bus || sfxBus); if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(rev); } }
    function tone(f, t, dur, o = {}) {
      const osc = ctx.createOscillator(); osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(f, t); if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + (o.slideT || dur));
      if (o.detune) osc.detune.value = o.detune;
      if (o.vib) { const l = ctx.createOscillator(); const lg = ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = f * .012; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + .3); }
      const g = ctx.createGain(); const a = o.a || .004; const peak = o.vol || .3;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
      if (o.hold) g.gain.setValueAtTime(peak, t + a + o.hold);
      g.gain.exponentialRampToValueAtTime(.0001, t + a + (o.hold || 0) + dur);
      let node = osc; if (o.lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; fl.Q.value = o.q || .7; osc.connect(fl); node = fl; }
      node.connect(g); out(g, o); osc.start(t); osc.stop(t + a + (o.hold || 0) + dur + .05);
    }
    function noise(t, dur, o = {}) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const fl = ctx.createBiquadFilter(); fl.type = o.ft || 'bandpass'; fl.frequency.value = o.f || 2000; fl.Q.value = o.q || .8;
      if (o.fTo) fl.frequency.exponentialRampToValueAtTime(o.fTo, t + dur);
      const g = ctx.createGain(); const a = o.a || .002; const peak = o.vol || .3;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dur);
      src.connect(fl); fl.connect(g); out(g, o); src.start(t, Math.random() * (6 - dur - 1 > 0 ? 6 - dur - 1 : 0)); src.stop(t + a + dur + .05);
    }
    function bell(m, t, dur, vol, o = {}) {
      const f = mtof(m);
      tone(f, t, dur, { ...o, vol }); tone(f * 2, t, dur * .55, { ...o, vol: vol * .32 }); tone(f * 3.003, t, dur * .28, { ...o, vol: vol * .14 });
    }
    function brass(notes, t, dur, vol) {
      notes.forEach(m => { [-7, 7].forEach(d => tone(mtof(m), t, dur, { type: 'sawtooth', vol: vol / notes.length, lp: 2600, a: .03, detune: d, rev: .25 })); });
    }

    // ---------- 효과음 ----------
    const S = {
      whoosh: t => noise(t, .45, { f: 500, fTo: 3500, q: .6, vol: .1, a: .2 }),
      ding: t => { bell(84, t, 1.4, .32, { rev: .35 }); bell(91, t + .09, 1.2, .2, { rev: .35 }); },
      tick: t => { tone(2000, t, .035, { type: 'square', vol: .06, lp: 5000 }); tone(1000, t, .05, { vol: .1 }); },
      buzzer: t => { tone(98, t, .25, { type: 'sawtooth', vol: .22, lp: 1100, hold: .45 }); tone(104, t, .25, { type: 'square', vol: .1, lp: 900, hold: .45 }); },
      pop: t => tone(520 + Math.random() * 300, t, .09, { type: 'triangle', slide: 1400, vol: .12 }),
      join: t => bell(96 + Math.floor(Math.random() * 3) * 2, t, .35, .07),
      fanfare: t => {
        const s = .14;
        brass([60, 64, 67], t, .1, .5); brass([60, 64, 67], t + s, .1, .5); brass([60, 64, 67], t + 2 * s, .1, .5);
        brass([65, 69, 72], t + 3 * s, .35, .55); brass([67, 71, 74], t + 3 * s + .38, .3, .55);
        brass([60, 64, 67, 72], t + 3 * s + .72, 1.4, .6);
        noise(t + 3 * s + .72, 1.8, { ft: 'highpass', f: 6000, vol: .22, rev: .3 });
        [84, 88, 91, 96].forEach((m, i) => bell(m, t + 3 * s + .72 + i * .06, .9, .09, { rev: .4 }));
      },
      cheer: t => {
        noise(t, 2.4, { f: 1400, q: .4, vol: .1, a: .35 });
        for (let i = 0; i < 46; i++) noise(t + Math.random() * 2.2, .03, { ft: 'highpass', f: 1200 + Math.random() * 2000, vol: .05 + Math.random() * .06 });
      },
      ball: t => { tone(160, t, .3, { slide: 55, vol: .45 }); noise(t, .08, { ft: 'lowpass', f: 600, vol: .2 }); bell(88, t + .12, .9, .16, { rev: .3 }); bell(95, t + .2, .7, .1, { rev: .3 }); },
      win: t => [72, 76, 79, 84, 88].forEach((m, i) => bell(m, t + i * .075, .8, .14, { rev: .35 })),
      drumroll: (t, dur = 4.4) => {
        const step = .042; const n = Math.floor(dur / step);
        for (let i = 0; i < n; i++) noise(t + i * step + (Math.random() - .5) * .006, .06, { f: 1700, q: .6, vol: .04 + .22 * Math.pow(i / n, 1.6) });
        tone(70, t, dur, { vol: .08, a: dur * .9 });
      },
      cymbal: t => { noise(t, 2.6, { ft: 'highpass', f: 4500, vol: .35, rev: .4 }); tone(55, t, .5, { slide: 40, vol: .5 }); },
      beep: t => tone(880, t, .16, { type: 'square', vol: .1, lp: 2600 }),
      go: t => { tone(1760, t, .5, { type: 'square', vol: .11, lp: 3500, hold: .15 }); tone(880, t, .5, { type: 'square', vol: .06, lp: 3000, hold: .15 }); },
      whistle: t => { tone(2350, t, .15, { vol: .14, vib: 28, hold: .55 }); tone(2390, t, .15, { vol: .08, vib: 28, hold: .55 }); },
      sparkle: t => [96, 100, 103, 108].forEach((m, i) => bell(m, t + i * .05, .5, .05, { rev: .5 }))
    };

    // ---------- 배경음악 (직접 작곡: 120 BPM, C장조, 40마디 ≈ 80초 한 곡을 반복) ----------
    // 구성: 인트로(4) → A 종소리 멜로디(8) → B 신스 리드 + 브라스(8) → C 브리지 피아노·현악(8) → A' 전체 합주(8) → 아웃트로 빌드업(4)
    const BPM = 120, STEP = 60 / BPM / 2;
    const CHD = { C: [36, [60, 64, 67]], Am: [45, [57, 60, 64]], F: [41, [57, 60, 65]], G: [43, [55, 59, 62]], Em: [40, [55, 59, 64]], Dm: [38, [57, 62, 65]] };
    const _ = null;
    const SONG = [
      { name: 'intro', ch: ['C', 'Am', 'F', 'G'] },
      { name: 'A', ch: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G'] },
      { name: 'B', ch: ['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'] },
      { name: 'C', ch: ['Am', 'Em', 'F', 'C', 'Dm', 'Em', 'F', 'G'] },
      { name: 'A2', ch: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G'] },
      { name: 'outro', ch: ['F', 'G', 'F', 'G'] }];
    const BARS = []; SONG.forEach(sec => sec.ch.forEach((c, i) => BARS.push({ sec: sec.name, i, n: sec.ch.length, ch: CHD[c] })));
    const LOOP = BARS.length * 8;
    const MEL = [
      [76, 79, 84, 79, 76, 74, 72, _], [72, 74, 76, 72, 69, _, 72, 74], [77, 76, 74, 72, 74, 76, 77, _], [79, _, 74, _, 71, 74, 79, 77],
      [76, 79, 84, 86, 84, 79, 76, _], [76, 74, 71, 74, 76, 79, 76, 74], [72, 74, 77, 81, 79, 77, 74, 72], [71, 74, 79, 74, 72, _, _, _]];
    const MEL_B = [
      [72, _, 72, 74, 77, _, 76, 74], [74, _, 71, _, 67, 71, 74, _], [76, _, 76, 79, 76, 74, 71, _], [72, _, 69, 72, 76, _, _, _],
      [77, _, 77, 79, 81, _, 79, 77], [79, _, 74, _, 71, 74, 79, _], [84, _, 79, 76, 79, _, 84, _], [84, _, _, _, _, _, _, _]];
    const STR_C = [76, 74, 72, 72, 74, 71, 72, 74];
    const H3 = m => { const sc = [0, 2, 4, 5, 7, 9, 11]; const pc = ((m % 12) + 12) % 12; const k = sc.indexOf(pc); if (k < 0) return m - 4; const t = sc[(k + 5) % 7]; let d = (t - pc + 12) % 12; return m - (12 - d); }; // 아래 3도 화음

    const ob = { bus: bgmBus };
    const kick = (t, v = .34) => tone(130, t, .16, { ...ob, slide: 45, slideT: .12, vol: v });
    const clap = (t, v = .09) => { [0, .012, .025].forEach(d => noise(t + d, .1, { ...ob, f: 1500, q: .6, vol: v, rev: .15 })); };
    const snare = (t, v = .12) => { noise(t, .14, { ...ob, f: 2200, q: .5, vol: v, rev: .12 }); tone(190, t, .08, { ...ob, vol: v * .7 }); };
    const sleigh = (t, v = .03) => { noise(t, .05, { ...ob, ft: 'highpass', f: 7500, vol: v }); noise(t + .03, .04, { ...ob, f: 5200, q: 4, vol: v * .7 }); };
    const tamb = (t, v = .025) => noise(t, .035, { ...ob, ft: 'highpass', f: 9000, vol: v });
    const crash = t => noise(t, 1.8, { ...ob, ft: 'highpass', f: 5000, vol: .14, rev: .3 });
    const tom = (t, f) => tone(f, t, .22, { ...ob, slide: f * .6, vol: .22 });
    const roll = (t, dur) => { const n = Math.floor(dur / .0625); for (let i = 0; i < n; i++) snare(t + i * .0625, .03 + .1 * i / n); };
    const piano = (m, t, dur, v) => { const f = mtof(m); tone(f, t, dur, { ...ob, vol: v, detune: -3, rev: .2 }); tone(f, t, dur * .8, { ...ob, vol: v * .5, detune: 4, type: 'triangle' }); tone(f * 2, t, dur * .4, { ...ob, vol: v * .25 }); };
    const pluck = (m, t, v) => tone(mtof(m), t, .2, { ...ob, type: 'triangle', lp: 1800, vol: v });
    const stab = (notes, t, dur, v) => notes.forEach(m => [-8, 8].forEach(d => tone(mtof(m), t, dur, { ...ob, type: 'sawtooth', lp: 2300, a: .015, detune: d, vol: v / notes.length, rev: .15 })));
    const strings = (notes, t, dur, v) => notes.forEach(m => [-10, 10].forEach(d => tone(mtof(m), t, dur * .5, { ...ob, type: 'sawtooth', lp: 1500, a: .35, hold: dur * .5, detune: d, vib: 5, vol: v / notes.length, rev: .3 })));
    const lead = (m, t, dur, v) => { tone(mtof(m), t, dur, { ...ob, type: 'square', lp: 2600, a: .01, vib: 5.5, vol: v, rev: .2 }); tone(mtof(m + 12), t, dur * .6, { ...ob, vol: v * .3 }); };
    const glock = (m, t, v) => bell(m, t, .5, v, { ...ob, rev: .4 });

    function bgmStep(step, t) {
      const b = BARS[Math.floor(step / 8) % BARS.length], pos = step % 8;
      const [root, tri] = b.ch; const last = b.i === b.n - 1; const half = STEP * .5;
      const sec = b.sec;
      // ---- 인트로: 피아노 화음 + 방울 + 반짝이, 마지막 마디 스네어 롤
      if (sec === 'intro') {
        if (pos === 0) { tri.forEach(m => piano(m, t, 1.8, .06)); piano(root + 12, t, 1.8, .07); }
        if (pos === 4) tri.forEach(m => piano(m + 12, t, 1.2, .035));
        sleigh(t, pos % 2 ? .03 : .018);
        if (pos === 6 && !last) glock(tri[2] + 24, t, .05);
        if (last && pos === 0) roll(t, STEP * 8);
        return;
      }
      // ---- 아웃트로: 브라스 빌드업 + 톰 필
      if (sec === 'outro') {
        if (pos === 0 || pos === 3 || pos === 6) stab(tri.map(m => m + 12), t, .25, .16);
        kick(t, .28); sleigh(t, .03);
        if (pos % 2) clap(t, .07);
        if (last) { if (pos >= 4) tom(t, [220, 180, 150, 120][pos - 4]); if (pos === 4) roll(t, STEP * 4); }
        else if (pos === 0) tone(mtof(root), t, 1.6, { ...ob, type: 'triangle', vol: .22 });
        return;
      }
      const full = sec === 'A2';
      // ---- 드럼
      if (b.i === 0 && pos === 0) crash(t);
      if (sec === 'C') { if (pos === 0) kick(t); if (pos === 4) snare(t, .1); if (pos === 6) kick(t, .2); }
      else {
        if (pos === 0 || pos === 4) kick(t); if (full && (pos === 3 || pos === 7)) kick(t + half, .18);
        if (pos === 2 || pos === 6) (sec === 'B' ? snare : clap)(t);
      }
      sleigh(t, pos % 2 ? .032 : .018);
      if (sec === 'B' || full) { tamb(t + half); }
      if (last && pos >= 6 && sec !== 'C') { tom(t, pos === 6 ? 200 : 150); tom(t + half, pos === 6 ? 175 : 120); }
      if (last && sec === 'C' && pos === 4) roll(t, STEP * 4);
      // ---- 베이스
      if (sec === 'B') { const walk = [0, 7, 12, 7, 0, 4, 7, 9]; tone(mtof(root + walk[pos]), t, .2, { ...ob, type: 'triangle', vol: .2 }); }
      else if (sec === 'C') { if (pos === 0 || pos === 3 || pos === 6) tone(mtof(root), t, pos === 0 ? .6 : .3, { ...ob, type: 'triangle', vol: .22 }); }
      else { if (pos % 2 === 0) tone(mtof(root + (pos === 4 && full ? 12 : 0)), t, .22, { ...ob, type: 'triangle', vol: pos === 0 ? .24 : .15 }); }
      // ---- 화음 악기
      if (sec === 'A') { if (pos % 2) tri.forEach(m => pluck(m + 12, t, .045)); if (pos === 0) strings(tri, t, STEP * 8, .03); }
      if (sec === 'B') { if (pos === 1 || pos === 3 || pos === 6) stab(tri.map(m => m + 12), t, .16, .12); if (pos === 0) strings(tri, t, STEP * 8, .045); }
      if (sec === 'C') {
        const arp = [tri[0], tri[1], tri[2], tri[1] + 12, tri[2], tri[1], tri[0] + 12, tri[2]]; piano(arp[pos], t, .5, .05);
        if (pos === 0) { strings(tri, t, STEP * 8, .05); strings([STR_C[b.i] + 12], t, STEP * 8, .045); }
        if (pos === 4 && b.i % 2) glock(STR_C[b.i] + 24, t, .045);
      }
      if (full) { if (pos === 0) strings(tri, t, STEP * 8, .05); if (pos === 3 || pos === 7) stab(tri.map(m => m + 12), t, .14, .1); if (pos % 2) tri.forEach(m => pluck(m + 12, t, .03)); }
      // ---- 멜로디
      if (sec === 'A') { const m = MEL[b.i][pos]; if (m) bell(m, t, .7, .11, { ...ob, rev: .28 }); }
      if (sec === 'B') { const m = MEL_B[b.i][pos]; if (m) lead(m, t, (MEL_B[b.i][pos + 1] === _ ? .4 : .2), .045); }
      if (full) { const m = MEL[b.i][pos]; if (m) { bell(m, t, .7, .1, { ...ob, rev: .28 }); lead(m, t, .2, .03); bell(H3(m), t, .5, .05, { ...ob, rev: .28 }); } }
    }
    return { ctx, S, sfxBus, bgmBus, bgmStep, STEP, LOOP };
  }

  // ---------- 실시간 재생기 ----------
  let ctx = null, E = null, unlocked = false;
  const cfg = { bgm: true, vol: .4, sfx: true }; let duck = false;
  let nextT = 0, step = 0, timer = null;
  const listeners = [];
  function unlock() {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); E = Engine(ctx, ctx.destination); }
    ctx.resume(); unlocked = true; apply(); listeners.forEach(f => f());
  }
  function apply() {
    if (!E) return;
    const target = cfg.bgm ? cfg.vol * (duck ? .3 : 1) : 0;
    E.bgmBus.gain.setTargetAtTime(Math.max(target, .0001), ctx.currentTime, duck ? .25 : .6);
    E.sfxBus.gain.setTargetAtTime(cfg.sfx ? .85 : .0001, ctx.currentTime, .05);
    if (cfg.bgm && !timer) { nextT = ctx.currentTime + .1; timer = setInterval(sched, 25); }
    if (!cfg.bgm && timer) { clearInterval(timer); timer = null; }
  }
  function sched() { while (nextT < ctx.currentTime + .15) { E.bgmStep(step, nextT); nextT += E.STEP; step = (step + 1) % E.LOOP; } }
  return {
    unlock, get unlocked() { return unlocked; }, onUnlock: f => listeners.push(f),
    set(o) { Object.assign(cfg, o || {}); apply(); },
    duck(on) { if (on !== duck) { duck = on; apply(); } },
    play(name, arg) { if (!E || !cfg.sfx || !E.S[name]) return; E.S[name](ctx.currentTime + .01, arg); },
    // 미리듣기용 녹음 (OfflineAudioContext)
    async render(kind, sec = 34) {
      const sr = 32000; const oc = new OfflineAudioContext(2, sr * sec, sr); const e = Engine(oc, oc.destination);
      if (kind === 'bgm') { e.bgmBus.gain.value = .9; for (let i = 0, t = .05; t < sec - .5; i++, t += e.STEP) e.bgmStep(i % e.LOOP, t); }
      else {
        const reel = [['whoosh', 0], ['join', .8], ['join', 1.1], ['ding', 1.8], ['tick', 3.4], ['tick', 4.4], ['tick', 5.4], ['buzzer', 6.4], ['fanfare', 7.8], ['cheer', 8.6],
          ['pop', 12], ['pop', 12.3], ['pop', 12.5], ['ball', 13.5], ['win', 15], ['drumroll', 16.5], ['cymbal', 21], ['fanfare', 21], ['beep', 25], ['beep', 26], ['beep', 27], ['go', 28], ['whistle', 30.5], ['sparkle', 32]];
        reel.forEach(([n, t]) => e.S[n](t + .05));
      }
      const buf = await oc.startRendering();
      return wav(buf);
    }
  };
  function wav(buf) {
    const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate; const ab = new ArrayBuffer(44 + len * ch * 2); const v = new DataView(ab);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, len * ch * 2, true);
    const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    let o = 44, peak = 0; for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); peak = Math.max(peak, Math.abs(s)); v.setInt16(o, s * 32767, true); o += 2; }
    let bin = ''; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i += 32768) bin += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
    return { b64: btoa(bin), peak };
  }
})();
