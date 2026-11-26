// 공통 엔진: 데이터 연결(Firebase 또는 데모), 콘텐츠 해석, 점수·빙고 계산
window.Core = (function () {
  const qs = new URLSearchParams(location.search);
  const cfg = window.FIREBASE_CONFIG || {};
  const DEMO = qs.has('demo') || !cfg.apiKey || /YOUR/.test(cfg.apiKey);
  if (!DEMO && typeof firebase === 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.innerHTML = '<div style="padding:40px;text-align:center;font-size:18px">⚠️ 서버 연결 라이브러리를 불러오지 못했습니다.<br>네트워크(사내 와이파이 차단 등)를 확인하거나 모바일 데이터로 다시 접속해 주세요.</div>';
    });
    throw new Error('firebase sdk not loaded');
  }
  const EVENT = String(qs.get('event') || window.EVENT_ID || 'main').replace(/[^\w-]/g, '') || 'main';
  const ROOT = 'yearend/' + EVENT;
  const TS = { '.sv': 'timestamp' };

  // ---------- 데이터 연결 ----------
  function fbBackend() {
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    const db = firebase.database();
    const p = path => (path ? ROOT + '/' + path : ROOT);
    let offset = 0;
    db.ref('.info/serverTimeOffset').on('value', s => { offset = s.val() || 0; });
    return {
      on(path, cb) { const r = db.ref(p(path)); const h = s => cb(s.val()); r.on('value', h); return () => r.off('value', h); },
      get: async path => (await db.ref(p(path)).get()).val(),
      set: (path, v) => db.ref(p(path)).set(v),
      update: (path, obj) => db.ref(p(path)).update(obj),
      remove: path => db.ref(p(path)).remove(),
      now: () => Date.now() + offset,
      presence(path, val) {
        const r = db.ref(p(path));
        db.ref('.info/connected').on('value', s => { if (s.val()) { r.onDisconnect().remove(); r.set(val); } });
      },
      onConnected(cb) { db.ref('.info/connected').on('value', s => cb(!!s.val())); }
    };
  }

  // 데모 모드: Firebase 없이 같은 브라우저의 여러 탭끼리만 동기화 (리허설·미리보기용)
  function localBackend() {
    const KEY = 'yearend-demo:' + ROOT;
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel(KEY) : null;
    const subs = new Set();
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
    let tree = load();
    const getAt = (t, path) => {
      if (!path) return t;
      for (const k of path.split('/')) { if (t == null || typeof t !== 'object') return null; t = t[k]; }
      return t === undefined ? null : t;
    };
    const resolve = v => {
      if (v && typeof v === 'object') {
        if (v['.sv'] === 'timestamp') return Date.now();
        const o = Array.isArray(v) ? [] : {};
        for (const k in v) { const r = resolve(v[k]); if (r !== null && r !== undefined) o[k] = r; }
        return Object.keys(o).length ? o : null;
      }
      return v;
    };
    const setAt = (path, v) => {
      const ks = path.split('/').filter(Boolean);
      if (!ks.length) { tree = v || {}; return; }
      let t = tree;
      for (let i = 0; i < ks.length - 1; i++) {
        if (t[ks[i]] == null || typeof t[ks[i]] !== 'object') t[ks[i]] = {};
        t = t[ks[i]];
      }
      const last = ks[ks.length - 1];
      if (v === null || v === undefined) delete t[last]; else t[last] = v;
    };
    const fire = () => subs.forEach(s => s.fire());
    const commit = () => { localStorage.setItem(KEY, JSON.stringify(tree)); if (bc) bc.postMessage(1); fire(); };
    if (bc) bc.onmessage = () => { tree = load(); fire(); };
    window.addEventListener('storage', e => { if (e.key === KEY) { tree = load(); fire(); } });
    const api = {
      on(path, cb) {
        const s = { last: undefined, fire() { const v = getAt(tree, path); const j = JSON.stringify(v ?? null); if (j !== s.last) { s.last = j; cb(JSON.parse(j)); } } };
        subs.add(s); setTimeout(() => s.fire(), 0); return () => subs.delete(s);
      },
      get: async path => JSON.parse(JSON.stringify(getAt(tree, path) ?? null)),
      set: async (path, v) => { tree = load(); setAt(path, resolve(v)); commit(); },
      update: async (path, obj) => { tree = load(); for (const k in obj) setAt((path ? path + '/' : '') + k, resolve(obj[k])); commit(); },
      remove: async path => { tree = load(); setAt(path, null); commit(); },
      now: () => Date.now(),
      presence(path, val) {
        api.set(path, val);
        window.addEventListener('pagehide', () => { tree = load(); setAt(path, null); localStorage.setItem(KEY, JSON.stringify(tree)); if (bc) bc.postMessage(1); });
      },
      onConnected(cb) { cb(true); }
    };
    return api;
  }

  const B = DEMO ? localBackend() : fbBackend();

  // ---------- 유틸 ----------
  const vals = x => (!x ? [] : (Array.isArray(x) ? x : Object.values(x)).filter(v => v != null));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function hash(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(arr, r = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function pageUrl(file, extra) {
    const u = new URL(file, location.href);
    const cur = new URLSearchParams(location.search);
    ['event', 'demo'].forEach(k => { if (cur.has(k)) u.searchParams.set(k, cur.get(k)); });
    if (extra) for (const k in extra) u.searchParams.set(k, extra[k]);
    return u.toString();
  }

  // ---------- 계산 ----------
  function bingoBoard(pid, idx, act) { return shuffle(act.words, rng(hash(pid + '#' + idx))).slice(0, act.size * act.size); }
  function bingoLines(board, size, calledSet) {
    const m = i => calledSet.has(board[i]);
    let n = 0;
    for (let r = 0; r < size; r++) { let ok = true; for (let c = 0; c < size; c++) if (!m(r * size + c)) { ok = false; break; } if (ok) n++; }
    for (let c = 0; c < size; c++) { let ok = true; for (let r = 0; r < size; r++) if (!m(r * size + c)) { ok = false; break; } if (ok) n++; }
    let d1 = true, d2 = true;
    for (let i = 0; i < size; i++) { if (!m(i * size + i)) d1 = false; if (!m(i * size + (size - 1 - i))) d2 = false; }
    return n + (d1 ? 1 : 0) + (d2 ? 1 : 0);
  }
  // 빙고 완성자: 각자 보고한 시각 순. 뽑힌 단어로 판을 다시 계산해 검증
  function bingoWinners(D, idx, act) {
    const players = D.players || {};
    const called = new Set(vals(((D.state || {})[idx] || {}).called));
    const rep = (D.bingo || {})[idx] || {};
    return Object.entries(rep)
      .filter(([pid, r]) => r && r.lines >= act.lines && players[pid] && bingoLines(bingoBoard(pid, idx, act), act.size, called) >= act.lines)
      .sort((a, b) => a[1].at - b[1].at)
      .map(([pid, r]) => ({ pid, at: r.at, name: players[pid].name, team: players[pid].team || '' }));
  }
  // ---------- 점수 규칙 (config.js 의 window.SCORING 으로 바꿀 수 있음) ----------
  // correct/speedBonus: 개인 퀴즈 점수, team: 팀 게임 순위별 팀 점수(1등, 2등, ...)
  const SCORING = Object.assign({ correct: 100, speedBonus: 50, team: [100, 70, 50, 30, 20, 10, 5, 0], fairSample: true }, window.SCORING || {});
  // 퀴즈: 정답 100점 + 빨리 맞힐수록 최대 50점 (제한시간 끝에 맞히면 100점, 바로 맞히면 150점)
  function quizPoints(ans, act, st) {
    if (!ans || ans.v !== act.answer || !st || !st.openedAt || !ans.at) return 0;
    const el = Math.max(0, (ans.at - st.openedAt) / 1000);
    if (el > act.duration + 1.5) return 0;
    return Math.round(SCORING.correct + SCORING.speedBonus * Math.max(0, 1 - el / act.duration));
  }

  // ---------- 팀 게임 ----------
  const TEAM_GAMES = ['race', 'teamquiz', 'mind', 'chosung', 'timing', 'reaction'];
  const isTeamGame = a => !!a && TEAM_GAMES.includes(a.type);
  const RACE_COUNTDOWN = 3000;
  // 진행 시간: 탭 레이스만 3초 카운트다운 후 시작, 10초 맞추기는 도전 가능 시간(window)
  function gameWindow(act, st) {
    const o = (st && st.openedAt) || 0;
    if (act.type === 'race') return { start: o + RACE_COUNTDOWN, end: o + RACE_COUNTDOWN + act.duration * 1000 };
    if (act.type === 'timing' || act.type === 'reaction') return { start: o, end: o + (act.window || 40) * 1000 };
    return { start: o, end: o + act.duration * 1000 };
  }
  const raceWindow = gameWindow;
  // 팀별 성적 계산. rows는 잘한 팀부터 정렬 (rank는 동점 공동 순위)
  // 공정성: 팀 인원이 달라도 결과가 같은 조건이 되도록, 참여 인원이 가장 적은 팀의 인원(K)만큼
  //         각 팀에서 무작위로 K명을 뽑아 평균을 냅니다. (인원이 적은 팀이 평균이 크게 출렁여 1등을 자주 하는 문제 방지)
  //         무작위 추첨은 게임 시작 시각을 씨앗으로 해서 모든 화면에서 똑같이 나옵니다.
  function teamGame(D, idx, act) {
    const players = D.players || {}; const teams = vals(D.content && D.content.teams);
    const st = (D.state || {})[idx] || {};
    const size = {}; Object.values(players).forEach(p => { if (p.team) size[p.team] = (size[p.team] || 0) + 1; });
    const src = act.type === 'race' ? ((D.taps || {})[idx] || {}) : ((D.answers || {})[idx] || {});
    const pool = {}; teams.forEach(t => { pool[t] = []; });
    const indiv = [];
    if (act.type === 'teamquiz') {
      // 시작 순간 접속해 있던 팀원 전체가 대상 (무응답은 오답). 명단이 없으면 응답자 기준
      const ro = st.roster || {};
      teams.forEach(t => {
        const ids = Array.isArray(ro[t]) ? vals(ro[t]) : [];
        Object.keys(src).forEach(pid => { if ((players[pid] || {}).team === t && !ids.includes(pid)) ids.push(pid); });
        ids.forEach(pid => { if (!players[pid]) return; const a = src[pid]; pool[t].push({ pid, v: a && a.v === act.answer ? 1 : 0, time: a && a.v === act.answer ? Math.max(0, (a.at || 0) - (st.openedAt || 0)) : 0, answered: !!a }); });
      });
    } else {
      Object.entries(src).forEach(([pid, a]) => {
        const p = players[pid]; if (!p || !p.team || !pool[p.team] || a == null) return; let v;
        if (act.type === 'race') { if (!a) return; v = a; }
        else if (act.type === 'mind') { if (a.v == null) return; v = a.v; }
        else if (act.type === 'chosung') v = vals(a.c).length;
        else if (act.type === 'timing') { if (a.ms == null) return; v = Math.abs(a.ms - act.target * 1000) / 1000; }
        else if (act.type === 'reaction') { if (a.ms == null) return; v = Math.min(1000, Math.max(100, a.ms)); }
        pool[p.team].push({ pid, v, ms: a.ms });
        if (act.type !== 'mind') indiv.push({ pid, name: p.name, team: p.team, v, ms: a.ms });
      });
    }
    const counts = teams.map(t => pool[t].length).filter(n => n > 0);
    const fair = SCORING.fairSample !== false;
    const K = counts.length ? Math.min(...counts) : 0;
    const opts = vals(act.options);
    const out = teams.map(t => {
      const all = pool[t].slice().sort((x, y) => x.pid < y.pid ? -1 : 1);
      const sample = fair && all.length > K ? shuffle(all, rng(hash(`${idx}:${st.openedAt || 0}:${t}`))).slice(0, K) : all;
      const m = sample.length; const sum = sample.reduce((s2, e) => s2 + (act.type === 'mind' ? 0 : e.v), 0);
      const r = { team: t, size: size[t] || 0, n: all.length, k: m, value: 0, label: '-', sub: '', time: 0 };
      const note = fair && all.length > m ? ` · 무작위 ${m}명 반영` : '';
      if (act.type === 'race') { r.value = m ? sum / m : 0; r.label = `${Math.round(r.value * 10) / 10}회`; r.sub = `1인당 평균 · ${all.length}명 참여${note}`; }
      if (act.type === 'teamquiz') { r.value = m ? sum / m : 0; r.time = sample.reduce((s2, e) => s2 + e.time, 0) / Math.max(1, sum); r.label = `${Math.round(r.value * 100)}%`; r.sum = sum; r.sub = `정답 ${sum}/${m}명${note}`; }
      if (act.type === 'chosung') { r.value = m ? sum / m : 0; r.label = `${Math.round(r.value * 10) / 10}개`; r.sub = `1인당 정답 · ${all.length}명 참여${note}`; }
      if (act.type === 'timing') { r.value = m ? sum / m : 999; r.label = m ? `±${r.value.toFixed(2)}초` : '-'; r.sub = `평균 오차 · ${all.length}명 참여${note}`; }
      if (act.type === 'reaction') { r.value = m ? sum / m : 9999; r.label = m ? `${Math.round(r.value)}ms` : '-'; r.sub = `평균 반응속도 · ${all.length}명 참여${note}`; }
      if (act.type === 'mind') { // 팀원 2명을 골랐을 때 같은 답일 확률
        const votes = {}; sample.forEach(e => { votes[e.v] = (votes[e.v] || 0) + 1; });
        const top = Object.entries(votes).sort((x, y) => y[1] - x[1])[0]; const same = Object.values(votes).reduce((s2, c) => s2 + c * (c - 1), 0);
        r.value = m >= 2 ? same / (m * (m - 1)) : 0; r.pick = top ? +top[0] : null; r.label = `${Math.round(r.value * 100)}%`; r.sub = top ? `최다 "${opts[top[0]]}" · ${all.length}명 응답${note}` : '응답 없음';
      }
      if (act.type !== 'teamquiz' && !m) r.n = 0;
      return r;
    });
    const low = act.type === 'timing' || act.type === 'reaction';
    const better = (x, y) => (y.n > 0) - (x.n > 0) || (low ? x.value - y.value : y.value - x.value) || (act.type === 'teamquiz' ? x.time - y.time : 0);
    out.sort(better);
    out.forEach(r => { r.rank = r.n > 0 ? 1 + out.filter(o => o.n > 0 && better(o, r) < 0).length : out.length; });
    indiv.sort((x, y) => low ? x.v - y.v : y.v - x.v);
    return { rows: out, indiv, low, K };
  }
  function teamGamePoints(D, idx, act) {
    const b = vals(SCORING.team); const pts = {};
    teamGame(D, idx, act).rows.forEach(r => { if (r.n > 0 && b[r.rank - 1]) pts[r.team] = b[r.rank - 1]; });
    return pts;
  }
  // ---------- 세션 ----------
  // [세션]으로 순서를 구간으로 나눕니다. 순위는 같은 세션 안의 점수만 집계합니다. (세션이 없으면 전체)
  function sectionRange(acts, idx) {
    acts = vals(acts); if (idx == null || idx < 0) return { start: 0, end: acts.length, idx: -1 };
    let start = 0, sec = -1; for (let i = Math.min(idx, acts.length - 1); i >= 0; i--) if (acts[i] && acts[i].type === 'section') { start = i; sec = i; break; }
    let end = acts.length; for (let i = Math.max(idx, start) + 1; i < acts.length; i++) if (acts[i] && acts[i].type === 'section') { end = i; break; }
    return { start, end, idx: sec };
  }
  const inSection = (acts, idx, i) => { const r = sectionRange(acts, idx); return i >= r.start && i < r.end; };
  // 개인 퀴즈 순위: ① 점수 → ② 맞힌 문제 수 → ③ 정답까지 걸린 시간 합계(빠를수록 위). 모두 같을 때만 공동 순위
  function quizRanking(D, idx) {
    const acts = vals(D.content && D.content.activities); const players = D.players || {};
    const qs = acts.map((a, i) => a.type === 'quiz' && (idx == null || inSection(acts, idx, i)) ? i : -1).filter(i => i >= 0);
    const rows = Object.entries(players).map(([pid, p]) => {
      let score = 0, correct = 0, time = 0;
      qs.forEach(i => {
        const pt = ((D.points || {})[i] || {})[pid] || 0; if (!pt) return;
        score += pt; correct++;
        const a = ((D.answers || {})[i] || {})[pid]; const st = (D.state || {})[i] || {};
        if (a && a.at && st.openedAt) time += Math.max(0, a.at - st.openedAt);
      });
      return { pid, name: p.name, team: p.team || '', score, correct, time };
    });
    const cmp = (x, y) => y.score - x.score || y.correct - x.correct || x.time - y.time;
    rows.sort((x, y) => cmp(x, y) || String(x.name).localeCompare(String(y.name)));
    rows.forEach(r => { r.rank = 1 + rows.filter(o => cmp(o, r) < 0).length; r.tieBroken = rows.some(o => o !== r && o.score === r.score && r.score > 0 && cmp(o, r) !== 0); });
    return rows;
  }
  // 세션 소개용 자동 정보: 이번 순서 목록, 규칙 안내, 상품 목록
  function sectionInfo(content, idx) {
    const acts = vals(content && content.activities); const r = sectionRange(acts, idx);
    const list = acts.slice(r.start, r.end).map((a, k) => ({ a, i: r.start + k })).filter(x => x.a.type !== 'section');
    const has = t => list.some(x => x.a.type === t);
    const tg = list.filter(x => isTeamGame(x.a)).length;
    const rules = [];
    if (has('wordcloud')) rules.push('☁️ 휴대폰으로 단어를 익명으로 보내면, 많이 나온 단어일수록 크게 보여요');
    if (has('poll')) rules.push('🗳️ 실시간 투표 — 결과가 바로 화면에 나타나요');
    if (has('quiz')) rules.push(`🧠 정답 ${SCORING.correct}점 + 빨리 맞힐수록 최대 ${SCORING.speedBonus}점 · 이 세션의 퀴즈 점수로만 순위를 매겨요`, '⚖️ 동점이면 맞힌 문제 수 → 정답까지 걸린 시간이 짧은 사람이 위');
    if (tg) rules.push(`👥 팀 게임 ${tg}종 · 팀원 평균으로 승부해 팀 인원 차이와 무관해요`, `🏅 게임마다 팀 순위별 ${vals(SCORING.team).filter(x => x).slice(0, (vals(content && content.teams).length || 4)).join('·')}점 · 동점이면 1등 횟수가 많은 팀이 위`);
    if (has('bingo')) rules.push('🎱 빙고판은 자동으로 만들어지고, 뽑힌 단어가 자동으로 칠해져요 · 먼저 완성한 순서로 시상');
    if (has('lottery')) rules.push('🎰 접속 중인 사람 중 무작위 추첨 · 한 사람이 두 번 당첨되지 않아요');
    const prizes = [];
    list.forEach(({ a }) => {
      if ((a.type === 'rank' || a.type === 'bingo') && vals(a.prizes).length) vals(a.prizes).forEach(p => prizes.push({ label: `${a.type === 'bingo' ? '빙고 ' : a.scope === 'team' ? '팀 ' : ''}${p.from}${p.to !== p.from ? '~' + p.to : ''}등`, prize: p }));
      if (a.type === 'lottery') { const p = vals(a.prizes)[0] || { name: a.title }; prizes.push({ label: `추첨 ${a.count}명`, prize: p }); }
    });
    const no = acts.slice(0, (r.idx < 0 ? 0 : r.idx) + 1).filter(a => a.type === 'section').length;
    const total = acts.filter(a => a.type === 'section').length;
    return { list, rules, prizes, no, total };
  }
  function sectionScore(content, points, pid, idx) {
    const acts = vals(content && content.activities); let t = 0;
    acts.forEach((a, i) => { if (a.type === 'quiz' && (idx == null || inSection(acts, idx, i))) t += ((points || {})[i] || {})[pid] || 0; });
    return t;
  }

  // 팀전 누적 점수 (팀 게임 결과 발표 때 받은 점수 합계) — idx를 주면 그 세션의 팀 게임만
  // 동점 처리: ① 팀전 점수 → ② 팀 게임 1등 횟수 → ③ 2등 횟수 → … → ④ 마지막 팀 게임 순위
  //           모든 기준이 같을 때만 공동 순위가 됩니다.
  function teamStandings(D, idx) {
    const teams = vals(D.content && D.content.teams); const acts = vals(D.content && D.content.activities);
    const ok = i => idx == null || inSection(acts, idx, +i);
    const rows = {}; teams.forEach(n => { rows[n] = { team: n, pts: 0, medals: Array(teams.length + 1).fill(0), last: 99 }; });
    const tp = D.tpoints || {};
    for (const i in tp) { if (!ok(i)) continue; const m = tp[i] || {}; for (const k in m) { rows[k] = rows[k] || { team: k, pts: 0, medals: Array(teams.length + 1).fill(0), last: 99 }; rows[k].pts += m[k] || 0; } }
    let lastIdx = -1;
    acts.forEach((a, i) => {
      if (!isTeamGame(a) || !ok(i)) return; const st = (D.state || {})[i] || {}; const res = vals(st.result); if (!res.length || st.phase !== 'reveal') return;
      res.forEach(r => { if (rows[r.team] && r.pts > 0 && r.rank >= 1) rows[r.team].medals[r.rank - 1]++; });
      lastIdx = i;
    });
    if (lastIdx >= 0) vals(((D.state || {})[lastIdx] || {}).result).forEach(r => { if (rows[r.team] && r.pts > 0) rows[r.team].last = r.rank; });
    const cmp = (x, y) => {
      if (y.pts !== x.pts) return y.pts - x.pts;
      for (let k = 0; k < x.medals.length; k++) if (y.medals[k] !== x.medals[k]) return y.medals[k] - x.medals[k];
      return x.last - y.last;
    };
    const out = Object.values(rows).sort(cmp);
    out.forEach(r => {
      r.rank = 1 + out.filter(o => cmp(o, r) < 0).length;
      r.tieBroken = out.some(o => o !== r && o.pts === r.pts && cmp(o, r) !== 0);
    });
    return out;
  }
  const hasTeamPoints = (D, idx) => Object.keys(D.tpoints || {}).some(i => idx == null || inSection(vals(D.content && D.content.activities), idx, +i));
  // 초성 정답 비교 (띄어쓰기·대소문자 무시)
  const norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();
  const chosungOk = (item, text) => vals(item.a).some(x => norm(x) === norm(text));

  const TEAM_COLORS = ['#ff5a6e', '#4da3ff', '#ffcc4d', '#3ddc97', '#b98cff', '#ff9f43', '#7ee0ff', '#ff8fd0'];
  const TEAM_EMOJI = ['🦊', '🐳', '🐯', '🐸', '🦄', '🐻', '🐧', '🐰'];
  function teamColor(teams, name) { const i = vals(teams).indexOf(name); return i < 0 ? '#a6acd6' : TEAM_COLORS[i % TEAM_COLORS.length]; }
  function teamEmoji(teams, name) { const i = vals(teams).indexOf(name); return i < 0 ? '🏃' : TEAM_EMOJI[i % TEAM_EMOJI.length]; }
  function totals(points) {
    const t = {};
    if (points) for (const idx in points) { const m = points[idx] || {}; for (const pid in m) t[pid] = (t[pid] || 0) + (m[pid] || 0); }
    return t;
  }
  // 개인 순위 (퀴즈 점수). rank는 동점 공동 순위
  function ranking(players, points) {
    const t = totals(points);
    const rows = Object.entries(players || {}).map(([pid, p]) => ({ pid, name: p.name, team: p.team || '', score: t[pid] || 0 }))
      .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)));
    let prev = null, rank = 0; rows.forEach((r, i) => { if (r.score !== prev) { rank = i + 1; prev = r.score; } r.rank = rank; });
    return rows;
  }

  // ---------- 포상 ----------
  function prizeFor(act, rank) { return vals(act && act.prizes).find(p => rank >= p.from && rank <= p.to) || null; }
  const maxPrizeRank = act => Math.max(0, ...vals(act && act.prizes).map(p => p.to));
  // 순위 화면 집계(스냅샷): 진행자가 순서를 열 때 고정해 두어 모든 화면이 같은 결과를 봅니다
  function rankSnapshot(D, act, idx) {
    if (act.scope === 'team') return { at: Date.now(), team: teamStandings(D, idx) };
    const n = Math.max(10, maxPrizeRank(act));
    const rows = quizRanking(D, idx).filter(r => r.score > 0);
    const cut = rows.filter(r => r.rank <= n); // 동점자가 경계에 걸려도 같은 순위는 모두 포함
    return { at: Date.now(), indiv: cut };
  }
  // 모든 포상 내역 (진행자 지급 명단용)
  function prizeList(D) {
    const out = []; const acts = vals(D.content && D.content.activities); const players = D.players || {};
    acts.forEach((a, i) => {
      const st = (D.state || {})[i] || {};
      if (a.type === 'rank' && st.snap && vals(a.prizes).length) {
        if (a.scope === 'team') vals(st.snap.team).forEach(r => { const p = prizeFor(a, r.rank); if (p) out.push({ act: a.title, rank: r.rank, name: r.team + ' (팀)', team: r.team, prize: p.name }); });
        else vals(st.snap.indiv).forEach(r => { const p = prizeFor(a, r.rank); if (p) out.push({ act: a.title, rank: r.rank, name: r.name, team: r.team, prize: p.name }); });
      }
      if (a.type === 'bingo' && vals(a.prizes).length) bingoWinners(D, i, a).forEach((w, k) => { const p = prizeFor(a, k + 1); if (p) out.push({ act: a.title, rank: k + 1, name: w.name, team: w.team, prize: p.name }); });
      if (a.type === 'lottery' && st.phase === 'spin') vals(st.winners).forEach((pid, k) => { const p = prizeFor(a, k + 1); out.push({ act: a.title, rank: '당첨', name: (players[pid] || {}).name || '?', team: (players[pid] || {}).team || '', prize: p ? p.name : a.title }); });
    });
    return out;
  }

  // ---------- 콘텐츠 해석 ----------
  const TYPE_NAMES = { section: '세션', poll: '투표', quiz: '퀴즈', wordcloud: '워드클라우드', bingo: '빙고', lottery: '추첨', rank: '순위', race: '탭 레이스', teamquiz: '팀 퀴즈', mind: '이심전심', chosung: '초성 퀴즈', timing: '10초 맞추기', reaction: '번개 반응' };
  const typeName = a => a.type === 'rank' && a.scope === 'team' ? '팀 순위' : a.type === 'timing' ? `${a.target}초 맞추기` : TYPE_NAMES[a.type];
  const splitList = s => s.split(/[,，、\n]/).map(x => x.trim()).filter(Boolean);
  function parseContent(text) {
    const out = { title: '연말 행사', teams: [], activities: [] }; const errors = [];
    let cur = null;
    String(text || '').split(/\r?\n/).forEach((raw, i) => {
      const line = raw.trim(); const ln = i + 1;
      if (!line || line.startsWith('#')) return;
      const h = line.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (h) {
        cur = newAct(h[1].trim(), h[2].trim(), ln, errors);
        if (cur.type !== '_bad') out.activities.push(cur);
        return;
      }
      if (!cur) {
        const kv = line.match(/^(제목|팀)\s*[:：]\s*(.*)$/);
        if (!kv) errors.push(`${ln}행: 첫 활동([투표] 등) 앞에는 "제목:" 또는 "팀:"만 쓸 수 있어요`);
        else if (kv[1] === '제목') out.title = kv[2].trim() || out.title;
        else out.teams = [...new Set(splitList(kv[2]))];
        return;
      }
      addBody(cur, line, ln, errors);
    });
    out.activities.forEach(a => finalize(a, errors, out));
    out.activities.forEach(a => { delete a._ln; });
    return { content: out, errors };
  }
  function newAct(tag, rest, ln, errors) {
    const parts = tag.split(/\s+/); const kind = parts[0];
    const num = re => { const m = tag.match(re); return m ? parseInt(m[1], 10) : null; };
    const a = { _ln: ln, title: rest };
    if (/^(세션|섹션|파트)$/.test(kind)) { a.type = 'section'; a.desc = []; }
    else if (/^투표$/.test(kind)) a.type = 'poll';
    else if (/^퀴즈$/.test(kind)) a.type = 'quiz';
    else if (/^ox$/i.test(kind)) { a.type = 'quiz'; a.ox = true; }
    else if (/^(워드클라우드|단어)$/.test(kind)) a.type = 'wordcloud';
    else if (/^빙고$/.test(kind)) a.type = 'bingo';
    else if (/^(추첨|경품)$/.test(kind)) a.type = 'lottery';
    else if (/^(순위|랭킹)$/.test(kind)) { a.type = 'rank'; a.scope = /팀/.test(tag) ? 'team' : 'indiv'; }
    else if (/^(팀순위|팀랭킹)$/.test(kind)) { a.type = 'rank'; a.scope = 'team'; }
    else if (/^(탭레이스|탭|레이스)$/.test(kind)) { a.type = 'race'; a.duration = num(/(\d+)\s*초/) || 10; }
    else if (/^팀퀴즈$/.test(kind)) { a.type = 'teamquiz'; a.duration = num(/(\d+)\s*초/) || 20; a.options = []; a.answer = -1; }
    else if (/^이심전심$/.test(kind)) { a.type = 'mind'; a.duration = num(/(\d+)\s*초/) || 15; a.options = []; }
    else if (/^초성(퀴즈)?$/.test(kind)) { a.type = 'chosung'; a.duration = num(/(\d+)\s*초/) || 60; a.items = []; }
    else if (/^(타이밍|\d+초맞추기|초맞추기)$/.test(kind)) { a.type = 'timing'; a.target = num(/(\d+)\s*초/) || 10; a.window = 40; }
    else if (/^(반응속도|번개반응|반응)$/.test(kind)) { a.type = 'reaction'; a.rounds = Math.min(5, num(/(\d+)\s*회/) || 3); a.window = 45; }
    else { errors.push(`${ln}행: [${tag}] — 알 수 없는 종류예요 (작성법의 종류 목록을 확인하세요)`); return { type: '_bad' }; }
    if (a.type === 'quiz') { a.duration = num(/(\d+)\s*초/) || (a.ox ? 10 : 20); a.options = a.ox ? ['O', 'X'] : []; a.answer = -1; }
    if (a.type === 'poll') a.options = [];
    if (a.type === 'bingo') { a.size = num(/(\d)\s*[x×X*]\s*\d/) || 5; a.lines = num(/(\d+)\s*줄/) || (a.size <= 3 ? 1 : 3); a.words = []; }
    if (a.type === 'lottery') a.count = num(/(\d+)\s*명/) || 1;
    if (a.ox) {
      const m = rest.match(/^(.*?)\s*[\/／]\s*([OoXx○×])\s*$/);
      if (m) { a.title = m[1].trim(); a.answer = /[Oo○]/.test(m[2]) ? 0 : 1; }
    }
    a.prizes = [];
    return a;
  }
  function addBody(a, line, ln, errors) {
    if (a.type === '_bad') return;
    if (a.type === 'section') {
      const m = line.match(/^(부제|소제목|슬로건)\s*[:：]\s*(.+)$/);
      if (m) a.sub = m[2].trim(); else if (!a.title) a.title = line; else a.desc.push(line.replace(/^[-*•]\s*/, ''));
      return;
    }
    // 포상: "1등: 상품", "4~10등: 상품", "경품: 상품" (뒤에 "| 이미지주소"를 붙이면 그 이미지 사용)
    const pz = line.match(/^(\d+)\s*(?:[~\-–]\s*(\d+)\s*)?등\s*[:：]\s*(.+)$/);
    const pz2 = line.match(/^(경품|상품|포상)\s*[:：]\s*(.+)$/);
    if (pz || pz2) {
      const body = (pz ? pz[3] : pz2[2]).split('|'); const name = body[0].trim(); const img = (body[1] || '').trim();
      if (pz) a.prizes.push({ from: +pz[1], to: +(pz[2] || pz[1]), name, img });
      else a.prizes.push({ from: 1, to: 999, name, img });
      return;
    }
    const opt = line.match(/^([-*•✔])\s*(.+)$/);
    if (['poll', 'quiz', 'teamquiz', 'mind'].includes(a.type) && opt) {
      if (a.ox) { if (opt[1] !== '-') a.answer = /^[Oo○]/.test(opt[2]) ? 0 : 1; return; }
      a.options.push(opt[2].trim());
      if (opt[1] !== '-' && opt[1] !== '•' && a.type !== 'poll' && a.type !== 'mind') a.answer = a.options.length - 1;
      return;
    }
    if (a.type === 'bingo') { a.words.push(...splitList(line)); return; }
    if (a.type === 'chosung') {
      const m = line.match(/^(.+?)\s*[=＝]\s*(.+)$/);
      if (m) { a.items.push({ q: m[1].trim(), a: m[2].split(/[\/／]/).map(x => x.trim()).filter(Boolean) }); return; }
    }
    if (!a.title) { a.title = line; return; }
    a.desc = (a.desc ? a.desc + ' ' : '') + line;
  }
  function finalize(a, errors, out) {
    const at = `${a._ln}행 [${typeName(a)}]`;
    if (a.type === 'poll' && a.options.length < 2) errors.push(`${at}: 보기를 2개 이상 "- 보기" 형식으로 적어 주세요`);
    if (a.type === 'mind' && a.options.length < 2) errors.push(`${at}: 보기를 2개 이상 "- 보기" 형식으로 적어 주세요`);
    if (a.type === 'quiz' || a.type === 'teamquiz') {
      if (!a.title) errors.push(`${at}: 문제가 비어 있어요`);
      if (a.ox && a.answer < 0) errors.push(`${at}: 정답을 "문제 / O" 형식으로 적어 주세요`);
      if (!a.ox && a.options.length < 2) errors.push(`${at}: 보기를 2개 이상 적어 주세요`);
      if (!a.ox && a.answer < 0) errors.push(`${at}: 정답 보기 앞에 "-" 대신 "*"를 붙여 주세요`);
    }
    if (a.options && a.options.length > 6) errors.push(`${at}: 보기는 6개까지 가능해요`);
    if (a.type === 'bingo') {
      a.words = [...new Set(a.words)];
      if (a.size < 3 || a.size > 5) errors.push(`${at}: 크기는 3x3~5x5만 가능해요`);
      if (a.words.length < a.size * a.size) errors.push(`${at}: 단어가 ${a.size * a.size}개 이상 필요해요 (지금 ${a.words.length}개, 중복 제외)`);
      if (a.lines < 1 || a.lines > a.size * 2 + 2) errors.push(`${at}: 목표 줄 수가 이상해요`);
    }
    if (a.type === 'chosung' && !a.items.length) errors.push(`${at}: "ㅎㅂㅁ = 정답" 형식으로 문제를 1개 이상 적어 주세요`);
    if (isTeamGame(a) && !out.teams.length) errors.push(`${at}: 팀 게임은 맨 위에 "팀: 1팀, 2팀" 처럼 팀을 정해야 해요`);
    if (a.type === 'rank' && a.scope === 'team' && !out.teams.length) errors.push(`${at}: 팀 순위는 팀이 있어야 해요`);
    if (a.type === 'lottery' && !a.prizes.length && a.title) a.prizes.push({ from: 1, to: 999, name: a.title, img: '' });
    if (!a.title) a.title = typeName(a);
  }

  return { DEMO, EVENT, ROOT, TS, B, vals, esc, hash, rng, shuffle, newId, pageUrl, bingoBoard, bingoLines, bingoWinners, quizPoints, SCORING,
    TEAM_GAMES, isTeamGame, RACE_COUNTDOWN, gameWindow, raceWindow, teamGame, teamGamePoints, teamStandings, hasTeamPoints, chosungOk,
    teamColor, teamEmoji, TEAM_COLORS, totals, ranking, prizeFor, maxPrizeRank, rankSnapshot, prizeList, sectionRange, inSection, quizRanking, sectionScore, sectionInfo, parseContent, TYPE_NAMES, typeName };
})();
