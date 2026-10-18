/* 수집 서버 시험용: 그럴듯한 가짜 결과 N개를 /submit 으로 보낸다. 실제 자료와 섞이지 않게 norms 를 'fake-test' 로 표시한다.
   node tools/fake-submit.cjs <서버 주소> [N=35] [mode=adaptive|quick|full|mix]   (--dry: 보내지 않고 한 명분 내용만 출력)
   가상 응시자는 cognitive.js 엔진을 그대로 쓴다(tools/cognitive-model.cjs): build 로 문항을 만들고, 적응형은 adaptNext·adaptRecord 로 진행하고,
   score 로 채점해 사이트(js/stats.js payloadOf)와 같은 모양으로 보낸다. 정답 확률은 점수 계산과 같은 모형 c + (1 − c)·σ(θ − b),
   b = ln((1 − p)/p), p = LEVEL_P, c = 1/보기 수. 그래서 LEVEL_P·문항 풀·LEVELS 가 바뀌어도 이 파일을 고칠 필요가 없다.
   기억 폭·반응·기호 찾기 답은 2026-10-18 렌더러와 같은 꼴(폭 { best, log, restarts }, 단순 반응 { times, … }, 선택·색-단어 { trials, … })로 만들어
   지금 채점 경로(폭 부분 점수, 실수 감점, 시행 수)를 그대로 탄다. 예전 꼴(숫자·배열)도 엔진이 받지만 예전 채점으로 간다.
   보낸 뒤 지우기(배포 서버): server 폴더에서
   npx wrangler d1 execute brainlab-stats --remote --command "DELETE FROM task_rows WHERE sid IN (SELECT sid FROM submissions WHERE norms='fake-test'); DELETE FROM submissions WHERE norms='fake-test'"
   빈도 제한·전송 상한(429)에 걸리면 기다렸다가 다시 보낸다. 환경 변수 ADMIN_TOKEN 이 있으면 끝에 집계를 바로 다시 계산하게 한다. */
const model = require('./cognitive-model.cjs');
const args = process.argv.slice(2).filter(function (a) { return a !== '--dry'; });
const DRY = process.argv.indexOf('--dry') >= 0;
const base = (args[0] || '').replace(/\/+$/, '');
const N = Number(args[1] || 35);
const MODE = args[2] || 'adaptive';
if (require.main === module && !base && !DRY) { console.error('사용법: node tools/fake-submit.cjs <서버 주소> [N] [mode] [--dry]'); process.exit(1); }

const M = model.load();
const T = M.test;
function randn() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
const r3 = function (x) { return Math.round(x * 1000) / 1000; };
const rint = function (lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); };
const sid = function () { return Array.from({ length: 24 }, function () { return '0123456789abcdef'[Math.floor(Math.random() * 16)]; }).join(''); };

