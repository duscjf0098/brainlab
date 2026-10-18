/* 집계(/stats) → cognitive.js 의 LEVEL_P·NORMS 상수 생성. 실제 응시 자료로 임시 기준값을 갈아끼우는 길.
   node tools/norms-from-stats.cjs <stats 주소, 저장한 /stats JSON 또는 /export 원자료 JSON> [--min 30] [--min-items 100] [--min-people 300] [--write [--force]] [--root <저장소>]
   - 보기만: 바뀌는 값, 새 상수 블록, 지금 단계와 실제 정답률이 어긋나는 언어 문항을 출력한다.
   - --write: js/tests/cognitive.js 의 const LEVEL_P = {…}; / const NORMS = {…}; 블록을 바꾸고 NORMS_VERSION 을 'data-<날짜>-n<표본>' 으로 올린다.
     결과 화면에 "기준값 · 응시자 N명 자료 반영"이 붙는다(js/app.js 가 버전 이름에서 N을 읽음).
     표본이 --min-people(기본 300명) 미만이면 쓰지 않는다. 그 전에는 지금 값(설계값·AI 추정값)을 그대로 쓴다. 시험 삼아 쓰려면 --force.
   규칙:
   - LEVEL_P 는 찍기 몫을 뺀 능력 부분이다(점수 계산: P = c + (1 − c)·σ(θ − b), b = ln((1 − p)/p), c = 1/보기 수).
     그래서 관측 정답률 q 를 p = (q − c)/(1 − c) 로 바꿔 넣는다. c 는 cognitive.js 에서 정밀 검사를 만들어 센 보기 수로 정한다(행렬 1/8, 도형 유추 1/6, 나머지 1/4).
     응시자 집단 평균 정답률을 θ = 0 인 사람의 정답률로 보는 근사라, 아주 쉽거나 어려운 단계는 실제보다 조금 0.5 쪽으로 나온다.
   - 생성 문항 과제: 정밀 검사(단계표대로 푼) 응답이 단계마다 --min-items 개 이상이면 그 정답률, 아니면 적응형을 합친 정답률(그 단계에 도달한 사람만 푸니
     치우침이 있어 "~" 표시), 그것도 모자라면 지금 값을 둔다.
   - 언어 4과제: 2026-10-18 단계 재조정 전 자료는 단계 라벨이 지금과 다르다. 그래서 문항별 자료(pool)를 cognitive.js 의 지금 단계로 다시 묶어 쓴다
     (모드를 가리지 않고 합친 값이라 "~" 표시). 풀에 없는 번호는 버린다.
   - 단계가 올라갈수록 내려가도록 다듬고(인접 위반 합치기) 0.05~0.97 로 자른다.
   - NORMS 폭(span)·개수(count): 응시자 --min 명 이상이면 평균·표준편차. 정답률(prop)의 sd 는 응시자별 정답률의 표준편차(단계 정보가 없을 때의 예비 식에만 쓰임).
   - NORMS 반응 시간(rt, 2026-10-18): 평균·표준편차는 딴짓하거나 앱을 오가다 아주 느리게 나온 몇 사람에 크게 휘둘린다(서버는 10초까지 받는다.
     참값 N(510, 80)에 2%만 섞여도 평균 580·표준편차 568). 그래서 중앙값과 MAD×1.4826(정규분포면 표준편차와 같음)을 쓴다.
     원자료(/export JSON)를 주면 정확도 0.85 미만(선택 반응·색-단어)인 결과와 응시자 중앙값이 RT_CAP(단순 반응 1초·선택 반응 1.5초·색-단어 2.5초)를 넘는 결과를 빼고,
     터치·비터치 응시자를 따로 센다. 터치가 --min 명 이상이면 터치 기준을 먼저 쓴다: NORMS 평균 = 터치 중앙값 − TOUCH_MS, sd = 터치 MAD
     (채점은 응답 절반 이상이 터치면 평균에 TOUCH_MS 를 더하므로 폰 응시자 중앙값이 그대로 기준이 된다). 아니면 비터치 중앙값·MAD.
     TOUCH_MS 는 두 집단이 모두 --min 명 이상인 반응 과제의 (터치 중앙값 − 비터치 중앙값)의 중앙값으로 다시 어림해 --write 때 함께 쓴다(0~120ms로 자름).
     집계(/stats)만 주면 정확도로 거를 수 없고 터치·비터치 백분위가 따로 없어서, 전체 백분위(q)의 중앙값과 사분위 범위/1.349를 쓰고
     평균에서 TOUCH_MS × 터치 비율을 뺀다(경고를 찍는다). 어느 쪽이든 sd 가 지금 값의 1.5배 넘게 바뀌면 경고를 찍는다.
   - OBS(영역·종합 규준화 상수)는 바꾸지 않고 참고 수치만 출력한다: 과제 z 의 표준편차(spread)·정답률 과제 z 평균(shift). 상관(within, 다른 영역은 과제별 부하 load)은 원자료(/export)가 필요하다.
   집계에는 표준 시간으로 푼 결과만 들어 있다(서버가 그렇게 집계). 원자료로 돌리면 정답률 과제는 표준 시간 결과만, 제한 시간이 없는 기억·속도 과제는
   시간 설정과 상관없이 넣고, norms='fake-test'(가짜 자료)는 뺀다. 집계로 돌릴 때는 가짜 자료를 지우고 돌릴 것.
   - 절차가 바뀐 과제(2026-10-18, 기준값 버전 ai-est-2026-10-18b): 회전·전개도·블록은 문항 생성기(단계별 문항), 기억 폭 4과제는 순서 만들기(같은 숫자·칸
     반복 없음, 쉬운 패턴 거름)와 최대 길이, 반응 3과제는 대기 시간·시행 수·잰 시각·실수 감점(값에 들어감)이 바뀌어 그 전 버전(PROC_OLD)의 원점수는
     뜻이 다르다. 원자료로 돌리면 이 과제들은 PROC_OLD 버전·버전 없는 행을 빼고, 기호 찾기는 정확도 0.7 미만 행을 뺀다(지금 채점은 이런 결과를
     "측정 안 됨"으로 두고 보내지 않는다). 집계(/stats)는 서버가 버전을 가리지 않고 합치므로 이 과제들이 있으면 경고를 찍는다. */
