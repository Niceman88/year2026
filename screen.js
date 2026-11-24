// 대형 화면(프로젝터) — 진행자 화면의 "현재 순서"를 그대로 보여 줍니다
(function () {
  const { B, esc, vals, DEMO } = Core;
  const app = document.getElementById('app');
  app.innerHTML = '<div class="s-wrap"><div class="s-top"><span id="sTitle"></span><span id="sCount"></span></div><div class="s-main" id="main"></div></div>';
  if (DEMO) document.body.insertAdjacentHTML('beforeend', '<div class="demo-banner">데모 모드</div>');
  const main = document.getElementById('main');
  const OPT_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const COLORS = ['#ff5a6e', '#4da3ff', '#ffcc4d', '#3ddc97', '#b98cff', '#ff9f43', '#7ee0ff', '#ff8fd0'];
  let D = null, lastKey = '';
  B.on('', v => { D = v || {}; render(); });
  setInterval(tick, 100);

  const joinUrl = Core.pageUrl('index.html');
  const players = () => D.players || {};
  const onlineN = () => Object.keys(D.online || {}).length;
  const nameOf = pid => (players()[pid] || {}).name || '?';
  function view(key, html) { if (key === lastKey) return; lastKey = key; main.innerHTML = html; }

  function render() {
    if (!D) return;
    const content = D.content || {}; const meta = D.meta || {};
    document.getElementById('sTitle').textContent = content.title || '';
    document.getElementById('sCount').textContent = `👥 접속 ${onlineN()}명`;
    const status = meta.status || 'waiting';
    const idx = meta.current != null ? meta.current : -1;
    const act = vals(content.activities)[idx];
    if (status === 'ended') return vFinal(content);
    if (status === 'waiting' || !act) return vWelcome(content, status);
    const st = (D.state || {})[idx] || {};
    const ans = (D.answers || {})[idx] || {};
    ({ poll: vPoll, quiz: vQuiz, wordcloud: vCloud, bingo: vBingo, lottery: vLottery, rank: vRank })[act.type](idx, act, st, ans, content);
  }
  function tick() {
    if (!D) return;
    document.querySelectorAll('[data-deadline]').forEach(el => { el.textContent = Math.max(0, Math.ceil((+el.dataset.deadline - B.now()) / 1000)); });
    const roll = document.getElementById('roll');
    if (roll) { const names = Object.values(players()).map(p => p.name); if (names.length) roll.textContent = names[Math.floor(Math.random() * names.length)]; }
    render();
  }

  function vWelcome(content, status) {
    const n = Object.keys(players()).length;
    view(JSON.stringify(['w', status, content.title, n, onlineN()]), `<div class="s-title">${esc(content.title || '연말 행사')}</div>
      <div class="s-sub">${status === 'waiting' ? '곧 시작합니다! 휴대폰으로 접속해 주세요' : `${n}명 참가 중 · 잠시 후 다음 순서가 시작됩니다`}</div>
      <div class="s-qr"><img alt="QR" src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=0&data=${encodeURIComponent(joinUrl)}" onerror="this.style.display='none'">
      <div><div class="s-sub" style="text-align:left">📱 접속 주소</div><div class="s-url">${esc(joinUrl)}</div></div></div>`);
  }

  function bars(opts, counts, opt = {}) {
    const total = counts.reduce((a, b) => a + b, 0) || 1; const max = Math.max(1, ...counts);
    return `<div class="s-bars">${opts.map((o, i) => `<div class="s-bar ${opt.correct === i ? 'correct' : ''} ${opt.correct != null && opt.correct !== i ? 'dim' : ''}">
      <div class="lab">${opt.correct === i ? '✅ ' : ''}${esc(o)}</div><div class="trk"><div class="fill" style="width:${100 * counts[i] / max}%;background:${COLORS[i % COLORS.length]}"></div></div>
      <div class="val">${counts[i]}${opt.pct ? ` <span class="muted small">(${Math.round(100 * counts[i] / total)}%)</span>` : ''}</div></div>`).join('')}</div>`;
  }
  const countVotes = (opts, ans) => { const c = opts.map(() => 0); vals(ans).forEach(a => { if (a.v != null && c[a.v] != null) c[a.v]++; }); return c; };

  function vPoll(idx, act, st, ans) {
    const opts = vals(act.options); const c = countVotes(opts, ans); const n = c.reduce((a, b) => a + b, 0);
    const ph = st.phase || 'ready';
    view(JSON.stringify(['poll', idx, ph, c]), `<div class="s-title">${esc(act.title)}</div>
      ${ph === 'ready' ? '<div class="s-sub pulse">곧 투표가 시작됩니다</div>' : bars(opts, c, { pct: true }) + `<div class="s-sub" style="margin-top:3vh">${ph === 'open' ? '🗳️ 투표 중' : '투표 마감'} · ${n}명 참여</div>`}`);
  }

  function vQuiz(idx, act, st, ans) {
    const opts = vals(act.options); const ph = st.phase || 'ready';
    const deadline = (st.openedAt || 0) + act.duration * 1000; const timeUp = ph === 'open' && B.now() > deadline;
    const n = vals(ans).length;
    const head = `<div class="s-sub">${act.ox ? 'OX 퀴즈' : '퀴즈'}</div><div class="s-title">${esc(act.title)}</div>`;
    if (ph === 'ready') return view(JSON.stringify(['q', idx, ph]), `<div class="s-sub">${act.ox ? 'OX 퀴즈' : '퀴즈'}</div><div class="s-title pulse">문제가 곧 나옵니다!</div>`);
    if (ph === 'reveal') {
      const c = countVotes(opts, ans); const top = Core.ranking(players(), D.points).slice(0, 5);
      return view(JSON.stringify(['q', idx, ph, c, top]), `${head}<div class="s-grid2"><div>${bars(opts, c, { correct: act.answer })}</div>
        <div><div class="s-sub" style="text-align:left;margin-bottom:1vh">🏆 누적 TOP 5</div><ol class="s-lb">${top.map((r, i) => `<li><span class="r">${i + 1}</span><span class="n">${esc(r.name)} <span class="muted small">${esc(r.team)}</span></span><span class="s">${r.score.toLocaleString()}</span></li>`).join('')}</ol></div></div>`);
    }
    const running = ph === 'open' && !timeUp;
    view(JSON.stringify(['q', idx, ph, running, n]), `${head}
      ${act.ox ? `<div class="s-opts"><div class="s-opt" style="justify-content:center;font-size:18vh;color:var(--red)">O</div><div class="s-opt" style="justify-content:center;font-size:18vh;color:var(--blue)">X</div></div>`
        : `<div class="s-opts">${opts.map((o, i) => `<div class="s-opt"><span class="k" style="background:${COLORS[i]}">${OPT_KEYS[i]}</span>${esc(o)}</div>`).join('')}</div>`}
      <div style="display:flex;justify-content:center;align-items:center;gap:5vw;margin-top:3vh">
        ${running ? `<div class="s-countdown" data-deadline="${deadline}">${act.duration}</div>` : '<div class="s-countdown" style="font-size:8vh">⏱️ 시간 종료</div>'}
        <div class="s-sub">응답 <b style="color:var(--text);font-size:6vh">${n}</b> / ${onlineN()}</div></div>`);
  }

  function vCloud(idx, act, st, ans) {
    const freq = {};
    vals(ans).forEach(a => vals(a.w).forEach(w => { const k = String(w).trim(); if (k) freq[k] = (freq[k] || 0) + 1; }));
    const items = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 60);
    const max = items.length ? items[0][1] : 1;
    const shown = items.slice().sort((a, b) => Core.hash(a[0]) - Core.hash(b[0]));
    const ph = st.phase || 'ready';
    view(JSON.stringify(['wc', idx, ph, items]), `<div class="s-title" style="margin-bottom:3vh">${esc(act.title)}</div>
      ${ph === 'ready' ? '<div class="s-sub pulse">곧 입력이 열립니다</div>' : `<div class="s-cloud">${shown.map(([w, c]) => `<span style="font-size:${(2.6 + 9 * Math.sqrt(c / max)).toFixed(1)}vh;color:${COLORS[Core.hash(w) % COLORS.length]}">${esc(w)}</span>`).join('') || '<span class="s-sub pulse">단어를 기다리는 중...</span>'}</div>
      <div class="s-sub" style="margin-top:3vh">${vals(ans).length}명 참여${ph === 'closed' ? ' · 마감' : ''}</div>`}`);
  }

  function vBingo(idx, act, st) {
    const called = vals(st.called); const last = called[called.length - 1];
    const fresh = st.drawAt && B.now() - st.drawAt < 2500;
    const winners = Core.bingoWinners(D, idx, act);
    const ph = st.phase || 'ready';
    view(JSON.stringify(['b', idx, ph, called.length, fresh, winners.map(w => w.pid)]), `<div class="s-sub">${esc(act.title)} · ${act.size}×${act.size} · ${act.lines}줄 완성 목표</div>
      <div class="s-grid2"><div><div class="s-sub">${ph === 'ready' ? '빙고판을 확인하세요!' : `${called.length}번째 단어`}</div>
        <div class="s-big ${fresh ? 'pulse' : ''}">${last ? esc(last) : '🎱'}</div>
        <div class="chips" style="justify-content:center;margin-top:3vh;font-size:2.2vh">${called.slice(0, -1).reverse().slice(0, 30).map(w => `<span class="chip">${esc(w)}</span>`).join('')}</div></div>
      <div><div class="s-sub" style="text-align:left;margin-bottom:1vh">🏁 빙고 완성 순서</div><ol class="s-lb">${winners.slice(0, 10).map((w, i) => `<li><span class="r">${i + 1}</span><span class="n">${esc(w.name)} <span class="muted small">${esc(w.team)}</span></span></li>`).join('') || '<li class="muted">아직 없음</li>'}</ol>
      ${winners.length > 10 ? `<div class="s-sub">외 ${winners.length - 10}명</div>` : ''}</div></div>`);
  }
  function vLottery(idx, act, st) {
    const ph = st.phase || 'ready';
    const revealed = ph === 'spin' && B.now() > (st.at || 0) + 4500;
    const w = vals(st.winners);
    if (ph !== 'spin') return view(JSON.stringify(['l', idx, ph]), `<div class="s-title">${esc(act.title)}</div><div class="s-big" style="font-size:16vh">🎁</div><div class="s-sub">행운의 주인공 ${act.count}명은 누구일까요?</div>`);
    if (!revealed) return view(JSON.stringify(['l', idx, 'spin', st.at]), `<div class="s-title">${esc(act.title)}</div><div class="s-roll" id="roll">...</div><div class="s-sub pulse">추첨 중</div>`);
    view(JSON.stringify(['l', idx, 'rev', st.at, w]), `<div class="s-title">🎉 ${esc(act.title)} 당첨자 🎉</div>
      <div class="s-winner" style="font-size:${w.length > 4 ? 7 : w.length > 2 ? 9 : 12}vh">${w.map(p => `<div>${esc(nameOf(p))} <span class="muted" style="font-size:.4em">${esc((players()[p] || {}).team || '')}</span></div>`).join('')}</div>`);
  }

  function vRank(idx, act, st, ans, content) {
    const top = Core.ranking(players(), D.points).slice(0, 10);
    const teams = Core.teamRanking(players(), D.points, vals(content.teams));
    view(JSON.stringify(['r', idx, top, teams]), `<div class="s-title" style="margin-bottom:2vh">🏆 ${esc(act.title)}</div>
      <div class="s-grid2"><ol class="s-lb">${top.map((r, i) => `<li><span class="r">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="n">${esc(r.name)} <span class="muted small">${esc(r.team)}</span></span><span class="s">${r.score.toLocaleString()}</span></li>`).join('')}</ol>
      ${teams.length ? `<div><div class="s-sub" style="text-align:left;margin-bottom:2vh">팀 순위 (팀원 평균 점수)</div>${bars(teams.map(t => `${t.team} (${t.n}명)`), teams.map(t => t.avg))}</div>` : '<div></div>'}</div>`);
  }

  function vFinal(content) {
    const top = Core.ranking(players(), D.points).slice(0, 5);
    view(JSON.stringify(['f', top]), `<div class="s-title">🎉 함께해 주셔서 감사합니다 🎉</div><div class="s-sub">${esc(content.title || '')}</div>
      ${top.length && top[0].score ? `<ol class="s-lb" style="width:min(900px,90%);margin:4vh auto 0">${top.map((r, i) => `<li><span class="r">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="n">${esc(r.name)} <span class="muted small">${esc(r.team)}</span></span><span class="s">${r.score.toLocaleString()}</span></li>`).join('')}</ol>` : ''}`);
  }
})();
