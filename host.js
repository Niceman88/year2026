// 진행자 화면
(function () {
  const { B, TS, esc, vals, DEMO } = Core;
  const app = document.getElementById('app');
  const qs = new URLSearchParams(location.search);
  const KEYK = 'yearend-hostkey';
  if (window.HOST_KEY && (qs.get('key') || sessionStorage.getItem(KEYK)) !== window.HOST_KEY) {
    app.innerHTML = `<div class="p-wrap"><div class="card"><div class="q-title">진행자 키를 입력하세요</div><input id="k" type="password"><button class="primary" id="go" style="margin-top:10px;width:100%">확인</button><div class="err" id="e"></div></div></div>`;
    document.getElementById('go').onclick = () => {
      if (document.getElementById('k').value === window.HOST_KEY) { sessionStorage.setItem(KEYK, window.HOST_KEY); location.reload(); }
      else document.getElementById('e').textContent = '키가 맞지 않아요';
    };
    return;
  }
  if (qs.get('key')) sessionStorage.setItem(KEYK, qs.get('key'));
  if (DEMO) document.body.insertAdjacentHTML('beforeend', '<div class="demo-banner">데모 모드 — Firebase 없이 이 브라우저 탭끼리만 연결됩니다 (리허설용)</div>');

  app.innerHTML = `<div class="h-wrap"><div class="h-top"><h1 id="hTitle">진행자</h1>
      <div class="tabs"><button data-t="run" class="on">진행</button><button data-t="edit">콘텐츠</button><button data-t="people">참가자</button></div></div>
    <div id="top"></div><div id="tab-run"></div><div id="tab-edit" class="hidden"></div><div id="tab-people" class="hidden"></div></div>`;
  let tab = 'run';
  app.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
    tab = b.dataset.t; app.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    ['run', 'edit', 'people'].forEach(t => document.getElementById('tab-' + t).classList.toggle('hidden', t !== tab));
    if (tab === 'edit') buildEditor(); render(true);
  });

  let D = null, seeded = false;
  const lot = { count: null, onlineOnly: true, exclude: true };
  B.on('', v => {
    D = v || {};
    if (!seeded && !D.content) { seeded = true; const r = Core.parseContent(window.DEFAULT_CONTENT || ''); B.update('', { content: r.content, contentText: window.DEFAULT_CONTENT || '' }); }
    seeded = true; render();
  });
  setInterval(tick, 300);

  const meta = () => D.meta || {};
  const acts = () => vals(D.content && D.content.activities);
  const curIdx = () => (meta().current != null ? meta().current : -1);
  const players = () => D.players || {};
  const online = () => D.online || {};
  const stOf = i => (D.state || {})[i] || {};
  const ansOf = i => (D.answers || {})[i] || {};
  const PH = { ready: '대기', open: '진행 중', closed: '마감', reveal: '공개', spin: '추첨 완료' };

  function tick() {
    if (!D) return;
    // 퀴즈 시간이 끝나면 자동 마감
    const i = curIdx(); const a = acts()[i]; const st = stOf(i);
    if (a && a.type === 'quiz' && st.phase === 'open' && st.openedAt && B.now() > st.openedAt + a.duration * 1000 + 1500) B.set(`state/${i}/phase`, 'closed');
    const cd = document.getElementById('cd');
    if (cd) cd.textContent = Math.max(0, Math.ceil((+cd.dataset.deadline - B.now()) / 1000)) + '초';
  }

  let lastRun = '', lastTop = '', lastPeople = '';
  function render(force) {
    if (!D) return;
    document.getElementById('hTitle').textContent = '🎛️ ' + ((D.content && D.content.title) || '진행자');
    const topKey = JSON.stringify([meta().status, Object.keys(online()).length, Object.keys(players()).length]);
    if (force || topKey !== lastTop) { lastTop = topKey; renderTop(); }
    if (tab === 'run') { const k = JSON.stringify([meta(), D.content, D.state, D.answers, D.points, D.bingo, D.players, Object.keys(online()).length, lot]); if (force || k !== lastRun) { lastRun = k; renderRun(); } }
    if (tab === 'people') { const k = JSON.stringify([D.players, D.online, D.points]); if (force || k !== lastPeople) { lastPeople = k; renderPeople(); } }
  }

  function renderTop() {
    const s = meta().status || 'waiting';
    const pUrl = Core.pageUrl('index.html'), sUrl = Core.pageUrl('screen.html');
    document.getElementById('top').innerHTML = `<div class="card" style="padding:14px">
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between">
        <div class="seg row" style="flex:none;gap:6px">
          <button data-s="waiting" class="${s === 'waiting' ? 'on' : ''}">⏸ 대기 (접속 전)</button>
          <button data-s="live" class="${s === 'live' ? 'on primary' : 'primary'}">▶ 행사 오픈</button>
          <button data-s="ended" class="${s === 'ended' ? 'on' : ''}">🏁 종료</button></div>
        <div><span class="stat">접속 <b>${Object.keys(online()).length}</b></span> <span class="stat">등록 <b>${Object.keys(players()).length}</b></span></div></div>
      <div class="row" style="margin-top:10px;flex-wrap:wrap">
        <div class="linkbox">📱 참가자 URL (사전 배포용): <a href="${esc(pUrl)}" target="_blank">${esc(pUrl)}</a></div>
        <div class="linkbox">🖥️ 대형 화면 URL (프로젝터): <a href="${esc(sUrl)}" target="_blank">${esc(sUrl)}</a></div></div>
      <p class="muted small" style="margin:8px 0 0">현재 상태: <b>${{ waiting: '대기 — 참가자는 “곧 시작합니다” 화면만 봅니다', live: '오픈 — 참가자가 이름을 입력하고 입장할 수 있습니다', ended: '종료 — 참가자에게 감사 화면이 보입니다' }[s]}</b></p></div>`;
    document.querySelectorAll('#top [data-s]').forEach(b => b.onclick = () => {
      if (b.dataset.s === 'ended' && !confirm('행사를 종료할까요? 참가자 화면이 종료 화면으로 바뀝니다.')) return;
      B.set('meta/status', b.dataset.s);
    });
  }

  // ---------- 진행 탭 ----------
  function renderRun() {
    const list = acts(); const ci = curIdx();
    const el = document.getElementById('tab-run');
    el.innerHTML = `<div class="h-grid"><div class="card" style="padding:10px"><div class="row" style="margin-bottom:8px">
        <button id="prev">◀ 이전</button><button id="next" class="primary">다음 ▶</button></div>
      <ul class="alist">${list.map((a, i) => `<li data-i="${i}" class="${i === ci ? 'cur' : ''}"><span class="no">${i + 1}</span><span class="ty">${Core.TYPE_NAMES[a.type]}</span><span class="ti">${esc(a.title)}</span><span class="ph">${PH[stOf(i).phase] || ''}</span></li>`).join('')}</ul>
      <button class="ghost small" id="toIdle" style="width:100%;margin-top:8px">☕ 화면 비우기 (안내 화면)</button></div>
      <div class="card" id="panel">${list[ci] ? '' : '<p class="muted">왼쪽에서 진행할 순서를 클릭하세요. 클릭하면 참가자·대형 화면이 그 순서로 바뀝니다.</p>'}</div></div>`;
    el.querySelectorAll('.alist li').forEach(li => li.onclick = () => B.set('meta/current', +li.dataset.i));
    el.querySelector('#prev').onclick = () => B.set('meta/current', Math.max(0, ci - 1));
    el.querySelector('#next').onclick = () => B.set('meta/current', Math.min(list.length - 1, ci + 1));
    el.querySelector('#toIdle').onclick = () => B.set('meta/current', -1);
    if (list[ci]) panel(ci, list[ci]);
  }

  function panel(i, a) {
    const p = document.getElementById('panel'); const st = stOf(i); const ph = st.phase || 'ready';
    const btn = (id, label, cls = '', dis = false) => `<button id="${id}" class="${cls}" ${dis ? 'disabled' : ''}>${label}</button>`;
    let body = '', btns = '';
    const head = `<div class="tag">${i + 1}. ${Core.TYPE_NAMES[a.type]} · ${PH[ph] || ''}</div><div class="q-title">${esc(a.title)}</div>`;
    const nAns = Object.keys(ansOf(i)).length, nOn = Object.keys(online()).length;

    if (a.type === 'poll' || a.type === 'quiz') {
      const opts = vals(a.options); const c = opts.map(() => 0); vals(ansOf(i)).forEach(x => { if (c[x.v] != null) c[x.v]++; });
      const max = Math.max(1, ...c);
      const showDist = a.type === 'poll' || ph === 'reveal' || ph === 'closed';
      body = `<table>${opts.map((o, k) => `<tr><td>${a.type === 'quiz' && k === a.answer ? '✅ ' : ''}${esc(o)}</td><td style="width:45%">${showDist ? `<div class="mini-bar"><i style="width:${100 * c[k] / max}%"></i></div>` : ''}</td><td style="width:50px">${showDist ? c[k] : ''}</td></tr>`).join('')}</table>
        <p class="muted">응답 <b>${nAns}</b> / 접속 ${nOn}명 ${a.type === 'quiz' && ph === 'open' ? `· 남은 시간 <b id="cd" data-deadline="${st.openedAt + a.duration * 1000}"></b>` : ''}</p>`;
      if (a.type === 'poll') btns = btn('open', '🗳️ 투표 열기', 'primary', ph === 'open') + btn('close', '⏹ 투표 마감', '', ph !== 'open');
      else btns = btn('start', `▶ 문제 시작 (${a.duration}초)`, 'primary', ph !== 'ready') + btn('close', '⏹ 즉시 마감', '', ph !== 'open') + btn('reveal', '✅ 정답 공개 · 채점', 'primary', ph === 'ready' || ph === 'reveal');
      if (a.type === 'quiz' && ph === 'reveal') {
        const top = Core.ranking(players(), D.points).slice(0, 5);
        body += `<p class="muted small">누적 TOP 5: ${top.map((r, k) => `${k + 1}. ${esc(r.name)}(${r.score})`).join(' · ')}</p>`;
      }
    }
    if (a.type === 'wordcloud') {
      const f = {}; vals(ansOf(i)).forEach(x => vals(x.w).forEach(w => f[w] = (f[w] || 0) + 1));
      const top = Object.entries(f).sort((x, y) => y[1] - x[1]).slice(0, 30);
      body = `<p class="muted">참여 ${nAns}명 · 단어 ${Object.keys(f).length}종</p><div class="chips">${top.map(([w, n]) => `<span class="chip">${esc(w)} <b>${n}</b></span>`).join('')}</div>`;
      btns = btn('open', '✍️ 입력 열기', 'primary', ph === 'open') + btn('close', '⏹ 입력 마감', '', ph !== 'open');
    }
    if (a.type === 'bingo') {
      const called = vals(st.called); const left = vals(a.words).filter(w => !called.includes(w));
      const winners = Core.bingoWinners(D, i, a);
      const near = Object.entries((D.bingo || {})[i] || {}).filter(([pid]) => players()[pid]).sort((x, y) => y[1].lines - x[1].lines || x[1].at - y[1].at).slice(0, 15);
      body = `<p>뽑힌 단어 <b>${called.length}</b>개 · 남은 단어 ${left.length}개 · 빙고 완성 <b style="color:var(--gold)">${winners.length}</b>명</p>
        <div class="chips" style="margin-bottom:12px">${called.map((w, k) => `<span class="chip ${k === called.length - 1 ? 'new' : ''}">${esc(w)}</span>`).join('')}</div>
        <table><tr><th>순위</th><th>이름</th><th>팀</th><th>줄</th></tr>${winners.map((w, k) => `<tr><td>🏁 ${k + 1}</td><td>${esc(w.name)}</td><td>${esc(w.team)}</td><td>${a.lines}+</td></tr>`).join('')}
        ${near.filter(([pid]) => !winners.find(w => w.pid === pid)).map(([pid, r]) => `<tr class="muted"><td>-</td><td>${esc(players()[pid].name)}</td><td>${esc(players()[pid].team || '')}</td><td>${r.lines}</td></tr>`).join('')}</table>`;
      btns = btn('open', '🎱 빙고 시작', 'primary', ph !== 'ready') + btn('draw', '🎲 단어 뽑기!', 'primary', ph !== 'open' || !left.length) + btn('undo', '↩ 마지막 취소', 'ghost', !called.length);
    }
    if (a.type === 'lottery') {
      if (lot.idx !== i) { lot.idx = i; lot.count = a.count; }
      const pool = lotteryPool(i);
      const w = vals(st.winners);
      body = `<div class="row" style="align-items:center;flex-wrap:wrap"><label style="flex:none">인원 <input id="lc" type="number" min="1" value="${lot.count}" style="width:80px"></label>
        <label style="flex:none"><input id="lo" type="checkbox" style="width:auto" ${lot.onlineOnly ? 'checked' : ''}> 현재 접속자만</label>
        <label style="flex:none"><input id="lx" type="checkbox" style="width:auto" ${lot.exclude ? 'checked' : ''}> 이전 추첨 당첨자 제외</label></div>
        <p class="muted">추첨 대상 <b>${pool.length}</b>명</p>
        ${w.length ? `<p>당첨: ${w.map(pid => `<b style="color:var(--gold)">${esc((players()[pid] || {}).name || '?')}</b> <span class="muted small">${esc((players()[pid] || {}).team || '')}</span>`).join(', ')}</p>` : ''}`;
      btns = btn('draw', w.length ? '🔁 다시 추첨' : '🎰 추첨!', 'primary', !pool.length);
    }
    if (a.type === 'rank') {
      const top = Core.ranking(players(), D.points).slice(0, 10);
      const teams = Core.teamRanking(players(), D.points, vals(D.content.teams));
      body = `<p class="muted">대형 화면에 개인 TOP 10과 팀 순위가 표시됩니다.</p><table><tr><th>#</th><th>이름</th><th>팀</th><th>점수</th></tr>${top.map((r, k) => `<tr><td>${k + 1}</td><td>${esc(r.name)}</td><td>${esc(r.team)}</td><td>${r.score}</td></tr>`).join('')}</table>
        ${teams.length ? `<p class="muted small">팀(평균): ${teams.map(t => `${esc(t.team)} ${t.avg}점(${t.n}명)`).join(' · ')}</p>` : ''}`;
    }
    p.innerHTML = head + `<div class="btns">${btns}${a.type !== 'rank' ? btn('reset', '🧹 이 순서 초기화', 'ghost') : ''}</div>` + body;
    const on = (id, fn) => { const b = p.querySelector('#' + id); if (b) b.onclick = fn; };
    on('open', () => B.set(`state/${i}/phase`, 'open'));
    on('close', () => B.set(`state/${i}/phase`, 'closed'));
    on('start', () => B.set(`state/${i}`, { phase: 'open', openedAt: TS }));
    on('reveal', () => reveal(i, a));
    on('draw', () => a.type === 'bingo' ? drawWord(i, a) : drawLottery(i));
    on('undo', () => { const c = vals(st.called); if (confirm(`"${c[c.length - 1]}" 뽑기를 취소할까요?`)) B.remove(`state/${i}/called/${c.length - 1}`); });
    on('reset', () => { if (confirm('이 순서의 응답·점수·결과를 모두 지울까요?')) B.update('', { [`state/${i}`]: null, [`answers/${i}`]: null, [`points/${i}`]: null, [`bingo/${i}`]: null }); });
    const lc = p.querySelector('#lc'); if (lc) { lc.onchange = () => { lot.count = Math.max(1, +lc.value || 1); render(); }; p.querySelector('#lo').onchange = e => { lot.onlineOnly = e.target.checked; render(); }; p.querySelector('#lx').onchange = e => { lot.exclude = e.target.checked; render(); }; }
  }

  function reveal(i, a) {
    const st = stOf(i); const pts = {};
    Object.entries(ansOf(i)).forEach(([pid, ans]) => { const s = Core.quizPoints(ans, a, st); if (s > 0) pts[pid] = s; });
    B.update('', { [`points/${i}`]: Object.keys(pts).length ? pts : null, [`state/${i}/phase`]: 'reveal' });
  }
  function drawWord(i, a) {
    const called = vals(stOf(i).called); const left = vals(a.words).filter(w => !called.includes(w));
    if (!left.length) return;
    const w = left[Math.floor(Math.random() * left.length)];
    B.update('', { [`state/${i}/called/${called.length}`]: w, [`state/${i}/drawAt`]: TS });
  }
  function lotteryPool(i) {
    let ids = Object.keys(players());
    if (lot.onlineOnly) ids = ids.filter(id => online()[id]);
    if (lot.exclude) {
      const prev = new Set(); acts().forEach((a, k) => { if (a.type === 'lottery' && k !== i) vals(stOf(k).winners).forEach(p => prev.add(p)); });
      ids = ids.filter(id => !prev.has(id));
    }
    return ids;
  }
  function drawLottery(i) {
    const pool = lotteryPool(i);
    const winners = Core.shuffle(pool).slice(0, lot.count || 1);
    B.set(`state/${i}`, { phase: 'spin', winners, at: TS });
  }

  // ---------- 콘텐츠 탭 ----------
  function buildEditor() {
    const el = document.getElementById('tab-edit');
    el.innerHTML = `<div class="h-grid"><div class="card"><div class="q-title">작성법</div><div class="small muted" style="line-height:1.8">
      <code>제목: 행사 이름</code><br><code>팀: 1팀, 2팀, 3팀</code> (없으면 팀 선택 생략)<br><br>
      <code>[투표] 질문</code> + 줄마다 <code>- 보기</code><br>
      <code>[퀴즈 20초] 질문</code> + <code>- 오답</code> / <code>* 정답</code><br>
      <code>[OX 10초] 문장 / O</code><br>
      <code>[워드클라우드] 질문</code><br>
      <code>[빙고 5x5 3줄] 제목</code> + 다음 줄에 단어들을 쉼표로 (25개 이상)<br>
      <code>[추첨 3명] 경품 이름</code><br>
      <code>[순위] 제목</code> — 누적 점수 순위 화면<br>
      <code># </code>로 시작하는 줄은 메모(무시)<br><br>
      ⚠️ 행사 중에 순서를 끼워 넣거나 지우면 이미 받은 응답이 다른 순서에 붙을 수 있어요. 행사 시작 후에는 오타 수정 정도만 하세요.</div>
      <div id="pv" style="margin-top:14px"></div></div>
      <div class="card"><textarea class="editor" id="ed" spellcheck="false"></textarea>
      <div class="btns"><button id="chk">검사</button><button class="primary" id="save">저장 (모든 화면에 반영)</button><button class="ghost" id="def">기본 예시 불러오기</button></div><div id="msg"></div></div></div>`;
    const ed = el.querySelector('#ed');
    ed.value = (D && D.contentText) || window.DEFAULT_CONTENT || '';
    const check = () => {
      const r = Core.parseContent(ed.value);
      el.querySelector('#pv').innerHTML = `<div class="q-title" style="font-size:16px">미리보기 (${r.content.activities.length}개 순서)</div><ol class="small">${r.content.activities.map(a => `<li>[${Core.TYPE_NAMES[a.type]}] ${esc(a.title)}</li>`).join('')}</ol>`;
      el.querySelector('#msg').innerHTML = r.errors.length ? r.errors.map(e => `<div class="err">• ${esc(e)}</div>`).join('') : '<div class="ok">문제 없음 ✓</div>';
      return r;
    };
    el.querySelector('#chk').onclick = check;
    el.querySelector('#def').onclick = () => { if (confirm('지금 내용을 기본 예시로 바꿀까요? (저장 전까지는 반영되지 않아요)')) { ed.value = window.DEFAULT_CONTENT; check(); } };
    el.querySelector('#save').onclick = async () => {
      const r = check(); if (r.errors.length) { alert('오류를 먼저 고쳐 주세요'); return; }
      await B.update('', { content: r.content, contentText: ed.value });
      el.querySelector('#msg').innerHTML = '<div class="ok">저장했어요 ✓ 참가자·대형 화면에 바로 반영됩니다</div>';
    };
    check();
  }

  // ---------- 참가자 탭 ----------
  function renderPeople() {
    const rank = Core.ranking(players(), D.points);
    const teams = Core.teamRanking(players(), D.points, vals(D.content && D.content.teams));
    const el = document.getElementById('tab-people');
    el.innerHTML = `<div class="h-grid"><div class="card"><div class="q-title">팀 현황</div><table><tr><th>팀</th><th>인원</th><th>평균</th></tr>${teams.map(t => `<tr><td>${esc(t.team)}</td><td>${t.n}</td><td>${t.avg}</td></tr>`).join('')}</table>
      <div class="btns" style="margin-top:20px"><button class="danger" id="wipe">⚠️ 전체 초기화 (리허설 후)</button></div><p class="muted small">참가자·응답·점수·결과를 모두 지우고 대기 상태로 돌립니다. 콘텐츠는 유지됩니다.</p></div>
      <div class="card"><div class="q-title">참가자 ${rank.length}명</div><table><tr><th>#</th><th>이름</th><th>팀</th><th>점수</th><th>접속</th><th></th></tr>
      ${rank.map((r, k) => `<tr><td>${k + 1}</td><td>${esc(r.name)}</td><td>${esc(r.team)}</td><td>${r.score}</td><td>${online()[r.pid] ? '🟢' : '⚪'}</td><td><button class="ghost small" data-del="${esc(r.pid)}" style="padding:4px 8px">삭제</button></td></tr>`).join('')}</table></div></div>`;
    el.querySelector('#wipe').onclick = () => {
      if (!confirm('정말 전체 초기화할까요? 되돌릴 수 없습니다.')) return;
      B.update('', { players: null, online: null, answers: null, points: null, bingo: null, state: null, 'meta/current': -1, 'meta/status': 'waiting' });
    };
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const id = b.dataset.del; if (!confirm(`${players()[id].name} 님을 삭제할까요?`)) return;
      B.remove('players/' + id);
    });
  }
})();
