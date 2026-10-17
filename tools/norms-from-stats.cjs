/* 집계(/stats) → cognitive.js 의 LEVEL_P·NORMS 상수 생성. 실제 응시 자료로 임시 기준값을 갈아끼우는 길.
   node tools/norms-from-stats.cjs <stats 주소 또는 저장한 JSON 파일> [--min 30] [--min-items 100] [--min-people 300] [--write [--force]] [--root <저장소>]
   - 보기만: 바뀌는 값, 새 상수 블록, 단계와 실제 정답률이 어긋나는 언어 문항을 출력한다.
   - --write: js/tests/cognitive.js 의 const LEVEL_P = {…}; / const NORMS = {…}; 블록을 바꾸고 NORMS_VERSION 을 'data-<날짜>-n<표본>' 으로 올린다.
     결과 화면에 "기준값 · 응시자 N명 자료 반영"이 붙는다(js/app.js 가 버전 이름에서 N을 읽음).
     표본이 --min-people(기본 300명) 미만이면 쓰지 않는다. 그 전에는 설계값을 그대로 쓴다. 시험 삼아 쓰려면 --force.
   규칙:
   - LEVEL_P(단계별 정답률): 정밀 검사(단계표대로 푼) 응답이 단계마다 --min-items 개 이상이면 그 정답률, 아니면 적응형을 합친 정답률(적응형은 그 단계에
     도달한 사람만 푸니 치우침이 있어 "~" 표시), 그것도 모자라면 지금 값을 둔다. 단계가 올라갈수록 정답률이 내려가도록 다듬고(인접 위반 합치기) 0.05~0.97 로 자른다.
   - NORMS 폭(span)·개수(count): 응시자 --min 명 이상이면 평균·표준편차. 반응 시간(rt): 마우스·키보드 응시자가 --min 명 이상이면 그 평균·표준편차,
     아니면 전체에서 터치 몫만큼(30ms × 터치 비율) 평균을 뺀다. 정답률(prop)의 sd 는 응시자별 정답률의 표준편차(단계 정보가 없을 때의 예비 식에만 쓰임).
   - OBS(영역·종합 규준화 상수)는 바꾸지 않고 참고 수치만 출력한다: 과제 z 의 표준편차(spread)·정답률 과제 z 평균(shift). 상관(within·between)은 원자료(/export)가 필요하다.
   집계에는 표준 시간으로 푼 결과만 들어 있다(서버가 그렇게 집계). 가짜 자료(norms='fake-test')를 지우고 돌릴 것. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
const TOUCH_MS = 30;

async function load(s) {
  if (/^https?:\/\//.test(s)) { const r = await fetch(s.replace(/\/+$/, '') + (s.indexOf('/stats') >= 0 ? '' : '/stats')); if (!r.ok) throw new Error('stats ' + r.status); return r.json(); }
  return JSON.parse(fs.readFileSync(s, 'utf8'));
}
function block(text, name) {
  const m = text.match(new RegExp('(  const ' + name + ' = )(\\{[\\s\\S]*?\\r?\\n  \\});'));
  if (!m) throw new Error(name + ' 블록을 찾지 못했다');
  return { all: m[0], head: m[1], body: m[2], value: vm.runInNewContext('(' + m[2] + ')') };
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
  const stats = await load(src);
  const file = path.join(opt.root, 'js', 'tests', 'cognitive.js');
  let text = fs.readFileSync(file, 'utf8');
  const eol = text.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const LP = block(text, 'LEVEL_P'), NM = block(text, 'NORMS');
  const log = [];

  /* ---- LEVEL_P ---- */
  const newLP = JSON.parse(JSON.stringify(LP.value));
  PROP_KEYS.forEach(function (k) {
    const t = stats.tasks && stats.tasks[k];
    if (!t || !t.levels) return;
    const cur = LP.value[k] || LP.value.default;
    const levels = Object.keys(cur).map(Number).sort(function (a, b) { return a - b; });
    const ps = [], ws = [], note = [];
    let changed = false;
    levels.forEach(function (l) {
      const e = t.levels[l];
      if (e && e.nFull >= opt.minItems) { ps.push(e.pFull); ws.push(e.nFull); note.push(l + ':' + f2(e.pFull) + '(정밀 ' + e.nFull + ')'); changed = true; }
      else if (e && e.n >= opt.minItems) { ps.push(e.p); ws.push(e.n); note.push(l + ':~' + f2(e.p) + '(합침 ' + e.n + ')'); changed = true; }
      else { ps.push(cur[l]); ws.push(1); note.push(l + ':' + f2(cur[l]) + '(유지)'); }
    });
    if (!changed) { log.push('LEVEL_P ' + k + ': 자료 부족, 유지'); return; }
    const mono = monotone(levels, ps, ws);
    newLP[k] = {};
    levels.forEach(function (l) { newLP[k][l] = Math.round(Math.max(0.05, Math.min(0.97, mono[l])) * 100) / 100; });
    log.push('LEVEL_P ' + k + ' (응시자 ' + t.n + '): ' + note.join(' ') + ' → ' + levels.map(function (l) { return l + ':' + f2(newLP[k][l]); }).join(' '));
  });

  /* ---- NORMS ---- */
  const newNM = JSON.parse(JSON.stringify(NM.value));
  Object.keys(KINDS).forEach(function (k) {
    const t = stats.tasks && stats.tasks[k];
    const cur = NM.value[k];
    if (!t || !cur) return;
    if (KINDS[k] === 'rt') {
      const v = t.value || {};
      if (v.mouse && v.mouse.n >= opt.min && v.mouse.sd) { newNM[k] = { kind: 'rt', mean: Math.round(v.mouse.mean), sd: Math.round(v.mouse.sd) }; log.push('NORMS ' + k + ': 마우스 ' + v.mouse.n + '명 ' + cur.mean + '±' + cur.sd + ' → ' + newNM[k].mean + '±' + newNM[k].sd); }
      else if (v.all && v.all.n >= opt.min && v.all.sd) { const touchShare = (v.touch && v.touch.n ? v.touch.n : 0) / v.all.n; newNM[k] = { kind: 'rt', mean: Math.round(v.all.mean - TOUCH_MS * touchShare), sd: Math.round(v.all.sd) }; log.push('NORMS ' + k + ': 전체 ' + v.all.n + '명(터치 ' + Math.round(touchShare * 100) + '% 보정) ' + cur.mean + '±' + cur.sd + ' → ' + newNM[k].mean + '±' + newNM[k].sd); }
      else log.push('NORMS ' + k + ': 자료 부족(' + t.n + '명), 유지');
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
  console.log('집계: 표본 ' + stats.n + '명 (표준 시간), 생성 ' + new Date(stats.generated).toISOString() + ', 기준 --min ' + opt.min + ' --min-items ' + opt.minItems);
  log.forEach(function (l) { console.log('  ' + l); });
  console.log('OBS 참고: spread(z 표준편차) ' + Object.keys(spread).map(function (k) { return k + ' ' + f2(avg(spread[k])); }).join(' · ') + ' / shift(정답률 과제 z 평균) adaptive ' + (shift.adaptive.length ? f2(avg(shift.adaptive)) : '자료 부족') + ', full ' + (shift.full.length ? f2(avg(shift.full)) : '자료 부족'));
  console.log(eol + '  const LEVEL_P = ' + fmtLP(newLP) + ';');
  console.log('  const NORMS = ' + fmtNM(newNM) + ';');
  /* 언어 풀 문항: 실제 정답률이 그 문항 단계의 (새) 기대 정답률과 0.15 넘게 어긋나면 단계를 다시 볼 후보로 출력 (문항을 30번 이상 푼 것만) */
  const flagged = [];
  PROP_KEYS.forEach(function (k) {
    const t = stats.tasks && stats.tasks[k];
    if (!t || !t.pool) return;
    const lp = newLP[k] || newLP.default;
    Object.keys(t.pool).forEach(function (i) {
      const e = t.pool[i];
      if (e.n < 30 || lp[e.level] == null) return;
      const d = e.p - lp[e.level];
      if (Math.abs(d) > 0.15) flagged.push(k + ' ' + i + '번(' + e.level + '단계): 실제 ' + f2(e.p) + ' / 기대 ' + f2(lp[e.level]) + ' (' + e.n + '회, 시간 초과 ' + e.miss + ', 평균 ' + e.t + '초) → ' + (d > 0 ? '더 쉬움' : '더 어려움'));
    });
  });
  console.log(eol + '단계를 다시 볼 언어 문항(30회 이상, 기대 정답률과 0.15 넘게 차이): ' + (flagged.length ? '' : '없음'));
  flagged.forEach(function (l) { console.log('  ' + l); });
  if (!opt.write) { console.log(eol + '(--write 를 붙이면 js/tests/cognitive.js 에 바로 쓴다. 표본 ' + opt.minPeople + '명 미만이면 쓰지 않는다)'); return; }
  if (stats.n < opt.minPeople && !opt.force) { console.log(eol + '표본 ' + stats.n + '명이 --min-people ' + opt.minPeople + '명보다 적어서 쓰지 않았다. 설계값을 그대로 둔다(시험 삼아 쓰려면 --force).'); return; }
  const ver = 'data-' + new Date().toISOString().slice(0, 10) + '-n' + stats.n;
  text = text.replace(LP.all, LP.head + fmtLP(newLP) + ';').replace(NM.all, NM.head + fmtNM(newNM) + ';');
  if (!/const NORMS_VERSION = '[^']*'/.test(text)) throw new Error('NORMS_VERSION 을 찾지 못했다');
  text = text.replace(/const NORMS_VERSION = '[^']*'/, "const NORMS_VERSION = '" + ver + "'");
  fs.writeFileSync(file, text);
  console.log(eol + '썼다: ' + file + ' (NORMS_VERSION ' + ver + '). NORMS 바로 위 주석("임시 기준값")과 README "검사 구성"의 기준값 설명도 손봐야 한다.');
})().catch(function (e) { console.error(e.message || e); process.exit(1); });