const fs = require('fs');
const path = require('path');
const model = require('./cognitive-model.cjs');

const args = process.argv.slice(2);
const opt = { min: 30, minItems: 100, minPeople: 300, write: false, force: false, root: path.resolve(__dirname, '..') };
let src = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--min') opt.min = Number(args[++i]);
  else if (a === '--min-items') opt.minItems = Number(args[++i]);
  else if (a === '--min-people') opt.minPeople = Number(args[++i]);
  else if (a === '--write') opt.write = true;
  else if (a === '--force') opt.force = true;
  else if (a === '--root') opt.root = path.resolve(args[++i]);
  else src = a;
}
if (!src) { console.error('사용법: node tools/norms-from-stats.cjs <stats 주소 또는 JSON 파일> [--min 30] [--min-items 100] [--min-people 300] [--write [--force]]'); process.exit(1); }

const PROP_KEYS = ['matrix', 'figAnalogy', 'series', 'sequence', 'weights', 'analogy', 'vocab', 'logic', 'similar', 'rotation', 'fold', 'blocks'];
const KINDS = { digitF: 'span', digitB: 'span', grid: 'span', lns: 'span', reaction: 'rt', choicert: 'rt', stroop: 'rt', symbol: 'count' };
const RT_CAP = { reaction: 1000, choicert: 1500, stroop: 2500 };   // 원자료: 응시자 한 명의 반응 시간(중앙값·감점 포함)이 이보다 길면 딴짓으로 보고 뺀다
const RT_ACC = 0.85;   // 원자료: 선택 반응·색-단어 간섭 정확도가 이보다 낮은 결과는 뺀다(서툴게 찍은 판)
const PROC_CHANGED = { rotation: 1, fold: 1, blocks: 1, digitF: 1, digitB: 1, grid: 1, lns: 1, reaction: 1, choicert: 1, stroop: 1 };   // 2026-10-18b 에서 문항·절차가 바뀐 과제
const PROC_OLD = ['design-2026-10-18', 'ai-est-2026-10-18'];   // 위 과제들이 옛 절차였던 기준값 버전(이 버전의 행은 그 과제만 뺀다)
const SYMBOL_ACC = 0.7;   // 원자료: 기호 찾기 정확도가 이보다 낮은 행은 뺀다(cognitive.js VALID.symbol 과 같은 값)
const SD_WARN = 1.5;   // 새 sd 가 지금 값의 이 배수보다 크거나 작으면 경고
const KIND_OF = {};
PROP_KEYS.forEach(function (k) { KIND_OF[k] = 'prop'; });
Object.keys(KINDS).forEach(function (k) { KIND_OF[k] = KINDS[k]; });

