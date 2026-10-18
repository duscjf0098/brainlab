/* 인지 검사 모델 불러오기 (tools 공용). js/util.js 와 js/tests/cognitive.js 를 Node vm 에서 그대로 실행해서,
   기준값(LEVEL_P·NORMS·LEVELS·NORMS_VERSION), 언어 풀 문항의 지금 단계, 과제별 보기 수(찍기 확률), 검사 엔진(build·adaptNext·adaptRecord·score)을 돌려준다.
   상수를 손으로 복사해 두면 cognitive.js 가 바뀔 때 어긋나므로 늘 여기서 읽는다.
   load(root) → { test, text, eol, LEVEL_P, NORMS, LEVELS, NORMS_VERSION, POOL, poolLevel(k, pid), guess(k), lp(k, level), block(name) } */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const POOL_KEYS = { analogy: 'VERBAL', vocab: 'VOCAB', logic: 'LOGIC', similar: 'SIMILAR' };

/* const NAME = { … }; 블록(두 칸 들여쓰기, 닫는 줄 "  };")을 찾아 값으로 읽는다 */
function block(text, name) {
  const m = text.match(new RegExp('(  const ' + name + ' = )(\\{[\\s\\S]*?\\r?\\n  \\});'));
  if (!m) throw new Error(name + ' 블록을 찾지 못했다');
  return { all: m[0], head: m[1], body: m[2], value: vm.runInNewContext('(' + m[2] + ')') };
}

function load(root) {
  root = root || path.resolve(__dirname, '..');
  const file = path.join(root, 'js', 'tests', 'cognitive.js');
  const text = fs.readFileSync(file, 'utf8');
  const ctx = vm.createContext({ console: console });
  ctx.window = ctx;   // localStorage·sessionStorage 는 없다 → util.js 저장소 함수가 try/catch 로 기본값을 쓴다
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'util.js'), 'utf8'), ctx, { filename: 'util.js' });
  vm.runInContext(text, ctx, { filename: 'cognitive.js' });
  const test = ctx.BL.tests.cognitive;
  const LEVEL_P = block(text, 'LEVEL_P').value, NORMS = block(text, 'NORMS').value, LEVELS = block(text, 'LEVELS').value;
  const vm1 = /const NORMS_VERSION = '([^']*)'/.exec(text);
  const POOL = {};
  Object.keys(POOL_KEYS).forEach(function (k) { POOL[k] = test._internals[POOL_KEYS[k]]; });
  /* 과제별 보기 수: 정밀 검사를 한 번 만들어 문항마다 센 값 중 가장 흔한 것 */
  const nopt = {};
  test.build('full', { practice: false }).forEach(function (it) {
    if (it.type !== 'choice' || !it.scored) return;
    const n = (it.options || it.optionsHtml || []).length;
    (nopt[it.part] = nopt[it.part] || {})[n] = (nopt[it.part][n] || 0) + 1;
  });
  const NOPT = {};
  Object.keys(nopt).forEach(function (k) { NOPT[k] = Number(Object.keys(nopt[k]).sort(function (a, b) { return nopt[k][b] - nopt[k][a]; })[0]); });
  return {
    test: test, text: text, file: file, eol: text.indexOf('\r\n') >= 0 ? '\r\n' : '\n',
    LEVEL_P: LEVEL_P, NORMS: NORMS, LEVELS: LEVELS, NORMS_VERSION: vm1 ? vm1[1] : null, POOL: POOL, NOPT: NOPT,
    /* 언어 풀 문항의 지금 단계 (없는 번호면 null) */
    poolLevel: function (k, pid) { const p = POOL[k]; return p && p[pid] ? p[pid].level : null; },
    /* 찍기 확률 c = 1/보기 수 (점수 계산 irtPost 와 같은 값) */
    guess: function (k) { return 1 / (NOPT[k] || 4); },
    /* LEVEL_P 는 찍기 몫을 뺀 능력 부분. 관측 정답률 ≈ c + (1 − c)·LEVEL_P */
    lp: function (k, level) { return (LEVEL_P[k] || LEVEL_P.default)[level]; },
    block: function (name) { return block(text, name); }
  };
}

module.exports = { load: load, block: block, POOL_KEYS: POOL_KEYS };