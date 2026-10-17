/* 두뇌실험실 · 익명 응시 통계 수집 서버 (Cloudflare Workers + D1)
   POST /submit   결과 하나 저장. 받는 것: 검사 id, 모드, 과제별 원점수(정답 수/문항 수·단계별 정답 수·기억 폭·반응 시간 중앙값), 시간 설정, 시각.
                  이름·이메일·IP·User-Agent는 받지도 저장하지도 않는다.
   GET  /stats    집계. 과제별·단계별 정답률, 기억 폭·반응 시간 분포, 과제 z·종합 z의 백분위(표본이 MIN_SAMPLE 이상일 때만). 표준 시간(time_factor 1)으로
                  푼 결과만 집계한다. 계산 결과는 D1 stats_cache 에 담아 두고 1시간마다(표본이 MIN_SAMPLE의 2배 미만이면 1분마다) 다시 계산한다.
                  workers.dev 에서는 Cache API가 동작하지 않고, 매번 계산하면 D1 무료 읽기 한도(하루 500만 행)를 금방 쓰기 때문이다.
                  ?fresh=1 + Authorization: Bearer <ADMIN_TOKEN> 이면 바로 다시 계산한다.
   GET  /export   원자료(관리용). Authorization: Bearer <ADMIN_TOKEN>. 토큰은 wrangler secret 으로만 둔다.
   GET  /         상태(받은 결과 수, 집계 시각).
   남용 방지: 본문 크기 제한(MAX_BODY), IP당 요청 빈도 제한(ratelimit 바인딩 — Cloudflare 안의 순간 계수기라 IP가 저장되지 않음),
   전송은 ALLOWED_ORIGINS 에 있는 Origin 만. 값은 모두 범위를 검사한다. */

const TASKS = {
  matrix: 'prop', figAnalogy: 'prop', series: 'prop', sequence: 'prop', weights: 'prop',
  analogy: 'prop', vocab: 'prop', logic: 'prop', similar: 'prop', rotation: 'prop', fold: 'prop', blocks: 'prop',
  digitF: 'span', digitB: 'span', grid: 'span', lns: 'span',
  reaction: 'rt', choicert: 'rt', stroop: 'rt', symbol: 'count'
};
const MODE_RE = /^(adaptive|quick|full|task:[A-Za-z]{1,16})$/;
const SID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const TIME_FACTORS = [0, 1, 1.5];
const STATS_TTL_MS = 60 * 60 * 1000;        // 집계 다시 계산 간격
const STATS_TTL_SMALL_MS = 60 * 1000;       // 표본이 적을 때(계산이 싸다)
const MAX_ROWS = 10000;                     // 집계에 쓰는 최근 결과 수 (한 번 계산에 D1 읽기 ≈ 결과 수 × 21행)

