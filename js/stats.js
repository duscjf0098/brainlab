/* 익명 응시 통계 (2026-10-18). 인지 능력 검사 결과의 과제별 원점수를 익명으로 수집 서버(server/, Cloudflare Workers + D1)에 보내고,
   집계를 받아 결과 화면에 "실제 응시자 n명 기준 상위 %"를 보여 준다.
   - 보내는 것: 검사 id, 모드, 시간 설정, 터치/마우스, 기준값 버전, 종합 z, 과제별 { z, 정답 수·문항 수, 단계별 정답 수, 적응형 여부,
     문항마다 [풀 번호(생성 문항은 -1), 단계, 정답 여부, 응답 시간], 기억 폭, 반응 시간 중앙값, 정확도, 터치 여부 } (cognitive.js taskStats 의 obs).
     이름·연락처·IP·기기 식별자·정확한 시각·문항 내용은 보내지 않는다(날짜는 서버가 일 단위로만 붙인다).
     sid 는 결과마다 새로 만드는 무작위 값으로, 같은 결과를 두 번 보내는 것만 막는다.
   - 참여가 기본값이고, 첫 결과 화면과 안내 페이지의 스위치로 끌 수 있다(localStorage bl.stats.share = false).
   - 보내기는 큐(bl.stats.queue)에 넣고 결과 화면에서(처음 안내가 보이면 8초 뒤) 또는 다음 방문 때 보낸다. 실패(429, 5xx)하면 큐에 남겨 다시 보낸다.
   - BL_CONFIG.statsUrl 이 비어 있으면 아무것도 하지 않는다(안내·스위치·실제 응시자 줄도 나오지 않음). */
