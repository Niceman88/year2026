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
      ({ section: vSection, poll: vPoll, quiz: vQuiz, wordcloud: vCloud, bingo: vBingo, lottery: vLottery, rank: vRank, race: vRace, teamquiz: vTeamGame, mind: vTeamGame, chosung: vTeamGame, timing: vTeamGame, reaction: vTeamGame })[act.type](idx, act, st, ans, content);
      if (Core.isTeamGame(act) || act.type === 'section' || (act.type === 'rank' && act.scope === 'team')) teamMode = 'hide';
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

  // ---------- 세션 소개 ----------
  const TYPE_ICON = { poll: '🗳️', quiz: '🧠', wordcloud: '☁️', bingo: '🎱', lottery: '🎰', rank: '🏆', race: '⚡', teamquiz: '🧠', mind: '💞', chosung: '🔤', timing: '⏱️', reaction: '⚡' };
  function vSection(idx, act, st, ans, content) {
    const info = Core.sectionInfo(content, idx);
    const counts = {}; info.list.forEach(({ a }) => { const n = Core.typeName(a); counts[n] = (counts[n] || 0) + 1; });
    const firstIcon = {}; info.list.forEach(({ a }) => { const n = Core.typeName(a); if (!firstIcon[n]) firstIcon[n] = TYPE_ICON[a.type] || '•'; });
    const prizes = info.prizes.slice(0, 8);
    view('sec' + idx, JSON.stringify([act, prizes.length]), () => `<div class="label">SESSION ${info.no}${info.total ? ' / ' + info.total : ''}</div>
      <div class="hero-title gold" style="font-size:9vh">${esc(act.title)}</div>
      ${act.sub ? `<div class="sec-sub">${esc(act.sub)}</div>` : ''}
      ${vals(act.desc).length ? `<div class="sec-desc">${vals(act.desc).map(d => `<div>${esc(d)}</div>`).join('')}</div>` : ''}
      <div class="sec-grid ${prizes.length ? '' : 'one'}"><div class="glass panel"><h3>📋 이번 세션에서 할 것</h3>
        <div class="sec-chips">${Object.entries(counts).map(([n, c]) => `<span>${firstIcon[n]} ${esc(n)}${c > 1 ? ` ×${c}` : ''}</span>`).join('')}</div>
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
  function quizNo(idx) { const qs = vals(D.content.activities).map((a, i) => a.type === 'quiz' ? i : -1).filter(i => i >= 0); return `${qs.indexOf(idx) + 1} / ${qs.length}`; }
  function vQuiz(idx, act, st, ans) {
    const opts = vals(act.options); const ph = st.phase || 'ready';
    const tag = `${act.ox ? '⭕❌ OX 퀴즈' : '🧠 QUIZ'} ${quizNo(idx)}`;
    if (ph === 'ready') return view('q-r' + idx, '', () => `${label(tag)}<div class="hero-title" style="font-size:22vh;animation:pop 1.2s infinite">❓</div><div class="headline">문제가 곧 나옵니다!</div>`);
    if (ph === 'reveal') {
      const c = countVotes(opts.length, ans); const top = Core.quizRanking(D, idx).slice(0, 5);
      const teams = teamsOf(); const tAcc = teams.map(t => { let a = 0, ok = 0; Object.entries(ans).forEach(([pid, x]) => { if ((players()[pid] || {}).team === t) { a++; if (x.v === act.answer) ok++; } }); return a ? Math.round(100 * ok / a) : 0; });
      view('q-v' + idx, JSON.stringify([c, top, tAcc]), () => `${label(tag + ' · 정답 공개')}<div class="headline" style="font-size:4vh;margin-bottom:2vh">${esc(act.title)}</div>
        <div class="reveal-grid"><div>${barsHTML(opts.map((o, i) => ({ label: o, k: act.ox ? '' : OPT_KEYS[i], color: COLORS[i % COLORS.length] })))}
          ${teams.length ? `<div class="glass panel tbars" style="margin-top:2.6vh"><h3>🎯 팀별 정답률</h3>${barsHTML(teams.map(t => ({ label: `${Core.teamEmoji(teams, t)} ${t}`, color: tc(t) })))}</div>` : ''}</div>
          <div class="glass panel"><h3>🏆 누적 TOP 5</h3><ol class="lb" id="qTop"></ol></div></div>`,
        () => {
          updateBars(main.querySelector('.reveal-grid > div'), c, { correct: act.answer });
          const tb = main.querySelector('.tbars'); if (tb) updateBars(tb, tAcc, { fmt: v => v + '%' });
          document.getElementById('qTop').innerHTML = lbRows(top);
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
    if (ph === 'ready') return view('wc-r' + idx, '', () => `${label('☁️ 워드클라우드')}<div class="headline">${esc(act.title)}</div><div class="sub" style="animation:blink 1.4s infinite">곧 입력이 열립니다</div>`);
    const freq = {}; vals(ans).forEach(a => vals(a.w).forEach(w => { const k = String(w).trim(); if (k) freq[k] = (freq[k] || 0) + 1; }));
    const items = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 60);
    const max = items.length ? items[0][1] : 1;
    const shown = items.slice().sort((a, b) => Core.hash(a[0]) - Core.hash(b[0]));
    const seen = seenWords[idx] = seenWords[idx] || new Set();
    view('wc' + idx, JSON.stringify([items, ph]), () => `${label('☁️ 워드클라우드')}<div class="headline" style="margin-bottom:2.4vh">${esc(act.title)}</div><div class="cloud" id="cl"></div><div class="sub" id="clS" style="margin-top:2.4vh"></div>`,
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
    if (ph !== 'spin') return view('l-r' + idx, String(Object.keys(players()).length), () => `${label('🎁 경품 추첨')}<div class="gift">🎁</div><div class="headline">${esc(act.title)}</div><div class="sub">행운의 주인공 <b style="color:var(--gold)">${act.count}명</b>은 누구일까요?</div>`);
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
    const snap = st.snap;
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
    if (ph === 'ready') return view('tg-r' + idx, '', () => `${lab}<div class="headline">${esc(act.title)}</div><div class="sub" style="max-width:70vw;margin:0 auto 4vh">${rules}</div>
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