function json(obj, status, extra) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, extra || {}) });
}
function round3(x) { return Math.round(x * 1000) / 1000; }
function num(x, lo, hi) { return typeof x === 'number' && isFinite(x) && x >= lo && x <= hi; }
function allowedOrigins(env) { return String(env.ALLOWED_ORIGINS || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
function corsHeaders(origin, env) {
  const h = { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
  if (origin && allowedOrigins(env).indexOf(origin) >= 0) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
function withHeaders(res, headers) {
  const out = new Response(res.body, res);
  Object.keys(headers).forEach(function (k) { out.headers.set(k, headers[k]); });
  return out;
}
/* 요청 빈도 제한. 바인딩이 없으면(로컬 등) 통과. */
async function limited(binding, request) {
  if (!binding || typeof binding.limit !== 'function') return false;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  try { const r = await binding.limit({ key: ip }); return !r.success; } catch (e) { return false; }
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let res;
    try {
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/stats') && await limited(env.RL_READ, request)) res = json({ error: 'too many requests' }, 429, { 'Retry-After': '60' });
      else if (url.pathname === '/' && request.method === 'GET') res = await status(env);
      else if (url.pathname === '/submit' && request.method === 'POST') res = await submit(request, env, origin);
      else if (url.pathname === '/stats' && request.method === 'GET') res = await stats(request, env, ctx, url);
      else if (url.pathname === '/export' && request.method === 'GET') res = await exportRows(request, env, url);
      else res = json({ error: 'not found' }, 404);
    } catch (e) {
      console.error(e && e.stack || e);
      res = json({ error: 'server error' }, 500);
    }
    return withHeaders(res, cors);
  }
};

/* 상태: MAX(id)는 한 행만 읽는다(지운 결과도 센다). 집계 표본 수는 캐시에서. */
async function status(env) {
  const r = await env.DB.prepare('SELECT MAX(id) AS n FROM submissions').first();
  const c = await env.DB.prepare('SELECT at, n FROM stats_cache WHERE id = 1').first();
  return json({ ok: true, service: 'brainlab-stats', received: r && r.n ? r.n : 0, stats: c ? { n: c.n, generated: c.at } : null });
}
function isAdmin(request, env) {
  return !!env.ADMIN_TOKEN && safeEqual(request.headers.get('Authorization') || '', 'Bearer ' + env.ADMIN_TOKEN);
}

/* ===== 전송 ===== */
async function submit(request, env, origin) {
  if (origin && allowedOrigins(env).indexOf(origin) < 0) return json({ error: 'origin not allowed' }, 403);
  if (await limited(env.RL_SUBMIT, request)) return json({ error: 'too many requests' }, 429, { 'Retry-After': '60' });
  const max = Number(env.MAX_BODY || 16384);
  if (Number(request.headers.get('Content-Length') || 0) > max) return json({ error: 'too large' }, 413);
  const text = await request.text();
  if (text.length > max) return json({ error: 'too large' }, 413);
  let body;
  try { body = JSON.parse(text); } catch (e) { return json({ error: 'bad json' }, 400); }
  const v = validate(body);
  if (v.error) return json({ error: v.error }, 400);
  const rec = v.value;
  const now = Date.now();
  const stmts = [env.DB.prepare('INSERT OR IGNORE INTO submissions (sid, received_at, client_at, test_id, mode, time_factor, norms, overall_z, payload) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
    .bind(rec.sid, now, rec.at, rec.testId, rec.mode, rec.timeFactor, rec.norms, rec.overall, JSON.stringify(rec.tasks))];
  Object.keys(rec.tasks).forEach(function (k) {
    const t = rec.tasks[k];
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO task_rows (sid, task, kind, z, n, c, levels, adaptive, value, acc, touch) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)')
      .bind(rec.sid, k, TASKS[k], t.z, t.n == null ? null : t.n, t.c == null ? null : t.c, t.levels ? JSON.stringify(t.levels) : null,
        t.adaptive == null ? null : (t.adaptive ? 1 : 0), t.value == null ? null : t.value, t.acc == null ? null : t.acc, t.touch == null ? null : (t.touch ? 1 : 0)));
  });
  const r = await env.DB.batch(stmts);
  if (!r[0].meta.changes) return json({ ok: true, dup: true });
  return json({ ok: true }, 201);
}

/* 받은 값의 모양과 범위 검사. 모르는 필드는 버린다. */
function validate(b) {
  if (!b || typeof b !== 'object') return { error: 'bad body' };
  if (b.testId !== 'cognitive') return { error: 'unknown test' };
  if (typeof b.sid !== 'string' || !SID_RE.test(b.sid)) return { error: 'bad sid' };
  if (typeof b.mode !== 'string' || !MODE_RE.test(b.mode)) return { error: 'bad mode' };
  if (b.mode.indexOf('task:') === 0 && !TASKS[b.mode.slice(5)]) return { error: 'bad mode' };
  const tf = b.timeFactor == null ? 1 : b.timeFactor;
  if (TIME_FACTORS.indexOf(tf) < 0) return { error: 'bad timeFactor' };
  const now = Date.now();
  const at = num(b.at, now - 30 * 864e5, now + 864e5) ? Math.round(b.at) : now;
  const norms = typeof b.norms === 'string' && b.norms.length <= 40 && /^[\w.-]+$/.test(b.norms) ? b.norms : null;
  const overall = num(b.overall, -3, 3) ? round3(b.overall) : null;
  if (!b.tasks || typeof b.tasks !== 'object') return { error: 'no tasks' };
  const keys = Object.keys(b.tasks);
  if (!keys.length || keys.length > 20) return { error: 'bad tasks' };
  const tasks = {};
  for (const k of keys) {
    const kind = TASKS[k];
    if (!kind) return { error: 'unknown task ' + k };
    const t = b.tasks[k];
    if (!t || typeof t !== 'object' || !num(t.z, -3, 3)) return { error: 'bad task ' + k };
    const o = { z: round3(t.z) };
    if (kind === 'prop') {
      if (!num(t.n, 1, 60) || !num(t.c, 0, 60) || t.c > t.n || t.n % 1 || t.c % 1) return { error: 'bad counts ' + k };
      o.n = t.n; o.c = t.c; o.adaptive = !!t.adaptive;
      if (t.levels && typeof t.levels === 'object') {
        o.levels = {};
        let sumN = 0, sumC = 0;
        for (const l of Object.keys(t.levels)) {
          const x = t.levels[l];
          if (!/^[1-6]$/.test(l) || !x || !num(x.n, 0, 60) || !num(x.c, 0, 60) || x.c > x.n || x.n % 1 || x.c % 1) return { error: 'bad level ' + k };
          o.levels[l] = { n: x.n, c: x.c }; sumN += x.n; sumC += x.c;
        }
        if (sumN > t.n || sumC > t.c) return { error: 'bad level sum ' + k };
      }
      if (num(t.rtAvg, 0, 600)) o.rtAvg = Math.round(t.rtAvg);
    } else if (kind === 'span') {
      if (!num(t.value, 0, 12) || t.value % 1) return { error: 'bad span ' + k };
      o.value = t.value;
    } else if (kind === 'rt') {
      if (!num(t.value, 50, 10000)) return { error: 'bad rt ' + k };
      o.value = Math.round(t.value);
      if (num(t.acc, 0, 1)) o.acc = round3(t.acc);
      o.touch = !!t.touch;
    } else {
      if (!num(t.value, 0, 120) || t.value % 1) return { error: 'bad count ' + k };
      o.value = t.value;
      if (num(t.acc, 0, 1)) o.acc = round3(t.acc);
    }
    tasks[k] = o;
  }
  return { value: { sid: b.sid, testId: 'cognitive', mode: b.mode, timeFactor: tf, at: at, norms: norms, overall: overall, tasks: tasks } };
}

/* ===== 집계 ===== */
async function stats(request, env, ctx, url) {
  const minN = Number(env.MIN_SAMPLE || 30);
  const now = Date.now();
  const fresh = url.searchParams.get('fresh') && isAdmin(request, env);
  const c = fresh ? null : await env.DB.prepare('SELECT at, n, body FROM stats_cache WHERE id = 1').first();
  const ttl = c && c.n >= 2 * minN ? STATS_TTL_MS : STATS_TTL_SMALL_MS;
  let body;
  if (c && now - c.at < ttl) body = c.body;
  else {
    const agg = await aggregate(env);
    body = JSON.stringify(agg);
    ctx.waitUntil(env.DB.prepare('INSERT OR REPLACE INTO stats_cache (id, at, n, body) VALUES (1, ?1, ?2, ?3)').bind(agg.generated, agg.n, body).run());
  }
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}

function sorted(arr) { return arr.slice().sort(function (a, b) { return a - b; }); }
function moments(arr) {
  const n = arr.length;
  if (!n) return { n: 0, mean: null, sd: null };
  const mean = arr.reduce(function (s, v) { return s + v; }, 0) / n;
  const sd = n > 1 ? Math.sqrt(arr.reduce(function (s, v) { return s + (v - mean) * (v - mean); }, 0) / (n - 1)) : null;
  return { n: n, mean: round3(mean), sd: sd == null ? null : round3(sd) };
}
/* 0, 1, …, 100 백분위의 값 101개 (선형 보간) */
function quantiles(arr) {
  const a = sorted(arr), out = [];
  if (!a.length) return null;
  for (let p = 0; p <= 100; p++) {
    const pos = (a.length - 1) * p / 100, lo = Math.floor(pos), hi = Math.ceil(pos);
    out.push(round3(a[lo] + (a[hi] - a[lo]) * (pos - lo)));
  }
  return out;
}
function dist(arr, minN) {
  const m = moments(arr);
  m.q = arr.length >= minN ? quantiles(arr) : null;
  return m;
}
function hist(arr, lo, hi, bins) {
  const out = new Array(bins).fill(0);
  arr.forEach(function (v) { const i = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / (hi - lo) * bins))); out[i]++; });
  return out;
}
function countBy(arr) { const o = {}; arr.forEach(function (v) { o[v] = (o[v] || 0) + 1; }); return o; }

