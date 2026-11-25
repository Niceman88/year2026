// 참가자 화면
(function () {
  const { B, ROOT, TS, esc, vals, DEMO } = Core;
  const app = document.getElementById('app');
  app.innerHTML = '<div class="p-wrap"><div class="p-hdr" id="hdr"></div><div id="main"><div class="spinner"></div></div></div>';
  if (DEMO) document.body.insertAdjacentHTML('beforeend', '<div class="demo-banner">데모 모드 — 이 브라우저 안의 탭끼리만 연결됩니다</div>');
  const hdr = document.getElementById('hdr'), main = document.getElementById('main');
  const PIDK = ROOT + ':pid';
  // 데모 모드에서는 탭마다 다른 참가자가 되도록 sessionStorage 사용
  const store = DEMO ? sessionStorage : localStorage;
  let pid = store.getItem(PIDK);
  const S = { meta: null, content: null, state: {}, me: null, points: {}, myAns: null, ready: {} };
  const OPT_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];
  let lastKey = '', ansUnsub = null, ansIdx = null, meUnsub = null;
  const lastBingoLines = {};

  B.on('meta', v => { S.meta = v || {}; S.ready.meta = 1; subAnswer(); render(); });
  B.on('content', v => { S.content = v; S.ready.content = 1; render(); });
  B.on('state', v => { S.state = v || {}; render(); });
  B.on('points', v => { S.points = v || {}; render(); });
  watchMe();
  setInterval(tick, 200);

  function watchMe() {
    if (meUnsub) meUnsub();
    if (!pid) return;
    meUnsub = B.on('players/' + pid, v => { S.me = v; S.ready.me = 1; render(); });
    B.presence('online/' + pid, true);
  }
  function subAnswer() {
    const idx = cur();
    if (idx === ansIdx) return;
    if (ansUnsub) ansUnsub();
    ansIdx = idx; S.myAns = null; S.ready.ans = 0;
    if (pid && idx >= 0) ansUnsub = B.on(`answers/${idx}/${pid}`, v => { S.myAns = v; S.ready.ans = 1; render(); });
  }
  const cur = () => (S.meta && S.meta.current != null ? S.meta.current : -1);
  const acts = () => vals(S.content && S.content.activities);
  const myTotal = () => Core.totals(S.points)[pid] || 0;

  function view(key, html, after) {
    if (key === lastKey) return;
    lastKey = key; main.innerHTML = html; if (after) after();
  }

  function render() {
    if (!S.ready.meta || !S.ready.content) return;
    const title = (S.content && S.content.title) || '연말 행사';
    document.title = title;
    const status = S.meta.status || 'waiting';
    const joined = pid && S.me;
    hdr.innerHTML = joined ? `<span><b>${esc(S.me.name)}</b>${S.me.team ? ' · ' + esc(S.me.team) : ''}</span><span class="score">${myTotal().toLocaleString()}점</span>` : `<span>${esc(title)}</span><span></span>`;

    if (status === 'waiting' || !S.content) return view('wait', `<div class="card hero"><div class="emoji">🎄</div><h1>${esc(title)}</h1><p class="muted">행사가 곧 시작됩니다.<br>진행자가 시작하면 이 화면이 자동으로 바뀌어요.<br>창을 닫지 말고 기다려 주세요!</p><div class="pulse muted small" style="margin-top:20px">● 대기 중</div></div>`);
    if (status === 'ended') return view('end' + myTotal(), `<div class="card hero"><div class="emoji">🎉</div><h1>함께해 주셔서 감사합니다!</h1>${joined ? `<p class="muted">나의 최종 점수</p><div class="big-num">${myTotal().toLocaleString()}점</div>` : ''}</div>`);
    if (pid && !S.ready.me) return;
    if (!joined) return view('join', joinHTML(), bindJoin);

    const idx = cur(); const act = acts()[idx];
    if (!act) return view('idle', `<div class="card hero"><div class="emoji">⏳</div><h1>잠시만 기다려 주세요</h1><p class="muted">곧 다음 순서가 시작됩니다.</p></div>`);
    if (pid && S.ready.ans === 0 && !['rank', 'lottery', 'bingo', 'race'].includes(act.type)) return;
    const st = S.state[idx] || {};
    const fn = { poll: vPoll, quiz: vQuiz, wordcloud: vCloud, bingo: vBingo, lottery: vLottery, rank: vRank, race: vRace }[act.type];
    if (fn) fn(idx, act, st);
  }
  function tick() {
    // 시간 표시 갱신 + 시간이 바뀌면 화면이 달라지는 경우(퀴즈 종료, 추첨 공개) 재렌더
    document.querySelectorAll('[data-deadline]').forEach(el => {
      const left = Math.max(0, +el.dataset.deadline - B.now()); const tot = +el.dataset.total;
      if (el.tagName === 'I') el.style.width = (100 * left / tot) + '%'; else el.textContent = Math.ceil(left / 1000) + '초';
    });
    render();
  }

  // ---------- 입장 ----------
  function joinHTML() {
    const teams = vals(S.content.teams);
    return `<div class="card"><div class="tag">참가 등록</div><div class="q-title">${esc(S.content.title || '연말 행사')}에 오신 걸 환영해요!</div>
      <label class="muted small">이름</label><input id="jName" maxlength="20" placeholder="예) 홍길동" autocomplete="off" style="margin:6px 0 14px">
      ${teams.length ? `<label class="muted small">소속 팀</label><select id="jTeam" style="margin:6px 0 14px"><option value="">팀을 선택하세요</option>${teams.map(t => `<option>${esc(t)}</option>`).join('')}</select>` : ''}
      <button class="primary" id="jGo" style="width:100%">입장하기</button><div class="err" id="jErr"></div>
      <p class="muted small">같은 이름·팀으로 다시 입장하면 이전 점수가 이어집니다.</p></div>`;
  }
  function bindJoin() {
    const go = document.getElementById('jGo');
    const submit = async () => {
      const name = document.getElementById('jName').value.trim().slice(0, 20);
      const tEl = document.getElementById('jTeam'); const team = tEl ? tEl.value : '';
      const err = document.getElementById('jErr');
      if (!name) { err.textContent = '이름을 입력해 주세요'; return; }
      if (tEl && !team) { err.textContent = '팀을 선택해 주세요'; return; }
      go.disabled = true;
      try {
        const [players, online] = await Promise.all([B.get('players'), B.get('online')]);
        let id = null;
        for (const [k, p] of Object.entries(players || {})) if (p.name === name && (p.team || '') === team) { id = k; break; }
        if (id && online && online[id] && id !== pid) { err.textContent = '같은 이름·팀이 이미 접속해 있어요. 이름 뒤에 구분자를 붙여 주세요 (예: 홍길동B)'; go.disabled = false; return; }
        if (!id) { id = pid || Core.newId(); await B.set('players/' + id, { name, team, joinedAt: TS }); }
        pid = id; store.setItem(PIDK, pid); S.ready.me = 0; lastKey = ''; ansIdx = null;
        watchMe(); subAnswer();
      } catch (e) { err.textContent = '접속 오류: ' + e.message; go.disabled = false; }
    };
    go.onclick = submit;
    document.getElementById('jName').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  }

  // ---------- 투표 ----------
  function vPoll(idx, act, st) {
    const ph = st.phase || 'ready'; const my = S.myAns ? S.myAns.v : null;
    const opts = vals(act.options);
    const key = JSON.stringify(['poll', idx, ph, my]);
    if (ph === 'ready') return view(key, waitCard('투표', act.title, '곧 투표가 시작됩니다'));
    const open = ph === 'open';
    view(key, `<div class="card"><div class="tag">투표 ${open ? '진행 중' : '마감'}</div><div class="q-title">${esc(act.title)}</div>
      <div class="opts">${opts.map((o, i) => `<button class="opt ${my === i ? 'sel' : ''}" data-i="${i}" ${open ? '' : 'disabled'}><span class="k" style="background:var(--o${i % 6})">${OPT_KEYS[i]}</span>${esc(o)}</button>`).join('')}</div>
      <p class="muted small center" style="margin-top:14px">${open ? (my != null ? '투표 완료! 마감 전까지 바꿀 수 있어요.' : '하나를 골라 주세요') : '투표가 마감되었습니다. 결과는 큰 화면에서!'}</p></div>`,
      () => main.querySelectorAll('.opt').forEach(b => b.onclick = () => B.set(`answers/${idx}/${pid}`, { v: +b.dataset.i, at: TS })));
  }

  // ---------- 퀴즈 ----------
  function vQuiz(idx, act, st) {
    const ph = st.phase || 'ready'; const my = S.myAns ? S.myAns.v : null;
    const opts = vals(act.options);
    const deadline = (st.openedAt || 0) + act.duration * 1000;
    const timeUp = ph === 'open' && B.now() > deadline;
    const key = JSON.stringify(['quiz', idx, ph, my, timeUp, myTotal()]);
    if (ph === 'ready') return view(key, waitCard(act.ox ? 'OX 퀴즈' : '퀴즈', '', '문제가 곧 나옵니다. 준비하세요!'));
    if (ph === 'reveal') {
      const pts = (S.points[idx] || {})[pid] || 0; const ok = my === act.answer;
      return view(key, `<div class="card hero"><div class="emoji">${my == null ? '⏱️' : ok ? '🎉' : '😢'}</div>
        <h1 class="${ok ? 'result-good' : 'result-bad'}">${my == null ? '응답하지 못했어요' : ok ? '정답입니다!' : '아쉽게 틀렸어요'}</h1>
        <p class="muted">정답: <b style="color:var(--text)">${esc(opts[act.answer])}</b></p>
        ${ok ? `<div class="big-num">+${pts}점</div>` : ''}<p class="muted small">누적 ${myTotal().toLocaleString()}점</p></div>`);
    }
    const locked = my != null || ph !== 'open' || timeUp;
    view(key, `<div class="card"><div class="tag">${act.ox ? 'OX 퀴즈' : '퀴즈'} · ${act.duration}초</div>
      ${ph === 'open' && !timeUp ? `<div class="timer"><i data-deadline="${deadline}" data-total="${act.duration * 1000}" style="width:100%"></i></div>` : ''}
      <div class="q-title">${esc(act.title)}</div>
      <div class="opts ${act.ox ? 'ox' : ''}">${opts.map((o, i) => `<button class="opt ${my === i ? 'sel' : ''}" data-i="${i}" ${locked ? 'disabled' : ''} ${act.ox ? `style="color:${i ? 'var(--blue)' : 'var(--red)'}"` : ''}><span class="k" style="background:var(--o${i % 6})">${OPT_KEYS[i]}</span>${esc(o)}</button>`).join('')}</div>
      <p class="muted small center" style="margin-top:14px">${my != null ? '제출 완료! 정답 공개를 기다려 주세요.' : (ph !== 'open' || timeUp) ? '⏱️ 시간 종료' : '빨리 맞힐수록 점수가 높아요 (한 번만 선택 가능)'}</p></div>`,
      () => main.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        if (B.now() > deadline || S.myAns) return;
        main.querySelectorAll('.opt').forEach(x => x.disabled = true); b.classList.add('sel');
        B.set(`answers/${idx}/${pid}`, { v: +b.dataset.i, at: TS });
      }));
  }

  // ---------- 워드클라우드 ----------
  function vCloud(idx, act, st) {
    const ph = st.phase || 'ready'; const mine = vals(S.myAns && S.myAns.w); const MAX = 3;
    const key = JSON.stringify(['wc', idx, ph, mine]);
    if (ph === 'ready') return view(key, waitCard('워드클라우드', act.title, '곧 입력이 열립니다'));
    const open = ph === 'open' && mine.length < MAX;
    view(key, `<div class="card"><div class="tag">워드클라우드 ${ph === 'open' ? '' : '· 마감'}</div><div class="q-title">${esc(act.title)}</div>
      ${open ? `<div class="row"><input id="wIn" maxlength="15" placeholder="짧은 단어로 입력" autocomplete="off"><button class="primary" id="wGo" style="flex:none">보내기</button></div>
      <p class="muted small">최대 ${MAX}개까지 보낼 수 있어요 (${mine.length}/${MAX})</p>` : `<p class="muted">${ph === 'open' ? '모두 보냈어요! 큰 화면을 확인하세요 👀' : '입력이 마감되었습니다.'}</p>`}
      ${mine.length ? `<div class="chips" style="margin-top:10px">${mine.map(w => `<span class="chip">${esc(w)}</span>`).join('')}</div>` : ''}</div>`,
      () => {
        const inp = document.getElementById('wIn'); if (!inp) return;
        const send = () => {
          const w = inp.value.trim().replace(/\s+/g, ' ').slice(0, 15); if (!w) return;
          B.set(`answers/${idx}/${pid}`, { w: [...mine, w].slice(0, MAX), at: TS }); inp.value = '';
        };
        document.getElementById('wGo').onclick = send;
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
      });
  }

  // ---------- 빙고 ----------
  function vBingo(idx, act, st) {
    const ph = st.phase || 'ready';
    const called = vals(st.called); const calledSet = new Set(called); const last = called[called.length - 1];
    const board = Core.bingoBoard(pid, idx, act);
    const lines = Core.bingoLines(board, act.size, calledSet);
    const done = lines >= act.lines;
    if (ph !== 'ready') reportBingo(idx, lines);
    const key = JSON.stringify(['bingo', idx, ph, called.length, lines]);
    view(key, `<div class="card"><div class="tag">빙고 · ${act.lines}줄 완성 목표</div><div class="q-title">${esc(act.title)}</div>
      ${done ? `<div class="win-banner">🎉 빙고 ${lines}줄 완성! 기록이 접수되었어요</div>` : ''}
      ${ph === 'ready' ? '<p class="muted">빙고판을 미리 확인하세요! 진행자가 단어를 뽑으면 자동으로 칠해집니다.</p>' : `<p>방금 뽑힌 단어: <b style="color:var(--gold);font-size:20px">${last ? esc(last) : '—'}</b> <span class="muted small">(${called.length}개 진행)</span></p>`}
      <div class="board" style="grid-template-columns:repeat(${act.size},1fr)">${board.map(w => `<div class="cell ${calledSet.has(w) ? 'on' : ''} ${w === last ? 'last' : ''}">${esc(w)}</div>`).join('')}</div>
      <p class="center"><b>${lines}</b> / ${act.lines}줄</p></div>`);
  }
  async function reportBingo(idx, lines) {
    const k = idx + ':' + pid;
    if (lines <= (lastBingoLines[k] || 0)) return;
    lastBingoLines[k] = lines;
    const prev = await B.get(`bingo/${idx}/${pid}`);
    if (!prev || (prev.lines || 0) < lines) await B.set(`bingo/${idx}/${pid}`, { lines, at: TS });
  }

  // ---------- 추첨 ----------
  function vLottery(idx, act, st) {
    const ph = st.phase || 'ready';
    const revealed = ph === 'spin' && B.now() > (st.at || 0) + 4500;
    const win = vals(st.winners).includes(pid);
    const key = JSON.stringify(['lot', idx, ph, st.at, revealed, win]);
    if (ph !== 'spin') return view(key, waitCard('추첨', act.title, '행운의 주인공은 누구일까요? 🍀'));
    if (!revealed) return view(key, `<div class="card hero"><div class="emoji pulse">🎰</div><h1>추첨 중...</h1><p class="muted">두근두근! 큰 화면을 봐 주세요</p></div>`);
    view(key, win ? `<div class="card hero"><div class="emoji">🎁</div><h1 class="result-good">축하합니다! 당첨되셨어요!</h1><p class="muted">${esc(act.title)}<br>진행자 안내에 따라 수령해 주세요.</p></div>`
      : `<div class="card hero"><div class="emoji">🍀</div><h1>아쉽지만 다음 기회에!</h1><p class="muted">${esc(act.title)}</p></div>`);
  }


  // ---------- 팀 대항 탭 레이스 ----------
  const race = { idx: null, count: 0, sent: 0, timer: null };
  function vRace(idx, act, st) {
    const ph = st.phase || 'ready';
    const teams = vals(S.content.teams); const myTeam = S.me.team || '';
    const color = Core.teamColor(teams, myTeam);
    if (race.idx !== idx || (ph === 'ready')) { if (race.idx !== idx || race.count) { race.idx = idx; race.count = 0; race.sent = 0; } }
    const w = Core.raceWindow(act, st); const now = B.now();
    const stage = ph === 'open' ? (now < w.start ? 'count' : now < w.end ? 'go' : 'end') : ph;
    const key = JSON.stringify(['race', idx, stage, stage === 'count' ? Math.ceil((w.start - now) / 1000) : 0, ph === 'reveal' ? (S.points[idx] || {})[pid] || 0 : 0]);
    const head = `<div class="tag">탭 레이스 · ${act.duration}초</div><div class="q-title">${esc(act.title)}</div>`;
    if (stage === 'ready') return view(key, `<div class="card hero">${head}<div class="emoji">${Core.teamEmoji(teams, myTeam)}</div>
      <p>${myTeam ? `<b style="color:${color}">${esc(myTeam)}</b>의 대표 선수!` : '개인전!'}</p>
      <p class="muted">시작되면 나타나는 버튼을 <b>최대한 빠르게</b> 연타하세요.<br>${teams.length ? '팀원 1인당 평균 탭 수로 승부합니다.' : ''}</p></div>`);
    if (stage === 'count') return view(key, `<div class="card hero">${head}<div class="race-count">${Math.ceil((w.start - now) / 1000)}</div><p class="muted">준비...</p></div>`);
    if (stage === 'go') {
      if (!race.timer) race.timer = setInterval(() => flushRace(idx), 500);
      return view(key, `<div class="card center" style="padding:16px">${head}
        <div class="timer"><i data-deadline="${w.end}" data-total="${act.duration * 1000}" style="width:100%"></i></div>
        <button class="tap-btn" id="tapBtn" style="--c:${color}"><span id="tapN">${race.count}</span><small>TAP!</small></button></div>`, () => {
        const btn = document.getElementById('tapBtn'); const n = document.getElementById('tapN');
        let lastTs = 0;
        btn.addEventListener('pointerdown', e => {
          e.preventDefault();
          if (B.now() > w.end) return;
          if (e.timeStamp - lastTs < 40) return; // 초당 25회 이상은 무시 (오토클릭 방지)
          lastTs = e.timeStamp; race.count++; n.textContent = race.count;
          btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit');
          if (navigator.vibrate) navigator.vibrate(8);
        });
        btn.addEventListener('contextmenu', e => e.preventDefault());
      });
    }
    flushRace(idx); if (race.timer) { clearInterval(race.timer); race.timer = null; }
    if (stage === 'reveal') { const p = (S.points[idx] || {})[pid] || 0;
      return view(key, `<div class="card hero">${head}<div class="emoji">${p ? '🏆' : '👏'}</div><h1>${p ? `팀 보너스 +${p}점!` : '수고하셨습니다!'}</h1><p class="muted">나의 기록 <b style="color:var(--text)">${race.count || '-'}회</b> · 결과는 큰 화면에서!</p></div>`); }
    view(key, `<div class="card hero">${head}<div class="emoji">⏱️</div><h1>종료!</h1><p class="muted">나의 기록 <b style="color:var(--text)">${race.count}회</b><br>결과 발표를 기다려 주세요</p></div>`);
  }
  function flushRace(idx) {
    if (race.idx !== idx || race.count === race.sent) return;
    race.sent = race.count; B.set(`taps/${idx}/${pid}`, race.count);
  }

  // ---------- 순위 ----------
  function vRank(idx, act) {
    const t = Core.totals(S.points);
    const all = Object.entries(t).sort((a, b) => b[1] - a[1]);
    const myScore = t[pid] || 0;
    const rank = myScore ? 1 + all.filter(([, s]) => s > myScore).length : null;
    const key = JSON.stringify(['rank', idx, myScore, rank]);
    view(key, `<div class="card hero"><div class="tag">${esc(act.title)}</div><div class="emoji">🏆</div>
      <p class="muted">나의 점수</p><div class="big-num">${myScore.toLocaleString()}점</div>
      <p>${rank ? `현재 <b style="color:var(--gold)">${rank}위</b>` : '아직 점수가 없어요'}</p><p class="muted small">전체 순위는 큰 화면에서 확인하세요</p></div>`);
  }

  function waitCard(tag, title, msg) {
    return `<div class="card hero"><div class="tag">${esc(tag)}</div>${title ? `<div class="q-title">${esc(title)}</div>` : '<div class="emoji">⏳</div>'}<p class="muted pulse">${esc(msg)}</p></div>`;
  }
})();