/* 한 문항의 답 만들기. a = 그 과제의 능력(z), touch = 터치 응시자 */
function answerFor(it, a, touch) {
  const norm = M.NORMS[it.part] || {};
  if (it.type === 'choice') {
    const n = (it.options || it.optionsHtml).length, c = 1 / n, p = M.lp(it.part, it.level);
    const P = p == null ? 0.6 : c + (1 - c) / (1 + Math.exp(-(a - Math.log((1 - p) / p))));
    if (Math.random() < P) return it.answer;
    return Math.random() < 0.05 ? null : (it.answer + rint(1, n - 1)) % n;   // 5%는 시간 초과
  }
  /* 기억 폭: 시행 하나의 정답 확률 σ((μ − 길이)/0.55), 맞히면 한 길이 늘리고 같은 길이를 두 번 틀리면 끝(렌더러 진행 규칙). μ는 최장 폭이 NORMS 근처가 되게 둔 값 */
  if (it.type === 'digitspan' || it.type === 'gridspan' || it.type === 'seqspan') {
    const mu = norm.mean + 0.1 + 0.78 * norm.sd * a, log = [];
    let len = it.start, fails = 0, best = it.start - 1;
    while (len <= it.max && fails < 2) { const ok = Math.random() < 1 / (1 + Math.exp((len - mu) / 0.55)); log.push([len, ok ? 1 : 0]); if (ok) { best = len; fails = 0; len += 1; } else fails += 1; }
    return { best: best, log: log, restarts: 0 };
  }
  if (it.type === 'symsearch') return { correct: clamp(Math.round(norm.mean + norm.sd * a) + rint(0, 1), 0, 60), wrong: rint(0, 2), fast: 0, pauses: 0, restarts: 0 };
  const inp = touch ? 't' : 'm', mean = norm.mean + (touch ? 30 : 0), rt = function () { return Math.max(150, Math.round(mean - norm.sd * a + norm.sd * 0.5 * randn())); };
  if (it.type === 'reaction') { const n = it.trials || 10; return { times: Array.from({ length: n }, rt), touch: touch ? n : 0, mouse: touch ? 0 : n, early: 0, slow: 0, away: 0, restarts: 0 }; }
  if (it.type === 'choicert') { const out = []; for (let i = 0; i < (it.trials || 16); i++) out.push({ rt: rt(), ok: Math.random() < 0.95, touch: touch, inp: inp }); return { trials: out, fast: 0, slow: 0, away: 0, restarts: 0 }; }
  if (it.type === 'stroop') { const out = []; for (let i = 0; i < (it.trials || 32); i++) { const cong = i % 2 === 0; out.push({ rt: rt() - (cong ? 120 : 0), ok: Math.random() < 0.93, cong: cong, touch: touch, inp: inp }); } return { trials: out, fast: 0, slow: 0, away: 0, restarts: 0 }; }
  return null;
}
/* 가상 응시자 한 명: 공통 능력 g + 과제마다 고유 몫 */
function make(mode) {
  const g = randn(), ab = {}, touch = Math.random() < 0.6;
  const abil = function (k) { if (ab[k] == null) ab[k] = 0.6 * g + 0.8 * randn(); return ab[k]; };
  const items = T.build(mode, { practice: false }), answers = [], times = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.type === 'adaptive') { const nx = T.adaptNext(it); if (nx) { items.splice(i, 0, nx); i -= 1; } continue; }
    if (!it.scored) continue;
    answers[i] = answerFor(it, abil(it.part), touch);
    times[i] = it.type === 'choice' ? rint(4000, 30000) : undefined;
    if (it.adaptive) T.adaptRecord(items[i + 1], it, answers[i]);
  }
  const res = T.score(answers, items, { times: times, mode: mode });
  const tasks = {};
  Object.keys(res.tasks).forEach(function (k) { const t = res.tasks[k]; if (t && typeof t.z === 'number' && t.obs) tasks[k] = Object.assign({ z: r3(t.z) }, t.obs); });
  return { sid: sid(), testId: 'cognitive', mode: mode, timeFactor: 1, device: touch ? 'touch' : 'mouse', norms: 'fake-test', overall: r3(res.z), tasks: tasks };
}
async function post(p) {
  for (let tries = 0; tries < 8; tries++) {
    const res = await fetch(base + '/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }, body: JSON.stringify(p) });
    if (res.status === 429) { const w = Number(res.headers.get('Retry-After') || 60); console.log('429 빈도 제한·전송 상한 · ' + w + '초 기다림'); await new Promise(function (r) { setTimeout(r, (w + 1) * 1000); }); continue; }
    return { status: res.status, body: await res.text() };
  }
  return { status: 429, body: 'gave up' };
}
module.exports = { make: make };
if (require.main === module) (async function () {
  const modes = ['adaptive', 'quick', 'full'];
  if (DRY) { const p = make(MODE === 'mix' ? 'adaptive' : MODE); console.log(JSON.stringify(p).slice(0, 1500)); console.log('bytes', JSON.stringify(p).length, 'tasks', Object.keys(p.tasks).length, 'version', M.NORMS_VERSION); return; }
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
  const s = await fetch(base + '/stats' + (tok ? '?fresh=1' : ''), { headers: tok ? { Authorization: 'Bearer ' + tok } : {} }).then(function (r) { return r.json(); });
  if (!tok) console.log('(ADMIN_TOKEN 없이 받은 집계라 최대 1분 늦을 수 있어요)');
  console.log('집계: 표본 ' + s.n + '명, 종합 분포 ' + Object.keys(s.overall).map(function (m) { return m + ' n=' + s.overall[m].n + (s.overall[m].q ? ' (백분위 있음)' : ' (표본 부족)'); }).join(', '));
})().catch(function (e) { console.error(e); process.exit(1); });