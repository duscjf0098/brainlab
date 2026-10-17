/* 수집 서버 시험용: 그럴듯한 가짜 결과 N개를 /submit 으로 보낸다. 실제 자료와 섞이지 않게 norms 를 'fake-test' 로 표시한다.
   node tools/fake-submit.cjs <서버 주소> [N=35] [mode=adaptive|quick|full|mix]
   보낸 뒤 지우기(배포 서버): server 폴더에서
   npx wrangler d1 execute brainlab-stats --remote --command "DELETE FROM task_rows WHERE sid IN (SELECT sid FROM submissions WHERE norms='fake-test'); DELETE FROM submissions WHERE norms='fake-test'"
   빈도 제한(IP당 60초 20회)에 걸리면(429) 기다렸다가 다시 보낸다. */
const base = (process.argv[2] || '').replace(/\/+$/, '');
const N = Number(process.argv[3] || 35);
const MODE = process.argv[4] || 'adaptive';
if (!base) { console.error('사용법: node tools/fake-submit.cjs <서버 주소> [N] [mode]'); process.exit(1); }

const PROP = { matrix: 6, figAnalogy: 5, series: 3, sequence: 5, weights: 5, analogy: 5, vocab: 5, logic: 5, similar: 5, rotation: 5, fold: 5, blocks: 5 };
const LEVEL_P = { default: { 1: 0.92, 2: 0.80, 3: 0.62, 4: 0.42, 5: 0.25, 6: 0.12 }, rotation: { 1: 0.85, 2: 0.75, 3: 0.60, 4: 0.45, 5: 0.35 }, fold: { 1: 0.88, 2: 0.76, 3: 0.60, 4: 0.45, 5: 0.32 }, blocks: { 1: 0.92, 2: 0.80, 3: 0.64, 4: 0.48, 5: 0.34 }, series: { 1: 0.90, 2: 0.72, 3: 0.50 } };
const SPAN = { digitF: [7.0, 1.1], digitB: [5.2, 1.2], grid: [6.0, 1.1], lns: [5.3, 1.1] };
const RT = { reaction: [280, 45], choicert: [480, 80], stroop: [800, 130] };
const QUICK = ['matrix', 'sequence', 'vocab', 'rotation', 'fold', 'digitB', 'symbol'];

function randn() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r3 = (x) => Math.round(x * 1000) / 1000;
const sid = () => Array.from({ length: 24 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');

function propTask(key, ability, full) {
  const LP = LEVEL_P[key] || LEVEL_P.default, maxL = Object.keys(LP).length;
  const seq = full ? (key === 'matrix' ? [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6] : key === 'series' ? [1, 1, 2, 2, 3, 3] : [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]) : null;
  const n = full ? seq.length : PROP[key];
  const levels = {};
  let level = 3, c = 0;
  for (let i = 0; i < n; i++) {
    const l = full ? seq[i] : level;
    const b = Math.log((1 - LP[l]) / LP[l]);
    const ok = Math.random() < 0.2 + 0.8 / (1 + Math.exp(-(ability - b)));
    levels[l] = levels[l] || { n: 0, c: 0 }; levels[l].n++;
    if (ok) { levels[l].c++; c++; }
    if (!full) level = clamp(level + (ok ? 1 : -1), 1, maxL);
  }
  return { z: r3(clamp(ability + 0.4 * randn(), -3, 3)), n, c, levels, adaptive: !full, rtAvg: Math.round(8 + Math.random() * 20) };
}
function make(mode) {
  const g = randn();
  const ab = () => 0.6 * g + 0.8 * randn();
  const full = mode === 'full';
  const keys = mode === 'quick' ? QUICK : Object.keys(PROP).concat(Object.keys(SPAN), Object.keys(RT), ['symbol']);
  const tasks = {};
  keys.forEach(function (k) {
    const a = ab();
    if (PROP[k]) tasks[k] = propTask(k, a, full);
    else if (SPAN[k]) { const v = clamp(Math.round(SPAN[k][0] + SPAN[k][1] * a), 2, 9); tasks[k] = { z: r3(clamp((v - SPAN[k][0]) / SPAN[k][1], -3, 3)), value: v }; }
    else if (RT[k]) { const touch = Math.random() < 0.3; const v = clamp(Math.round(RT[k][0] + (touch ? 30 : 0) - RT[k][1] * a), 150, 2500); const o = { z: r3(clamp((RT[k][0] + (touch ? 30 : 0) - v) / RT[k][1], -3, 3)), value: v, touch }; if (k !== 'reaction') o.acc = r3(clamp(0.95 + 0.04 * randn(), 0.6, 1)); tasks[k] = o; }
    else { const v = clamp(Math.round(24 + 6 * a), 0, 60); tasks[k] = { z: r3(clamp((v - 24) / 6, -3, 3)), value: v, acc: r3(clamp(0.95 + 0.04 * randn(), 0.6, 1)) }; }
  });
  const zs = Object.values(tasks).map(t => t.z), m = zs.length;
  const overall = r3(clamp(zs.reduce((s, z) => s + z, 0) / Math.sqrt(m * (1 + (m - 1) * 0.25)), -3, 3));
  return { sid: sid(), testId: 'cognitive', mode, timeFactor: 1, at: Date.now(), norms: 'fake-test', overall, tasks };
}
async function post(p) {
  for (let tries = 0; tries < 5; tries++) {
    const res = await fetch(base + '/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }, body: JSON.stringify(p) });
    if (res.status === 429) { const w = Number(res.headers.get('Retry-After') || 60); console.log('429 빈도 제한 · ' + w + '초 기다림'); await new Promise(r => setTimeout(r, (w + 1) * 1000)); continue; }
    return { status: res.status, body: await res.text() };
  }
  return { status: 429, body: 'gave up' };
}
(async function () {
  const modes = ['adaptive', 'quick', 'full'];
  const counts = {};
  for (let i = 0; i < N; i++) {
    const mode = MODE === 'mix' ? modes[i % 3] : MODE;
    const r = await post(make(mode));
    counts[r.status] = (counts[r.status] || 0) + 1;
    if (r.status >= 300) console.log(i + 1, r.status, r.body);
    else if ((i + 1) % 10 === 0 || i === N - 1) console.log((i + 1) + '/' + N + ' 보냄');
  }
  console.log('결과(상태 코드별):', JSON.stringify(counts));
  // 집계는 서버가 담아 둔 값(표본이 적으면 1분마다 갱신). 환경 변수 ADMIN_TOKEN 이 있으면 바로 다시 계산하게 한다.
  const tok = process.env.ADMIN_TOKEN;
  const s = await fetch(base + '/stats' + (tok ? '?fresh=1' : ''), { headers: tok ? { Authorization: 'Bearer ' + tok } : {} }).then(r => r.json());
  if (!tok) console.log('(ADMIN_TOKEN 없이 받은 집계라 최대 1분 늦을 수 있어요)');
  console.log('집계: 표본 ' + s.n + '명, 종합 분포 ' + Object.keys(s.overall).map(m => m + ' n=' + s.overall[m].n + (s.overall[m].q ? ' (백분위 있음)' : ' (표본 부족)')).join(', '));
})().catch(e => { console.error(e); process.exit(1); });