async function aggregate(env) {
  const minN = Number(env.MIN_SAMPLE || 30);
  const subs = (await env.DB.prepare('SELECT sid, mode, time_factor, overall_z FROM submissions WHERE test_id = ?1 ORDER BY received_at DESC LIMIT ?2').bind('cognitive', MAX_ROWS).all()).results;
  const std = {};
  let excluded = 0;
  subs.forEach(function (s) { if (s.time_factor == null || s.time_factor === 1) std[s.sid] = s; else excluded++; });
  const rows = (await env.DB.prepare('SELECT t.sid, t.task, t.z, t.n, t.c, t.levels, t.adaptive, t.value, t.acc, t.touch FROM task_rows t JOIN submissions s ON s.sid = t.sid WHERE s.test_id = ?1 ORDER BY s.received_at DESC LIMIT ?2').bind('cognitive', MAX_ROWS * 20).all()).results;
  const out = { generated: Date.now(), testId: 'cognitive', minSample: minN, n: Object.keys(std).length, excludedNonStandardTime: excluded, overall: {}, tasks: {} };
  const overall = {};
  Object.keys(std).forEach(function (sid) {
    const s = std[sid];
    if (s.overall_z == null || !/^(adaptive|quick|full)$/.test(s.mode)) return;
    (overall[s.mode] = overall[s.mode] || []).push(s.overall_z);
  });
  Object.keys(overall).forEach(function (m) { out.overall[m] = dist(overall[m], minN); });
  const byTask = {};
  rows.forEach(function (r) { if (std[r.sid]) (byTask[r.task] = byTask[r.task] || []).push(r); });
  Object.keys(TASKS).forEach(function (k) {
    const list = byTask[k] || [], kind = TASKS[k];
    const t = { kind: kind, n: list.length, z: dist(list.map(function (r) { return r.z; }), minN) };
    if (kind === 'prop') {
      let items = 0, correct = 0;
      const levels = {}, props = [], zA = [], zF = [];
      list.forEach(function (r) {
        items += r.n; correct += r.c; props.push(r.c / r.n); (r.adaptive ? zA : zF).push(r.z);
        if (!r.levels) return;
        const lv = JSON.parse(r.levels);
        Object.keys(lv).forEach(function (l) {
          const e = levels[l] = levels[l] || { n: 0, c: 0, nFull: 0, cFull: 0 };
          e.n += lv[l].n; e.c += lv[l].c;
          if (!r.adaptive) { e.nFull += lv[l].n; e.cFull += lv[l].c; }
        });
      });
      Object.keys(levels).forEach(function (l) { const e = levels[l]; e.p = e.n ? round3(e.c / e.n) : null; e.pFull = e.nFull ? round3(e.cFull / e.nFull) : null; });
      t.items = items; t.correct = correct; t.p = items ? round3(correct / items) : null; t.levels = levels;
      t.prop = moments(props); t.propHist = hist(props, 0, 1.0001, 10);
      t.zByMode = { adaptive: moments(zA), full: moments(zF) };
    } else if (kind === 'span' || kind === 'count') {
      const vals = list.map(function (r) { return r.value; });
      t.value = Object.assign(moments(vals), { counts: countBy(vals) });
      if (kind === 'count') t.acc = moments(list.map(function (r) { return r.acc; }).filter(function (x) { return x != null; }));
    } else {
      const all = list.map(function (r) { return r.value; });
      t.value = { all: moments(all), mouse: moments(list.filter(function (r) { return !r.touch; }).map(function (r) { return r.value; })),
        touch: moments(list.filter(function (r) { return r.touch; }).map(function (r) { return r.value; })), q: all.length >= minN ? quantiles(all) : null, hist: hist(all, 100, 2000, 19) };
      t.acc = moments(list.map(function (r) { return r.acc; }).filter(function (x) { return x != null; }));
    }
    out.tasks[k] = t;
  });
  return out;
}

/* ===== 원자료 (관리용) ===== */
async function exportRows(request, env, url) {
  if (!env.ADMIN_TOKEN) return json({ error: 'not found' }, 404);
  if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401);
  const after = Number(url.searchParams.get('after') || 0) || 0;
  const limit = Math.min(2000, Math.max(1, Number(url.searchParams.get('limit') || 1000) || 1000));
  const rows = (await env.DB.prepare('SELECT id, sid, received_at, client_at, test_id, mode, time_factor, norms, overall_z, payload FROM submissions WHERE id > ?1 ORDER BY id LIMIT ?2').bind(after, limit).all()).results;
  rows.forEach(function (r) { try { r.tasks = JSON.parse(r.payload); } catch (e) { r.tasks = null; } delete r.payload; });
  return json({ rows: rows, next: rows.length === limit ? rows[rows.length - 1].id : null });
}