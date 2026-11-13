/* 익명 응시 통계 (2026-10-18). 인지 능력 검사 결과의 과제별 원점수를 익명으로 수집 서버(server/, Cloudflare Workers + D1)에 보내고,
   집계를 받아 결과 화면에 "실제 응시자 n명 기준 상위 %"를 보여 준다.
   - 보내는 것: 검사 id, 모드, 시간 설정, 터치/마우스, 기준값 버전, 종합 z, 과제별 { z, 정답 수·문항 수, 단계별 정답 수, 적응형 여부,
     문항마다 [풀 번호(생성 문항은 -1), 단계, 정답 여부, 응답 시간], 기억 폭, 반응 시간 중앙값, 정확도, 터치 여부 } (cognitive.js taskStats 의 obs).
     2026-10-18부터 반응 과제 obs 에 일찍 누름·너무 빨리 누름·다시 시작·화면을 벗어나 다시 잰(away) 횟수와 입력 방식(터치·마우스·키보드)도 붙는다.
     시간 설정(timeFactor)은 제한 시간이 있는 객관식 문항을 푼 결과에만 붙어서(js/app.js finish), 기억·속도 과제만 푼 결과는 1로 간다.
     기억 폭 과제 obs 는 value(최장 폭 정수, 서버가 0~12 정수만 받음) 그대로에 부분 점수(part, 0.5 단위)와 다시 시작 횟수가 붙는다. 서버가 아직 모르는 필드는 버린다.
     측정 안 됨(정확도가 찍기 수준 등)인 과제는 obs 가 없어 보내지 않는다.
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
  /* 끄기를 저장하지 못했을 때(저장 공간이 꽉 참) 이 페이지에서라도 꺼 두는 표시(2026-11-13). sessionStorage 에도 적어 새로고침 뒤에도 이어 간다. */
  let offMem = false;
  function enabled() { return available() && !offMem && U.sstore.get(OPT_KEY, true) !== false && U.store.get(OPT_KEY, true) !== false; }
  /* 끌 때는 큐부터 지워 자리를 만든 뒤 꺼짐을 쓴다(2026-11-13). 예전에는 꺼짐을 먼저 썼는데, 저장 공간이 꽉 차 있으면 그 쓰기가 조용히
     실패해서 스위치는 꺼진 것처럼 보여도 다음 방문에 다시 켜지고 남은 큐를 보냈다. 돌려주는 값 = 설정을 저장했는지(못 했으면 이번 방문 동안만 꺼짐). */
  function setEnabled(v) {
    if (!v) U.store.remove(QUEUE_KEY);
    let ok = U.store.set(OPT_KEY, !!v);
    if (!ok && v) { U.store.remove(OPT_KEY); ok = U.store.get(OPT_KEY, true) !== false; }   // 켜기는 값을 지워도 된다(없으면 참여)
    offMem = !v && !ok;
    if (offMem) U.sstore.set(OPT_KEY, false); else U.sstore.remove(OPT_KEY);
    return ok;
  }
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
    // 측정 안 된 과제를 빼고 낸 종합 z는 같은 모드의 다른 결과와 과제 구성이 달라 보내지 않는다
    if (typeof result.z === 'number' && !(result.invalidTasks && result.invalidTasks.length)) p.overall = r3(result.z);
    return p;
  }
  /* 입력 방식(터치/마우스)만. 반응 시간 기준값을 나눠 보는 데 쓴다. 기기 종류·모델은 보지 않는다. */
  function device() {
    try { return window.matchMedia ? (matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse') : null; } catch (e) { return null; }
  }
  /* 결과를 낸 기준값에 반영된 실제 응시자 수. 버전 이름 'data-<날짜>-n<명>'에서 읽는다. 실제 자료가 아닌 판(설계값 'design-…', AI 추정값 'ai-est-…' 등)이면 0. */
  function normsN(version) { const m = /-n(\d+)$/.exec(String(version || '')); return m ? Number(m[1]) : 0; }
  // 객체가 아닌 항목(null 등)은 거른다(2026-11-13): 저장소가 어긋나 있으면 enqueue 가 예외를 던져 검사 끝내기가 멈췄다
  function queue() { const q = U.store.get(QUEUE_KEY, []); return Array.isArray(q) ? q.filter(function (x) { return x && typeof x === 'object'; }) : []; }
  function enqueue(result) {
    if (!enabled()) return false;
    const p = payloadOf(result);
    if (!p) return false;
    const q = queue().filter(function (x) { return x.sid !== p.sid; });
    q.push(p);
    U.store.set(QUEUE_KEY, q.slice(-QUEUE_MAX));
    return true;
  }
  /* 큐는 보내기 전에 비우지 않고, 보낸 것(또는 다시 보내도 소용없는 것)만 하나씩 지운다(2026-11-13). 예전에는 보내기 전에 큐를 통째로 비워서,
     차례로 보내는 도중에 창을 닫으면 아직 안 보낸 결과가 사라졌다. 두 탭이 같은 결과를 함께 보내도 서버가 sid 로 한 번만 받는다. */
  let sending = null;
  function flush() {
    if (!enabled()) return Promise.resolve();
    if (sending) return sending;
    const q = queue();
    if (!q.length) return Promise.resolve();
    // 보내는 도중에 참여를 끄면 남은 것은 보내지 않는다
    sending = q.reduce(function (pr, p) { return pr.then(function () { return enabled() ? send(p) : null; }); }, Promise.resolve())
      .then(function () { sending = null; }, function () { sending = null; });
    return sending;
  }
  function drop(sid) { U.store.set(QUEUE_KEY, queue().filter(function (x) { return x && x.sid !== sid; })); }
  function send(p) {
    if (typeof fetch !== 'function') return Promise.resolve();
    return fetch(BASE + '/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p), keepalive: true })
      .then(function (res) {
        // 400(모양이 틀림)·403(허용되지 않은 출처)·413(너무 큼)은 다시 보내도 같으니 큐에서 지운다. 그 밖(429, 5xx, 네트워크)은 큐에 그대로 둔다.
        if (res.ok || res.status === 400 || res.status === 403 || res.status === 413) drop(p && p.sid);
      })
      .catch(function () { });
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