function median(a) { const s = a.slice().sort(function (x, y) { return x - y; }), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; }
function mad(a) { const m = median(a); return 1.4826 * median(a.map(function (x) { return Math.abs(x - m); })); }
function moments(arr) {
  const n = arr.length;
  if (!n) return { n: 0, mean: null, sd: null };
  const mean = arr.reduce(function (s, v) { return s + v; }, 0) / n;
  const sd = n > 1 ? Math.sqrt(arr.reduce(function (s, v) { return s + (v - mean) * (v - mean); }, 0) / (n - 1)) : null;
  return { n: n, mean: mean, sd: sd };
}
/* /export 원자료 → /stats 와 같은 꼴의 집계(+ 반응 과제는 응시자별 값 rows). 서버 aggregate() 와 같은 규칙에 위 거르기를 더한다.
   받는 꼴: { rows: [...] }, 그런 쪽 여러 개의 배열, 또는 행 배열. 행 = { mode, time_factor, norms, tasks: { 과제: { z, n, c, levels, items, adaptive, value, acc, touch } } } */
function exportRows(data) {
  if (Array.isArray(data)) return data.length && data[0] && Array.isArray(data[0].rows) ? data.reduce(function (a, p) { return a.concat(p.rows || []); }, []) : data;
  return data && Array.isArray(data.rows) ? data.rows : null;
}
function fromExport(rows) {
  const out = { generated: Date.now(), n: 0, raw: true, fake: 0, oldProc: {}, lowAcc: 0, tasks: {} }, byTask = {};
  rows.forEach(function (r) {
    if (!r || !r.tasks || typeof r.tasks !== 'object' || (r.test_id && r.test_id !== 'cognitive')) return;
    if (r.norms === 'fake-test') { out.fake++; return; }
    const std = r.time_factor == null || r.time_factor === 1;
    if (std) out.n++;
    Object.keys(r.tasks).forEach(function (k) {
      if (!KIND_OF[k]) return;
      if (KIND_OF[k] === 'prop' && !std) return;   // 제한 시간을 늘려 푼 정답률 과제는 기준값에 넣지 않는다
      if (PROC_CHANGED[k] && (r.norms == null || PROC_OLD.indexOf(r.norms) >= 0)) { out.oldProc[k] = (out.oldProc[k] || 0) + 1; return; }   // 옛 절차로 낸 원점수
      if (k === 'symbol' && r.tasks[k] && typeof r.tasks[k].acc === 'number' && r.tasks[k].acc < SYMBOL_ACC) { out.lowAcc++; return; }
      (byTask[k] = byTask[k] || []).push(r.tasks[k]);
    });
  });
  Object.keys(byTask).forEach(function (k) {
    const list = byTask[k], kind = KIND_OF[k];
    const t = { kind: kind, n: list.length, z: moments(list.map(function (x) { return x.z; }).filter(function (z) { return typeof z === 'number'; })) };
    if (kind === 'prop') {
      const levels = {}, pool = {}, props = [], zA = [], zF = [];
      list.forEach(function (x) {
        if (x.n) props.push(x.c / x.n);
        (x.adaptive ? zA : zF).push(x.z);
        Object.keys(x.levels || {}).forEach(function (l) {
          const e = levels[l] = levels[l] || { n: 0, c: 0, nFull: 0, cFull: 0 };
          e.n += x.levels[l].n; e.c += x.levels[l].c;
          if (!x.adaptive) { e.nFull += x.levels[l].n; e.cFull += x.levels[l].c; }
        });
        (x.items || []).forEach(function (it) {
          if (!Array.isArray(it) || it[0] < 0) return;
          const e = pool[it[0]] = pool[it[0]] || { level: it[1], n: 0, c: 0, miss: 0, tN: 0, tSum: 0 };
          e.n++; if (it[2] === 1) e.c++; if (it[2] === -1) e.miss++; if (it[3] != null) { e.tN++; e.tSum += it[3]; }
        });
      });
      Object.keys(levels).forEach(function (l) { const e = levels[l]; e.p = e.n ? e.c / e.n : null; e.pFull = e.nFull ? e.cFull / e.nFull : null; });
      t.levels = levels;
      if (M_POOL[k]) { t.pool = {}; Object.keys(pool).forEach(function (i) { const e = pool[i]; t.pool[i] = { level: e.level, n: e.n, c: e.c, p: e.n ? e.c / e.n : null, miss: e.miss, t: e.tN ? Math.round(e.tSum / e.tN) / 10 : null }; }); }
      t.prop = moments(props);
      t.zByMode = { adaptive: moments(zA), full: moments(zF) };
    } else if (kind === 'span' || kind === 'count') {
      t.value = moments(list.map(function (x) { return x.value; }).filter(function (v) { return typeof v === 'number'; }));
    } else {
      t.rows = list.filter(function (x) { return typeof x.value === 'number'; }).map(function (x) { return { value: x.value, acc: typeof x.acc === 'number' ? x.acc : null, touch: !!x.touch }; });
    }
    out.tasks[k] = t;
  });
  return out;
}
let M_POOL = {};

