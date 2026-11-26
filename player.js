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
  const myTotal = () => Core.sectionScore(S.content, S.points, pid, cur());

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
    if (pid && S.ready.ans === 0 && !['rank', 'lottery', 'bingo', 'race', 'section'].includes(act.type)) return;
    const st = S.state[idx] || {};
    const fn = { section: vSection, poll: vPoll, quiz: vQuiz, wordcloud: vCloud, bingo: vBingo, lottery: vLottery, rank: vRank, race: vRace, teamquiz: vTeamQuiz, mind: vMind, chosung: vChosung, timing: vTiming, reaction: vReaction }[act.type];
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

  // ---------- 세션 소개 ----------
  function vSection(idx, act) {
    const info = Core.sectionInfo(S.content, idx);
    view('sec' + idx, `<div class="card hero" style="padding:28px 20px"><div class="tag">SESSION ${info.no}${info.total ? ' / ' + info.total : ''}</div>
      <h1 style="font-size:28px;color:var(--gold)">${esc(act.title)}</h1>${act.sub ? `<div class="q-title" style="font-size:18px;margin:4px 0 10px">${esc(act.sub)}</div>` : ''}
      ${vals(act.desc).map(d => `<p class="muted" style="margin:4px 0">${esc(d)}</p>`).join('')}</div>
      ${info.rules.length ? `<div class="card"><div class="tag">이렇게 진행해요</div><ul style="margin:0;padding-left:18px;line-height:1.7;font-size:14px">${info.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>` : ''}
      ${info.prizes.length ? `<div class="card"><div class="tag">🎁 이번 세션 상품</div><ul class="lb">${info.prizes.map(p => `<li><span class="n">${esc(p.label)}</span><span class="s" style="color:var(--gold)">${esc(p.prize.name)}</span></li>`).join('')}</ul></div>` : ''}`);
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
    const myRank = vals(st.bwin).indexOf(pid) + 1; const prize = myRank ? Core.prizeFor(act, myRank) : null;
    const key = JSON.stringify(['bingo', idx, ph, called.length, lines, myRank]);
    view(key, `${prize ? congrats(`빙고 ${myRank}등!`, prize) : ''}<div class="card"><div class="tag">빙고 · ${act.lines}줄 완성 목표</div><div class="q-title">${esc(act.title)}</div>
      ${done ? `<div class="win-banner">🎉 빙고 ${lines}줄 완성!${myRank ? ` ${myRank}등으로 기록되었어요` : ' 기록이 접수되었어요'}</div>` : ''}
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
    const k = vals(st.winners).indexOf(pid) + 1;
    view(key, win ? congrats(esc(act.title) + ' 당첨!', Core.prizeFor(act, k) || { name: act.title })
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
    const key = JSON.stringify(['race', idx, stage, stage === 'count' ? Math.ceil((w.start - now) / 1000) : 0, st.result ? 1 : 0]);
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
    if (stage === 'reveal') return view(key, teamResult(act, st, `나의 기록 <b style="color:var(--text)">${race.count || '-'}회</b>`));
    view(key, `<div class="card hero">${head}<div class="emoji">⏱️</div><h1>종료!</h1><p class="muted">나의 기록 <b style="color:var(--text)">${race.count}회</b><br>결과 발표를 기다려 주세요</p></div>`);
  }
  function flushRace(idx) {
    if (race.idx !== idx || race.count === race.sent) return;
    race.sent = race.count; B.set(`taps/${idx}/${pid}`, race.count);
  }

  // ---------- 순위 (개인 / 팀) ----------
  function vRank(idx, act, st) {
    const snap = st.snap;
    if (!snap) return view('rank-wait' + idx, waitCard(Core.typeName(act), act.title, '결과를 집계하고 있어요...'));
    if (act.scope === 'team') {
      const rows = vals(snap.team); const me = rows.find(r => r.team === S.me.team);
      const prize = me ? Core.prizeFor(act, me.rank) : null;
      return view(JSON.stringify(['trank', idx, snap.at]), (prize ? congrats(`우리 팀 ${me.rank}등!`, prize, `${esc(S.me.team)} 팀원 모두 축하합니다!`) : '') +
        `<div class="card"><div class="tag">${esc(act.title)}</div><ol class="lb">${rows.map(r => `<li class="${r.team === S.me.team ? 'me' : ''}"><span class="r">${r.rank}</span><span class="n">${Core.teamEmoji(S.content.teams, r.team)} ${esc(r.team)}</span><span class="s">${r.pts}점</span></li>`).join('')}</ol></div>`);
    }
    const rows = vals(snap.indiv); const me = rows.find(r => r.pid === pid);
    const prize = me ? Core.prizeFor(act, me.rank) : null;
    const all = { score: myTotal() };
    view(JSON.stringify(['rank', idx, snap.at]), prize ? congrats(`${me.rank}등!`, prize, `${me.score.toLocaleString()}점`)
      : `<div class="card hero"><div class="tag">${esc(act.title)}</div><div class="emoji">🏆</div>
      <p class="muted">나의 점수</p><div class="big-num">${(me ? me.score : all.score).toLocaleString()}점</div>
      <p>${me ? `<b style="color:var(--gold)">${me.rank}위</b>` : '아쉽지만 순위권 밖이에요'}</p><p class="muted small">전체 순위는 큰 화면에서 확인하세요</p></div>`);
  }
  function congrats(title, prize, sub) {
    return `<div class="card congrats"><div class="burst">🎉</div><h1 class="result-good">축하합니다! ${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}
      ${Prize.card(prize, 'lg')}<p class="muted small">진행자 안내에 따라 수령해 주세요</p></div>`;
  }
  // 팀 게임 결과 (진행자가 결과 발표 시 저장한 st.result 사용)
  function teamResult(act, st, mine) {
    const rows = vals(st.result); const me = rows.find(r => r.team === S.me.team);
    return `<div class="card hero"><div class="tag">${esc(Core.typeName(act))} 결과</div>
      <div class="emoji">${me ? ['🥇', '🥈', '🥉'][me.rank - 1] || '👏' : '👏'}</div>
      <h1>${me ? `우리 팀 ${me.rank}위!` : '수고하셨습니다!'}</h1>${me && me.pts ? `<div class="big-num">+${me.pts}점</div><p class="muted small">팀전 점수</p>` : ''}
      ${mine ? `<p class="muted">${mine}</p>` : ''}
      <ol class="lb" style="text-align:left;margin-top:12px">${rows.map(r => `<li class="${r.team === S.me.team ? 'me' : ''}"><span class="r">${r.rank}</span><span class="n">${esc(r.team)}</span><span class="s">${esc(r.label)}</span></li>`).join('')}</ol></div>`;
  }

  // ---------- 팀 퀴즈 / 이심전심 (보기 선택형 팀 게임) ----------
  function choiceGame(idx, act, st, kind) {
    const ph = st.phase || 'ready'; const my = S.myAns ? S.myAns.v : null; const opts = vals(act.options);
    const w = Core.gameWindow(act, st); const timeUp = ph === 'open' && B.now() > w.end;
    const name = Core.typeName(act); const team = S.me.team;
    const key = JSON.stringify([kind, idx, ph, my, timeUp, st.result ? 1 : 0]);
    const rule = kind === 'mind' ? '정답은 없어요! <b>팀원들과 같은 답</b>을 골라야 해요. 팀원끼리 답이 많이 겹칠수록 이깁니다.' : '시작 때 접속한 팀원 중 <b>정답을 맞힌 비율</b>로 승부해요. 모두 답해야 유리합니다!';
    if (ph === 'ready') return view(key, `<div class="card hero"><div class="tag">팀 게임 · ${name}</div><div class="emoji">${Core.teamEmoji(S.content.teams, team)}</div><p><b style="color:${Core.teamColor(S.content.teams, team)}">${esc(team)}</b> 준비!</p><p class="muted">${rule}</p></div>`);
    if (ph === 'reveal') {
      const mine = kind === 'teamquiz' ? (my == null ? '응답하지 않았어요' : my === act.answer ? `내 답: 정답 ⭕ (${esc(opts[act.answer])})` : `내 답: 오답 ❌ · 정답은 ${esc(opts[act.answer])}`)
        : (my == null ? '응답하지 않았어요' : `내 선택: ${esc(opts[my])}`);
      return view(key, teamResult(act, st, mine));
    }
    const locked = my != null || ph !== 'open' || timeUp;
    view(key, `<div class="card"><div class="tag">팀 게임 · ${name} · ${act.duration}초</div>
      ${ph === 'open' && !timeUp ? `<div class="timer"><i data-deadline="${w.end}" data-total="${act.duration * 1000}" style="width:100%"></i></div>` : ''}
      <div class="q-title">${esc(act.title)}</div>
      <div class="opts">${opts.map((o, i) => `<button class="opt ${my === i ? 'sel' : ''}" data-i="${i}" ${locked ? 'disabled' : ''}><span class="k" style="background:var(--o${i % 6})">${OPT_KEYS[i]}</span>${esc(o)}</button>`).join('')}</div>
      <p class="muted small center" style="margin-top:14px">${my != null ? '제출 완료! 결과 발표를 기다려 주세요.' : (ph !== 'open' || timeUp) ? '⏱️ 시간 종료' : rule}</p></div>`,
      () => main.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        if (B.now() > w.end || S.myAns) return;
        main.querySelectorAll('.opt').forEach(x => x.disabled = true); b.classList.add('sel');
        B.set(`answers/${idx}/${pid}`, { v: +b.dataset.i, at: TS });
      }));
  }
  const vTeamQuiz = (idx, act, st) => choiceGame(idx, act, st, 'teamquiz');
  const vMind = (idx, act, st) => choiceGame(idx, act, st, 'mind');

  // ---------- 초성 퀴즈 ----------
  const cho = { idx: null, passed: [] };
  function vChosung(idx, act, st) {
    const ph = st.phase || 'ready'; const items = vals(act.items);
    if (cho.idx !== idx) { cho.idx = idx; cho.passed = []; }
    const solved = vals(S.myAns && S.myAns.c);
    const w = Core.gameWindow(act, st); const timeUp = ph === 'open' && B.now() > w.end;
    const left = items.map((_, i) => i).filter(i => !solved.includes(i));
    let curI = left.find(i => !cho.passed.includes(i)); if (curI == null && left.length) { cho.passed = []; curI = left[0]; }
    const key = JSON.stringify(['cho', idx, ph, timeUp, solved.length, curI, st.result ? 1 : 0]);
    if (ph === 'ready') return view(key, `<div class="card hero"><div class="tag">팀 게임 · 초성 퀴즈 · ${act.duration}초</div><div class="emoji">🔤</div><div class="q-title">${esc(act.title)}</div>
      <p class="muted">초성을 보고 단어를 입력하세요. 모르면 <b>패스</b>!<br>팀원 1인당 평균 정답 수로 승부합니다. (총 ${items.length}문제)</p></div>`);
    if (ph === 'reveal') return view(key, teamResult(act, st, `나의 정답 <b style="color:var(--text)">${solved.length}개</b> / ${items.length}개`));
    if (ph !== 'open' || timeUp || curI == null) return view(key, `<div class="card hero"><div class="emoji">${curI == null ? '🎉' : '⏱️'}</div><h1>${curI == null ? '전부 맞혔어요!' : '시간 종료!'}</h1><p class="muted">나의 정답 <b style="color:var(--text)">${solved.length}개</b> / ${items.length}개<br>결과 발표를 기다려 주세요</p></div>`);
    const it = items[curI];
    view(key, `<div class="card center"><div class="tag">초성 퀴즈 · ${solved.length}/${items.length} 정답</div>
      <div class="timer"><i data-deadline="${w.end}" data-total="${act.duration * 1000}" style="width:100%"></i></div>
      <div class="cho-q" id="choQ">${esc(it.q)}</div>
      <div class="row"><input id="choIn" placeholder="정답 입력" autocomplete="off" autocapitalize="off"><button class="primary" id="choGo" style="flex:none">확인</button></div>
      <div class="row" style="margin-top:10px"><button class="ghost" id="choPass">패스 ▶</button></div><div id="choMsg" class="small" style="margin-top:8px;min-height:20px"></div></div>`,
      () => {
        const inp = document.getElementById('choIn'); inp.focus();
        const check = () => {
          if (B.now() > w.end) return;
          if (Core.chosungOk(it, inp.value)) { B.set(`answers/${idx}/${pid}`, { c: [...solved, curI], at: TS }); }
          else { const m = document.getElementById('choMsg'); m.innerHTML = '<span class="result-bad">땡! 다시 생각해 보세요</span>'; inp.select(); document.getElementById('choQ').classList.remove('shake'); void inp.offsetWidth; document.getElementById('choQ').classList.add('shake'); }
        };
        document.getElementById('choGo').onclick = check;
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
        document.getElementById('choPass').onclick = () => { cho.passed.push(curI); lastKey = ''; render(); };
      });
  }

  // ---------- 번개 반응 (반응속도) ----------
  const rx = { idx: null, times: [], goAt: 0, t: null, state: 'idle' };
  function vReaction(idx, act, st) {
    const ph = st.phase || 'ready'; const mine = S.myAns && S.myAns.ms != null ? S.myAns : null;
    if (rx.idx !== idx) { rx.idx = idx; rx.times = []; rx.state = 'idle'; clearTimeout(rx.t); }
    const w = Core.gameWindow(act, st); const timeUp = ph === 'open' && B.now() > w.end && !rx.times.length;
    const N = act.rounds || 3;
    const key = JSON.stringify(['rx', idx, ph, !!mine, timeUp, st.result ? 1 : 0]);
    const myLine = mine ? `나의 평균 <b style="color:var(--text)">${mine.ms}ms</b>` : '도전하지 않았어요';
    if (ph === 'ready') return view(key, `<div class="card hero"><div class="tag">팀 게임 · 번개 반응</div><div class="emoji">⚡</div><div class="q-title">${esc(act.title)}</div>
      <p class="muted">화면이 <b style="color:#ff5a6e">빨간색</b>일 때 기다리다가 <b style="color:#3ddc97">초록색</b>으로 바뀌는 순간 터치!<br>${N}번 해서 평균 반응속도를 재요. 미리 누르면 그 판은 다시 합니다.<br>팀원 평균이 빠른 팀이 이깁니다.</p></div>`);
    if (ph === 'reveal') return view(key, teamResult(act, st, myLine));
    if (mine) return view(key, `<div class="card hero"><div class="emoji">⚡</div><h1 class="big-num" style="font-size:52px">${mine.ms}ms</h1><p class="muted">${vals(mine.r).map(x => x + 'ms').join(' · ')}<br>결과 발표를 기다려 주세요</p></div>`);
    if (ph !== 'open' || timeUp) return view(key, `<div class="card hero"><div class="emoji">⏱️</div><h1>도전 시간 종료</h1><p class="muted">${myLine}</p></div>`);
    view(key, `<div class="card center" style="padding:14px"><div class="tag">번개 반응 · 도전 가능 <span data-deadline="${w.end}" data-total="1"></span></div>
      <div id="rxPad" class="rx-pad"></div><p class="muted small" id="rxLog"></p></div>`, () => {
      const pad = document.getElementById('rxPad'); const log = document.getElementById('rxLog');
      const show = (cls, html) => { pad.className = 'rx-pad ' + cls; pad.innerHTML = html; log.textContent = rx.times.length ? '기록: ' + rx.times.map(x => x + 'ms').join(' · ') : ''; };
      const idle = msg => { rx.state = 'idle'; show('idle', `<b>${msg || `${rx.times.length + 1} / ${N} 라운드`}</b><small>터치해서 준비</small>`); };
      idle();
      pad.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (rx.state === 'idle') {
          if (B.now() > w.end) return;
          rx.state = 'wait'; show('wait', '<b>기다리세요...</b><small>초록색이 되면 터치!</small>');
          rx.t = setTimeout(() => { rx.state = 'go'; rx.goAt = performance.now(); show('go', '<b>지금!</b>'); }, 1500 + Math.random() * 3000);
        } else if (rx.state === 'wait') {
          clearTimeout(rx.t); rx.state = 'early'; show('early', '<b>너무 빨라요! 😅</b><small>이번 판은 다시</small>'); setTimeout(() => idle(), 1100);
        } else if (rx.state === 'go') {
          const ms = Math.round(performance.now() - rx.goAt);
          if (ms < 100) { rx.state = 'early'; show('early', '<b>너무 빨라요! 😅</b>'); setTimeout(() => idle(), 1100); return; }
          rx.times.push(Math.min(ms, 1000)); rx.state = 'done';
          if (rx.times.length >= N) {
            const avg = Math.round(rx.times.reduce((a, b) => a + b, 0) / rx.times.length);
            S.myAns = { ms: avg, r: rx.times.slice() }; B.set(`answers/${idx}/${pid}`, { ms: avg, r: rx.times.slice(), at: TS }); lastKey = ''; render();
          } else { show('done', `<b>${ms}ms</b><small>잠시 후 다음 라운드</small>`); setTimeout(() => idle(), 900); }
        }
      });
    });
  }

  // ---------- N초 맞추기 ----------
  const tm = { idx: null, start: 0, raf: 0 };
  function vTiming(idx, act, st) {
    const ph = st.phase || 'ready'; const mine = S.myAns && S.myAns.ms != null ? S.myAns.ms : null;
    if (tm.idx !== idx) { tm.idx = idx; tm.start = 0; }
    const w = Core.gameWindow(act, st); const timeUp = ph === 'open' && B.now() > w.end && !tm.start;
    const T = act.target;
    const key = JSON.stringify(['tm', idx, ph, mine, timeUp, !!tm.start, st.result ? 1 : 0]);
    const resultLine = mine != null ? `나의 기록 <b style="color:var(--text)">${(mine / 1000).toFixed(2)}초</b> (오차 ${Math.abs(mine / 1000 - T).toFixed(2)}초)` : '도전하지 않았어요';
    if (ph === 'ready') return view(key, `<div class="card hero"><div class="tag">팀 게임 · ${T}초 맞추기</div><div class="emoji">⏱️</div><div class="q-title">${esc(act.title)}</div>
      <p class="muted"><b>시작</b>을 누르고 마음속으로 세다가 정확히 <b>${T}.00초</b>에 <b>멈춤</b>!<br>3초가 지나면 숫자가 사라져요. 기회는 한 번, 팀원 평균 오차가 작은 팀이 이깁니다.</p></div>`);
    if (ph === 'reveal') return view(key, teamResult(act, st, resultLine));
    if (mine != null) return view(key, `<div class="card hero"><div class="emoji">${Math.abs(mine / 1000 - T) < .1 ? '🎯' : '👏'}</div><h1 class="big-num" style="font-size:52px">${(mine / 1000).toFixed(2)}초</h1>
      <p>목표 ${T}.00초 · 오차 <b style="color:var(--gold)">${Math.abs(mine / 1000 - T).toFixed(2)}초</b></p><p class="muted">결과 발표를 기다려 주세요</p></div>`);
    if (ph !== 'open' || timeUp) return view(key, `<div class="card hero"><div class="emoji">⏱️</div><h1>도전 시간 종료</h1><p class="muted">${resultLine}</p></div>`);
    if (!tm.start) return view(key, `<div class="card center"><div class="tag">${T}초 맞추기 · 도전 가능 <span data-deadline="${w.end}" data-total="1">${Math.ceil((w.end - B.now()) / 1000)}초</span></div>
      <div class="q-title">정확히 ${T}.00초에 멈추세요!</div><button class="tap-btn" id="tmGo" style="--c:var(--green)"><span style="font-size:44px">시작</span><small>START</small></button></div>`,
      () => { document.getElementById('tmGo').addEventListener('pointerdown', e => { e.preventDefault(); tm.start = performance.now(); lastKey = ''; render(); }); });
    view(key, `<div class="card center"><div class="tag">${T}초 맞추기</div><div class="cho-q" id="tmN" style="font-variant-numeric:tabular-nums">0.00</div>
      <button class="tap-btn" id="tmStop" style="--c:var(--red)"><span style="font-size:44px">멈춤!</span><small>STOP</small></button></div>`,
      () => {
        const n = document.getElementById('tmN');
        const loop = () => { if (!tm.start || !document.getElementById('tmN')) return; const e = (performance.now() - tm.start) / 1000; n.textContent = e < 3 ? e.toFixed(2) : '? ? ?'; tm.raf = requestAnimationFrame(loop); };
        loop();
        document.getElementById('tmStop').addEventListener('pointerdown', ev => {
          ev.preventDefault(); if (!tm.start) return;
          const ms = Math.round(performance.now() - tm.start); tm.start = 0; cancelAnimationFrame(tm.raf);
          S.myAns = { ms }; B.set(`answers/${idx}/${pid}`, { ms, at: TS }); lastKey = ''; render();
        });
      });
  }

  function waitCard(tag, title, msg) {
    return `<div class="card hero"><div class="tag">${esc(tag)}</div>${title ? `<div class="q-title">${esc(title)}</div>` : '<div class="emoji">⏳</div>'}<p class="muted pulse">${esc(msg)}</p></div>`;
  }
})();