(function () {
  const U = BL.util;
  const BASE = String((window.BL_CONFIG && window.BL_CONFIG.statsUrl) || '').replace(/\/+$/, '');
  const OPT_KEY = 'bl.stats.share', NOTICE_KEY = 'bl.stats.noticed', QUEUE_KEY = 'bl.stats.queue', CACHE_KEY = 'bl.stats.cache';
  const CACHE_MS = 10 * 60 * 1000, QUEUE_MAX = 10, MIN_N = 30;
  function available() { return !!BASE; }
  function enabled() { return available() && U.store.get(OPT_KEY, true) !== false; }
  function setEnabled(v) { U.store.set(OPT_KEY, !!v); if (!v) U.store.remove(QUEUE_KEY); }
  function noticed() { return U.store.get(NOTICE_KEY, false) === true; }
  function markNoticed() { U.store.set(NOTICE_KEY, true); }
  function newId() {
    const a = new Uint8Array(12);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(a, function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
  }
  /* 결과의 모드 → 비교할 집단. 과제별 검사는 그 과제 분포, 그 밖은 같은 모드로 푼 사람들의 종합 점수 분포 */
  function modeKind(mode) {
    if (typeof mode === 'string' && mode.indexOf('task:') === 0) return 'task';
    return mode === 'quick' || mode === 'full' ? mode : 'adaptive';
  }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  /* 결과 객체 → 보낼 내용. 인지 검사 결과(tasks[k].z + obs)만. obs 가 없는 과제(예전 결과·측정 안 됨)는 뺀다. 종합 프로필(coverage)은 이미 보낸 결과의 조합이라 안 보낸다. */
  function payloadOf(result) {
    if (!result || result.testId !== 'cognitive' || !result.tasks || result.coverage) return null;
    const tasks = {};
    Object.keys(result.tasks).forEach(function (k) {
      const t = result.tasks[k];
      if (!t || typeof t.z !== 'number' || !t.obs) return;
      tasks[k] = Object.assign({ z: r3(t.z) }, t.obs);
    });
    if (!Object.keys(tasks).length) return null;
    const p = { sid: result.sid || newId(), testId: 'cognitive', mode: typeof result.mode === 'string' ? result.mode : 'adaptive',
      timeFactor: typeof result.timeFactor === 'number' ? result.timeFactor : 1, tasks: tasks };
    const dev = device();
    if (dev) p.device = dev;
    if (typeof result.norms === 'string') p.norms = result.norms;
    if (typeof result.z === 'number') p.overall = r3(result.z);
    return p;
  }
  /* 입력 방식(터치/마우스)만. 반응 시간 기준값을 나눠 보는 데 쓴다. 기기 종류·모델은 보지 않는다. */
  function device() {
    try { return window.matchMedia ? (matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse') : null; } catch (e) { return null; }
  }
  /* 결과를 낸 기준값에 반영된 실제 응시자 수. 버전 이름 'data-<날짜>-n<명>'에서 읽는다. 설계값('design-…')이면 0. */
  function normsN(version) { const m = /-n(\d+)$/.exec(String(version || '')); return m ? Number(m[1]) : 0; }
  function queue() { const q = U.store.get(QUEUE_KEY, []); return Array.isArray(q) ? q : []; }
  function enqueue(result) {
    if (!enabled()) return false;
    const p = payloadOf(result);
    if (!p) return false;
    const q = queue().filter(function (x) { return x.sid !== p.sid; });
    q.push(p);
    U.store.set(QUEUE_KEY, q.slice(-QUEUE_MAX));
    return true;
  }
  let sending = null;
  function flush() {
    if (!enabled()) return Promise.resolve();
    if (sending) return sending;
    const q = queue();
    if (!q.length) return Promise.resolve();
    U.store.set(QUEUE_KEY, []);
    sending = q.reduce(function (pr, p) { return pr.then(function () { return send(p); }); }, Promise.resolve())
      .then(function () { sending = null; }, function () { sending = null; });
    return sending;
  }
  function requeue(p) {
    if (!enabled()) return;
    const q = queue().filter(function (x) { return x.sid !== p.sid; });
    q.push(p);
    U.store.set(QUEUE_KEY, q.slice(-QUEUE_MAX));
  }
  function send(p) {
    if (typeof fetch !== 'function') return Promise.resolve();
    return fetch(BASE + '/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p), keepalive: true })
      .then(function (res) {
        // 400(모양이 틀림)·403(허용되지 않은 출처)·413(너무 큼)은 다시 보내도 같으니 버린다. 그 밖(429, 5xx)은 큐에 남긴다.
        if (res.ok || res.status === 400 || res.status === 403 || res.status === 413) return;
        throw new Error('status ' + res.status);
      })
      .catch(function () { requeue(p); });
  }
  /* 집계 받기 (sessionStorage 10분 캐시). 실패하면 null. */
  function get() {
    if (!available() || typeof fetch !== 'function') return Promise.resolve(null);
    const c = U.sstore.get(CACHE_KEY, null);
    if (c && c.at && Date.now() - c.at < CACHE_MS && c.data) return Promise.resolve(c.data);
    return fetch(BASE + '/stats').then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(function (data) { U.sstore.set(CACHE_KEY, { at: Date.now(), data: data }); return data; })
      .catch(function () { return null; });
  }
  /* z 가 분포(q: 0~100 백분위 값 101개, n: 표본 수)에서 상위 몇 %인지. 같은 값은 가운데 등수. 표본이 MIN_N 미만이면 null. */
  function topPct(z, dist) {
    if (typeof z !== 'number' || !dist || !dist.q || dist.q.length < 2 || !(dist.n >= MIN_N)) return null;
    let below = 0, equal = 0;
    dist.q.forEach(function (v) { if (v < z) below++; else if (v === z) equal++; });
    const pct = (below + equal / 2) / (dist.q.length - 1) * 100;   // 나보다 낮은 사람의 비율
    return { n: dist.n, top: U.clamp(Math.round(100 - pct), 1, 99) };
  }
  BL.stats = { available: available, enabled: enabled, setEnabled: setEnabled, noticed: noticed, markNoticed: markNoticed, newId: newId, modeKind: modeKind,
    payloadOf: payloadOf, enqueue: enqueue, flush: flush, get: get, topPct: topPct, normsN: normsN, MIN_N: MIN_N };
})();