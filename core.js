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
  const SCORING = Object.assign({ correct: 100, speedBonus: 50, teamRace: [100, 60, 30] }, window.SCORING || {});
  // 퀴즈: 정답 100점 + 빨리 맞힐수록 최대 50점 (제한시간 끝에 맞히면 100점, 바로 맞히면 150점)
  function quizPoints(ans, act, st) {
    if (!ans || ans.v !== act.answer || !st || !st.openedAt || !ans.at) return 0;
    const el = Math.max(0, (ans.at - st.openedAt) / 1000);
    if (el > act.duration + 1.5) return 0;
    return Math.round(SCORING.correct + SCORING.speedBonus * Math.max(0, 1 - el / act.duration));
  }
  // 탭 레이스: 3초 카운트다운 후 duration초 동안 진행
  const RACE_COUNTDOWN = 3000;
  function raceWindow(act, st) { const s = (st.openedAt || 0) + RACE_COUNTDOWN; return { start: s, end: s + act.duration * 1000 }; }
  // 팀별 1인당 평균 탭 수 (탭을 1번 이상 한 사람 기준). 팀이 없으면 개인전
  function raceResult(D, idx, act) {
    const players = D.players || {}; const taps = (D.taps || {})[idx] || {};
    const teams = vals(D.content && D.content.teams);
    const agg = {}; teams.forEach(t => { agg[t] = { team: t, sum: 0, n: 0 }; });
    const indiv = [];
    Object.entries(taps).forEach(([pid, c]) => {
      const p = players[pid]; if (!p || !c) return;
      indiv.push({ pid, name: p.name, team: p.team || '', taps: c });
      if (p.team) { agg[p.team] = agg[p.team] || { team: p.team, sum: 0, n: 0 }; agg[p.team].sum += c; agg[p.team].n++; }
    });
    const teamRows = Object.values(agg).map(a => ({ ...a, avg: a.n ? Math.round(a.sum / a.n * 10) / 10 : 0 })).sort((a, b) => b.avg - a.avg);
    indiv.sort((a, b) => b.taps - a.taps);
    return { teams: teamRows, indiv };
  }
  function racePoints(D, idx, act) {
    const r = raceResult(D, idx, act); const pts = {}; const bonus = vals(SCORING.teamRace);
    if (r.teams.length) {
      r.teams.forEach((t, k) => { const b = bonus[k] || 0; if (!b || !t.n) return; r.indiv.forEach(i => { if (i.team === t.team) pts[i.pid] = b; }); });
    } else {
      r.indiv.forEach((i, k) => { if (bonus[k]) pts[i.pid] = bonus[k]; });
    }
    return pts;
  }
  const TEAM_COLORS = ['#ff5a6e', '#4da3ff', '#ffcc4d', '#3ddc97', '#b98cff', '#ff9f43', '#7ee0ff', '#ff8fd0'];
  const TEAM_EMOJI = ['🦊', '🐳', '🐯', '🐸', '🦄', '🐻', '🐧', '🐰'];
  function teamColor(teams, name) { const i = vals(teams).indexOf(name); return i < 0 ? '#a6acd6' : TEAM_COLORS[i % TEAM_COLORS.length]; }
  function teamEmoji(teams, name) { const i = vals(teams).indexOf(name); return i < 0 ? '🏃' : TEAM_EMOJI[i % TEAM_EMOJI.length]; }
  function totals(points) {
    const t = {};
    if (points) for (const idx in points) { const m = points[idx] || {}; for (const pid in m) t[pid] = (t[pid] || 0) + (m[pid] || 0); }
    return t;
  }
  function ranking(players, points) {
    const t = totals(points);
    return Object.entries(players || {}).map(([pid, p]) => ({ pid, name: p.name, team: p.team || '', score: t[pid] || 0 }))
      .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)));
  }
  // 팀 점수 = 팀원 평균 (인원 차이 보정)
  function teamRanking(players, points, teams) {
    const t = totals(points); const agg = {};
    (teams || []).forEach(n => { agg[n] = { team: n, sum: 0, n: 0 }; });
    Object.entries(players || {}).forEach(([pid, p]) => { if (!p.team) return; agg[p.team] = agg[p.team] || { team: p.team, sum: 0, n: 0 }; agg[p.team].sum += t[pid] || 0; agg[p.team].n++; });
    return Object.values(agg).map(a => ({ ...a, avg: a.n ? Math.round(a.sum / a.n) : 0 })).sort((a, b) => b.avg - a.avg);
  }

  // ---------- 콘텐츠 해석 ----------
  const TYPE_NAMES = { poll: '투표', quiz: '퀴즈', wordcloud: '워드클라우드', bingo: '빙고', lottery: '추첨', rank: '순위', race: '탭 레이스' };
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
    out.activities.forEach(a => finalize(a, errors));
    out.activities.forEach(a => { delete a._ln; });
    return { content: out, errors };
  }
  function newAct(tag, rest, ln, errors) {
    const kind = tag.split(/\s+/)[0];
    const num = re => { const m = tag.match(re); return m ? parseInt(m[1], 10) : null; };
    const a = { _ln: ln, title: rest };
    if (/^투표$/.test(kind)) a.type = 'poll';
    else if (/^퀴즈$/.test(kind)) a.type = 'quiz';
    else if (/^ox$/i.test(kind)) { a.type = 'quiz'; a.ox = true; }
    else if (/^(워드클라우드|단어)$/.test(kind)) a.type = 'wordcloud';
    else if (/^빙고$/.test(kind)) a.type = 'bingo';
    else if (/^(추첨|경품)$/.test(kind)) a.type = 'lottery';
    else if (/^(순위|랭킹)$/.test(kind)) a.type = 'rank';
    else if (/^(탭레이스|탭|팀대항|레이스)$/.test(kind)) { a.type = 'race'; a.duration = num(/(\d+)\s*초/) || 10; }
    else { errors.push(`${ln}행: [${tag}] — 알 수 없는 종류예요 (투표/퀴즈/OX/워드클라우드/빙고/추첨/순위/탭레이스)`); return { type: '_bad' }; }
    if (a.type === 'quiz') { a.duration = num(/(\d+)\s*초/) || (a.ox ? 10 : 20); a.options = a.ox ? ['O', 'X'] : []; a.answer = -1; }
    if (a.type === 'poll') a.options = [];
    if (a.type === 'bingo') { a.size = num(/(\d)\s*[x×X*]\s*\d/) || 5; a.lines = num(/(\d+)\s*줄/) || (a.size <= 3 ? 1 : 3); a.words = []; }
    if (a.type === 'lottery') a.count = num(/(\d+)\s*명/) || 1;
    if (a.ox) {
      const m = rest.match(/^(.*?)\s*[\/／]\s*([OoXx○×])\s*$/);
      if (m) { a.title = m[1].trim(); a.answer = /[Oo○]/.test(m[2]) ? 0 : 1; }
    }
    return a;
  }
  function addBody(a, line, ln, errors) {
    if (a.type === '_bad') return;
    const opt = line.match(/^([-*•✔])\s*(.+)$/);
    if ((a.type === 'poll' || a.type === 'quiz') && opt) {
      if (a.ox) { if (opt[1] !== '-') a.answer = /^[Oo○]/.test(opt[2]) ? 0 : 1; return; }
      a.options.push(opt[2].trim());
      if (opt[1] !== '-' && opt[1] !== '•') a.answer = a.options.length - 1;
      return;
    }
    if (a.type === 'bingo') { a.words.push(...splitList(line)); return; }
    if (!a.title) { a.title = line; return; }
    a.desc = (a.desc ? a.desc + ' ' : '') + line;
  }
  function finalize(a, errors) {
    const at = `${a._ln}행 [${TYPE_NAMES[a.type]}]`;
    if (a.type === 'poll' && a.options.length < 2) errors.push(`${at}: 보기를 2개 이상 "- 보기" 형식으로 적어 주세요`);
    if (a.type === 'quiz') {
      if (!a.title) errors.push(`${at}: 문제가 비어 있어요`);
      if (a.ox && a.answer < 0) errors.push(`${at}: 정답을 "문제 / O" 형식으로 적어 주세요`);
      if (!a.ox && a.options.length < 2) errors.push(`${at}: 보기를 2개 이상 적어 주세요`);
      if (!a.ox && a.answer < 0) errors.push(`${at}: 정답 보기 앞에 "-" 대신 "*"를 붙여 주세요`);
      if (a.options.length > 6) errors.push(`${at}: 보기는 6개까지 가능해요`);
    }
    if (a.type === 'bingo') {
      a.words = [...new Set(a.words)];
      if (a.size < 3 || a.size > 5) errors.push(`${at}: 크기는 3x3~5x5만 가능해요`);
      if (a.words.length < a.size * a.size) errors.push(`${at}: 단어가 ${a.size * a.size}개 이상 필요해요 (지금 ${a.words.length}개, 중복 제외)`);
      if (a.lines < 1 || a.lines > a.size * 2 + 2) errors.push(`${at}: 목표 줄 수가 이상해요`);
    }
    if (!a.title) a.title = TYPE_NAMES[a.type];
  }

  return { DEMO, EVENT, ROOT, TS, B, vals, esc, hash, rng, shuffle, newId, pageUrl, bingoBoard, bingoLines, bingoWinners, quizPoints, SCORING, RACE_COUNTDOWN, raceWindow, raceResult, racePoints, teamColor, teamEmoji, TEAM_COLORS, totals, ranking, teamRanking, parseContent, TYPE_NAMES };
})();