async function load(s) {
  if (/^https?:\/\//.test(s)) { const r = await fetch(s.replace(/\/+$/, '') + (s.indexOf('/stats') >= 0 ? '' : '/stats')); if (!r.ok) throw new Error('stats ' + r.status); return r.json(); }
  return JSON.parse(fs.readFileSync(s, 'utf8'));
}
/* 단계가 올라갈수록 정답률이 내려가게: 인접 위반을 합쳐 평균으로 (pool adjacent violators) */
function monotone(levels, ps, weights) {
  const blocks = levels.map(function (l, i) { return { ls: [l], sum: ps[i] * weights[i], w: weights[i] }; });
  for (let i = 0; i < blocks.length - 1;) {
    const a = blocks[i], b = blocks[i + 1];
    if (a.sum / a.w >= b.sum / b.w) { i++; continue; }
    blocks.splice(i, 2, { ls: a.ls.concat(b.ls), sum: a.sum + b.sum, w: a.w + b.w });
    if (i > 0) i--;
  }
  const out = {};
  blocks.forEach(function (bk) { bk.ls.forEach(function (l) { out[l] = bk.sum / bk.w; }); });
  return out;
}
const f2 = function (x) { return (Math.round(x * 100) / 100).toFixed(2); };
const f1 = function (x) { return (Math.round(x * 10) / 10).toFixed(1); };

(async function () {
  const M = model.load(opt.root);
  M_POOL = M.POOL;
  const loaded = await load(src), rawRows = exportRows(loaded);
  const stats = rawRows ? fromExport(rawRows) : loaded;
  const tm = /const TOUCH_MS = (\d+);/.exec(M.text), curTouch = tm ? Number(tm[1]) : 30;
  let text = M.text;
  const eol = M.eol;
  const LP = M.block('LEVEL_P'), NM = M.block('NORMS');
  const log = [];
  /* 관측 정답률 → 찍기 몫을 뺀 능력 부분 */
  const toAbility = function (k, q) { const c = M.guess(k); return (q - c) / (1 - c); };

  /* ---- 언어 풀: 문항별 자료를 지금 단계로 다시 묶기 ---- */
  const regrouped = {};
  Object.keys(M.POOL).forEach(function (k) {
    const t = stats.tasks && stats.tasks[k];
    if (!t || !t.pool) return;
    const lv = regrouped[k] = {};
    let dropped = 0;
    Object.keys(t.pool).forEach(function (pid) {
      const cur = M.poolLevel(k, Number(pid)), e = t.pool[pid];
      if (cur == null) { dropped += e.n; return; }
      const g = lv[cur] = lv[cur] || { n: 0, c: 0 };
      g.n += e.n; g.c += e.c;
    });
    if (dropped) log.push(k + ': 풀에 없는 문항 번호의 응답 ' + dropped + '개는 뺐다');
  });

  /* ---- LEVEL_P ---- */
  const newLP = JSON.parse(JSON.stringify(LP.value));
  PROP_KEYS.forEach(function (k) {
    const t = stats.tasks && stats.tasks[k];
    if (!t) return;
    const cur = LP.value[k] || LP.value.default;
    const levels = Object.keys(cur).map(Number).sort(function (a, b) { return a - b; });
    const ps = [], ws = [], note = [];
    let changed = false;
    levels.forEach(function (l) {
      const pool = regrouped[k] && regrouped[k][l], e = !regrouped[k] && t.levels ? t.levels[l] : null;
      let q = null, w = 0, how = '';
      if (pool && pool.n >= opt.minItems) { q = pool.c / pool.n; w = pool.n; how = '~문항 ' + pool.n; }
      else if (e && e.nFull >= opt.minItems) { q = e.pFull; w = e.nFull; how = '정밀 ' + e.nFull; }
      else if (e && e.n >= opt.minItems) { q = e.p; w = e.n; how = '~합침 ' + e.n; }
      if (q == null) { ps.push(cur[l]); ws.push(1); note.push(l + ':' + f2(cur[l]) + '(유지)'); return; }
      const p = toAbility(k, q);
      ps.push(p); ws.push(w); changed = true;
      note.push(l + ':관측 ' + f2(q) + '→' + f2(p) + '(' + how + ')');
    });
    if (!changed) { log.push('LEVEL_P ' + k + ': 자료 부족, 유지'); return; }
    const mono = monotone(levels, ps, ws);
    newLP[k] = {};
    levels.forEach(function (l) { newLP[k][l] = Math.round(Math.max(0.05, Math.min(0.97, mono[l])) * 100) / 100; });
    log.push('LEVEL_P ' + k + ' (응시자 ' + t.n + ', 찍기 ' + f2(M.guess(k)) + '): ' + note.join(' ') + ' ⇒ ' + levels.map(function (l) { return l + ':' + f2(newLP[k][l]); }).join(' '));
  });

  /* ---- 반응 시간 기준값(2026-10-18): 중앙값·MAD, 원자료면 정확도·너무 느린 결과를 거르고 터치 기준 우선 ---- */
  const RT_KEYS = Object.keys(KINDS).filter(function (k) { return KINDS[k] === 'rt'; });
  const rtGroups = {}, touchEst = [];
  RT_KEYS.forEach(function (k) {
    const t = stats.tasks && stats.tasks[k];
    if (!t || !t.rows) return;
    const kept = t.rows.filter(function (x) { return x.value <= RT_CAP[k] && (k === 'reaction' || x.acc == null || x.acc >= RT_ACC); });
    const g = rtGroups[k] = { all: t.rows.length, touch: kept.filter(function (x) { return x.touch; }).map(function (x) { return x.value; }), other: kept.filter(function (x) { return !x.touch; }).map(function (x) { return x.value; }) };
    if (g.touch.length >= opt.min && g.other.length >= opt.min) touchEst.push(median(g.touch) - median(g.other));
  });
  const touchMs = touchEst.length ? Math.round(Math.max(0, Math.min(120, median(touchEst)))) : curTouch;
  if (touchEst.length) log.push('TOUCH_MS: 터치 − 비터치 중앙값 차 ' + touchEst.map(function (x) { return Math.round(x); }).join('·') + 'ms → ' + curTouch + ' → ' + touchMs);
  function rtNorm(k, t, cur) {
    const g = rtGroups[k];
    if (g) {
      const out = function (vals, base, who) { return { mean: Math.round(median(vals) - base), sd: Math.max(1, Math.round(mad(vals))), how: who + ' ' + vals.length + '명 중앙값·MAD(뺀 결과 ' + (g.all - g.touch.length - g.other.length) + '명)' }; };
      if (g.touch.length >= opt.min) return out(g.touch, touchMs, '터치');
      if (g.other.length >= opt.min) return out(g.other, 0, '비터치');
      return null;
    }
    const v = t.value || {};
    if (!Array.isArray(v.q) || v.q.length < 101 || !v.all || v.all.n < opt.min) return null;
    const share = v.touch && v.touch.n ? v.touch.n / v.all.n : 0;
    rawWarn = true;
    return { mean: Math.round(v.q[50] - curTouch * share), sd: Math.max(1, Math.round((v.q[75] - v.q[25]) / 1.349)), how: '집계 ' + v.all.n + '명 백분위(중앙값·사분위 범위, 터치 ' + Math.round(share * 100) + '% 보정)' };
  }
  let rawWarn = false;

  /* ---- NORMS ---- */
  const newNM = JSON.parse(JSON.stringify(NM.value));
  Object.keys(KINDS).forEach(function (k) {
    const t = stats.tasks && stats.tasks[k];
    const cur = NM.value[k];
    if (!t || !cur) return;
    if (KINDS[k] === 'rt') {
      const r = rtNorm(k, t, cur);
      if (!r) { log.push('NORMS ' + k + ': 자료 부족(' + t.n + '명), 유지'); return; }
      newNM[k] = { kind: 'rt', mean: r.mean, sd: r.sd };
      const ratio = r.sd / cur.sd;
      log.push('NORMS ' + k + ': ' + r.how + ' ' + cur.mean + '±' + cur.sd + ' → ' + r.mean + '±' + r.sd + (ratio >= SD_WARN || ratio <= 1 / SD_WARN ? ' ⚠ sd가 ' + f2(ratio) + '배로 바뀜, 자료를 확인할 것' : ''));
      return;
    }
    const v = t.value;
    if (v && v.n >= opt.min && v.sd) {
      newNM[k] = { kind: KINDS[k], mean: KINDS[k] === 'span' ? Number(f1(v.mean)) : Math.round(v.mean), sd: KINDS[k] === 'span' ? Number(f1(v.sd)) : Math.round(v.sd) };
      log.push('NORMS ' + k + ': ' + v.n + '명 ' + cur.mean + '±' + cur.sd + ' → ' + newNM[k].mean + '±' + newNM[k].sd);
    } else log.push('NORMS ' + k + ': 자료 부족(' + t.n + '명), 유지');
  });
  PROP_KEYS.forEach(function (k) {
    const t = stats.tasks && stats.tasks[k];
    if (t && t.prop && t.prop.n >= opt.min && t.prop.sd) { newNM[k] = { kind: 'prop', sd: Number(f2(t.prop.sd)) }; }
  });

  /* ---- OBS 참고 수치 ---- */
  const spread = {}, shift = { adaptive: [], full: [] };
  Object.keys(stats.tasks || {}).forEach(function (k) {
    const t = stats.tasks[k];
    if (t.z && t.z.n >= opt.min && t.z.sd) (spread[t.kind] = spread[t.kind] || []).push(t.z.sd);
    if (t.zByMode) { if (t.zByMode.adaptive.n >= opt.min) shift.adaptive.push(t.zByMode.adaptive.mean); if (t.zByMode.full.n >= opt.min) shift.full.push(t.zByMode.full.mean); }
  });
  const avg = function (a) { return a.length ? (a.reduce(function (s, v) { return s + v; }, 0) / a.length) : null; };

  /* ---- 출력 ---- */
  const fmtLP = function (o) { return '{' + eol + Object.keys(o).map(function (k) { return '    ' + k + ': { ' + Object.keys(o[k]).map(function (l) { return l + ': ' + f2(o[k][l]); }).join(', ') + ' }'; }).join(',' + eol) + eol + '  }'; };
  const fmtNM = function (o) { return '{' + eol + Object.keys(o).map(function (k) { const v = o[k]; return '    ' + k + ': { kind: \'' + v.kind + '\'' + (v.mean != null ? ', mean: ' + v.mean : '') + ', sd: ' + v.sd + ' }'; }).join(',' + eol) + eol + '  }'; };
  console.log((stats.raw ? '원자료' : '집계') + ': 표본 ' + stats.n + '명 (표준 시간)' + (stats.raw && stats.fake ? ', 가짜 자료 ' + stats.fake + '건 뺌' : '') + ', 생성 ' + new Date(stats.generated).toISOString() + ', 지금 기준값 ' + M.NORMS_VERSION + ', 기준 --min ' + opt.min + ' --min-items ' + opt.minItems);
  if (stats.raw) { const old = Object.keys(stats.oldProc || {}); if (old.length || stats.lowAcc) console.log('  옛 절차(' + PROC_OLD.join('·') + '·버전 없음)로 낸 행 뺌: ' + (old.length ? old.map(function (k) { return k + ' ' + stats.oldProc[k]; }).join(', ') : '없음') + (stats.lowAcc ? ' / 기호 찾기 정확도 ' + SYMBOL_ACC + ' 미만 ' + stats.lowAcc + '건 뺌' : '')); }
  else if (Object.keys(stats.tasks || {}).some(function (k) { return PROC_CHANGED[k]; })) console.log('  ⚠ 집계(/stats)는 기준값 버전을 가리지 않고 합친 값이에요. 회전·전개도·블록·기억 폭·반응 과제는 ai-est-2026-10-18b 에서 문항·절차가 바뀌어서, 그 전 자료가 섞였으면 /export 원자료 JSON으로 돌리세요(옛 버전 행을 뺍니다).');
  if (rawWarn) console.log('  ⚠ 반응 시간을 집계(/stats)로 잡았어요. 정확도 낮은 결과·너무 느린 결과를 거르고 터치 기준을 따로 잡으려면 /export 원자료 JSON으로 돌리세요.');
  log.forEach(function (l) { console.log('  ' + l); });
  console.log('OBS 참고: spread(z 표준편차) ' + Object.keys(spread).map(function (k) { return k + ' ' + f2(avg(spread[k])); }).join(' · ') + ' / shift(정답률 과제 z 평균) adaptive ' + (shift.adaptive.length ? f2(avg(shift.adaptive)) : '자료 부족') + ', full ' + (shift.full.length ? f2(avg(shift.full)) : '자료 부족'));
  console.log(eol + '  const LEVEL_P = ' + fmtLP(newLP) + ';');
  console.log('  const NORMS = ' + fmtNM(newNM) + ';');
  /* 언어 풀 문항: 관측 정답률이 지금 단계의 기대 관측 정답률 c + (1 − c)·LEVEL_P 와 0.15 넘게 어긋나면 단계를 다시 볼 후보 (30번 이상 푼 것만) */
  const flagged = [];
  Object.keys(M.POOL).forEach(function (k) {
    const t = stats.tasks && stats.tasks[k];
    if (!t || !t.pool) return;
    const lp = newLP[k] || newLP.default, c = M.guess(k);
    Object.keys(t.pool).forEach(function (i) {
      const e = t.pool[i], lv = M.poolLevel(k, Number(i));
      if (e.n < 30 || lv == null || lp[lv] == null) return;
      const expect = c + (1 - c) * lp[lv], d = e.p - expect;
      if (Math.abs(d) > 0.15) flagged.push(k + ' ' + i + '번(' + lv + '단계' + (e.level !== lv ? ', 응답 당시 ' + e.level + '단계' : '') + '): 실제 ' + f2(e.p) + ' / 기대 ' + f2(expect) + ' (' + e.n + '회, 시간 초과 ' + e.miss + ', 평균 ' + e.t + '초) → ' + (d > 0 ? '더 쉬움' : '더 어려움'));
    });
  });
  console.log(eol + '단계를 다시 볼 언어 문항(30회 이상, 기대 관측 정답률과 0.15 넘게 차이): ' + (flagged.length ? '' : '없음'));
  flagged.forEach(function (l) { console.log('  ' + l); });
  if (!opt.write) { console.log(eol + '(--write 를 붙이면 js/tests/cognitive.js 에 바로 쓴다. 표본 ' + opt.minPeople + '명 미만이면 쓰지 않는다)'); return; }
  if (stats.n < opt.minPeople && !opt.force) { console.log(eol + '표본 ' + stats.n + '명이 --min-people ' + opt.minPeople + '명보다 적어서 쓰지 않았다. 지금 기준값을 그대로 둔다(시험 삼아 쓰려면 --force).'); return; }
  const ver = 'data-' + new Date().toISOString().slice(0, 10) + '-n' + stats.n;
  text = text.replace(LP.all, LP.head + fmtLP(newLP) + ';').replace(NM.all, NM.head + fmtNM(newNM) + ';');
  if (touchMs !== curTouch) text = text.replace(/const TOUCH_MS = \d+;/, 'const TOUCH_MS = ' + touchMs + ';');
  if (!/const NORMS_VERSION = '[^']*'/.test(text)) throw new Error('NORMS_VERSION 을 찾지 못했다');
  text = text.replace(/const NORMS_VERSION = '[^']*'/, "const NORMS_VERSION = '" + ver + "'");
  fs.writeFileSync(M.file, text);
  console.log(eol + '썼다: ' + M.file + ' (NORMS_VERSION ' + ver + '). NORMS 바로 위 주석("임시 기준값")과 README "검사 구성"의 기준값 설명도 손봐야 한다.');
})().catch(function (e) { console.error(e.message || e); process.exit(1); });