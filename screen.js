// 대형 화면(프로젝터) — 진행자 화면의 "현재 순서"를 행사용 연출로 보여 줍니다
(function () {
  const { B, esc, vals, DEMO } = Core;
  const COLORS = Core.TEAM_COLORS;
  const OPT_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];
  document.body.classList.add('screen');
  document.body.insertAdjacentHTML('afterbegin', '<div class="fx-bg"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div></div><canvas id="snow"></canvas><canvas id="confetti"></canvas>');
  const app = document.getElementById('app');
  app.innerHTML = `<div class="sc"><div class="sc-top"><div class="sc-brand"><span class="live">LIVE</span><span class="gold" id="sTitle"></span></div>
    <div class="sc-pill"><span class="dot"></span>접속 <b id="sCount">0</b>명</div></div>
    <div class="sc-main" id="main"></div><div class="sc-teams" id="teams"></div></div>`;
  if (DEMO) document.body.insertAdjacentHTML('beforeend', '<div class="demo-banner">데모 모드</div>');
  const main = document.getElementById('main');
  // ---------- 소리 ----------
  const snd = window.Sound;
  document.body.insertAdjacentHTML('beforeend', '<button id="sndBtn" class="snd-btn">🔊 클릭해서 소리 켜기</button>');
  const sndBtn = document.getElementById('sndBtn');
  const doUnlock = () => { if (!snd || snd.unlocked) return; snd.unlock(); sndBtn.remove(); };
  sndBtn.onclick = doUnlock; document.addEventListener('keydown', doUnlock); document.addEventListener('pointerdown', doUnlock);
  const cued = new Set();
  const sfx = (name, arg) => { if (snd && snd.unlocked) snd.play(name, arg); };
  const cue = (id, name, arg) => { if (cued.has(id)) return; cued.add(id); sfx(name, arg); };
  let lastPop = 0; const pop = name => { const n = Date.now(); if (n - lastPop > 130) { lastPop = n; sfx(name || 'pop'); } };
  let duckNow = false;
  const joinUrl = Core.pageUrl('index.html');

  let D = null, rTimer = null;
  B.on('', v => { D = v || {}; if (!rTimer) rTimer = setTimeout(() => { rTimer = null; render(); }, 80); });
  setInterval(tick, 100);

  // ---------- 공통 ----------
  const players = () => D.players || {};
  const onlineN = () => Object.keys(D.online || {}).length;
  const teamsOf = () => vals(D.content && D.content.teams);
  const tc = t => Core.teamColor(teamsOf(), t);
  const nameOf = pid => (players()[pid] || {}).name || '?';
  const fired = new Set();
  const once = (id, fn) => { if (!fired.has(id)) { fired.add(id); fn(); } };

  let curType = '', curKey = '', curUpdate = null;
  function view(type, key, build, update) {
    if (type !== curType) {
      curType = type; curKey = key; curUpdate = update || null;
      main.innerHTML = build();
      main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter');
      if (!/^(race|q-o|l-s|l-v|q-v|r\d|final)/.test(type)) cue('w:' + type, 'whoosh');
      if (update) update(true);
      return;
    }
    if (key !== curKey) { curKey = key; if (update) update(false); else main.innerHTML = build(); }
  }
  function label(t) { return `<div class="label">${t}</div>`; }

  function render() {
    if (!D) return;
    const content = D.content || {}; const meta = D.meta || {};
    document.getElementById('sTitle').textContent = content.title || '';
    const cEl = document.getElementById('sCount'); const n = String(onlineN());
    if (cEl.textContent !== n) { cEl.textContent = n; cEl.classList.remove('bump'); void cEl.offsetWidth; cEl.classList.add('bump'); }
    const status = meta.status || 'waiting';
    const idx = meta.current != null ? meta.current : -1;
    const act = vals(content.activities)[idx];
    if (snd) snd.set(Object.assign({ bgm: true, vol: .4, sfx: true }, meta.sound || {}));
    duckNow = false;
    let teamMode = 'score';
    if (status === 'ended') vFinal(content);
    else if (status === 'waiting' || !act) { vWelcome(content, status); teamMode = 'members'; }
    else {
      const st = (D.state || {})[idx] || {}; const ans = (D.answers || {})[idx] || {};
      ({ agenda: vAgenda, game: vGame, oddone: vOdd, section: vSection, thanks: vThanks, poll: vPoll, quiz: vQuiz, wordcloud: vCloud, bingo: vBingo, lottery: vLottery, rank: vRank, race: vRace, teamquiz: vTeamGame, mind: vTeamGame, chosung: vTeamGame, timing: vTeamGame, reaction: vTeamGame })[act.type](idx, act, st, ans, content);
      if (Core.isTeamGame(act) || ['section', 'thanks', 'agenda', 'game', 'oddone'].includes(act.type) || (act.type === 'rank' && act.scope === 'team')) teamMode = 'hide';
    }
    renderTeams(teamMode, idx);
    if (snd) snd.duck(duckNow);
  }

  // 하단 팀 띠: 대기 중에는 팀별 인원, 진행 중에는 팀전 누적 점수(팀 게임을 한 번이라도 했을 때)
  let teamsKey = '';
  function renderTeams(mode, idx) {
    const el = document.getElementById('teams'); const teams = teamsOf();
    if (mode === 'score' && !Core.hasTeamPoints(D, idx)) mode = 'hide';
    if (!teams.length || mode === 'hide') { if (teamsKey !== 'none') { teamsKey = 'none'; el.innerHTML = ''; } return; }
    let rows;
    if (mode === 'score') rows = Core.teamStandings(D, idx).map(t => ({ team: t.team, rank: t.rank, v: `${t.pts}<small style="font-size:1.6vh;color:#9aa0d0"> 점</small>` }));
    else { const cnt = {}; Object.values(players()).forEach(p => { cnt[p.team] = (cnt[p.team] || 0) + 1; }); rows = teams.map(t => ({ team: t, v: `${cnt[t] || 0}<small style="font-size:1.6vh;color:#9aa0d0"> 명</small>` })); }
    const key = JSON.stringify([mode, rows]); if (key === teamsKey) return; teamsKey = key;
    el.innerHTML = (mode === 'score' ? '<div class="tchip" style="--c:#ffcc4d;border:0;background:transparent;color:#ffe08a">🏁 팀전</div>' : '') + rows.map(r => `<div class="tchip ${mode === 'score' && r.rank === 1 ? 'first' : ''}" style="--c:${tc(r.team)}">
      ${mode === 'score' ? `<span class="rk">${r.rank}위</span>` : ''}<span class="em">${Core.teamEmoji(teams, r.team)}</span>${esc(r.team)} <b>${r.v}</b></div>`).join('');
  }

  function tick() {
    if (!D) return;
    document.querySelectorAll('[data-deadline]').forEach(el => {
      const total = +el.dataset.total; const left = Math.max(0, +el.dataset.deadline - B.now());
      const sec = Math.ceil(left / 1000);
      if (el.classList.contains('ring')) {
        el.querySelector('.fg').style.strokeDashoffset = String(565.5 * (1 - left / total));
        el.querySelector('.num').textContent = left > 0 ? sec : '⏰';
        el.classList.toggle('hurry', left > 0 && left <= 5000);
        if (el.dataset.sec !== String(sec)) {
          if (el.dataset.sec && left > 0 && left <= 5000) sfx('tick');
          if (el.dataset.sec && el.dataset.sec !== '0' && left <= 0) sfx('buzzer');
          el.dataset.sec = sec;
        }
      } else el.textContent = sec;
    });
    const tk = document.getElementById('thTk');
    if (tk && thRecent.length) { const e = thRecent[Math.floor(Date.now() / 4000) % thRecent.length]; const html = `💌 <b>${esc(e.to)}</b>님께 · “${esc(e.msg)}”`; if (tk.dataset.h !== html) { tk.dataset.h = html; tk.innerHTML = html; tk.classList.remove('in'); void tk.offsetWidth; tk.classList.add('in'); } }
    render();
  }

  // ---------- 막대 그래프 (제자리에서 부드럽게 갱신) ----------
  function barsHTML(opts, cls = '') {
    return `<div class="bars ${cls}">${opts.map((o, i) => `<div class="bar" data-i="${i}"><div class="lab"><span class="lt"></span>${o.k ? `<span class="k" style="background:${o.color}">${o.k}</span>` : ''}<span>${esc(o.label)}</span></div>
      <div class="trk"><div class="fill" style="background:linear-gradient(90deg,${o.color}99,${o.color})"></div></div><div class="val">0</div></div>`).join('')}</div>`;
  }
  function updateBars(root, counts, opt = {}) {
    const total = counts.reduce((a, b) => a + b, 0); const max = Math.max(1, ...counts);
    root.querySelectorAll('.bar').forEach((b, i) => {
      const c = counts[i] || 0;
      b.querySelector('.fill').style.width = (100 * c / max) + '%';
      b.querySelector('.val').innerHTML = (opt.fmt ? opt.fmt(c) : c) + (opt.pct && total ? ` <small>${Math.round(100 * c / total)}%</small>` : '');
      b.classList.toggle('win', opt.correct === i); b.classList.toggle('dim', opt.correct != null && opt.correct !== i);
      b.querySelector('.lt').innerHTML = opt.crown && c && c === max ? '<span class="crown">👑</span>' : opt.correct === i ? '✅' : '';
    });
  }
  const countVotes = (n, ans) => { const c = Array(n).fill(0); vals(ans).forEach(a => { if (a.v != null && c[a.v] != null) c[a.v]++; }); return c; };

  // ---------- 환영 ----------
  function vWelcome(content, status) {
    const n = Object.keys(players()).length;
    view('welcome' + status, JSON.stringify([n, content.title]), () => `${label(status === 'waiting' ? '✨ WELCOME ✨' : '☕ 잠시 쉬어 갑니다')}
      <div class="hero-title gold">${esc(content.title || '연말 행사')}</div>
      <div class="sub">${status === 'waiting' ? '휴대폰 카메라로 QR을 찍고 접속해 주세요!' : '잠시 후 다음 순서가 시작됩니다'}</div>
      <div class="hero-row"><div class="glass qr-card"><img alt="QR" src="https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=0&data=${encodeURIComponent(joinUrl)}" onerror="this.style.display='none'">
        <div><div class="sub" style="text-align:left">📱 접속 주소</div><div class="url">${esc(joinUrl.replace(/^https?:\/\//, ''))}</div></div></div>
        <div class="big-count"><div class="n" id="wN">0</div><div class="t">명 참가 중</div></div></div>`,
      () => { const el = document.getElementById('wN'); if (el && el.textContent !== String(n)) { if (el.textContent !== '0') pop('join'); el.textContent = n; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } });
  }

  // ---------- 감사 인사 ----------
  let thRecent = [];
  function vThanks(idx, act, st, ans) {
    const ph = st.phase || 'ready';
    const lab = label('💌 ' + esc(act.title));
    if (ph === 'ready') return view('th-r' + idx, '', () => `${lab}<div class="hero-title" style="font-size:20vh">💌</div><div class="headline">올 한 해 고마웠던 동료에게<br>마음을 전해 주세요</div><div class="sub">휴대폰에서 이름과 고마운 점을 적으면 이곳에 나타나요 · 보낸 사람은 공개되지 않아요</div>`);
    if (ph === 'open' || ph === 'closed') {
      const rows = Core.thanksAgg(D, idx).slice(0, 40); const max = rows.length ? rows[0].count : 1;
      const shown = rows.slice().sort((a, b) => Core.hash(a.key) - Core.hash(b.key));
      const recent = []; Object.values(ans || {}).forEach(a => vals(a && a.list).forEach(e => { if (e.msg) recent.push(e); })); recent.sort((a, b) => b.at - a.at);
      const senders = Object.keys(ans || {}).length;
      const seen = seenWords['th' + idx] = seenWords['th' + idx] || new Set();
      return view('th-o' + idx, JSON.stringify([rows.map(r => [r.key, r.count]), ph, recent.length]), () => `${lab}<div class="headline" style="margin-bottom:2vh">${esc(act.title)}</div>
        <div class="cloud th-cloud" id="thCl"></div><div class="th-ticker" id="thTk"></div><div class="sub" id="thS" style="margin-top:1.4vh"></div>`,
        first => {
          document.getElementById('thCl').innerHTML = shown.map(r => `<span class="${seen.has(r.key) ? '' : 'new'}" style="font-size:${(2.4 + 8.6 * Math.sqrt(r.count / max)).toFixed(1)}vh;color:${COLORS[Core.hash(r.key) % COLORS.length]}">${esc(r.name)}</span>`).join('') || '<span class="sub" style="animation:blink 1.4s infinite">첫 감사 인사를 기다리는 중...</span>';
          if (!first && shown.some(r => !seen.has(r.key)) && seen.size) pop();
          shown.forEach(r => seen.add(r.key));
          const canon = {}; Core.thanksAgg(D, idx).forEach(r => { canon[r.key] = r.name; });
          thRecent = recent.slice(0, 12).map(e => ({ to: canon[Core.nameKey(e.to)] || e.to, msg: e.msg }));
          document.getElementById('thS').innerHTML = `<b style="color:#fff">${senders}</b>명이 <b style="color:#fff">${recent.length}</b>개의 감사를 전했어요${ph === 'closed' ? ' · 입력 마감' : ''}`;
        });
    }
    if (ph === 'result' && st.res) {
      const res = vals(st.res); const top = [res.find(r => r.rank === 2) || res[1], res.find(r => r.rank === 1) || res[0], res.find(r => r.rank === 3) || res[2]];
      return view('th-v' + idx + JSON.stringify(res.map(r => r.key)), '', () => `${label('💌 ' + esc(act.title) + ' · 결과')}
        <div class="th-podium">${top.map((r, k) => r ? `<div class="th-card ${r.rank === 1 ? 'first' : ''}" style="animation-delay:${[.6, 1.2, 0][k]}s">
          <div class="md">${['🥇', '🥈', '🥉'][r.rank - 1] || r.rank + '위'}</div><div class="nm gold">${esc(r.name)}</div>
          <div class="tm">${r.team ? esc(r.team) + ' · ' : ''}💌 ${r.count}명의 감사</div>
          ${Core.prizeFor(act, r.rank) ? `<div style="margin:1vh 0">${Prize.card(Core.prizeFor(act, r.rank), 'sm')}</div>` : ''}
          <div class="th-msgs">${vals(r.msgs).map(m => `<div>“${esc(m)}”</div>`).join('')}</div></div>` : '<div></div>').join('')}</div>`,
        () => once('thv' + idx, () => { sfx('drumroll', 1.2); setTimeout(() => { sfx('fanfare'); sfx('cheer'); confetti(240); }, 1300); }));
    }
    if (ph === 'finale') {
      return view('th-f' + idx + st.finaleAt, '', () => `<canvas id="oneTeam" class="one-team"></canvas><div class="one-team-txt" id="otTxt"><div class="gold">올 한 해 서로에게 고마웠습니다</div><div class="sub">함께라서 가능했던 2026 · We are One Team 💛</div></div>`,
        () => {
          const items = []; const names = [];
          Core.thanksAgg(D, idx).forEach(r => { names.push(r.name); r.msgs.forEach(m => items.push({ name: r.name, msg: m.msg })); });
          const go = () => oneTeam(Core.shuffle(items, Core.rng(Core.hash('ot' + idx))).slice(0, 160), names.length ? names : ['One Team']);
          if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
        });
    }
    view('th-w' + idx, '', () => `${lab}<div class="headline">결과를 집계하고 있어요...</div>`);
  }

  // One Team 피날레: 이름과 멘트 카드가 가운데 나타났다가 작아지며 "One Team" 글자를 이룹니다
  function oneTeam(items, names) {
    const cv = document.getElementById('oneTeam'); if (!cv) return;
    const W = cv.width = innerWidth, H = cv.height = innerHeight; const ctx = cv.getContext('2d');
    const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
    const off = document.createElement('canvas'); off.width = W; off.height = H; const o = off.getContext('2d');
    let fs = Math.min(H * .42, W * .22); o.font = `900 ${fs}px ${FONT}`;
    const tw = o.measureText('One Team').width; if (tw > W * .92) { fs *= W * .92 / tw; o.font = `900 ${fs}px ${FONT}`; }
    o.fillStyle = '#fff'; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText('One Team', W / 2, H * .46);
    const img = o.getImageData(0, 0, W, H).data;
    let area = 0; for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (img[(y * W + x) * 4 + 3] > 128) area += 4;
    const g = Math.max(6, Math.sqrt(area / 560));
    const pts = []; for (let y = g / 2; y < H; y += g) for (let x = g / 2; x < W; x += g) if (img[((y | 0) * W + (x | 0)) * 4 + 3] > 128) pts.push([x + (Math.random() - .5) * g * .4, y + (Math.random() - .5) * g * .4]);
    const P = Core.shuffle(pts);
    const N = Math.min(items.length, P.length);
    // 화면을 4×3 = 12칸으로 나눠 이름+멘트 카드가 동시에 여러 장 떠오릅니다 (묶음마다 2.6초 머문 뒤 글자로 날아감)
    // 최대 60장(5묶음)까지 카드로 보여 주고, 나머지는 이름만 빠르게 날아가 글자를 채웁니다
    const COLS = 4, ROWS = 3, SLOTS = COLS * ROWS;
    const HL = Math.min(N, 60), WAVE = 3.6, BURST = 3;
    const waves = Math.ceil(HL / SLOTS);
    const cascade = Math.max(0, waves - 1) * WAVE + 1.4 + (N > HL ? BURST : 0);
    const HOLD = 2.6, FLY = 1.4, small = g * .9;
    const slotPos = k => [W * ((k % COLS) + .5) / COLS + (Math.random() - .5) * W * .025, H * (.21 + .29 * Math.floor(k / COLS)) + (Math.random() - .5) * H * .025];
    const slotOrder = Core.shuffle([...Array(SLOTS).keys()]);
    const pal = ['#ffcc4d', '#ff8fb8', '#7ee0ff', '#3ddc97', '#b98cff', '#ffb36b', '#ffffff'];
    const parts = P.map((pt, i) => {
      const filler = i >= N; const it = filler ? { name: names[i % names.length] } : items[i];
      const hl = !filler && i < HL;
      const wave = Math.floor(i / SLOTS), slot = i % SLOTS;
      return { it, filler, hl, to: pt, c: pal[Core.hash(it.name) % pal.length],
        t0: filler ? (N ? cascade + FLY : 0) + Math.random() * 1.8 : hl ? wave * WAVE + slotOrder.indexOf(slot) * .11 : (waves - 1) * WAVE + 1.4 + ((i - HL) / Math.max(1, N - HL)) * BURST,
        from: hl ? slotPos(slot) : [W / 2 + (Math.random() - .5) * W * .3, H / 2 + (Math.random() - .5) * H * .3] };
    });
    const tEnd = (N ? cascade + FLY : 0) + 1.8 + .9;
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const wrap = (text, maxW, font) => {
      ctx.font = font; const out = []; let line = '';
      for (const ch of String(text)) { if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; if (out.length === 3) { out[2] = out[2].slice(0, -1) + '…'; line = ''; break; } } else line += ch; }
      if (line) out.push(line); return out.slice(0, 3);
    };
    const start = performance.now(); let lastPop = 0, done = false;
    function frame(now) {
      if (!document.getElementById('oneTeam')) return;
      const t = (now - start) / 1000; ctx.clearRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255,204,77,.35)'; ctx.shadowBlur = done ? 12 : 0;
      for (const p of parts) {
        const lt = t - p.t0; if (lt < 0) continue;
        if (p.filler) { ctx.globalAlpha = Math.min(1, lt / .6) * .95; ctx.fillStyle = p.c; ctx.font = `700 ${small}px ${FONT}`; ctx.fillText(p.it.name, p.to[0], p.to[1]); continue; }
        if (lt >= (p.hl ? HOLD + FLY : FLY)) { ctx.globalAlpha = .95; ctx.fillStyle = p.c; ctx.font = `700 ${small}px ${FONT}`; ctx.fillText(p.it.name, p.to[0], p.to[1]); }
      }
      ctx.shadowBlur = 0;
      for (const p of parts) {
        if (p.filler) continue; const lt = t - p.t0; if (lt < 0 || lt >= (p.hl ? HOLD + FLY : FLY)) continue;
        if (!p.hl) { // 빠른 이름: 가운데에서 바로 날아감
          const k2 = ease(Math.min(1, lt / FLY)); const x2 = p.from[0] + (p.to[0] - p.from[0]) * k2, y2 = p.from[1] + (p.to[1] - p.from[1]) * k2;
          if (lt >= FLY) continue;
          ctx.globalAlpha = Math.min(1, lt / .2); ctx.fillStyle = p.c; ctx.font = `800 ${H * .03 + (small - H * .03) * k2}px ${FONT}`; ctx.fillText(p.it.name, x2, y2); continue;
        }
        const k = lt < HOLD ? 0 : ease((lt - HOLD) / FLY);
        const x = p.from[0] + (p.to[0] - p.from[0]) * k, y = p.from[1] + (p.to[1] - p.from[1]) * k;
        const appear = Math.min(1, lt / .35); const pop = lt < .35 ? .85 + .15 * ease(lt / .35) : 1; const shrink = (1 - k * .92) * pop;
        const big = H * .042; const fsz = big + (small - big) * k;
        const cardA = (1 - Math.min(1, k * 1.7)) * appear;
        if (cardA > .02) {
          const cw = W * .225 * shrink, ch = H * .25 * shrink;
          ctx.globalAlpha = cardA * .92; ctx.fillStyle = '#1c1f4d'; ctx.strokeStyle = p.c; ctx.lineWidth = 3;
          ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - cw / 2, y - ch / 2, cw, ch, 24 * shrink); else ctx.rect(x - cw / 2, y - ch / 2, cw, ch); ctx.fill(); ctx.stroke();
          const mf = `500 ${H * .022 * shrink}px ${FONT}`; const lines = wrap('“' + p.it.msg + '”', cw * .86, mf);
          ctx.fillStyle = '#e6e8ff'; ctx.font = mf; lines.forEach((l, j) => ctx.fillText(l, x, y + ch * .02 + j * H * .03 * shrink));
        }
        ctx.globalAlpha = appear; ctx.fillStyle = p.c; ctx.font = `900 ${fsz}px ${FONT}`;
        ctx.fillText(p.it.name, x, y - H * .07 * shrink * (cardA > .02 ? 1 : 0));
        if (lt >= HOLD && t - lastPop > .4) { lastPop = t; sfx('pop'); }
      }
      ctx.globalAlpha = 1;
      if (t > tEnd && !done) { done = true; const tx = document.getElementById('otTxt'); if (tx) tx.classList.add('show'); sfx('fanfare'); sfx('cheer'); confetti(260); setTimeout(() => confetti(200), 1200); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ---------- 오늘의 순서 (목차) ----------
  function vAgenda(idx, act, st, ans, content) {
    const secs = vals(content.activities).filter(a => a.type === 'section');
    view('ag' + idx, JSON.stringify(secs.map(s => s.title)), () => `${label('📋 ' + esc(act.title || '오늘의 순서'))}
      <div class="hero-title gold" style="font-size:7vh;margin-bottom:3vh">${esc(content.title || '')}</div>
      <div class="agenda">${secs.map((s, k) => `<div class="ag-item glass" style="animation-delay:${.15 + k * .18}s"><div class="ag-no">${k + 1}</div><div><div class="ag-t">${esc(s.title.replace(/^[^\wㄱ-힣]*\d+\.\s*/, '').replace(/^\d+\.\s*/, ''))}</div>${s.sub ? `<div class="ag-s">${esc(s.sub)}</div>` : ''}</div></div>`).join('')}</div>`,
      () => cue('ag' + idx, 'sparkle'));
  }

  // ---------- 게임 소개 + 상품 공개 ----------
  function vGame(idx, act, st, ans, content) {
    const acts = vals(content.activities); const b = Core.blockRange(acts, idx);
    const qs = b ? acts.slice(b.start, b.end).filter(a => a.type === 'quiz') : [];
    const no = acts.slice(0, idx + 1).filter(a => a.type === 'game').length;
    const prizes = vals(act.prizes);
    const shown = !!st.prize;
    view('gm' + idx + shown, '', () => `${label(`🎮 GAME ${no}`)}<div class="hero-title gold" style="font-size:9vh">${esc(act.title)}</div>
      ${act.desc ? `<div class="sec-desc">${esc(act.desc)}</div>` : ''}
      ${shown ? `<div class="gm-prizes">${prizes.map((p, k) => `<div class="gm-p" style="animation-delay:${.2 + k * .35}s"><div class="gm-r">${p.from}${p.to !== p.from ? '~' + p.to : ''}등 <small>${p.to - p.from + 1}명</small></div>${Prize.card(p, k === 0 ? 'lg' : 'md')}</div>`).join('')}</div>`
        : `<div class="glass panel" style="width:min(1100px,80vw);margin:0 auto"><ul class="sec-rules">
          <li>📝 문제 ${qs.length}개 · 보기 중 정답을 휴대폰에서 터치</li>
          <li>⚡ 정답 ${Core.SCORING.correct}점 + 빨리 맞힐수록 최대 ${Core.SCORING.speedBonus}점 보너스</li>
          <li>📊 문제마다 중간 순위 TOP 10 공개 · 마지막 문제 후 최종 발표</li>
          <li>⚖️ 동점이면 맞힌 문제 수 → 정답까지 걸린 시간(1/1000초) 순</li></ul>
          ${prizes.length ? '<div class="sub" style="margin-top:2vh;font-size:3vh;animation:blink 1.6s infinite">🎁 1~10등 상품은 과연?</div>' : ''}</div>`}`,
      () => { if (shown) once('gmp' + idx + st.prize, () => { sfx('drumroll', 1); setTimeout(() => { sfx('fanfare'); confetti(200); }, 1000); }); });
  }

  // ---------- 몸풀기: 다른 글자 찾기 ----------
  function vOdd(idx, act, st, ans) {
    const ph = st.phase || 'ready'; const N = Core.maxPrizeRank(act) || 50;
    const rk = Core.oddRanking(D, idx); const deadline = (st.openedAt || 0) + act.duration * 1000; const running = ph === 'open' && B.now() < deadline;
    const lab = label('🧩 몸풀기 게임');
    const grid = (hl) => { const n = act.cols * act.rows; const pos = Core.oddBoard('screen' + idx, act);
      return `<div class="odd-grid" style="grid-template-columns:repeat(${act.cols},1fr)">${Array.from({ length: n }, (_, i) => `<span class="${i === pos && hl ? 'hit' : ''}">${esc(i === pos ? act.odd : act.base)}</span>`).join('')}</div>`; };
    if (ph === 'ready') return view('od-r' + idx, '', () => `${lab}<div class="hero-title gold" style="font-size:8vh">${esc(act.title)}</div>${act.desc ? `<div class="sec-desc">${esc(act.desc)}</div>` : ''}
      <div class="glass panel" style="width:min(1100px,80vw);margin:0 auto"><ul class="sec-rules">
        <li>📱 시작하면 휴대폰에 글자판이 나타나요 (사람마다 배치가 달라요)</li>
        <li>🔍 똑같은 글자들 사이에 숨은 <b>다른 글자 하나</b>를 가장 빨리 찾아 터치!</li>
        <li>⛔ 틀리면 1.5초 동안 멈춰요 · 제한시간 ${act.duration}초</li></ul></div>`);
    if (ph === 'open' || ph === 'closed') {
      return view('od-o' + idx + st.openedAt + running, JSON.stringify([rk.length, rk.slice(0, 6).map(r => r.pid)]), () => `${lab}<div class="headline">${running ? '휴대폰에서 다른 글자 하나를 찾아 터치!' : '⏰ 시간 종료!'}</div>
        <div class="quiz-wrap"><div><div class="odd-feed" id="odF"></div></div><div>${running ? `<div class="ring" data-deadline="${deadline}" data-total="${act.duration * 1000}"><svg viewBox="0 0 200 200"><circle class="bg" cx="100" cy="100" r="90" fill="none" stroke-width="14"/><circle class="fg" cx="100" cy="100" r="90" fill="none" stroke-width="14" stroke-linecap="round" stroke-dasharray="565.5" stroke-dashoffset="0"/></svg><div class="num"></div></div>` : ''}
        <div class="answered">찾은 사람 <b id="odN" style="color:#fff;font-size:5vh">0</b> / ${Math.max(onlineN(), rk.length)}</div></div></div>`,
        first => {
          if (running) { cue('odgo' + st.openedAt, 'ding'); duckNow = true; }
          document.getElementById('odN').textContent = rk.length;
          document.getElementById('odF').innerHTML = rk.length ? rk.slice(0, 6).map(r => `<div><b>${r.rank}</b><span>${esc(r.name)}</span><em>${r.sec.toFixed(2)}초</em></div>`).join('') : '<div class="sub" style="animation:blink 1.4s infinite">누가 제일 먼저 찾을까요?</div>';
          if (!first && rk.length) pop();
        });
    }
    if (ph === 'answer') return view('od-a' + idx, '', () => `${lab}<div class="headline">정답은 '${esc(act.base)}' 사이에 숨은 <b class="gold">'${esc(act.odd)}'</b>!</div>${grid(true)}<div class="sub" style="margin-top:2vh">찾은 사람 <b style="color:#fff">${rk.length}명</b></div>`, () => cue('oda' + idx, 'ding'));
    if (ph === 'rank') {
      const top = rk.slice(0, N);
      return view('od-k' + idx, '', () => `${lab}<div class="headline" style="font-size:4.2vh;margin-bottom:1.6vh">🏁 가장 빨리 찾은 TOP ${N}</div>
        <div class="odd-rank" style="grid-template-columns:repeat(${top.length > 30 ? 5 : top.length > 15 ? 3 : 2},1fr)">${top.map((r, k) => `<div style="animation-delay:${Math.min(3, k * .05)}s"><b>${r.rank}</b><span>${esc(r.name)}</span><em>${r.sec.toFixed(2)}s</em></div>`).join('')}</div>`,
        () => once('odk' + idx, () => sfx('fanfare')));
    }
    const p = Core.prizeFor(act, 1) || { name: '깜짝 선물' };
    view('od-p' + idx, '', () => `${label('🎁 깜짝 선물!')}<div class="hero-title gold" style="font-size:9vh">TOP ${N} 전원 당첨!</div>
      <div style="display:flex;justify-content:center;margin:2vh 0">${Prize.card(p, 'lg')}</div>
      <div class="headline" style="font-size:4vh">${esc(p.name)} ${N}명 당첨을 축하합니다 🎉</div><div class="sub">당첨자는 휴대폰 화면을 확인하세요!</div>`,
      () => once('odp' + idx, () => { sfx('cymbal'); sfx('fanfare'); sfx('cheer'); confetti(260); setTimeout(() => confetti(220), 1000); setTimeout(() => confetti(180), 2200); }));
  }

  // ---------- 세션 소개 ----------
  const TYPE_ICON = { game: '🎮', oddone: '🧩', agenda: '📋', thanks: '💌', poll: '🗳️', quiz: '🧠', wordcloud: '☁️', bingo: '🎱', lottery: '🎰', rank: '🏆', race: '⚡', teamquiz: '🧠', mind: '💞', chosung: '🔤', timing: '⏱️', reaction: '⚡' };
  function vSection(idx, act, st, ans, content) {
    const info = Core.sectionInfo(content, idx);

    const firstIcon = {}; info.list.forEach(({ a }) => { const n = Core.typeName(a); if (!firstIcon[n]) firstIcon[n] = TYPE_ICON[a.type] || '•'; });
    const prizes = info.prizes.slice(0, 8);
    view('sec' + idx, JSON.stringify([act, prizes.length]), () => `<div class="label">SESSION ${info.no}${info.total ? ' / ' + info.total : ''}</div>
      <div class="hero-title gold" style="font-size:9vh">${esc(act.title)}</div>
      ${act.sub ? `<div class="sec-sub">${esc(act.sub)}</div>` : ''}
      ${vals(act.desc).length ? `<div class="sec-desc">${vals(act.desc).map(d => `<div>${esc(d)}</div>`).join('')}</div>` : ''}
      <div class="sec-grid ${prizes.length ? '' : 'one'}"><div class="glass panel"><h3>📋 이번 세션에서 할 것</h3>
        <div class="sec-chips">${info.chips.map(c => `<span>${/^[\p{L}\p{N}]/u.test(c.label) ? (TYPE_ICON[c.type] || '•') + ' ' : ''}${esc(c.label)}</span>`).join('')}</div>
        ${info.rules.length ? `<ul class="sec-rules">${info.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}</div>
        ${prizes.length ? `<div class="glass panel"><h3>🎁 이번 세션 상품</h3><div class="sec-prizes">${prizes.map(p => `<div><div class="sec-pl">${esc(p.label)}</div>${Prize.card(p.prize, 'sm')}</div>`).join('')}</div></div>` : ''}</div>`,
      () => cue('sec' + idx, 'sparkle'));
  }

  // ---------- 투표 ----------
  function vPoll(idx, act, st, ans) {
    const opts = vals(act.options); const ph = st.phase || 'ready';
    if (ph === 'ready') return view('poll-r' + idx, '', () => `${label('🗳️ 실시간 투표')}<div class="headline">${esc(act.title)}</div><div class="sub" style="animation:blink 1.4s infinite">곧 투표가 시작됩니다</div>`);
    const c = countVotes(opts.length, ans); const n = c.reduce((a, b) => a + b, 0);
    view('poll' + idx, JSON.stringify([c, ph]), () => `${label('🗳️ 실시간 투표')}<div class="headline">${esc(act.title)}</div>
      ${barsHTML(opts.map((o, i) => ({ label: o, k: OPT_KEYS[i], color: COLORS[i % COLORS.length] })))}<div class="sub" id="pS" style="margin-top:3vh"></div>`,
      first => { if (!first) pop();
        updateBars(main, c, { pct: true, crown: true }); document.getElementById('pS').innerHTML = `${ph === 'open' ? '<span style="color:#3ddc97">● 투표 진행 중</span>' : '투표 마감'} · <b style="color:#fff">${n}</b>명 참여`; });
  }

  // ---------- 퀴즈 ----------
  function quizNo(idx) {
    const acts = vals(D.content.activities); const b = Core.blockRange(acts, idx);
    const qs = acts.map((a, i) => a.type === 'quiz' && (!b || (i >= b.start && i < b.end)) ? i : -1).filter(i => i >= 0);
    return `${qs.indexOf(idx) + 1} / ${qs.length}`;
  }
  function vQuiz(idx, act, st, ans) {
    const opts = vals(act.options); const ph = st.phase || 'ready';
    const acts = vals(D.content.activities); const blk = Core.blockRange(acts, idx); const gname = blk ? acts[blk.start].title : '';
    const tag = `${gname ? esc(gname) + ' · ' : ''}${act.ox ? '⭕❌ OX' : 'Q'} ${quizNo(idx)}`;
    if (ph === 'ready') return view('q-r' + idx, '', () => `${label(tag)}<div class="hero-title" style="font-size:22vh;animation:pop 1.2s infinite">❓</div><div class="headline">문제가 곧 나옵니다!</div>`);
    if (ph === 'reveal') {
      const c = countVotes(opts.length, ans); const last = Core.isLastQuizInBlock(acts, idx);
      const top = blk ? Core.quizRanking(D, idx, 'block').filter(r => r.score > 0).slice(0, 10) : Core.quizRanking(D, idx).slice(0, 5);
      const teams = blk ? [] : teamsOf(); const tAcc = teams.map(t => { let a = 0, ok = 0; Object.entries(ans).forEach(([pid, x]) => { if ((players()[pid] || {}).team === t) { a++; if (x.v === act.answer) ok++; } }); return a ? Math.round(100 * ok / a) : 0; });
      view('q-v' + idx, JSON.stringify([c, top, tAcc]), () => `${label(tag + ' · 정답 공개')}<div class="headline" style="font-size:4vh;margin-bottom:2vh">${esc(act.title)}</div>
        <div class="reveal-grid ${last ? 'solo' : ''}"><div>${barsHTML(opts.map((o, i) => ({ label: o, k: act.ox ? '' : OPT_KEYS[i], color: COLORS[i % COLORS.length] })))}
          ${teams.length ? `<div class="glass panel tbars" style="margin-top:2.6vh"><h3>🎯 팀별 정답률</h3>${barsHTML(teams.map(t => ({ label: `${Core.teamEmoji(teams, t)} ${t}`, color: tc(t) })))}</div>` : ''}</div>
          ${last ? '' : `<div class="glass panel"><h3>🏆 ${blk ? '중간 순위 TOP 10' : '누적 TOP 5'}</h3><ol class="lb ${blk ? 'lb10' : ''}" id="qTop"></ol></div>`}</div>
          ${last ? '<div class="sub" style="margin-top:3vh;font-size:3vh">🏁 마지막 문제였어요! 순위는 결과 발표에서 공개됩니다</div>' : ''}`,
        () => {
          updateBars(main.querySelector('.reveal-grid > div'), c, { correct: act.answer });
          const tb = main.querySelector('.tbars'); if (tb) updateBars(tb, tAcc, { fmt: v => v + '%' });
          const qt = document.getElementById('qTop'); if (qt) qt.innerHTML = lbRows(top);
          once('q' + idx + ':' + st.openedAt, () => { sfx('fanfare'); setTimeout(() => { confetti(160); sfx('cheer'); }, 400); });
        });
      return;
    }
    const deadline = (st.openedAt || 0) + act.duration * 1000; const n = vals(ans).length; const on = Math.max(onlineN(), n, 1);
    if (ph === 'open') { cue('qo' + idx + st.openedAt, 'ding'); if (B.now() < deadline) duckNow = true; }
    view('q-o' + idx + st.openedAt, JSON.stringify([n, on]), () => `${label(tag)}<div class="headline">${esc(act.title)}</div>
      <div class="quiz-wrap"><div>${act.ox ? `<div class="ox-big"><div style="color:#ff5a6e">O</div><div style="color:#4da3ff">X</div></div>`
        : `<div class="qopts">${opts.map((o, i) => `<div class="qopt" style="--c:${COLORS[i % COLORS.length]}"><span class="k">${OPT_KEYS[i]}</span>${esc(o)}</div>`).join('')}</div>`}</div>
        <div><div class="ring" data-deadline="${deadline}" data-total="${act.duration * 1000}"><svg viewBox="0 0 200 200"><circle class="bg" cx="100" cy="100" r="90" fill="none" stroke-width="14"/>
          <circle class="fg" cx="100" cy="100" r="90" fill="none" stroke-width="14" stroke-linecap="round" stroke-dasharray="565.5" stroke-dashoffset="0"/></svg><div class="num">${act.duration}</div></div>
        <div class="answered">응답 <b id="qN" style="color:#fff;font-size:3.4vh">0</b> / ${on}<div class="meter"><i id="qM" style="width:0"></i></div></div></div></div>`,
      () => { document.getElementById('qN').textContent = n; document.getElementById('qM').style.width = Math.min(100, 100 * n / on) + '%'; });
  }
  const lbRows = rows => rows.map((r, i) => `<li><span class="r">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="n">${esc(r.name)}</span>${r.team ? `<span class="tm" style="--c:${tc(r.team)}">${esc(r.team)}</span>` : ''}<span class="s">${r.score.toLocaleString()}</span></li>`).join('');

  // ---------- 워드클라우드 ----------
  const seenWords = {};
  function vCloud(idx, act, st, ans) {
    const ph = st.phase || 'ready';
    if (ph === 'ready') return view('wc-r' + idx, '', () => `${label('☁️ 워드클라우드')}<div class="headline">${esc(act.title)}</div>${act.desc ? `<div class="sec-desc">${esc(act.desc)}</div>` : ''}<div class="sub" style="animation:blink 1.4s infinite">곧 입력이 열립니다</div>`);
    const freq = {}; vals(ans).forEach(a => vals(a.w).forEach(w => { const k = String(w).trim(); if (k) freq[k] = (freq[k] || 0) + 1; }));
    const items = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 60);
    const max = items.length ? items[0][1] : 1;
    const shown = items.slice().sort((a, b) => Core.hash(a[0]) - Core.hash(b[0]));
    const seen = seenWords[idx] = seenWords[idx] || new Set();
    view('wc' + idx, JSON.stringify([items, ph]), () => `${label('☁️ 워드클라우드')}<div class="headline" style="margin-bottom:${act.desc ? '.6vh' : '2.4vh'}">${esc(act.title)}</div>${act.desc ? `<div class="sub" style="margin-bottom:2vh;font-size:2.2vh">${esc(act.desc)}</div>` : ''}<div class="cloud" id="cl"></div><div class="sub" id="clS" style="margin-top:2.4vh"></div>`,
      () => {
        document.getElementById('cl').innerHTML = shown.map(([w, c]) => `<span class="${seen.has(w) ? '' : 'new'}" style="font-size:${(2.6 + 9.5 * Math.sqrt(c / max)).toFixed(1)}vh;color:${COLORS[Core.hash(w) % COLORS.length]}">${esc(w)}</span>`).join('') || '<span class="sub" style="animation:blink 1.4s infinite">첫 단어를 기다리는 중...</span>';
        if (shown.some(([w]) => !seen.has(w)) && seen.size) pop();
        shown.forEach(([w]) => seen.add(w));
        document.getElementById('clS').innerHTML = `<b style="color:#fff">${vals(ans).length}</b>명 참여${ph === 'closed' ? ' · 입력 마감' : ''}`;
      });
  }

  // ---------- 빙고 ----------
  let lastCalled = {};
  function vBingo(idx, act, st) {
    const called = vals(st.called); const ph = st.phase || 'ready';
    const winners = Core.bingoWinners(D, idx, act);
    const need = Core.maxPrizeRank(act) || 3;
    if (winners.length >= need) return vBingoResult(idx, act, winners, need);
    view('b' + idx, JSON.stringify([called, winners.map(w => w.pid), ph]), () => `${label(`🎱 ${esc(act.title)} · ${act.size}×${act.size} · ${act.lines}줄 완성`)}
      <div class="bingo-grid"><div class="ball-wrap"><div class="ball" id="ball"></div><div class="hist" id="hist"></div></div>
      <div class="glass panel"><h3>🏁 빙고 완성 순서 <span id="bwN" style="color:#fff"></span></h3><ol class="lb" id="bw"></ol></div></div>`,
      first => {
        const ball = document.getElementById('ball'); const last = called[called.length - 1];
        const prev = lastCalled[idx]; lastCalled[idx] = called.length;
        ball.innerHTML = last ? `<div><div class="no">${called.length}번째</div><div class="w">${esc(last)}</div></div>` : `<div><div class="w" style="font-size:12vh">🎱</div><div class="no">${ph === 'ready' ? '빙고판을 확인하세요!' : '첫 공을 기다리는 중'}</div></div>`;
        if (!first && prev != null && called.length > prev) { ball.classList.remove('drop'); void ball.offsetWidth; ball.classList.add('drop'); setTimeout(() => sfx('ball'), 650); }
        document.getElementById('hist').innerHTML = called.slice(0, -1).reverse().slice(0, 28).map(w => `<span>${esc(w)}</span>`).join('');
        document.getElementById('bwN').textContent = winners.length ? `(${winners.length}명)` : '';
        document.getElementById('bw').innerHTML = winners.slice(0, 8).map((w, i) => `<li><span class="r">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="n">${esc(w.name)}</span>${w.team ? `<span class="tm" style="--c:${tc(w.team)}">${esc(w.team)}</span>` : ''}</li>`).join('') + (winners.length > 8 ? `<li class="sub">외 ${winners.length - 8}명</li>` : '') || '<li class="sub" style="justify-content:center">아직 없음 — 누가 먼저일까요?</li>';
        if (winners.length) once('bw' + idx + ':' + winners.length, () => { if (!first) { confetti(120); sfx('win'); } });
      });
  }

  function vBingoResult(idx, act, winners, need) {
    const items = winners.slice(0, Math.max(need, 3)).map((w, k) => ({ rank: k + 1, title: w.name, sub: w.team ? `<span style="color:${tc(w.team)}">${esc(w.team)}</span>` : '', prize: Core.prizeFor(act, k + 1) }));
    view('bres' + idx, JSON.stringify(items.map(i => i.title)), () => `${label('🎱 ' + esc(act.title) + ' · 결과')}<div class="headline" style="font-size:4.2vh;margin-bottom:4vh">🎉 빙고 완성! 축하합니다 🎉</div>
      ${podium(items.slice(0, 3))}${extraRanks(items.slice(3), 4)}`,
      () => once('bres' + idx, () => { sfx('fanfare'); sfx('cheer'); confetti(220); setTimeout(() => confetti(160), 900); }));
  }

  // ---------- 추첨 ----------
  let reelTimer = null;
  function vLottery(idx, act, st) {
    const ph = st.phase || 'ready';
    const revealAt = (st.at || 0) + 4500; const revealed = ph === 'spin' && B.now() > revealAt;
    const w = vals(st.winners);
    if (ph !== 'spin') return view('l-r' + idx, String(Object.keys(players()).length), () => `${label('🎁 깜짝 추첨')}<div class="headline" style="margin-bottom:2vh">${esc(act.title)}</div>
      ${act.desc ? `<div class="sub" style="margin-bottom:2.4vh">${esc(act.desc)}</div>` : ''}
      <div style="display:flex;justify-content:center;align-items:center;gap:4vw"><div class="gift" style="font-size:18vh">🎁</div>${Prize.card(Core.prizeFor(act, 1) || { name: act.title }, 'lg')}</div>
      <div class="sub" style="margin-top:2.4vh">행운의 주인공 <b style="color:var(--gold)">${act.count}명</b>은 누구일까요?</div>`);
    if (ph === 'spin' && !revealed) duckNow = true;
    if (!revealed) return view('l-s' + idx + st.at, '', () => `${label('🎰 추첨 중')}<div class="headline">${esc(act.title)}</div><div class="reel glass"><div class="nm" id="reel">...</div></div><div class="sub" style="margin-top:3vh;animation:blink .8s infinite">두근두근...</div>`,
      () => { startReel(st.at, revealAt); cue('dr' + st.at, 'drumroll', Math.max(.5, (revealAt - B.now()) / 1000)); });
    
    view('l-v' + idx + st.at, JSON.stringify(w), () => `${label('🎉 당첨을 축하합니다 🎉')}<div class="headline">${esc(act.title)}</div>
      <div class="winners">${w.map((pid, i) => `<div class="glass wcard" style="animation-delay:${i * .25}s"><div class="nm gold">${esc(nameOf(pid))}</div><div class="tm">${esc((players()[pid] || {}).team || '')}</div>
        <div style="margin-top:1.6vh">${Prize.card(Core.prizeFor(act, i + 1) || { name: act.title }, w.length > 3 ? 'sm' : 'md')}</div></div>`).join('')}</div>`,
      () => once('lot' + idx + st.at, () => { confetti(220); sfx('cymbal'); sfx('fanfare'); setTimeout(() => { confetti(160); sfx('cheer'); }, 900); }));
  }
  function startReel(start, end) {
    clearTimeout(reelTimer);
    const names = Object.values(players()).map(p => p.name); if (!names.length) return;
    const step = () => {
      const el = document.getElementById('reel'); if (!el) return;
      const now = B.now(); const p = Math.min(1, Math.max(0, (now - start) / (end - start)));
      el.textContent = names[Math.floor(Math.random() * names.length)];
      el.style.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      if (p < 1) reelTimer = setTimeout(step, 45 + 380 * p * p);
    };
    step();
  }

  // ---------- 순위 / 시상 ----------
  // items: [{title, sub, prize, emoji?}] 1·2·3등 순서
  function podium(items) {
    const order = [1, 0, 2];
    return `<div class="podium">${order.map(k => { const r = items[k]; return `<div class="pod p${k + 1}"><div class="who">${r ? `<div class="md">${r.emoji || ['🥇', '🥈', '🥉'][k]}</div><div class="nm">${esc(r.title)}</div><div class="ps">${r.sub || ''}</div>
      ${r.prize ? `<div style="margin-top:1vh">${Prize.card(r.prize, 'sm')}</div>` : ''}` : ''}</div><div class="blk">${r && r.rank ? r.rank : k + 1}</div></div>`; }).join('')}</div>`;
  }
  function extraRanks(items, from) {
    if (!items.length) return '';
    return `<div style="display:flex;justify-content:center;gap:1vw;margin-top:2.4vh;flex-wrap:wrap;max-width:94vw;margin-left:auto;margin-right:auto">${items.map((r, i) => `<div class="tchip" style="--c:#ffcc4d"><span class="rk">${r.rank || from + i}위</span>${esc(r.title)}${r.prize ? ` <b style="font-size:1.8vh;color:#ffe08a">${esc(r.prize.name)}</b>` : ''}</div>`).join('')}</div>`;
  }
  function podiumHTML(top) { return podium(top.map(r => ({ title: r.name, sub: `${r.score.toLocaleString()}점${r.team ? ` · <span style="color:${tc(r.team)}">${esc(r.team)}</span>` : ''}` }))); }
  function vRank(idx, act, st) {
    const snap = st.shown ? st.snap : null;
    if (!snap) return view('r-w' + idx, '', () => `${label('🏆 ' + esc(act.title))}<div class="hero-title gold" style="font-size:16vh;margin-bottom:2vh">${esc(act.desc || '여기까지!')}</div>
      <div class="headline" style="font-size:4.4vh">${act.scope === 'block' ? '이 게임이 모두 끝났어요 🎉' : act.scope === 'team' ? '모든 팀 게임이 끝났어요 🎉' : '모든 게임이 끝났어요 🎉'}</div><div class="sub" style="animation:blink 1.6s infinite">잠시 후 결과를 발표합니다</div>`,
      () => cue('rw' + idx, 'sparkle'));
    if (!snap) return view('r-w' + idx, '', () => `${label('🏆 ' + esc(act.title))}<div class="hero-title" style="font-size:20vh;animation:pop 1.2s infinite">🏆</div><div class="headline">결과 집계 중...</div>`);
    if (act.scope === 'team') {
      const teams = teamsOf(); const rows = vals(snap.team);
      const medal = r => vals(r.medals).length ? ` · 🥇${r.medals[0]} 🥈${r.medals[1]}` : '';
      const items = rows.map(r => ({ title: r.team, emoji: Core.teamEmoji(teams, r.team), rank: r.rank, sub: `<span style="color:${tc(r.team)}">팀전 ${r.pts}점${medal(r)}</span>`, prize: Core.prizeFor(act, r.rank) }));
      const tieNote = rows.some(r => r.tieBroken) ? '<div class="sub" style="margin-top:1.6vh;font-size:2vh">⚖️ 동점 팀은 팀 게임 1등 횟수 → 2등 횟수 → 마지막 게임 순위로 결정했습니다</div>' : '';
      return view('rt' + idx + snap.at, '', () => `${label('🏁 ' + esc(act.title))}${podium(items.slice(0, 3))}${extraRanks(items.slice(3), 4)}${tieNote}`,
        () => once('rankt' + idx + snap.at, () => { sfx('drumroll', 1.2); setTimeout(() => { confetti(260); sfx('fanfare'); sfx('cheer'); setTimeout(() => confetti(180), 1000); }, 1300); }));
    }
    const rows = vals(snap.indiv); const n = Math.max(8, Core.maxPrizeRank(act));
    const items = rows.slice(0, n).map(r => ({ title: r.name, rank: r.rank, sub: `${r.score.toLocaleString()}점${r.correct != null ? ` · ${r.correct}문제` : ''}${r.team ? ` · <span style="color:${tc(r.team)}">${esc(r.team)}</span>` : ''}`, prize: Core.prizeFor(act, r.rank) }));
    const tieNote = rows.some(r => r.tieBroken && r.rank <= Math.max(3, Core.maxPrizeRank(act))) ? '<div class="sub" style="margin-top:1.6vh;font-size:2vh">⚖️ 동점자는 맞힌 문제 수 → 정답까지 걸린 시간 순으로 정했습니다</div>' : '';
    view('r' + idx + snap.at, '', () => `${label('🏆 ' + esc(act.title))}${podium(items.slice(0, 3))}${extraRanks(items.slice(3), 4)}${tieNote}`,
      () => once('rank' + idx + snap.at, () => { sfx('drumroll', 1); setTimeout(() => { confetti(200); sfx('fanfare'); sfx('cheer'); }, 1100); }));
  }

  // ---------- 팀 게임 공통 ----------
  function teamBoard(rows, act, opt = {}) {
    const teams = teamsOf();
    const low = act.type === 'timing' || act.type === 'reaction';
    const best = low ? Math.min(...rows.filter(r => r.n > 0).map(r => r.value), Infinity) : 0;
    const vals2 = rows.map(r => r.n > 0 ? (low ? Math.max(.05, best) / Math.max(.05, r.value) : r.value) : 0); const max = Math.max(1e-9, ...vals2);
    return `<div class="tboard">${rows.map((r, i) => `<div class="trow ${opt.reveal && r.rank === 1 ? 'win' : ''}" style="--c:${tc(r.team)}">
      <div class="tr-rk">${opt.reveal ? (['🥇', '🥈', '🥉'][r.rank - 1] || r.rank + '위') : ''}</div><div class="tr-nm"><span>${Core.teamEmoji(teams, r.team)}</span>${esc(r.team)}</div>
      <div class="tr-bar"><i style="width:${(100 * vals2[i] / max).toFixed(1)}%"></i><em>${esc(opt.sub ? opt.sub(r) : r.sub)}</em></div>
      <div class="tr-v">${opt.value ? opt.value(r) : esc(r.label)}${opt.reveal && r.pts ? `<small>+${r.pts}점</small>` : ''}</div></div>`).join('')}</div>`;
  }
  function vTeamGame(idx, act, st) {
    const ph = st.phase || 'ready'; const teams = teamsOf(); const name = Core.typeName(act);
    const w = Core.gameWindow(act, st); const now = B.now(); const running = ph === 'open' && now < w.end;
    const g = Core.teamGame(D, idx, act); const opts = vals(act.options);
    const lab = label(`👥 팀 게임 · ${esc(name)}`);
    const rules = { teamquiz: '시작 때 접속한 팀원 중 정답을 맞힌 비율로 승부! 모두 답해야 유리합니다', mind: '정답은 없어요! 팀원끼리 같은 답을 고를수록 이깁니다', reaction: `빨간 화면에서 기다리다 초록색이 되는 순간 터치! ${act.rounds || 3}번 평균 반응속도가 빠른 팀이 승리`, chosung: '초성을 보고 단어를 입력! 팀원 1인당 평균 정답 수로 승부', timing: `시작을 누르고 정확히 ${act.target}.00초에 멈추기! 팀원 평균 오차가 작은 팀이 승리` }[act.type];
    if (ph === 'ready') return view('tg-r' + idx, '', () => `${lab}<div class="headline">${esc(act.title)}</div>${act.desc ? `<div class="sec-desc" style="max-width:80vw">${esc(act.desc)}</div>` : ''}<div class="sub" style="max-width:70vw;margin:0 auto 4vh">📏 ${rules}</div>
      <div style="display:flex;justify-content:center;gap:2vw">${teams.map(t => `<div class="tchip" style="--c:${tc(t)};font-size:3vh;padding:1.6vh 2vw"><span class="em" style="font-size:5vh">${Core.teamEmoji(teams, t)}</span>${esc(t)}</div>`).join('')}</div>`);
    if (ph === 'reveal' && st.result) {
      const res = vals(st.result);
      const rows = res.map(r => Object.assign({}, g.rows.find(x => x.team === r.team) || {}, r));
      let extra = '';
      if (act.type === 'teamquiz') extra = `<div class="sub" style="margin-bottom:2vh">정답: <b style="color:#3ddc97;font-size:3.4vh">${esc(opts[act.answer])}</b></div>`;
      if (act.type === 'chosung') extra = `<div class="hist" style="max-width:90vw;margin:0 auto 2vh">${vals(act.items).map(it => `<span>${esc(it.q)} → <b style="color:#fff">${esc(vals(it.a)[0])}</b></span>`).join('')}</div>`;
      const mvp = g.indiv[0];
      const mvpTxt = mvp ? (act.type === 'reaction' ? `⚡ 가장 빨랐던 사람 <b style="color:var(--gold)">${esc(mvp.name)}</b> (${esc(mvp.team)}) · ${Math.round(mvp.v)}ms` : act.type === 'timing' ? `🎯 가장 정확했던 사람 <b style="color:var(--gold)">${esc(mvp.name)}</b> (${esc(mvp.team)}) · ${(mvp.ms / 1000).toFixed(2)}초` : act.type === 'chosung' ? `🔤 MVP <b style="color:var(--gold)">${esc(mvp.name)}</b> (${esc(mvp.team)}) · ${mvp.v}개 정답` : '') : '';
      return view('tg-v' + idx + st.result.length + JSON.stringify(res), '', () => `${lab}<div class="headline" style="font-size:4.2vh;margin-bottom:1.6vh">${esc(act.title)}</div>${extra}
        ${teamBoard(rows, act, { reveal: true, sub: r => r.sub })}${mvpTxt ? `<div class="sub" style="margin-top:2vh">${mvpTxt}</div>` : ''}`,
        () => once('tg' + idx + st.openedAt, () => { sfx('fanfare'); sfx('cheer'); confetti(220); }));
    }
    if (running) { duckNow = true; cue('tgo' + idx + st.openedAt, act.type === 'timing' ? 'go' : 'ding'); }
    if (ph === 'open' && !running) cue('tge' + idx + st.openedAt, 'whistle');
    const ring = running ? `<div class="ring" data-deadline="${w.end}" data-total="${w.end - w.start}"><svg viewBox="0 0 200 200"><circle class="bg" cx="100" cy="100" r="90" fill="none" stroke-width="14"/>
      <circle class="fg" cx="100" cy="100" r="90" fill="none" stroke-width="14" stroke-linecap="round" stroke-dasharray="565.5" stroke-dashoffset="0"/></svg><div class="num"></div></div>` : `<div class="headline" style="font-size:6vh">⏰ 시간 종료!</div>`;
    const liveOpt = (act.type === 'teamquiz' || act.type === 'mind') ? { value: r => `${r.n}/${r.size}`, sub: () => '응답' } : {};
    const liveRows = (act.type === 'teamquiz' || act.type === 'mind') ? g.rows.map(r => { const ro = st.roster && st.roster[r.team]; const base = Math.max(r.n, Array.isArray(ro) ? ro.length : (ro || r.size)); return Object.assign({}, r, { size: base, value: base ? r.n / base : 0 }); }).sort((a, b) => teams.indexOf(a.team) - teams.indexOf(b.team)) : g.rows.slice().sort((a, b) => teams.indexOf(a.team) - teams.indexOf(b.team));
    let mid = '';
    if (act.type === 'teamquiz' || act.type === 'mind') mid = `<div class="qopts">${opts.map((o, i) => `<div class="qopt" style="--c:${COLORS[i % COLORS.length]}"><span class="k">${['A', 'B', 'C', 'D', 'E', 'F'][i]}</span>${esc(o)}</div>`).join('')}</div>`;
    if (act.type === 'chosung') mid = `<div class="cho-grid">${vals(act.items).map(it => `<span>${esc(it.q)}</span>`).join('')}</div>`;
    if (act.type === 'reaction') mid = `<div class="cho-grid"><span style="font-size:10vh;padding:2vh 3vw;color:#3ddc97">⚡ 초록불에 터치!</span></div><div class="sub">휴대폰 화면이 빨간색 → 초록색으로 바뀌는 순간! (미리 누르면 그 판은 다시)</div>`;
    if (act.type === 'timing') mid = `<div class="cho-grid"><span style="font-size:12vh;padding:2vh 3vw">${act.target}.00초</span></div><div class="sub">휴대폰에서 시작 → 마음속으로 세다가 멈춤! (3초 뒤 숫자가 사라져요)</div>`;
    view('tg-o' + idx + st.openedAt + running, JSON.stringify(liveRows.map(r => [r.n, r.value])), () => `${lab}<div class="headline" style="margin-bottom:2vh">${esc(act.title)}</div>
      <div class="quiz-wrap"><div>${mid}</div><div>${ring}</div></div><div id="tgLive" style="margin-top:2.4vh"></div>`,
      () => { document.getElementById('tgLive').innerHTML = teamBoard(liveRows, (act.type === 'timing' || act.type === 'reaction') ? act : { type: 'x' }, liveOpt); });
  }

  // ---------- 팀 대항 탭 레이스 ----------
  function vRace(idx, act, st) {
    const ph = st.phase || 'ready'; const teams = teamsOf();
    const w = Core.raceWindow(act, st); const now = B.now();
    const stage = ph === 'open' ? (now < w.start ? 'count' : now < w.end ? 'go' : 'end') : ph;
    const g = Core.teamGame(D, idx, act); const res = vals(st.result);
    if (stage === 'count') { duckNow = true; cue('rc' + st.openedAt + ':' + Math.ceil((w.start - now) / 1000), 'beep'); }
    if (stage === 'go') { duckNow = true; cue('rg' + st.openedAt, 'go'); }
    if (stage === 'end' || (stage === 'closed' && now < w.end + 4000)) cue('re' + st.openedAt, 'whistle');
    const lanes = teams.map(t => { const x = g.rows.find(y => y.team === t) || { value: 0, n: 0 }; const rr = res.find(y => y.team === t) || {}; return { id: t, name: t, emoji: Core.teamEmoji(teams, t), color: tc(t), v: Math.round(x.value * 10) / 10, n: x.n, rank: rr.rank, pts: rr.pts }; });
    const lead = Math.max(0, ...lanes.map(l => l.v)); const scale = Math.max(lead * 1.08, act.duration * 5);
    const rankOf = id => [...lanes].sort((a, b) => b.v - a.v).findIndex(l => l.id === id);
    const top = (stage === 'count') ? `<div class="go-overlay" id="rcd">${Math.ceil((w.start - now) / 1000)}</div>`
      : stage === 'go' ? `<div class="race-time">⏱️ <span data-deadline="${w.end}" data-total="${act.duration * 1000}">${act.duration}</span>초</div>`
      : stage === 'ready' ? `<div class="sub" style="margin-bottom:3vh">시작하면 휴대폰의 <b style="color:var(--gold)">TAP 버튼을 연타!</b> ${teams.length ? '팀원 1인당 평균 탭 수로 승부합니다' : ''}</div>`
      : stage === 'reveal' ? '' : `<div class="race-time" style="font-size:5vh">🏁 종료! 결과 집계 중...</div>`;
    view('race' + idx + stage + (stage === 'count' ? Math.ceil((w.start - now) / 1000) : ''), JSON.stringify(lanes.map(l => [l.v, l.n])), () => `${label(teams.length ? '⚡ 팀 대항 탭 레이스' : '⚡ 탭 레이스')}<div class="headline" style="margin-bottom:2vh">${esc(act.title)}</div>${top}
      <div class="track">${lanes.map(l => `<div class="lane ${stage === 'go' ? 'go' : ''}" data-id="${esc(l.id)}" style="--c:${l.color}"><div class="nm">${esc(l.name)}</div>
        <div class="road"><div class="trail"></div><div class="runner">${l.emoji}</div></div><div class="v"></div></div>`).join('')}</div>
      ${stage === 'reveal' && g.indiv[0] ? `<div class="sub" style="margin-top:2.6vh">⚡ MVP <b style="color:var(--gold)">${esc(g.indiv[0].name)}</b> (${esc(g.indiv[0].team)}) · ${g.indiv[0].v}회</div>` : ''}`,
      () => {
        main.querySelectorAll('.lane').forEach(el => {
          const l = lanes.find(x => String(x.id) === el.dataset.id); if (!l) return;
          const pos = 3 + 88 * (l.v / scale);
          el.querySelector('.runner').style.left = pos + '%'; el.querySelector('.trail').style.width = pos + '%';
          const rk = rankOf(l.id);
          el.classList.toggle('first', l.v > 0 && rk === 0);
          el.querySelector('.v').innerHTML = stage === 'reveal' ? `${['🥇', '🥈', '🥉'][(l.rank || rk + 1) - 1] || ''} ${l.pts ? `<small style="color:var(--gold)">+${l.pts}점</small>` : ''}`
            : `${l.v}<small>${teams.length ? ` 회/인 · ${l.n}명` : ' 회'}</small>`;
        });
        if (stage === 'reveal') once('race' + idx + st.openedAt, () => { confetti(220); sfx('fanfare'); sfx('cheer'); });
      });
  }

  // ---------- 종료 ----------
  function vFinal(content) {
    const top = Core.quizRanking(D).filter(r => r.score > 0).slice(0, 3);
    view('final', JSON.stringify(top), () => `${label('🎄 THANK YOU 🎄')}<div class="hero-title gold" style="font-size:8vh">함께해 주셔서 감사합니다</div>
      <div class="sub" style="margin-bottom:3vh">${esc(content.title || '')}</div>${top.length ? podiumHTML(top) : ''}`,
      () => once('final', () => { confetti(250); sfx('fanfare'); sfx('cheer'); let k = 0; const t = setInterval(() => { confetti(120); if (++k > 4) clearInterval(t); }, 2500); }));
  }

  // ---------- 눈 ----------
  (function snow() {
    const cv = document.getElementById('snow'); const ctx = cv.getContext('2d'); let W, H, flakes = [];
    const resize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
    resize(); addEventListener('resize', resize);
    for (let i = 0; i < 110; i++) flakes.push({ x: Math.random() * W, y: Math.random() * H, r: .6 + Math.random() * 2.4, s: .3 + Math.random() * 1, d: Math.random() * 6 });
    (function loop(t) {
      ctx.clearRect(0, 0, W, H);
      for (const f of flakes) {
        f.y += f.s; f.x += Math.sin(t / 1600 + f.d) * .35;
        if (f.y > H + 5) { f.y = -5; f.x = Math.random() * W; }
        ctx.globalAlpha = .25 + f.r / 4; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
      }
      requestAnimationFrame(loop);
    })(0);
  })();

  // ---------- 꽃가루 ----------
  const cf = document.getElementById('confetti'); const cctx = cf.getContext('2d'); let parts = [], running = false;
  function confetti(n) {
    cf.width = innerWidth; cf.height = innerHeight;
    const cols = ['#ffcc4d', '#ff5a6e', '#4da3ff', '#3ddc97', '#b98cff', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const left = i % 2 === 0;
      parts.push({ x: left ? 0 : cf.width, y: cf.height * (.55 + Math.random() * .3), vx: (left ? 1 : -1) * (6 + Math.random() * 12), vy: -(12 + Math.random() * 14),
        w: 6 + Math.random() * 8, h: 10 + Math.random() * 10, a: Math.random() * 6, va: (Math.random() - .5) * .4, c: cols[i % cols.length], life: 0 });
    }
    if (!running) { running = true; requestAnimationFrame(cloop); }
  }
  function cloop() {
    cctx.clearRect(0, 0, cf.width, cf.height);
    parts = parts.filter(p => p.y < cf.height + 40 && p.life < 420);
    for (const p of parts) {
      p.life++; p.vy += .35; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.a += p.va;
      cctx.save(); cctx.translate(p.x, p.y); cctx.rotate(p.a); cctx.fillStyle = p.c; cctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.a * 2))); cctx.restore();
    }
    if (parts.length) requestAnimationFrame(cloop); else { running = false; cctx.clearRect(0, 0, cf.width, cf.height); }
  }
})();
