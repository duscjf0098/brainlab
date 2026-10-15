/* 실험 01 · 인지 능력 검사
   5개 영역(규칙 찾기(유동 추론) · 언어 · 공간 · 기억 · 속도·주의), 18개 과제.
   사용자에게 보이는 설명은 쉬운 말, 해요체. 영역·과제마다 what(무엇을 재나)·where(일상에서 어디에 쓰이나)를 둔다.
   빠른 검사(6과제) · 정밀 검사(13과제) · 과제별 단독 검사(task:<key>)를 지원하고,
   따로 본 과제들은 merge()로 종합 프로필에 합쳐진다.

   난이도: 문항마다 1~5단계가 있고 쉬운 것부터 나온다. 4~5단계는 실제 지능검사의 상위 문항 유형
   (레이븐식 회전·논리 연산·선 겹침 규칙, 다단계 수열, 고난도 어휘·삼단논법)을 따른다.
   점수는 IQ 척도(평균 100, 표준편차 15)로 환산한다. 기준값(NORMS, LEVEL_P)은 문항 설계상의 예상 정답률과
   일반 성인 추정치이며 공인 규준이 아니다. 실제 응시 데이터가 쌓이면 바꿔야 한다.
   도형 행렬 · 도형 계열 · 수열 · 도형 회전 문항은 규칙 기반으로 매번 새로 생성한다 (원본 문항). */
(function () {
  const U = BL.util;

  /* ===== 공통: 도형 셀 (네 층: 틀 · 안쪽 도형 · 선 · 모서리 점) ===== */
  const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'cross'];
  const ASYM = ['triangle', 'arrow', 'lshape'];       // 회전이 보이는 모양
  /* 마름모 틀은 안쪽 공간이 좁아 도형 3~4개(중간·큰 크기)가 틀 선과 겹치므로 쓰지 않는다. */
  const FRAMES = ['none', 'square', 'circle', 'hexagon'];
  const FILLS = ['none', 'solid', 'half', 'dot', 'hatch'];
  const COUNTS = [1, 2, 3, 4];
  const SIZES = ['s', 'm', 'l'];
  const ROTS = [0, 90, 180, 270];
  const POSS = ['c', 'n', 'e', 's', 'w'];
  const POS_XY = { c: [50, 50], n: [50, 30], e: [70, 50], s: [50, 70], w: [30, 50] };
  const MARK_POS = { a: [13, 13], b: [87, 13], c: [13, 87], d: [87, 87] };   // 모서리 점 (네모 틀 안쪽, 둥근·육각 틀 바깥. 큰 도형 4개와도 안 겹침)
  const LINE_DEF = { h: [10, 50, 90, 50], v: [50, 10, 50, 90], d: [14, 14, 86, 86], e: [14, 86, 86, 14] };
  const DOMAIN = { shape: SHAPES, fill: FILLS, count: COUNTS, size: SIZES, frame: FRAMES, pos: POSS };
  const ATTRS = ['shape', 'fill', 'count', 'size'];    // 도형 계열에서 쓰는 기본 속성
  const ALL_ATTRS = ['frame', 'shape', 'fill', 'count', 'size', 'pos', 'rot', 'flip', 'lines', 'marks'];
  const RADIUS = { s: 8, m: 11, l: 14 };
  const ATTR_KO = { frame: '틀', shape: '모양', fill: '채움', count: '개수', size: '크기', pos: '위치', rot: '방향', flip: '좌우', marks: '모서리 점', lines: '선' };
  const VAL_KO = {
    frame: { none: '없음', square: '네모 틀', circle: '둥근 틀', diamond: '마름모 틀', hexagon: '육각 틀' },
    shape: { circle: '원', square: '사각형', triangle: '삼각형', diamond: '마름모', pentagon: '오각형', hexagon: '육각형', star: '별', cross: '십자', arrow: '화살표', lshape: 'ㄱ자' },
    fill: { none: '비움', solid: '채움', half: '반 채움', dot: '점', hatch: '빗금' },
    count: { 1: '1개', 2: '2개', 3: '3개', 4: '4개' },
    size: { s: '작게', m: '중간', l: '크게' },
    pos: { c: '가운데', n: '위', e: '오른쪽', s: '아래', w: '왼쪽' }
  };
  const RULE_KO = { row: '같은 행에서는 같고 행마다 다름', col: '같은 열에서는 같고 열마다 다름', latin: '각 행과 각 열에 세 가지가 한 번씩 나옴', prog: '오른쪽으로 갈수록 한 단계씩 커지거나 돎' };
  const OP_KO = { union: '첫째와 둘째를 합친 것', xor: '첫째와 둘째 중 한쪽에만 있는 것', inter: '첫째와 둘째에 모두 있는 것', sub: '첫째에서 둘째를 뺀 것' };
  const OPK_KO = { union: '왼쪽에 정해진 것을 더한 것', xor: '왼쪽에서 정해진 것을 뒤집은 것(있으면 빼고 없으면 더함)', sub: '왼쪽에서 정해진 것을 뺀 것' };
  let uid = 0;

  function polygonPoints(cx, cy, r, n, offsetDeg) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (offsetDeg + i * 360 / n) * Math.PI / 180;
      pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
    }
    return pts.join(' ');
  }
  function shapeEl(shape, cx, cy, r, attrs, rot, flip) {
    let el;
    const poly = function (u, k) { return '<polygon points="' + u.map(function (p) { return (cx + p[0] * r * k).toFixed(1) + ',' + (cy + p[1] * r * k).toFixed(1); }).join(' ') + '" ' + attrs + '/>'; };
    if (shape === 'circle') el = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" ' + attrs + '/>';
    else if (shape === 'arrow') el = poly([[0, -1], [0.62, -0.3], [0.3, -0.3], [0.3, 1], [-0.3, 1], [-0.3, -0.3], [-0.62, -0.3]], 0.95);
    else if (shape === 'lshape') el = poly([[-0.8, -1], [-0.2, -1], [-0.2, 0.4], [0.8, 0.4], [0.8, 1], [-0.8, 1]], 0.9);
    else if (shape === 'cross') el = poly([[-0.3, -1], [0.3, -1], [0.3, -0.3], [1, -0.3], [1, 0.3], [0.3, 0.3], [0.3, 1], [-0.3, 1], [-0.3, 0.3], [-1, 0.3], [-1, -0.3], [-0.3, -0.3]], 0.9);
    else if (shape === 'star') {
      const pts = [];
      for (let i = 0; i < 10; i++) { const a = (-90 + i * 36) * Math.PI / 180, rr = i % 2 === 0 ? r * 1.1 : r * 0.48; pts.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1)); }
      el = '<polygon points="' + pts.join(' ') + '" ' + attrs + '/>';
    } else {
      const n = { triangle: 3, square: 4, diamond: 4, pentagon: 5, hexagon: 6 }[shape];
      const off = { triangle: -90, square: 45, diamond: -90, pentagon: -90, hexagon: 0 }[shape];
      const rr = shape === 'square' ? r * 1.15 : shape === 'triangle' ? r * 1.1 : r;
      el = '<polygon points="' + polygonPoints(cx, cy, rr, n, off) + '" ' + attrs + '/>';
    }
    const tf = (flip ? 'translate(' + (2 * cx) + ' 0) scale(-1 1) ' : '') + (rot ? 'rotate(' + rot + ' ' + cx + ' ' + cy + ')' : '');
    return tf ? '<g transform="' + tf.trim() + '">' + el + '</g>' : el;
  }
  function frameEl(frame) {
    const a = 'fill="none" stroke="currentColor" stroke-width="1.8" opacity=".9"';
    if (!frame || frame === 'none') return '';
    if (frame === 'square') return '<rect x="7" y="7" width="86" height="86" rx="3" ' + a + '/>';
    if (frame === 'circle') return '<circle cx="50" cy="50" r="44" ' + a + '/>';
    if (frame === 'diamond') return '<polygon points="' + polygonPoints(50, 50, 46, 4, -90) + '" ' + a + '/>';
    return '<polygon points="' + polygonPoints(50, 50, 46, 6, 0) + '" ' + a + '/>';
  }
  function cellSVG(cell) {
    const r = RADIUS[cell.size];
    let pos;
    if (cell.count === 1) pos = [POS_XY[cell.pos || 'c']];
    else if (cell.count === 2) pos = [[34, 50], [66, 50]];
    else if (cell.count === 3) pos = [[50, 33], [34, 64], [66, 64]];
    else pos = [[35, 35], [65, 35], [35, 65], [65, 65]];
    const rot = ASYM.indexOf(cell.shape) >= 0 ? (cell.rot || 0) : 0;
    const flip = cell.shape === 'lshape' ? !!cell.flip : false;
    let body = frameEl(cell.frame), defs = '';
    const base = 'stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"';
    (cell.lines || '').split('').forEach(function (k) {
      const l = LINE_DEF[k]; if (!l) return;
      body += '<line x1="' + l[0] + '" y1="' + l[1] + '" x2="' + l[2] + '" y2="' + l[3] + '" stroke="currentColor" stroke-width="1.6" opacity=".7"/>';
    });
    pos.forEach(function (p) {
      if (cell.fill === 'none') body += shapeEl(cell.shape, p[0], p[1], r, base + ' fill="none"', rot, flip);
      else if (cell.fill === 'solid') body += shapeEl(cell.shape, p[0], p[1], r, base + ' fill="currentColor"', rot, flip);
      else if (cell.fill === 'half') {
        const id = 'clip' + (++uid);
        defs += '<clipPath id="' + id + '"><rect x="' + (p[0] - r - 4) + '" y="' + (p[1] - r - 4) + '" width="' + (r + 4) + '" height="' + (2 * r + 8) + '"/></clipPath>';
        body += shapeEl(cell.shape, p[0], p[1], r, 'fill="currentColor" stroke="none" clip-path="url(#' + id + ')"', rot, flip);
        body += shapeEl(cell.shape, p[0], p[1], r, base + ' fill="none"', rot, flip);
      } else if (cell.fill === 'hatch') {
        const id = 'clip' + (++uid);
        defs += '<clipPath id="' + id + '">' + shapeEl(cell.shape, p[0], p[1], r, '', rot, flip) + '</clipPath>';
        let h = '';
        for (let i = -2; i <= 2; i++) { const o = i * r * 0.5; h += '<line x1="' + (p[0] - r - 2 + o) + '" y1="' + (p[1] + r + 2) + '" x2="' + (p[0] + r + 2 + o) + '" y2="' + (p[1] - r - 2) + '" stroke="currentColor" stroke-width="1.5"/>'; }
        body += '<g clip-path="url(#' + id + ')">' + h + '</g>';
        body += shapeEl(cell.shape, p[0], p[1], r, base + ' fill="none"', rot, flip);
      } else {
        body += shapeEl(cell.shape, p[0], p[1], r, base + ' fill="none"', rot, flip);
        body += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (r * 0.3).toFixed(1) + '" fill="currentColor"/>';
      }
    });
    (cell.marks || '').split('').forEach(function (k) {
      const m = MARK_POS[k]; if (!m) return;
      body += '<circle cx="' + m[0] + '" cy="' + m[1] + '" r="4" fill="currentColor"/>';
    });
    return '<svg class="cell" viewBox="0 0 100 100" aria-hidden="true">' + (defs ? '<defs>' + defs + '</defs>' : '') + body + '</svg>';
  }
  const cellKey = function (c) { return ALL_ATTRS.map(function (a) { return c[a] == null ? '' : c[a]; }).join('|'); };
  function shuffleOptions(r, options, answer) {
    const idx = r.shuffle(options.map(function (_, i) { return i; }));
    return { options: idx.map(function (i) { return options[i]; }), answer: idx.indexOf(answer) };
  }
  /* 보기만 보고 찍을 수 없게, 보기에서 달라지는 속성마다 값이 고르게 나오도록 오답을 만든다.
     varying = { 속성: [보기에 쓸 값들] }. 정답 값도 다른 값과 같은 횟수만 나온다. */
  function balancedDistractors(r, answer, varying, nOpt) {
    const attrs = Object.keys(varying);
    for (let attempt = 0; attempt < 300; attempt++) {
      const cols = {};
      attrs.forEach(function (a) {
        const vals = varying[a];
        const others = vals.filter(function (v) { return v !== answer[a]; });
        const per = Math.floor(nOpt / vals.length);
        let rem = nOpt - per * vals.length;
        // 나머지는 정답 값부터 채워, 정답 값이 "가장 드문 값"이 되지 않게 한다
        let ansCount = per + (rem > 0 ? 1 : 0); if (rem > 0) rem--;
        const bag = [];
        for (let i = 0; i < ansCount - 1; i++) bag.push(answer[a]);
        r.shuffle(others).forEach(function (v) { const c = per + (rem > 0 ? 1 : 0); if (rem > 0) rem--; for (let i = 0; i < c; i++) bag.push(v); });
        while (bag.length < nOpt - 1) bag.push(r.pick(others));
        cols[a] = r.shuffle(bag.slice(0, nOpt - 1));
      });
      const seen = {}; seen[cellKey(answer)] = true;
      const dis = [];
      let ok = true;
      for (let i = 0; i < nOpt - 1; i++) {
        const c = Object.assign({}, answer);
        attrs.forEach(function (a) { c[a] = cols[a][i]; });
        const k = cellKey(c);
        if (seen[k]) { ok = false; break; }
        seen[k] = true; dis.push(c);
      }
      if (ok) return dis;
    }
    return null;
  }
  function pickFoil(r, answer, exclude) {
    const pool = ATTRS.filter(function (x) { return exclude.indexOf(x) < 0; });
    const a = r.pick(pool.length ? pool : ['frame']);
    return { attr: a, vals: [answer[a], r.pick(DOMAIN[a].filter(function (v) { return v !== answer[a]; }))] };
  }

  /* ===== 집합 연산 (모서리 점 · 선) ===== */
  function setOf(s) { return s.split('').filter(Boolean); }
  function setStr(arr, order) { return order.split('').filter(function (k) { return arr.indexOf(k) >= 0; }).join(''); }
  const OPS = {
    union: function (a, b, o) { return setStr(setOf(a).concat(setOf(b)), o); },
    xor: function (a, b, o) { return setStr(setOf(a).filter(function (k) { return b.indexOf(k) < 0; }).concat(setOf(b).filter(function (k) { return a.indexOf(k) < 0; })), o); },
    inter: function (a, b, o) { return setStr(setOf(a).filter(function (k) { return b.indexOf(k) >= 0; }), o); },
    sub: function (a, b, o) { return setStr(setOf(a).filter(function (k) { return b.indexOf(k) < 0; }), o); }
  };
  function randomSet(r, order, min, max) { return setStr(r.sample(order.split(''), r.int(min, max)), order); }
  /* 3×3: 행마다 (A, B, op(A,B)) — 결과가 A나 B와 같거나 비어 있지 않게 */
  function logicRow(r, op, order) {
    for (let t = 0; t < 80; t++) {
      const a = randomSet(r, order, 1, 3), b = randomSet(r, order, 1, 3);
      const c = OPS[op](a, b, order);
      if (!c || c === a || c === b || a === b) continue;
      return [a, b, c];
    }
    return [order.slice(0, 2), order.slice(1, 3), OPS.union(order.slice(0, 2), order.slice(1, 3), order)];
  }
  /* 정답이 유일하도록: 보기로 주어지는 두 행(0,1)이 다른 연산과 구별되어야 한다.
     (예: 두 행 모두 A∩B=∅ 이면 합집합과 배타가 같아 보여 셋째 행의 답이 두 개가 된다) */
  function logicRows(r, op, order) {
    const others = Object.keys(OPS).filter(function (o) { return o !== op; });
    for (let t = 0; t < 120; t++) {
      const rows = [logicRow(r, op, order), logicRow(r, op, order), logicRow(r, op, order)];
      const ok = others.every(function (o) { return rows.slice(0, 2).some(function (row) { return OPS[o](row[0], row[1], order) !== row[2]; }); });
      if (ok) return rows;
    }
    return [logicRow(r, op, order), logicRow(r, op, order), logicRow(r, op, order)];
  }
  /* 2×2: 오른쪽 = 왼쪽 op K (K는 숨은 고정 집합). 예시 행이 하나뿐이라 K를 완전히 알 수 없으므로,
     예시에 맞는 모든 (연산, K') 가설이 질문 행에서 같은 답을 내야 정답이 유일하다. 네 연산 × K'의 모든 부분집합을 확인한다. */
  function allSubsets(order) {
    const out = [];
    for (let m = 1; m < (1 << order.length); m++) { let s = ''; for (let i = 0; i < order.length; i++) if (m & (1 << i)) s += order[i]; out.push(s); }
    return out;
  }
  function kUnique(left0, c0, left1, answer, order) {
    const subs = allSubsets(order);
    return Object.keys(OPS).every(function (o) {
      return subs.every(function (K2) { return OPS[o](left0, K2, order) !== c0 || OPS[o](left1, K2, order) === answer; });
    });
  }
  function logicK(r, op, order) {
    for (let t = 0; t < 300; t++) {
      const K = randomSet(r, order, 1, 2);
      const left0 = randomSet(r, order, 1, 3), c0 = OPS[op](left0, K, order);
      if (!c0 || c0 === left0) continue;
      const left1 = randomSet(r, order, 1, 3), c1 = OPS[op](left1, K, order);
      if (!c1 || c1 === left1 || left1 === left0) continue;
      if (!kUnique(left0, c0, left1, c1, order)) continue;
      return { K: K, rows: [[left0, c0], [left1, c1]] };
    }
    // 연산별로 검증된 안전한 기본값 (가설 전수 검사를 통과하는 조합)
    const o = order;
    if (op === 'xor') return { K: o.slice(0, 2), rows: [[o.slice(0, 1), o.slice(1, 2)], [o.slice(2, 3), o.slice(0, 3)]] };
    if (op === 'sub') return { K: o.slice(0, 1), rows: [[o.slice(0, 3), o.slice(1, 3)], [o.slice(0, 2), o.slice(1, 2)]] };
    return { K: o.slice(0, 1), rows: [[o.slice(1, 2), o.slice(0, 2)], [o.slice(1, 3), o.slice(0, 3)]] };
  }
  function logicFoils(r, a, b, op, order, answer, n) {
    n = n || 3;
    const vals = [answer];
    Object.keys(OPS).filter(function (o) { return o !== op; }).forEach(function (o) { const v = OPS[o](a, b, order); if (v && vals.indexOf(v) < 0) vals.push(v); });
    let guard = 0;
    while (vals.length < n && guard++ < 60) { const v = randomSet(r, order, 1, 3); if (vals.indexOf(v) < 0) vals.push(v); }
    return vals.slice(0, n);
  }
  /* 보기 8개가 속성마다 정확히 균형(4값×2 또는 2값×4)을 이루도록 값 집합을 맞춘다. set[0]은 정답 값. */
  function fitSet(r, a, set) {
    const out = set.filter(function (x, i, arr) { return x != null && arr.indexOf(x) === i; });
    if (out.length >= 4) return out.slice(0, 4);
    if (out.length === 3 && DOMAIN[a]) {
      const extra = r.shuffle(DOMAIN[a].filter(function (v) { return out.indexOf(v) < 0; }));
      if (extra.length) return out.concat([extra[0]]);
    }
    if (out.length === 3 && PROG_SEQ[a]) {
      const extra = PROG_SEQ[a].filter(function (v) { return out.indexOf(v) < 0; });
      if (extra.length) return out.concat([extra[0]]);
    }
    return out.slice(0, 2);
  }

  /* ===== 1. 도형 행렬 (1~6단계, 2×2·3×3 혼합, 보기 8개) =====
     규칙 종류: 범주(행 고정·열 고정·라틴 분배), 진행(개수·크기·방향·위치가 한 단계씩), 집합 논리(선·모서리 점의
     합집합·교집합·배타·빼기), 2×2에서는 "오른쪽 = 왼쪽을 변환한 것"(진행·좌우 반전·고정 집합 더하기/빼기/뒤집기). */
  const PROG_SEQ = { count: [1, 2, 3, 4], size: ['s', 'm', 'l'], rot: [0, 90, 180, 270], pos: ['n', 'e', 's', 'w'] };
  const CYCLIC = { rot: true, pos: true };
  function nextVal(a, v, step) { const s = PROG_SEQ[a]; const i = s.indexOf(v); return CYCLIC[a] ? s[((i + step) % s.length + s.length) % s.length] : s[Math.min(s.length - 1, Math.max(0, i + step))]; }

  function makeMatrix(r, level) {
    const grid = level >= 4 && r.next() < 0.4 ? 2 : 3;
    const recipe = {
      1: { cat: 1, prog: 0, logic: 0, pool: ['shape', 'fill', 'count', 'size'] },
      2: { cat: 2, prog: 0, logic: 0, pool: ['shape', 'fill', 'count', 'size', 'frame'] },
      3: { cat: 2, prog: 1, logic: 0, pool: ['shape', 'fill', 'count', 'size', 'frame'], progPool: ['count', 'size', 'pos'] },
      4: { cat: 2, prog: 0, logic: 1, pool: ['shape', 'fill', 'count', 'size', 'frame'], progPool: ['count', 'size', 'pos'], ops: ['union', 'inter'] },
      5: { cat: 2, prog: 1, logic: 1, pool: ['shape', 'fill', 'size', 'frame'], progPool: ['rot', 'pos', 'count', 'size'], ops: ['union', 'inter', 'xor', 'sub'] },
      6: { cat: 2, prog: 1, logic: 2, pool: ['shape', 'fill', 'size', 'frame'], progPool: ['rot', 'pos'], ops: ['xor', 'sub', 'union', 'inter'] }
    }[level];
    if (grid === 2) { recipe.cat = Math.max(1, recipe.cat - 1); recipe.prog = Math.max(recipe.prog, 1); }

    // 기본값 (모든 칸 공통)
    const base = { frame: level >= 3 && r.next() < 0.4 ? r.pick(FRAMES.slice(1)) : 'none', shape: r.pick(SHAPES), fill: r.pick(FILLS), count: r.int(1, 2), size: r.pick(SIZES), pos: 'c', rot: 0, flip: 0, lines: '', marks: '' };
    // 진행 속성 고르기 (회전·반전은 비대칭 모양을 요구하고, 위치는 개수 1을 요구한다)
    const progAttrs = recipe.prog ? r.sample(recipe.progPool, recipe.prog) : [];
    let flipAttr = false;
    if (grid === 2 && level >= 5 && r.next() < 0.35) flipAttr = true;
    if (progAttrs.indexOf('rot') >= 0 || flipAttr) base.shape = flipAttr ? 'lshape' : r.pick(ASYM);
    if (progAttrs.indexOf('pos') >= 0) base.count = 1;
    const catPool = recipe.pool.filter(function (a) { return progAttrs.indexOf(a) < 0 && !(a === 'shape' && (progAttrs.indexOf('rot') >= 0 || flipAttr)) && !(a === 'count' && progAttrs.indexOf('pos') >= 0); });
    const catAttrs = r.sample(catPool, Math.min(recipe.cat, catPool.length));

    // 규칙 명세
    const spec = {};
    catAttrs.forEach(function (a) {
      const vals = r.sample(DOMAIN[a], grid === 3 ? 3 : 2);
      const rule = grid === 2 ? (r.next() < 0.3 ? 'row' : 'col') : r.pick(level === 1 ? ['col', 'latin'] : ['row', 'col', 'latin']);
      spec[a] = { kind: 'cat', rule: rule, vals: vals, perm: r.shuffle([0, 1, 2]) };
    });
    if (grid === 3 && catAttrs.length >= 2 && !catAttrs.some(function (a) { return spec[a].rule === 'latin'; })) spec[r.pick(catAttrs)].rule = 'latin';
    if (grid === 2 && catAttrs.length && !catAttrs.some(function (a) { return spec[a].rule === 'col'; }) && !progAttrs.length && !flipAttr) spec[catAttrs[0]].rule = 'col';
    progAttrs.forEach(function (a) {
      const seq = PROG_SEQ[a];
      const step = a === 'rot' && r.next() < 0.3 ? -1 : 1;
      const starts = [];
      for (let row = 0; row < grid; row++) starts.push(CYCLIC[a] ? r.int(0, seq.length - 1) : (a === 'count' ? r.int(0, 1) : 0));
      spec[a] = { kind: 'prog', step: step, starts: starts };
    });
    if (flipAttr) spec.flip = { kind: 'flip' };
    const logicAttrs = recipe.logic ? r.sample(['marks', 'lines'], recipe.logic) : [];
    logicAttrs.forEach(function (a) {
      const order = a === 'marks' ? 'abcd' : 'hvde';
      const op = r.pick(grid === 2 ? recipe.ops.filter(function (o) { return o !== 'inter'; }) : recipe.ops);
      if (grid === 3) spec[a] = { kind: 'logic', op: op, order: order, rows: logicRows(r, op, order) };
      else { const k = logicK(r, op, order); spec[a] = { kind: 'logicK', op: op, order: order, K: k.K, rows: k.rows }; }
    });

    function value(a, row, col) {
      const s = spec[a];
      if (!s) return base[a];
      if (s.kind === 'cat') {
        if (s.rule === 'row') return s.vals[row];
        if (s.rule === 'col') return s.vals[col];
        return s.vals[(s.perm[row] + col) % 3];
      }
      if (s.kind === 'prog') { const seq = PROG_SEQ[a]; return CYCLIC[a] ? seq[((s.starts[row] + s.step * col) % seq.length + seq.length) % seq.length] : seq[Math.min(seq.length - 1, s.starts[row] + col)]; }
      if (s.kind === 'flip') return col;
      return s.rows[row][col];
    }
    const cells = [];
    for (let row = 0; row < grid; row++) for (let col = 0; col < grid; col++) {
      const c = {}; ALL_ATTRS.forEach(function (a) { c[a] = value(a, row, col); }); cells.push(c);
    }
    const answer = cells[cells.length - 1];
    const lastRow = grid - 1;

    // 보기: 달라지는 속성마다 값 세 가지(정답 포함), 균형 배치
    const varying = {};
    catAttrs.forEach(function (a) { varying[a] = fitSet(r, a, [answer[a]].concat(spec[a].vals)); });
    progAttrs.forEach(function (a) { const v = answer[a]; varying[a] = fitSet(r, a, [v, nextVal(a, v, -1), nextVal(a, v, 1), nextVal(a, v, 2)]); });
    if (flipAttr) varying.flip = [answer.flip, answer.flip ? 0 : 1];
    logicAttrs.forEach(function (a) {
      const s = spec[a];
      varying[a] = fitSet(r, a, s.kind === 'logic' ? logicFoils(r, s.rows[lastRow][0], s.rows[lastRow][1], s.op, s.order, answer[a], 4) : logicFoils(r, s.rows[lastRow][0], s.K, s.op, s.order, answer[a], 4));
    });
    const foilEx = function () { return Object.keys(varying).concat(progAttrs.indexOf('rot') >= 0 || flipAttr ? ['shape'] : []).concat(progAttrs.indexOf('pos') >= 0 ? ['count'] : []); };
    if (Object.keys(varying).length === 1) { const f = pickFoil(r, answer, foilEx()); varying[f.attr] = f.vals; }
    let dis = balancedDistractors(r, answer, varying, 8);
    if (!dis) { const f = pickFoil(r, answer, foilEx()); varying[f.attr] = f.vals; dis = balancedDistractors(r, answer, varying, 8); }
    if (!dis) dis = balancedDistractors(r, answer, varying, 6) || [];
    const o = shuffleOptions(r, [answer].concat(dis), 0);

    const explain = catAttrs.map(function (a) { return ATTR_KO[a] + ': ' + (grid === 2 && spec[a].rule === 'col' ? '왼쪽과 오른쪽이 각각 정해진 값' : RULE_KO[spec[a].rule]); })
      .concat(progAttrs.map(function (a) { return ATTR_KO[a] + ': ' + (a === 'rot' ? '오른쪽으로 갈수록 ' + (spec[a].step > 0 ? '시계 방향' : '반시계 방향') + '으로 90°씩 돎' : a === 'pos' ? '오른쪽으로 갈수록 시계 방향으로 한 칸씩 이동' : '오른쪽으로 갈수록 한 단계씩 커짐'); }))
      .concat(flipAttr ? ['좌우: 오른쪽은 왼쪽을 거울처럼 뒤집은 것'] : [])
      .concat(logicAttrs.map(function (a) { const s = spec[a]; return ATTR_KO[a] + ': ' + (s.kind === 'logic' ? '셋째 열은 ' + OP_KO[s.op] : '오른쪽은 ' + OPK_KO[s.op]); }))
      .join(' / ');
    return {
      type: 'choice', part: 'matrix', scored: true, level: level, timeLimit: [60, 60, 80, 90, 100, 120][level - 1],
      prompt: (grid === 2 ? '왼쪽에서 오른쪽으로의 변화를 찾아 ' : '규칙을 찾아 ') + '빈칸에 들어갈 도형을 고르세요.',
      promptHtml: '<div class="matrix' + (grid === 2 ? ' matrix2' : '') + '">' + cells.slice(0, cells.length - 1).map(cellSVG).join('') + '<div class="cell cell-missing"><span>?</span></div></div>',
      optionsHtml: o.options.map(cellSVG), answer: o.answer, optionCols: 4,
      explain: explain
    };
  }

  /* ===== 1b. 도형 유추 (A → B 와 같은 변환을 C에 적용) ===== */
  function fit3(a, set) {
    const out = set.filter(function (x, i, arr) { return x != null && arr.indexOf(x) === i; });
    if (out.length >= 3) return out.slice(0, 3);
    const extra = (DOMAIN[a] || PROG_SEQ[a] || []).filter(function (v) { return out.indexOf(v) < 0; });
    while (out.length < 3 && extra.length) out.push(extra.shift());
    return out.length >= 3 ? out : out.slice(0, 2);
  }
  const TRANS_KO = { fill: '채움', shape: '모양', frame: '틀', size: '크기', count: '개수', rot: '방향', flip: '좌우', marks: '모서리 점', lines: '선' };
  function makeFigAnalogy(r, level) {
    const nT = [1, 1, 2, 2, 3][level - 1], nN = [0, 1, 1, 2, 2][level - 1];
    const pool = level <= 2 ? ['fill', 'shape', 'size', 'count', 'frame'] : ['fill', 'shape', 'frame', 'size', 'count', 'rot', 'flip', 'marks', 'lines'];
    let trans = r.sample(pool, nT);
    if (trans.indexOf('rot') >= 0 && trans.indexOf('flip') >= 0) trans = trans.filter(function (t) { return t !== 'flip'; });
    if (trans.indexOf('shape') >= 0 && (trans.indexOf('rot') >= 0 || trans.indexOf('flip') >= 0)) trans = trans.filter(function (t) { return t !== 'shape'; });
    const A = { frame: r.pick(FRAMES), shape: r.pick(SHAPES), fill: r.pick(FILLS), count: r.int(1, 3), size: r.pick(['s', 'm']), pos: 'c', rot: 0, flip: 0, lines: '', marks: '' };
    if (trans.indexOf('rot') >= 0) A.shape = r.pick(['triangle', 'arrow']);
    if (trans.indexOf('flip') >= 0) A.shape = 'lshape';
    if (trans.indexOf('marks') >= 0) A.marks = r.next() < 0.5 ? '' : randomSet(r, 'abcd', 1, 2);
    if (trans.indexOf('lines') >= 0) A.lines = r.next() < 0.5 ? '' : randomSet(r, 'hvde', 1, 1);
    const noisePool = ['fill', 'shape', 'frame', 'size', 'count'].filter(function (a) { return trans.indexOf(a) < 0 && !(a === 'shape' && (trans.indexOf('rot') >= 0 || trans.indexOf('flip') >= 0)); });
    const noise = r.sample(noisePool, Math.min(nN, noisePool.length));
    const C = Object.assign({}, A);
    noise.forEach(function (a) { C[a] = r.pick(DOMAIN[a].filter(function (v) { return v !== A[a] && !(a === 'size' && v === 'l') && !(a === 'count' && v === 4); })); });
    const T = {};
    trans.forEach(function (t) {
      if (t === 'fill' || t === 'shape' || t === 'frame') T[t] = { to: r.pick(DOMAIN[t].filter(function (v) { return v !== A[t] && v !== C[t]; })) };
      else if (t === 'size' || t === 'count') T[t] = { step: 1 };
      else if (t === 'rot') T[t] = { step: r.pick([1, -1]) };
      else if (t === 'flip') T[t] = {};
      else {
        const order = t === 'marks' ? 'abcd' : 'hvde';
        const op = r.pick(['union', 'xor']);
        let K = order.slice(0, 1);
        for (let g = 0; g < 40; g++) { const k = randomSet(r, order, 1, 2); if (OPS[op](A[t], k, order) !== A[t] && OPS[op](C[t], k, order) !== C[t]) { K = k; break; } }
        T[t] = { op: op, K: K, order: order };
      }
    });
    function apply(cell) {
      const out = Object.assign({}, cell);
      trans.forEach(function (t) {
        const p = T[t];
        if (p.to) out[t] = p.to;
        else if (t === 'size' || t === 'count' || t === 'rot') out[t] = nextVal(t, cell[t], p.step);
        else if (t === 'flip') out.flip = cell.flip ? 0 : 1;
        else out[t] = OPS[p.op](cell[t], p.K, p.order);
      });
      return out;
    }
    const B = apply(A), D = apply(C);
    const varying = {};
    trans.forEach(function (t) {
      if (t === 'flip') varying.flip = [D.flip, C.flip];
      else if (t === 'size' || t === 'count' || t === 'rot') varying[t] = fit3(t, [D[t], C[t], nextVal(t, D[t], T[t].step || 1)]);
      else if (T[t].to) varying[t] = fit3(t, [D[t], C[t], r.pick(DOMAIN[t].filter(function (v) { return v !== D[t] && v !== C[t]; }))]);
      else varying[t] = logicFoils(r, C[t], T[t].K, T[t].op, T[t].order, D[t], 3);
    });
    const foilEx = function () { return Object.keys(varying).concat(trans.indexOf('rot') >= 0 || trans.indexOf('flip') >= 0 ? ['shape'] : []); };
    if (Object.keys(varying).length === 1) { const f = pickFoil(r, D, foilEx()); varying[f.attr] = f.vals; }
    let dis = balancedDistractors(r, D, varying, 6);
    if (!dis) { const f = pickFoil(r, D, foilEx()); varying[f.attr] = f.vals; dis = balancedDistractors(r, D, varying, 6) || []; }
    const o = shuffleOptions(r, [D].concat(dis), 0);
    const explain = 'A에서 B로: ' + trans.map(function (t) {
      const p = T[t];
      if (p.to) return TRANS_KO[t] + '이(가) ' + VAL_KO[t][p.to] + '(으)로 바뀜';
      if (t === 'size') return '크기가 한 단계 커짐';
      if (t === 'count') return '개수가 하나 늘어남';
      if (t === 'rot') return (p.step > 0 ? '시계 방향' : '반시계 방향') + '으로 90° 돎';
      if (t === 'flip') return '좌우가 뒤집힘';
      return TRANS_KO[t] + ': ' + OPK_KO[p.op];
    }).join(', ') + '. 같은 변화를 C에 적용한 것이 정답입니다.' + (noise.length ? ' C는 A와 ' + noise.map(function (a) { return TRANS_KO[a]; }).join('·') + '이(가) 다르지만 변화 규칙은 같습니다.' : '');
    return {
      type: 'choice', part: 'figAnalogy', scored: true, level: level, timeLimit: level >= 4 ? 60 : 45,
      prompt: 'A가 B로 바뀐 것과 같은 방식으로 C를 바꾸면?',
      promptHtml: '<div class="analogy"><div class="an-pair"><span class="an-label mono">A</span>' + cellSVG(A) + '<span class="an-sep">→</span><span class="an-label mono">B</span>' + cellSVG(B) + '</div><div class="an-pair"><span class="an-label mono">C</span>' + cellSVG(C) + '<span class="an-sep">→</span><span class="an-label mono">?</span><div class="cell cell-missing"><span>?</span></div></div></div>',
      optionsHtml: o.options.map(cellSVG), answer: o.answer, optionCols: 3,
      explain: explain
    };
  }

  /* ===== 1c. 저울 추론 (양적 추론) ===== */
  const W_SHAPES = ['circle', 'square', 'triangle'];
  function bagWeight(bag, w) { return bag.reduce(function (s, k) { return s + w[k]; }, 0); }
  function bagKey(bag) { return bag.slice().sort().join(','); }
  function bagItems(bag, cx, cy, r, gapf) {
    const n = bag.length, gap = r * (gapf || 2.4);
    return bag.map(function (k, i) { return shapeEl(k, cx + (i - (n - 1) / 2) * gap, cy, r, 'fill="currentColor" stroke="currentColor" stroke-width="1"', 0, 0); }).join('');
  }
  function scaleSVG(left, right) {
    const pan = function (bag, x) {
      return '<line x1="' + x + '" y1="36" x2="' + x + '" y2="62" stroke="currentColor" stroke-width="2"/>' +
        '<path d="M' + (x - 40) + ',62 Q' + x + ',84 ' + (x + 40) + ',62" fill="none" stroke="currentColor" stroke-width="2.5"/>' +
        (bag === null ? '<text x="' + x + '" y="56" text-anchor="middle" font-size="22" font-weight="800" fill="var(--accent)">?</text>' : bagItems(bag, x, 50, 6.5));
    };
    return '<svg class="scale" viewBox="0 0 260 96" aria-hidden="true">' +
      '<line x1="40" y1="36" x2="220" y2="36" stroke="currentColor" stroke-width="3"/>' +
      '<polygon points="130,36 118,90 142,90" fill="none" stroke="currentColor" stroke-width="2.5"/>' +
      '<line x1="100" y1="90" x2="160" y2="90" stroke="currentColor" stroke-width="2.5"/>' +
      pan(left, 60) + pan(right, 200) + '</svg>';
  }
  function panSVG(bag) {
    // 보기 접시는 최대 7개까지 올라가므로 접시를 넓게(10~110) 그리고 간격을 조금 좁힌다
    return '<svg class="cell pan-opt" viewBox="0 0 120 56" aria-hidden="true">' + bagItems(bag, 60, 26, 6.5, 2.3) +
      '<path d="M10,40 Q60,60 110,40" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';
  }
  function bagsOfWeight(target, shapes, w, maxItems) {
    const out = [];
    const rec = function (i, bag, sum) {
      if (sum > target || bag.length > maxItems) return;
      if (i === shapes.length) { if (sum === target && bag.length) out.push(bag.slice()); return; }
      for (let c = 0; c <= maxItems; c++) { for (let k = 0; k < c; k++) bag.push(shapes[i]); rec(i + 1, bag, sum + c * w[shapes[i]]); for (let k = 0; k < c; k++) bag.pop(); }
    };
    rec(0, [], 0);
    return out;
  }
  function makeWeights(r, level) {
    const nShapes = level <= 2 ? 2 : 3;
    const shapes = r.sample(W_SHAPES, nShapes);
    const w = {};
    w[shapes[0]] = 1;
    const others = r.sample(level >= 5 ? [2, 3, 4, 5] : level >= 3 ? [2, 3, 4] : [2, 3], nShapes - 1);
    shapes.slice(1).forEach(function (s, i) { w[s] = others[i]; });
    const givens = [];
    shapes.slice(1).forEach(function (s, i) {
      // 오른쪽 접시에는 최대 5개만 올릴 수 있으므로, 2개를 올리는 것은 2·무게 ≤ 5일 때만 (안 그러면 접시가 모자라 잘못된 저울이 그려진다)
      let k = level >= 4 && 2 * w[s] <= 5 ? r.int(1, 2) : 1;
      const allowed = level >= 3 && i > 0 ? shapes.slice(0, i + 1) : [shapes[0]];
      let left = [], cands = [];
      for (; k >= 1 && !cands.length; k--) {
        left = []; for (let j = 0; j < k; j++) left.push(s);
        cands = bagsOfWeight(bagWeight(left, w), allowed, w, 5).filter(function (b) { return bagKey(b) !== bagKey(left); });
      }
      const right = cands.length ? r.pick(cands) : bagsOfWeight(w[s], [shapes[0]], w, 5)[0];   // w[s] ≤ 5 이므로 항상 있다
      givens.push([left, right]);
    });
    // 질문: 왼쪽 무게를 보기 중에서 찾기
    let qLeft, cands;
    for (let g = 0; g < 60; g++) {
      const n = level <= 2 ? r.int(2, 3) : r.int(2, 4);
      qLeft = []; for (let j = 0; j < n; j++) qLeft.push(r.pick(shapes));
      if (level >= 3 && !qLeft.some(function (s) { return s === shapes[shapes.length - 1]; })) continue;
      const t = bagWeight(qLeft, w);
      const optShapes = level <= 2 ? [shapes[0]] : shapes;
      const answerBags = bagsOfWeight(t, optShapes, w, 7).filter(function (b) { return bagKey(b) !== bagKey(qLeft); });
      if (!answerBags.length) continue;
      const offsets = r.pick([[-2, -1, 1], [-1, 1, 2], [-3, -1, 1], [-1, 1, 3], [-2, 1, 2]]);
      const dist = [];
      offsets.forEach(function (d) { const bs = bagsOfWeight(t + d, optShapes, w, 7); if (bs.length) dist.push(r.pick(bs)); });
      if (dist.length < 3) continue;
      cands = { t: t, answer: r.pick(answerBags), dist: dist };
      break;
    }
    if (!cands) { qLeft = [shapes[0], shapes[0]]; cands = { t: 2, answer: [shapes[0], shapes[0]], dist: [[shapes[0]], [shapes[0], shapes[0], shapes[0]], [shapes[0], shapes[0], shapes[0], shapes[0]]] }; }
    const o = shuffleOptions(r, [cands.answer].concat(cands.dist), 0);
    const names = shapes.map(function (s) { return VAL_KO.shape[s] + '=' + w[s]; }).join(', ');
    return {
      type: 'choice', part: 'weights', scored: true, level: level, timeLimit: level >= 4 ? 90 : level === 3 ? 75 : 60,
      prompt: '위 저울들은 모두 평형입니다. 마지막 저울의 물음표 자리에 올려야 평형이 되는 것은?',
      promptHtml: '<div class="scales-given">' + givens.map(function (g) { return scaleSVG(g[0], g[1]); }).join('') + scaleSVG(qLeft, null) + '</div>',
      optionsHtml: o.options.map(panSVG), answer: o.answer, optionCols: 2,
      explain: '가장 가벼운 ' + VAL_KO.shape[shapes[0]] + '을(를) 1로 두면 ' + names + '입니다. 왼쪽의 무게는 ' + cands.t + '이므로 무게가 ' + cands.t + '인 보기가 정답입니다.'
    };
  }

  /* ===== 2. 도형 계열 완성 (1~3단계) ===== */
  function makeSeries(r, level) {
    const active = r.sample(ATTRS, level);
    const base = {}; ATTRS.forEach(function (a) { base[a] = r.pick(DOMAIN[a]); });
    base.frame = 'none'; base.pos = 'c'; base.rot = 0; base.flip = 0; base.marks = ''; base.lines = '';
    if (base.count === 4) base.count = 3;
    const rules = {};
    active.forEach(function (a, idx) {
      const n = idx === 0 ? 3 : 2;
      rules[a] = { vals: r.sample(DOMAIN[a], n), start: r.int(0, n - 1) };
    });
    function cellAt(i) {
      const c = Object.assign({}, base);
      active.forEach(function (a) { const ru = rules[a]; c[a] = ru.vals[(ru.start + i) % ru.vals.length]; });
      return c;
    }
    const cells = [0, 1, 2, 3, 4].map(cellAt);
    const answer = cells[4];
    const varying = {};
    active.forEach(function (a) { varying[a] = [answer[a], cells[3][a]]; });
    if (active.length === 1) { const f = pickFoil(r, answer, active); varying[f.attr] = f.vals; }
    const dis = balancedDistractors(r, answer, varying, 4);
    const o = shuffleOptions(r, [answer].concat(dis), 0);
    return {
      type: 'choice', part: 'series', scored: true, level: level, timeLimit: level >= 3 ? 50 : 40,
      prompt: '왼쪽에서 오른쪽으로 이어지는 변화를 찾아 다음 도형을 고르세요.',
      promptHtml: '<div class="series">' + cells.slice(0, 4).map(cellSVG).join('') + '<div class="cell cell-missing"><span>?</span></div></div>',
      optionsHtml: o.options.map(cellSVG), answer: o.answer, optionCols: 4,
      explain: active.map(function (a) { return ATTR_KO[a] + ': ' + rules[a].vals.map(function (v) { return VAL_KO[a][v]; }).join(' → ') + ' 순서로 반복'; }).join(' / ')
    };
  }

  /* ===== 3. 수열 (1~5단계) ===== */
  const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
  /* 앞 다섯 수에 맞는 단순 규칙들이 예측하는 여섯째 수 목록 (등차·등비·2차·피보나치·교대 등차·교대 차이·쌍 반복) */
  function altNext(s) {
    const out = [];
    const d = [1, 2, 3, 4].map(function (i) { return s[i] - s[i - 1]; });
    if (d.every(function (x) { return x === d[0]; })) out.push(s[4] + d[0]);
    if (s.slice(0, 4).every(function (x) { return x !== 0; })) { const q = s[1] / s[0]; if ([1, 2, 3].every(function (i) { return s[i + 1] / s[i] === q; })) out.push(s[4] * q); }
    const dd = [1, 2, 3].map(function (i) { return d[i] - d[i - 1]; });
    if (dd.every(function (x) { return x === dd[0]; })) out.push(s[4] + d[3] + dd[0]);
    if (s[2] === s[0] + s[1] && s[3] === s[1] + s[2] && s[4] === s[2] + s[3]) out.push(s[3] + s[4]);
    if (s[2] - s[0] === s[4] - s[2] && (s[3] - s[1]) !== undefined) out.push(s[3] + (s[3] - s[1]));
    if (d[0] === d[2] && d[1] === d[3]) out.push(s[4] + d[0]);
    if (s[0] === s[1] && s[2] === s[3]) out.push(s[4]);
    // 뒤쪽 세 차이가 같으면(예: 2, 5, 11, 17, 23) "계속 같은 만큼 더한다"로도 읽히므로 그 예측도 포함한다
    if (d[1] === d[2] && d[2] === d[3]) out.push(s[4] + d[3]);
    if (s.slice(1, 4).every(function (x) { return x !== 0; })) { const q2 = s[2] / s[1]; if (s[3] / s[2] === q2 && s[4] / s[3] === q2) out.push(s[4] * q2); }
    return out.filter(function (v, i, arr) { return isFinite(v) && arr.indexOf(v) === i; });
  }
  function makeSequence(r, level) {
    const six = function (f) { return [0, 1, 2, 3, 4, 5].map(f); };
    const gens = {
      arith: function () { const a = r.int(1, 20), d = r.int(2, 9); return { seq: six(function (i) { return a + d * i; }), explain: '앞의 수에 ' + U.josa(d, '을', '를') + ' 더합니다.' }; },
      arithNeg: function () { const a = r.int(50, 95), d = r.int(3, 9); return { seq: six(function (i) { return a - d * i; }), explain: '앞의 수에서 ' + U.josa(d, '을', '를') + ' 뺍니다.' }; },
      geo: function () { const a = r.int(1, 4), q = r.pick([2, 3]); return { seq: six(function (i) { return a * Math.pow(q, i); }), explain: '앞의 수에 ' + U.josa(q, '을', '를') + ' 곱합니다.' }; },
      alt: function () { const a = r.int(1, 15), d1 = r.int(4, 9), d2 = r.int(1, 3); let x = a; const s = []; for (let i = 0; i < 6; i++) { s.push(x); x += i % 2 === 0 ? d1 : -d2; } return { seq: s, explain: '+' + U.josa(d1, '과', '와') + ' −' + U.josa(d2, '이', '가') + ' 번갈아 적용됩니다.' }; },
      square: function () { const k = r.int(-3, 5), off = r.int(1, 3); return { seq: six(function (i) { return (i + off) * (i + off) + k; }), explain: '제곱수(' + off + '², ' + (off + 1) + '², ' + (off + 2) + '², …)' + (k === 0 ? '입니다.' : k > 0 ? '에 ' + U.josa(k, '을', '를') + ' 더한 수입니다.' : '에서 ' + U.josa(-k, '을', '를') + ' 뺀 수입니다.') }; },
      fib: function () { const a = r.int(1, 5), b = r.int(a + 1, 9); const s = [a, b]; while (s.length < 6) s.push(s[s.length - 1] + s[s.length - 2]); return { seq: s, explain: '앞의 두 수를 더한 값이 다음 수입니다.' }; },
      inter: function () { const a = r.int(1, 9), d1 = r.int(1, 4), b = r.int(10, 40), d2 = r.int(3, 10); return { seq: six(function (i) { return i % 2 === 0 ? a + d1 * (i / 2) : b + d2 * ((i - 1) / 2); }), explain: '두 수열이 번갈아 나옵니다. ' + a + '부터 ' + d1 + '씩, ' + b + '부터 ' + d2 + '씩 커집니다.' }; },
      second: function () { const a = r.int(1, 10), d = r.int(1, 4), inc = r.int(1, 3); let x = a, step = d; const s = []; for (let i = 0; i < 6; i++) { s.push(x); x += step; step += inc; } return { seq: s, explain: '이웃한 수의 차이가 ' + d + ', ' + (d + inc) + ', ' + (d + 2 * inc) + '…처럼 ' + inc + '씩 늘어납니다.' }; },
      mulAdd: function () { const a = r.int(2, 5), k = r.pick([1, -1, 3]); let x = a; const s = []; for (let i = 0; i < 6; i++) { s.push(x); x = x * 2 + k; } return { seq: s, explain: '앞의 수를 2배 한 뒤 ' + (k > 0 ? U.josa(k, '을', '를') + ' 더합니다.' : U.josa(-k, '을', '를') + ' 뺍니다.') }; },
      /* 4단계 */
      mulSub: function () { const a = r.int(3, 6), k = r.int(1, 3); let x = a; const s = []; for (let i = 0; i < 6; i++) { s.push(x); x = x * 2 - k; } return { seq: s, explain: '앞의 수를 2배 한 뒤 ' + U.josa(k, '을', '를') + ' 뺍니다.' }; },
      alt2: function () { const a = r.int(2, 9), d = r.int(2, 5), b = r.int(2, 5); return { seq: six(function (i) { return i % 2 === 0 ? a + d * (i / 2) : b * Math.pow(2, (i - 1) / 2); }), explain: '두 수열이 번갈아 나옵니다. 홀수 번째는 ' + a + '부터 ' + d + '씩 커지고, 짝수 번째는 ' + b + '부터 2배씩 커집니다.' }; },
      primes: function () { const st = r.int(0, 5); return { seq: PRIMES.slice(st, st + 6), explain: '소수(1과 자기 자신으로만 나누어지는 수)가 작은 것부터 차례로 나옵니다.' }; },
      sqPlusN: function () { const off = r.int(1, 3), sg = r.pick([1, -1]); return { seq: six(function (i) { const n = i + off; return n * n + sg * n; }), explain: 'n²' + (sg > 0 ? '+n' : '−n') + ' (n=' + off + ', ' + (off + 1) + ', …)입니다. 이웃한 수의 차이가 2씩 늘어납니다.' }; },
      /* 5단계 */
      lookback3: function () { const a = r.int(1, 3), b = r.int(1, 3); const s = [a, b, a + b]; while (s.length < 6) s.push(s[s.length - 1] + s[s.length - 2] + s[s.length - 3]); return { seq: s, explain: '앞의 세 수를 더한 값이 다음 수입니다.' }; },
      altMulAdd: function () { const a = r.int(2, 5), k = r.int(2, 4); let x = a; const s = []; for (let i = 0; i < 6; i++) { s.push(x); x = i % 2 === 0 ? x * 2 : x + k; } return { seq: s, explain: '×2와 ' + U.josa('+' + k, '이', '가') + ' 번갈아 적용됩니다.' }; },
      diffGeo: function () { const a = r.int(1, 5), d = r.pick([1, 2, 3]); let x = a, step = d; const s = []; for (let i = 0; i < 6; i++) { s.push(x); x += step; step *= 2; } return { seq: s, explain: '이웃한 수의 차이가 ' + d + ', ' + d * 2 + ', ' + d * 4 + '…처럼 2배씩 커집니다.' }; },
      primesSkip: function () { const st = r.int(0, 3); return { seq: [0, 1, 2, 3, 4, 5].map(function (i) { return PRIMES[st + 2 * i]; }), explain: '소수를 하나씩 건너뛰며 나열한 것입니다.' }; }
    };
    const pools = { 1: ['arith', 'arithNeg', 'geo'], 2: ['alt', 'square', 'fib', 'inter'], 3: ['second', 'mulAdd', 'inter', 'square'], 4: ['mulSub', 'alt2', 'primes', 'sqPlusN'], 5: ['lookback3', 'altMulAdd', 'diffGeo', 'primesSkip'] };
    // 앞 다섯 수가 다른 단순 규칙으로도 설명되면서 여섯째 수가 달라지는 경우(모호한 문항)는 버리고 다시 만든다
    let g = null;
    for (let t = 0; t < 40; t++) {
      const cand = gens[r.pick(pools[level])]();
      const alts = altNext(cand.seq.slice(0, 5));
      if (alts.every(function (v) { return v === cand.seq[5]; })) { g = cand; break; }
      if (!g) g = cand;
    }
    const seq = g.seq, shown = seq.slice(0, 5), answer = seq[5];
    const d = seq[4] - seq[3];
    const cands = [answer + d, answer - d, answer + 1, answer - 1, answer + 2, answer - 2, seq[4] * 2, answer + 2 * d, seq[4] + seq[3], seq[4] + d - 1, answer + 3];
    const seen = {}; seen[answer] = true;
    const uniq = [];
    r.shuffle(cands).forEach(function (v) { if (!seen[v] && isFinite(v)) { seen[v] = true; uniq.push(v); } });
    const o = shuffleOptions(r, [answer].concat(uniq.slice(0, 3)), 0);
    return {
      type: 'choice', part: 'sequence', scored: true, level: level, timeLimit: level >= 4 ? 60 : 50,
      prompt: '다음에 올 숫자는 무엇일까요?',
      promptHtml: '<div class="seq">' + shown.map(function (n) { return '<span>' + n + '</span>'; }).join('') + '<span class="seq-q">?</span></div>',
      options: o.options.map(String), answer: o.answer, optionCols: 2,
      explain: g.explain
    };
  }

  /* ===== 4. 언어: 유추 · 어휘 · 논리 (원본 문항, 1~5단계) ===== */
  const VERBAL = [
    { prompt: '손가락 : 손 = 발가락 : ?', options: ['발', '다리', '무릎', '신발'], answer: 0, level: 1, explain: '손가락이 손의 일부이듯 발가락은 발의 일부입니다 (부분과 전체).' },
    { prompt: '뜨겁다 : 차갑다 = 넓다 : ?', options: ['길다', '좁다', '얇다', '작다'], answer: 1, level: 1, explain: '반대말 관계입니다.' },
    { prompt: '연필 : 쓰다 = 가위 : ?', options: ['붙이다', '자르다', '재다', '그리다'], answer: 1, level: 1, explain: '도구와 그 도구의 기능입니다.' },
    { prompt: '새 : 날개 = 물고기 : ?', options: ['비늘', '아가미', '지느러미', '눈'], answer: 2, level: 2, explain: '이동에 쓰는 기관입니다. 날개로 날듯 지느러미로 헤엄칩니다.' },
    { prompt: '온도계 : 온도 = 저울 : ?', options: ['길이', '부피', '무게', '속도'], answer: 2, level: 2, explain: '측정 도구와 측정 대상입니다.' },
    { prompt: '섬 : 바다 = 오아시스 : ?', options: ['강', '사막', '숲', '호수'], answer: 1, level: 2, explain: '넓은 공간 속에 고립된 작은 장소입니다.' },
    { prompt: '나무 : 종이 = 모래 : ?', options: ['시멘트', '유리', '벽돌', '흙'], answer: 1, level: 3, explain: '원료와 그 원료로 만드는 제품입니다. 유리는 모래(규사)로 만듭니다.' },
    { prompt: '희소하다 : 흔하다 = 간결하다 : ?', options: ['명확하다', '복잡하다', '장황하다', '짧다'], answer: 2, level: 3, explain: '반대말 관계입니다. 간결의 반대는 장황입니다.' },
    { prompt: '지도 : 지형 = 악보 : ?', options: ['음악', '악기', '연주자', '무대'], answer: 0, level: 4, explain: '기호로 옮겨 적은 것과 그 원래 대상입니다. 지도는 지형을, 악보는 음악을 적습니다.' },
    { prompt: '증상 : 질병 = 연기 : ?', options: ['불', '공기', '재', '굴뚝'], answer: 0, level: 4, explain: '겉으로 드러나는 징후와 그 원인입니다. 증상은 질병의, 연기는 불의 징후입니다.' },
    { prompt: '관대하다 : 엄격하다 = 사치하다 : ?', options: ['검소하다', '인색하다', '빈곤하다', '겸손하다'], answer: 0, level: 5, explain: '반대말 관계입니다. 사치의 반대는 검소이며, 인색은 베풀기를 아끼는 것이라 다릅니다.' },
    { prompt: '암시 : 명시 = 함축 : ?', options: ['직설', '생략', '비유', '축약'], answer: 0, level: 5, explain: '넌지시 드러냄과 분명히 드러냄의 대비입니다. 함축의 반대는 직설입니다.' }
  ];
  const VOCAB = [
    { prompt: '"명료하다"와 뜻이 가장 가까운 말은?', options: ['분명하다', '복잡하다', '느슨하다', '화려하다'], answer: 0, level: 1, explain: '명료하다 = 뚜렷하고 분명하다.' },
    { prompt: '"빈번하다"와 뜻이 가장 가까운 말은?', options: ['잦다', '드물다', '급하다', '넓다'], answer: 0, level: 1, explain: '빈번하다 = 자주 일어나 잦다.' },
    { prompt: '"인색하다"의 반대말에 가장 가까운 것은?', options: ['후하다', '검소하다', '무심하다', '성실하다'], answer: 0, level: 2, explain: '인색은 베풀기를 아끼는 것, 반대는 후하다입니다.' },
    { prompt: '"경솔하다"의 반대말에 가장 가까운 것은?', options: ['신중하다', '대담하다', '느리다', '겸손하다'], answer: 0, level: 2, explain: '경솔은 가볍게 행동하는 것, 반대는 신중입니다.' },
    { prompt: '"유보하다"와 뜻이 가장 가까운 말은?', options: ['미루다', '결정하다', '거절하다', '보관하다'], answer: 0, level: 2, explain: '유보하다 = 결정을 나중으로 미루다.' },
    { prompt: '"미미하다"와 뜻이 가장 가까운 말은?', options: ['보잘것없다', '아름답다', '조용하다', '강하다'], answer: 0, level: 2, explain: '미미하다 = 보잘것없이 작다.' },
    { prompt: '"완곡하다"와 뜻이 가장 가까운 것은?', options: ['부드럽게 돌려 말하다', '직설적으로 말하다', '단호하게 말하다', '길게 늘여 말하다'], answer: 0, level: 3, explain: '완곡하다 = 듣기 좋게 돌려서 부드럽게 말하다.' },
    { prompt: '"고루하다"와 뜻이 가장 가까운 것은?', options: ['낡고 융통성이 없다', '고르고 균등하다', '외롭고 쓸쓸하다', '높고 귀하다'], answer: 0, level: 3, explain: '고루하다 = 낡은 생각에 매여 융통성이 없다.' },
    { prompt: '"서슴다"와 뜻이 가장 가까운 말은?', options: ['망설이다', '서두르다', '숨기다', '다투다'], answer: 0, level: 4, explain: '서슴다 = 결단을 내리지 못하고 머뭇거리다. "서슴지 않고"의 그 말입니다.' },
    { prompt: '"알음알음"의 뜻으로 가장 알맞은 것은?', options: ['서로 아는 관계를 통해', '아주 천천히 조금씩', '남몰래 은밀하게', '분명하고 뚜렷하게'], answer: 0, level: 4, explain: '알음알음 = 서로 아는 관계나 친분을 통해.' },
    { prompt: '"미쁘다"와 뜻이 가장 가까운 말은?', options: ['믿음직하다', '예쁘다', '미련하다', '어설프다'], answer: 0, level: 5, explain: '미쁘다 = 믿음성이 있다, 믿음직하다.' },
    { prompt: '"사위스럽다"와 뜻이 가장 가까운 것은?', options: ['마음에 불길한 느낌이 들다', '사이가 서먹하다', '몹시 까다롭다', '몸가짐이 단정하다'], answer: 0, level: 5, explain: '사위스럽다 = 마음에 꺼림칙하고 불길한 느낌이 있다.' }
  ];
  const LOGIC = [
    { premise: '모든 고래는 포유류다. 모든 포유류는 폐로 숨 쉰다.', options: ['모든 고래는 폐로 숨 쉰다', '폐로 숨 쉬는 동물은 모두 고래다', '어떤 포유류는 고래가 아니다', '고래는 물고기다'], answer: 0, level: 1, explain: '고래 → 포유류 → 폐호흡이므로 모든 고래는 폐로 숨 쉽니다.' },
    { premise: '민수는 지호보다 키가 크다. 지호는 수아보다 키가 크다.', options: ['민수는 수아보다 키가 크다', '수아는 민수보다 키가 크다', '지호가 가장 크다', '셋의 키는 같다'], answer: 0, level: 1, explain: '민수 > 지호 > 수아이므로 민수 > 수아입니다.' },
    { premise: '어떤 학생은 안경을 쓴다. 안경을 쓴 사람은 모두 시력이 나쁘다.', options: ['어떤 학생은 시력이 나쁘다', '모든 학생은 시력이 나쁘다', '시력이 나쁜 사람은 모두 학생이다', '안경을 안 쓴 학생은 시력이 좋다'], answer: 0, level: 2, explain: '안경 쓴 학생이 적어도 한 명 있고 그 사람은 시력이 나쁘므로 "어떤 학생은 시력이 나쁘다"만 반드시 참입니다.' },
    { premise: '이 상자의 공은 모두 빨갛거나 파랗다. 상자에서 꺼낸 공은 빨갛지 않다.', options: ['꺼낸 공은 파랗다', '꺼낸 공은 빨갛다', '상자에는 파란 공만 있다', '알 수 없다'], answer: 0, level: 2, explain: '빨강 아니면 파랑인데 빨강이 아니므로 파랑입니다.' },
    { premise: '시험이 쉬웠다면 평균이 80점을 넘었을 것이다. 평균은 80점을 넘지 않았다.', options: ['시험은 쉽지 않았다', '시험은 쉬웠다', '평균은 정확히 80점이었다', '알 수 없다'], answer: 0, level: 3, explain: '"쉬움 → 80점 초과"인데 80점을 넘지 않았으므로 쉽지 않았습니다 (후건 부정).' },
    { premise: '비가 오면 땅이 젖는다. 지금 땅이 젖어 있다.', options: ['비가 왔는지는 알 수 없다', '비가 왔다', '비가 오지 않았다', '땅은 항상 젖어 있다'], answer: 0, level: 3, explain: '땅은 물을 뿌려도 젖습니다. "비 → 젖음"에서 "젖음 → 비"는 따라 나오지 않습니다.' },
    { premise: '모든 A는 B가 아니다. 어떤 C는 A다.', options: ['어떤 C는 B가 아니다', '모든 C는 B가 아니다', '어떤 B는 C다', '모든 B는 A다'], answer: 0, level: 3, explain: 'A인 C가 적어도 하나 있고, A는 B가 아니므로 그 C는 B가 아닙니다.' },
    { premise: '어떤 새는 날지 못한다. 모든 새는 알을 낳는다.', options: ['알을 낳는 동물 중에 날지 못하는 것이 있다', '날지 못하는 동물은 모두 새다', '알을 낳지 않는 새가 있다', '모든 새는 날지 못한다'], answer: 0, level: 4, explain: '날지 못하는 새가 적어도 하나 있고 그 새도 알을 낳으므로, 알을 낳으면서 날지 못하는 동물이 있습니다.' },
    { premise: '회의에 참석한 사람은 모두 보고서를 읽었다. 지수는 보고서를 읽지 않았다.', options: ['지수는 회의에 참석하지 않았다', '지수는 회의에 참석했다', '보고서를 읽은 사람은 모두 회의에 참석했다', '알 수 없다'], answer: 0, level: 4, explain: '참석했다면 읽었어야 하는데 읽지 않았으므로 참석하지 않았습니다 (후건 부정).' },
    { premise: '모든 B는 C다. 어떤 A는 B가 아니다.', options: ['A와 C의 관계는 알 수 없다', '어떤 A는 C가 아니다', '모든 A는 C다', '어떤 A는 C다'], answer: 0, level: 5, explain: 'B가 아닌 A가 C인지 아닌지는 전제에 없습니다. "B가 아니면 C도 아니다"로 읽기 쉬운 함정입니다.' },
    { premise: '진우, 민아, 서준 중 한 명만 거짓말을 한다. 진우: "민아는 거짓말쟁이다." 민아: "서준은 거짓말쟁이다." 서준: "나는 거짓말쟁이가 아니다."', options: ['민아', '진우', '서준', '알 수 없다'], answer: 0, level: 5, explain: '민아가 거짓말쟁이라면 진우의 말은 참, 서준의 말도 참이 되어 한 명만 거짓인 조건에 맞습니다. 다른 경우는 거짓말쟁이가 둘이 됩니다.' }
  ];
  /* 공통점 찾기: 두 낱말의 본질적 공통점(범주·기능)을 고른다. 보기 길이는 정답과 무관하게 섞었다. */
  const SIMILAR = [
    { pair: ['사과', '바나나'], options: ['둘 다 과일이다', '둘 다 노란색이다', '둘 다 껍질째 먹는다', '둘 다 씨가 하나도 없다'], answer: 0, level: 1, explain: '둘을 묶는 범주는 "과일"입니다. 노란색과 껍질째 먹는 것은 한쪽에만 해당하고, 사과에는 씨가 있습니다.' },
    { pair: ['개', '고양이'], options: ['네 발 달린 포유류다', '사람을 보면 짖는다', '주인을 따라다닌다', '주로 밤에 활동한다'], answer: 0, level: 1, explain: '둘 다 포유류입니다. 나머지는 한쪽에만 해당합니다.' },
    { pair: ['시계', '달력'], options: ['시간을 재는 도구다', '바늘이 돌아간다', '한 해가 지나면 새것으로 바꾼다', '전기가 있어야 움직인다'], answer: 0, level: 2, explain: '둘 다 시간을 재고 알려 주는 도구입니다. 바늘은 시계에만, 해마다 바꾸는 것은 달력에만 해당합니다.' },
    { pair: ['연필', '붓'], options: ['그리거나 쓰는 도구다', '글씨를 쓰는 데만 쓴다', '잉크를 묻혀 쓴다', '지우개로 지울 수 있다'], answer: 0, level: 2, explain: '기능(그리기·쓰기)이 본질적 공통점입니다. 나머지는 한쪽에만 해당합니다.' },
    { pair: ['증기', '얼음'], options: ['물의 다른 상태다', '만지면 차갑다', '사람이 만들어 낸 것이다', '하늘 위에 떠 있다'], answer: 0, level: 3, explain: '둘 다 물이 상태만 바뀐 것입니다.' },
    { pair: ['칭찬', '벌'], options: ['행동을 바꾸는 수단이다', '받으면 기분이 좋다', '아이에게만 쓰는 것이다', '말로만 할 수 있다'], answer: 0, level: 3, explain: '정반대로 보이지만 둘 다 행동을 조절하려는 수단입니다.' },
    { pair: ['지도', '설명서'], options: ['모르는 것을 안내한다', '길을 찾을 때만 쓴다', '한 번 보면 다시 볼 일이 없다', '반드시 전문가가 만든다'], answer: 0, level: 4, explain: '둘 다 모르는 것을 찾아가게 돕는 안내 도구입니다. 나머지는 한쪽에만 맞거나 사실이 아닙니다.' },
    { pair: ['뿌리', '기초'], options: ['전체를 떠받치는 바탕이다', '위로 갈수록 두꺼워진다', '시간이 지나면 저절로 사라진다', '식물에게만 있는 것이다'], answer: 0, level: 4, explain: '보이지 않는 곳에서 전체를 지탱한다는 점이 본질입니다.' },
    { pair: ['민주주의', '독재'], options: ['사회를 다스리는 방식이다', '국민이 직접 투표한다', '권력이 한 사람에게 있다', '현대에 와서 생긴 제도다'], answer: 0, level: 5, explain: '정반대의 체제지만 둘 다 "통치 방식"이라는 범주에 속합니다.' },
    { pair: ['희망', '두려움'], options: ['앞일에 대한 감정이다', '마음이 편해지는 감정이다', '주로 밤에 생기는 감정이다', '남에게 숨기는 감정이다'], answer: 0, level: 5, explain: '둘 다 아직 오지 않은 일을 향한 감정입니다.' },
    { pair: ['소문', '뉴스'], options: ['사람들에게 퍼지는 정보다', '언제나 사실에 근거한다', '신문과 방송에만 실린다', '며칠 지나면 모두 잊힌다'], answer: 0, level: 5, explain: '진위와 경로는 다르지만 둘 다 퍼져 나가는 정보입니다.' }
  ].map(function (it) { it.prompt = '"' + it.pair[0] + '"와(과) "' + it.pair[1] + '"의 공통점으로 가장 알맞은 것은?'; return it; });
  const QUICK_VERBAL = [0, 3, 6, 8, 10, 11];
  /* 기호 찾기용 글리프 12종 (세 가지 비대칭 모양 × 네 방향) */
  function glyphSVG(i) {
    const kind = ['triangle', 'arrow', 'lshape'][Math.floor(i / 4) % 3], rot = (i % 4) * 90;
    return '<svg class="glyph" viewBox="0 0 40 40" aria-hidden="true">' + shapeEl(kind, 20, 20, 13, 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"', rot, 0) + '</svg>';
  }
  function choiceItems(r, list, part, timeLimit, cols, withPremise) {
    return list.map(function (v) {
      const o = shuffleOptions(r, v.options, v.answer);
      const tl = typeof timeLimit === 'function' ? timeLimit(v.level) : timeLimit;
      return {
        type: 'choice', part: part, scored: true, level: v.level, timeLimit: tl,
        scenario: withPremise ? v.premise : undefined,
        prompt: withPremise ? (v.options.length && v.premise.indexOf('거짓말') >= 0 ? '거짓말을 하는 사람은 누구일까요?' : '다음 문장이 모두 참일 때, 반드시 참인 것은?') : v.prompt,
        options: o.options, answer: o.answer, optionCols: cols, explain: v.explain
      };
    });
  }

  /* ===== 5. 도형 회전 (1~5단계) ===== */
  function makePolyomino(r, n) {
    const cells = {}; cells['1,1'] = true;
    let count = 1, guard = 0;
    while (count < n && guard++ < 400) {
      const arr = Object.keys(cells).map(function (s) { return s.split(',').map(Number); });
      const c = r.pick(arr), d = r.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      const nx = c[0] + d[0], ny = c[1] + d[1];
      if (nx < 0 || ny < 0 || nx > 3 || ny > 3) continue;
      const k = nx + ',' + ny;
      if (!cells[k]) { cells[k] = true; count++; }
    }
    return Object.keys(cells).map(function (s) { return s.split(',').map(Number); });
  }
  function normalize(cells) {
    const minx = Math.min.apply(null, cells.map(function (c) { return c[0]; }));
    const miny = Math.min.apply(null, cells.map(function (c) { return c[1]; }));
    return cells.map(function (c) { return [c[0] - minx, c[1] - miny]; });
  }
  function polyKey(cells) { return normalize(cells).map(function (c) { return c.join(','); }).sort().join(';'); }
  function rotate(cells) { return cells.map(function (c) { return [-c[1], c[0]]; }); }
  function mirror(cells) { return cells.map(function (c) { return [-c[0], c[1]]; }); }
  function rotations(cells) { const out = []; let cur = cells; for (let i = 0; i < 4; i++) { out.push(cur); cur = rotate(cur); } return out; }
  function has(cells, p) { return cells.some(function (c) { return c[0] === p[0] && c[1] === p[1]; }); }
  function connected(cells) {
    if (!cells.length) return false;
    const seen = {}; const stack = [cells[0]]; seen[cells[0].join(',')] = true;
    let n = 0;
    while (stack.length) {
      const c = stack.pop(); n++;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        const p = [c[0] + d[0], c[1] + d[1]];
        if (has(cells, p) && !seen[p.join(',')]) { seen[p.join(',')] = true; stack.push(p); }
      });
    }
    return n === cells.length;
  }
  function mutate(r, shape) {
    for (let t = 0; t < 60; t++) {
      const idx = r.int(0, shape.length - 1);
      const rest = shape.filter(function (_, i) { return i !== idx; });
      if (!connected(rest)) continue;
      const cand = [];
      rest.forEach(function (c) {
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          const p = [c[0] + d[0], c[1] + d[1]];
          if (!has(rest, p) && !(p[0] === shape[idx][0] && p[1] === shape[idx][1]) && !has(cand, p)) cand.push(p);
        });
      });
      if (!cand.length) continue;
      return rest.concat([r.pick(cand)]);
    }
    return null;
  }
  function polySVG(cells) {
    const n = normalize(cells);
    const w = Math.max.apply(null, n.map(function (c) { return c[0]; })) + 1;
    const h = Math.max.apply(null, n.map(function (c) { return c[1]; })) + 1;
    const g = Math.max(5, w, h);
    const ox = (g - w) / 2, oy = (g - h) / 2;
    return '<svg class="cell poly" viewBox="0 0 ' + g + ' ' + g + '" aria-hidden="true">' + n.map(function (c) {
      return '<rect x="' + (c[0] + ox) + '" y="' + (c[1] + oy) + '" width="1" height="1" fill="currentColor" stroke="var(--surface)" stroke-width="0.08"/>';
    }).join('') + '</svg>';
  }
  function makeRotation(r, level) {
    const size = level >= 4 ? 7 : level === 3 ? 6 : 5;
    let shape, rots, mirs, guard = 0;
    while (guard++ < 300) {
      shape = makePolyomino(r, size);
      if (shape.length < size) continue;
      rots = rotations(shape);
      const keys = rots.map(polyKey);
      if (keys.length !== new Set(keys).size) continue;
      mirs = rotations(mirror(shape));
      const mkeys = mirs.map(polyKey);
      if (mkeys.some(function (k) { return keys.indexOf(k) >= 0; })) continue;
      if (mkeys.length !== new Set(mkeys).size) continue;
      break;
    }
    const k = r.int(1, 3);
    const used = {};
    rots.map(polyKey).forEach(function (x) { used[x] = true; });
    mirs.map(polyKey).forEach(function (x) { used[x] = true; });
    const dis = [r.pick(mirs)];
    let g2 = 0;
    // 4단계부터는 오답 셋 다 거울상에 가까운 모양이라 더 어렵다
    while (dis.length < 3 && g2++ < 100) {
      const m = mutate(r, level >= 4 || r.next() < 0.5 ? mirror(shape) : shape);
      if (!m || !connected(m)) continue;
      const mk = rotations(m).map(polyKey);
      if (mk.some(function (x) { return used[x]; })) continue;
      mk.forEach(function (x) { used[x] = true; });
      dis.push(r.pick(rotations(m)));
    }
    while (dis.length < 3) dis.push(mirs[dis.length]);
    const o = shuffleOptions(r, [rots[k]].concat(dis), 0);
    return {
      type: 'choice', part: 'rotation', scored: true, level: level, timeLimit: level >= 4 ? 50 : 40,
      prompt: '위 도형을 돌리기만 해서 만들 수 있는 것은? (뒤집으면 안 됩니다)',
      promptHtml: '<div class="poly-prompt">' + polySVG(shape) + '</div>',
      optionsHtml: o.options.map(polySVG), answer: o.answer, optionCols: 4,
      explain: '정답은 원래 도형을 ' + (k * 90) + '° 돌린 모양입니다. 나머지는 거울에 비친 모양이거나 칸 하나의 위치가 다른 도형입니다.'
    };
  }

  /* ===== 구성 ===== */
  const DOMAINS = [
    { key: 'fluid', label: '규칙 찾기',
      what: '처음 보는 문제에서 숨은 규칙을 찾아내는 힘이에요. 지능검사에서 가장 중요하게 보는 능력이고, 전문 용어로는 "유동 추론"이라고 불러요.',
      where: '새 일을 배울 때, 처음 보는 기계나 앱을 만질 때, 보드게임 규칙을 익힐 때, 뭔가 고장 났을 때 원인을 찾는 데 쓰여요. 이게 좋은 사람은 설명서 없이도 금방 감을 잡아요.' },
    { key: 'verbal', label: '언어',
      what: '단어의 뜻을 알고, 말과 글의 앞뒤를 따져서 맞는 결론을 내는 힘이에요.',
      where: '글을 빨리 정확하게 읽기, 내 생각을 말이나 글로 전하기, 계약서나 안내문에서 중요한 조건 골라내기, 시험 공부에 바로 쓰여요. 외국어를 배우는 속도와도 관계가 있어요.' },
    { key: 'spatial', label: '공간',
      what: '머릿속에서 모양을 돌리고 뒤집어 보는 힘이에요.',
      where: '주차할 때, 지도를 보고 길을 찾을 때, 가구를 어디에 놓을지 그려 볼 때, 뭔가 조립할 때 쓰여요. 그림, 설계, 운동처럼 손과 눈을 함께 쓰는 일에서 특히 중요해요.' },
    { key: 'memory', label: '기억',
      what: '방금 본 것을 머릿속에 잠깐 붙들어 두고, 그대로 떠올리거나 순서를 바꾸는 힘이에요. "작업 기억"이라고 하는데, 오래 기억하는 것과는 달라요. 성인은 보통 숫자를 앞으로 5~9개, 거꾸로 4~7개쯤 외워요.',
      where: '암산, 전화번호나 주문 외우기, 여러 지시를 한 번에 듣고 처리하기, 긴 대화에서 요점을 놓치지 않기에 쓰여요. 이게 약하면 여러 일을 같이 할 때 자꾸 뭔가를 빠뜨려요.' },
    { key: 'speed', label: '속도·주의',
      what: '빨리 반응하면서도 방해되는 것에 흔들리지 않는 힘이에요. 기기나 터치 반응 속도에 따라 조금씩 다르게 나올 수 있어요.',
      where: '운전 중 급브레이크, 게임, 서류에서 오타 찾기, 시끄러운 곳에서 할 일에 집중하기에 쓰여요. 피곤하거나 잠이 부족하면 가장 먼저 떨어지는 능력이기도 해요.' }
  ];
  const TASKS = {
    matrix: { label: '도형 행렬', domain: 'fluid', minutes: 9, desc: '칸들이 어떤 규칙으로 바뀌는지 찾아서, 빈칸에 들어갈 도형을 보기 8개 중에서 골라요. 칸 하나에는 테두리, 안쪽 모양, 선, 모서리 점이 들어가고, 뒤로 갈수록 여러 규칙이 한꺼번에 섞여요.', where: '처음 보는 규칙을 빨리 알아채는 힘을 봐요. 새 프로그램이나 보드게임을 금방 익히는 사람이 잘해요.' },
    figAnalogy: { label: '도형 유추', domain: 'fluid', minutes: 5, desc: 'A가 B로 바뀐 방식을 보고, C를 똑같이 바꾸면 뭐가 되는지 골라요. 뒤로 갈수록 바뀌는 게 늘어나요.', where: '"A가 B로 됐으니 C는 이렇게 되겠네"를 찾는 힘이에요. 남이 하는 방법을 보고 내 상황에 그대로 적용할 때 쓰여요.' },
    series: { label: '도형 계열', domain: 'fluid', minutes: 3, desc: '왼쪽부터 차례로 변해 가는 도형 네 개를 보고 다섯 번째를 골라요.', where: '변화의 흐름을 읽고 다음을 내다보는 힘이에요. 추세를 보고 앞일을 짐작하는 일에 쓰여요.' },
    sequence: { label: '수열', domain: 'fluid', minutes: 5, desc: '숫자 다섯 개의 규칙을 찾아 여섯 번째 숫자를 골라요. 뒤로 가면 규칙 두 개가 번갈아 나오거나 소수, 제곱수 같은 게 쓰여요.', where: '숫자 속 규칙을 찾는 힘이에요. 수학, 코딩, 돈 흐름 읽기처럼 숫자를 다루는 일과 관계가 깊어요.' },
    weights: { label: '저울 추론', domain: 'fluid', minutes: 6, desc: '균형 잡힌 저울들을 보고 도형들의 무게 관계를 알아낸 뒤, 마지막 저울의 균형을 맞추는 보기를 골라요. 뒤로 가면 도형이 세 종류가 되고 저울 두 개를 이어서 풀어야 해요.', where: '조건 여러 개를 동시에 맞춰 보는 힘이에요. 예산 맞추기, 시간표 짜기, 공평하게 나누기 같은 일에 쓰여요.' },
    analogy: { label: '언어 유추', domain: 'verbal', minutes: 4, desc: '앞 단어 쌍이 어떤 관계인지 보고, 같은 관계가 되게 빈칸에 들어갈 단어를 골라요.', where: '단어 사이의 관계를 알아채는 힘이에요. 비유를 이해하고, 설명을 잘하고, 농담의 포인트를 빨리 잡는 데 쓰여요.' },
    vocab: { label: '어휘', domain: 'verbal', minutes: 4, desc: '주어진 낱말과 뜻이 가장 가까운 말, 또는 반대말을 골라요. 뒤로 갈수록 보기 드문 낱말이 나와요.', where: '아는 단어가 얼마나 많고 정확한지 봐요. 글을 빨리 읽고 정확하게 쓰는 힘의 바탕이에요.' },
    logic: { label: '논리 추론', domain: 'verbal', minutes: 6, desc: '문장이 참이라고 칠 때 반드시 참인 결론을 골라요. 그럴듯한 게 아니라 "반드시" 맞는 걸 찾는 게 포인트예요.', where: '말이 되는지 아닌지 따지는 힘이에요. 계약서나 규정 읽기, 토론, 가짜 뉴스 걸러내기에 쓰여요.' },
    similar: { label: '공통점 찾기', domain: 'verbal', minutes: 4, desc: '두 낱말이 공통으로 속하는 묶음이나 하는 일을 골라요. 겉모습이 아니라 본질적인 공통점을 찾아야 해요.', where: '서로 다른 것에서 공통점을 찾는 힘이에요. 개념을 정리하고 분류하고 요약하는 데 쓰여요.' },
    rotation: { label: '도형 회전', domain: 'spatial', minutes: 3, desc: '위 도형을 돌리기만 해서 만들 수 있는 걸 골라요. 거울처럼 뒤집은 건 정답이 아니에요.', where: '머릿속에서 모양을 돌리는 힘이에요. 주차, 지도 읽기, 조립, 그림 그리기에 쓰여요.' },
    digitF: { label: '숫자 앞으로', domain: 'memory', minutes: 2, desc: '숫자가 한 자리씩 나타나요. 보이는 순서 그대로 입력해요.', where: '들은 걸 그대로 잠깐 기억하는 힘이에요. 전화번호나 주문을 외우는 데 쓰여요.' },
    digitB: { label: '숫자 거꾸로', domain: 'memory', minutes: 2, desc: '보이는 순서를 거꾸로 뒤집어 입력해요. 예: 3 7 1 → 1 7 3', where: '기억한 걸 머릿속에서 뒤집는 힘이에요. 암산이나 순서를 거꾸로 따져 보는 일에 쓰여요.' },
    grid: { label: '위치 기억', domain: 'memory', minutes: 2, desc: '격자의 칸이 차례로 켜져요. 켜진 순서 그대로 눌러요.', where: '위치를 순서대로 기억하는 힘이에요. 길을 기억하거나 물건 둔 자리를 떠올릴 때 쓰여요.' },
    lns: { label: '숫자-문자 순서', domain: 'memory', minutes: 3, desc: '숫자와 한글 자음이 섞여 하나씩 나타나요. 다 본 뒤 숫자는 작은 것부터, 그다음 자음은 ㄱㄴㄷ 순서로 눌러요. 예: 7 ㄷ 2 ㄱ → 2 7 ㄱ ㄷ', where: '기억하면서 동시에 정리하는 힘이에요. 여러 지시를 한 번에 받아 순서대로 처리하는 일에 쓰여요.' },
    reaction: { label: '단순 반응', domain: 'speed', minutes: 1, desc: '화면이 초록색으로 바뀌는 순간 최대한 빨리 눌러요.', where: '신호에 얼마나 빨리 반응하는지 봐요. 운전 중 급브레이크, 공 받기 같은 순발력이에요.' },
    choicert: { label: '선택 반응', domain: 'speed', minutes: 1, desc: '화살표가 나타나면 같은 방향 버튼을 최대한 빨리 눌러요. PC에서는 방향키도 돼요.', where: '보고 판단해서 맞는 쪽으로 반응하는 속도예요. 게임, 운동, 신호 보고 움직이기에 쓰여요.' },
    stroop: { label: '색-단어 간섭', domain: 'speed', minutes: 1, desc: '글자의 "색"을 골라요. 글자가 뜻하는 색 이름은 무시해요. 예: 파란색으로 쓰인 "주황" → 파랑.', where: '습관적인 반응을 참고 필요한 것에 집중하는 힘이에요. 딴생각 누르고 할 일 하기, 실수 줄이기에 쓰여요.' },
    symbol: { label: '기호 찾기', domain: 'speed', minutes: 2, desc: '왼쪽 기호 두 개 중 하나라도 오른쪽 다섯 개 안에 있으면 "있음", 없으면 "없음"을 골라요. 60초 동안 최대한 많이, 정확하게요.', where: '많은 것 중에서 찾는 걸 빨리 골라내는 힘이에요. 명단에서 이름 찾기, 오타 찾기, 서류 검토에 쓰여요.' }
  };
  const TASK_KEYS = Object.keys(TASKS);
  const QUICK = ['matrix', 'sequence', 'analogy', 'rotation', 'digitF', 'reaction'];
  const LEVEL_KO = { 1: '쉬움', 2: '보통', 3: '어려움', 4: '매우 어려움', 5: '최상', 6: '극상' };

  /* 난이도 단계별 예상 정답률 (문항 설계 기준). 포함된 문항의 평균이 그 과제의 기준 정답률이 된다. */
  const LEVEL_P = {
    default: { 1: 0.92, 2: 0.80, 3: 0.62, 4: 0.42, 5: 0.25, 6: 0.12 },
    rotation: { 1: 0.85, 2: 0.75, 3: 0.60, 4: 0.45, 5: 0.35 },
    series: { 1: 0.90, 2: 0.72, 3: 0.50 }
  };
  /* 임시 기준값: prop = 정답률(평균은 LEVEL_P로 계산), span = 폭, rt = 반응 시간(ms, 낮을수록 좋음). 공인 규준이 아니다. */
  const NORMS = {
    matrix: { kind: 'prop', sd: 0.20 }, figAnalogy: { kind: 'prop', sd: 0.20 }, series: { kind: 'prop', sd: 0.22 }, sequence: { kind: 'prop', sd: 0.20 }, weights: { kind: 'prop', sd: 0.22 },
    analogy: { kind: 'prop', sd: 0.18 }, vocab: { kind: 'prop', sd: 0.18 }, logic: { kind: 'prop', sd: 0.20 }, similar: { kind: 'prop', sd: 0.18 }, rotation: { kind: 'prop', sd: 0.22 },
    /* 폭 과제: 한 개씩 보여 주고 같은 길이를 두 번까지 시도하는 방식(공인 검사와 같은 규칙)의 20~30대 기준.
       숫자 앞으로 7, 거꾸로 5, 위치(코르시) 6, 숫자-문자 5~6 정도가 보통이라 그 근처에 둔다. 기준을 낮게 잡으면 기억 IQ가 부풀어 보인다. */
    digitF: { kind: 'span', mean: 7.0, sd: 1.1 }, digitB: { kind: 'span', mean: 5.2, sd: 1.2 }, grid: { kind: 'span', mean: 6.0, sd: 1.1 }, lns: { kind: 'span', mean: 5.6, sd: 1.2 },
    reaction: { kind: 'rt', mean: 280, sd: 45 }, choicert: { kind: 'rt', mean: 480, sd: 80 }, stroop: { kind: 'rt', mean: 800, sd: 130 },
    symbol: { kind: 'count', mean: 24, sd: 6 }
  };
  /* 터치 화면은 마우스·키보드보다 입력 지연이 길어(대략 30ms) 반응 과제 기준값에 그만큼 더한다. 응답의 절반 이상이 터치면 적용. */
  const TOUCH_MS = 30;
  const IQ_RANGE = [55, 145];
  /* 라쉬(1PL)+찍기 확률 모형의 사후 최빈값. obs = [{b: 난이도, c: 찍기 확률, ok}], 사전분포 N(0, 1.5²) */
  function irtTheta(obs) {
    let best = 0, bestLp = -Infinity;
    for (let th = -4; th <= 4.0001; th += 0.05) {
      let lp = -0.5 * (th / 1.5) * (th / 1.5);
      obs.forEach(function (o) { const pr = o.c + (1 - o.c) / (1 + Math.exp(-(th - o.b))); lp += Math.log(Math.max(1e-6, o.ok ? pr : 1 - pr)); });
      if (lp > bestLp) { bestLp = lp; best = th; }
    }
    return best;
  }
  function iqOf(z) { return Math.round(U.clamp(100 + 15 * z, IQ_RANGE[0], IQ_RANGE[1])); }
  function topPct(z) { return Math.max(1, Math.round((1 - U.normCdf(z)) * 100)); }
  function compositeZ(zs, r) {
    const k = zs.length;
    if (!k) return 0;
    if (k === 1) return zs[0];
    return U.clamp(U.mean(zs) / Math.sqrt((1 + (k - 1) * r) / k), -3, 3);
  }
  function band(iq) {
    return iq >= 130 ? '매우 우수' : iq >= 120 ? '우수' : iq >= 110 ? '평균 상' : iq >= 90 ? '평균' : iq >= 80 ? '평균 하' : iq >= 70 ? '경계선' : '낮음';
  }

  /* 과제별 문항 구성: 쉬운 단계부터 어려운 단계로 */
  const LEVELS = {
    matrix: { full: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6], quick: [1, 2, 3, 4, 5, 6] },
    figAnalogy: { full: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5] },
    weights: { full: [1, 2, 2, 3, 3, 4, 4, 5] },
    series: { full: [1, 1, 2, 2, 3, 3] },
    sequence: { full: [1, 2, 2, 3, 3, 4, 4, 5], quick: [1, 2, 3, 4, 5] },
    rotation: { full: [1, 2, 3, 4, 5, 5], quick: [1, 2, 4, 5] }
  };
  const byLevel = function (list) { return list.slice().sort(function (a, b) { return a.level - b.level; }); };
  const BUILD = {
    matrix: function (r, full) { return (full ? LEVELS.matrix.full : LEVELS.matrix.quick).map(function (l) { return makeMatrix(r, l); }); },
    figAnalogy: function (r) { return LEVELS.figAnalogy.full.map(function (l) { return makeFigAnalogy(r, l); }); },
    weights: function (r) { return LEVELS.weights.full.map(function (l) { return makeWeights(r, l); }); },
    similar: function (r) { return choiceItems(r, byLevel(SIMILAR), 'similar', 35, 1); },
    lns: function () { return [{ type: 'seqspan', part: 'lns', scored: true, start: 2, max: 8, title: '숫자-문자 순서', desc: TASKS.lns.desc }]; },
    symbol: function () { return [{ type: 'symsearch', part: 'symbol', scored: true, seconds: 60, title: '기호 찾기', desc: TASKS.symbol.desc }]; },
    series: function (r) { return LEVELS.series.full.map(function (l) { return makeSeries(r, l); }); },
    sequence: function (r, full) { return (full ? LEVELS.sequence.full : LEVELS.sequence.quick).map(function (l) { return makeSequence(r, l); }); },
    analogy: function (r, full) { return choiceItems(r, byLevel(full ? VERBAL : QUICK_VERBAL.map(function (i) { return VERBAL[i]; })), 'analogy', function (l) { return l >= 4 ? 45 : 40; }, 2); },
    vocab: function (r) { return choiceItems(r, byLevel(VOCAB), 'vocab', 35, 1); },
    logic: function (r) { return choiceItems(r, byLevel(LOGIC), 'logic', function (l) { return l >= 4 ? 75 : 60; }, 1, true); },
    rotation: function (r, full) { return (full ? LEVELS.rotation.full : LEVELS.rotation.quick).map(function (l) { return makeRotation(r, l); }); },
    digitF: function () { return [{ type: 'digitspan', part: 'digitF', scored: true, mode: 'forward', start: 3, max: 9, title: '숫자 앞으로 외우기', desc: TASKS.digitF.desc }]; },
    digitB: function () { return [{ type: 'digitspan', part: 'digitB', scored: true, mode: 'backward', start: 2, max: 8, title: '숫자 거꾸로 외우기', desc: TASKS.digitB.desc }]; },
    grid: function () { return [{ type: 'gridspan', part: 'grid', scored: true, start: 3, max: 9, title: '위치 기억', desc: TASKS.grid.desc }]; },
    reaction: function () { return [{ type: 'reaction', part: 'reaction', scored: true, trials: 5, title: '단순 반응', desc: TASKS.reaction.desc }]; },
    choicert: function () { return [{ type: 'choicert', part: 'choicert', scored: true, trials: 16, title: '선택 반응', desc: TASKS.choicert.desc }]; },
    stroop: function () { return [{ type: 'stroop', part: 'stroop', scored: true, trials: 16, title: '색-단어 간섭', desc: TASKS.stroop.desc }]; }
  };
  const COUNT_KO = {
    matrix: function (f) { return (f ? 12 : 6) + '문항 · 60~120초 · 1~6단계 · 보기 8개'; }, series: function () { return '6문항 · 40~50초 · 1~3단계'; },
    figAnalogy: function () { return '10문항 · 45~60초 · 1~5단계'; }, weights: function () { return '8문항 · 60~90초 · 1~5단계'; }, similar: function () { return '11문항 · 35초 · 1~5단계'; },
    sequence: function (f) { return (f ? 8 : 5) + '문항 · 50~60초 · 1~5단계'; }, analogy: function (f) { return (f ? 12 : 6) + '문항 · 40~45초 · 1~5단계'; },
    vocab: function () { return '12문항 · 35초 · 1~5단계'; }, logic: function () { return '11문항 · 60~75초 · 1~5단계'; }, rotation: function (f) { return (f ? 6 : 4) + '문항 · 40~50초 · 1~5단계'; }
  };

  /* 처음 보는 과제 앞에 붙는 연습 문제 (시간 제한 없음, 점수 없음, 풀고 나면 정답과 규칙을 보여 준다) */
  const PRACTICE = {
    matrix: function (r) { return makeMatrix(r, 1); },
    figAnalogy: function (r) { return makeFigAnalogy(r, 1); },
    weights: function (r) { return makeWeights(r, 1); },
    similar: function (r) { return choiceItems(r, [SIMILAR[0]], 'similar', 0, 1)[0]; },
    series: function (r) { return makeSeries(r, 1); },
    sequence: function (r) { return makeSequence(r, 1); },
    rotation: function (r) { return makeRotation(r, 1); },
    analogy: function (r) { return choiceItems(r, [VERBAL[0]], 'analogy', 0, 2)[0]; },
    logic: function (r) { return choiceItems(r, [LOGIC[1]], 'logic', 0, 1, true)[0]; }
  };
  function practiceItem(r, key) {
    const it = PRACTICE[key](r);
    it.practice = true; it.scored = false; it.part = undefined; it.timeLimit = 0; it.level = undefined;
    it.prompt = '연습 · ' + it.prompt;
    return it;
  }
  function taskItems(r, key, full, withPractice) {
    const items = [];
    if (COUNT_KO[key]) items.push({ type: 'section', sub: true, title: TASKS[key].label, desc: TASKS[key].desc + ' 쉬운 것부터 나오고 뒤로 갈수록 어려워져요.' + (withPractice && PRACTICE[key] ? ' 먼저 연습 문제를 하나 풀어 볼게요. 연습은 점수에 안 들어가요.' : ''), where: TASKS[key].where, count: COUNT_KO[key](full) });
    if (withPractice && PRACTICE[key]) items.push(practiceItem(r, key));
    return items.concat(BUILD[key](r, full));
  }

  /* ===== 적응형 진행: 맞히면 한 단계 위, 틀리면 한 단계 아래. 문항은 그때그때 생성한다. =====
     스텁(type 'adaptive')이 과제 자리에 놓이고, 엔진이 adaptNext()로 다음 문항을 받아 스텁 앞에 끼운 뒤
     답이 오면 adaptRecord()로 상태를 갱신한다. 스텁 상태는 세션에 함께 저장된다. */
  const ADAPT = {
    matrix: { n: 8, start: 3, max: 6 }, figAnalogy: { n: 7, start: 3, max: 5 }, series: { n: 5, start: 2, max: 3 },
    sequence: { n: 6, start: 3, max: 5 }, weights: { n: 6, start: 2, max: 5 }, rotation: { n: 5, start: 3, max: 5 },
    analogy: { n: 7, start: 3, max: 5 }, vocab: { n: 7, start: 3, max: 5 }, logic: { n: 7, start: 3, max: 5 }, similar: { n: 7, start: 3, max: 5 }
  };
  const GEN = { matrix: makeMatrix, figAnalogy: makeFigAnalogy, series: makeSeries, sequence: makeSequence, weights: makeWeights, rotation: makeRotation };
  const POOL = { analogy: VERBAL, vocab: VOCAB, logic: LOGIC, similar: SIMILAR };
  const POOL_OPTS = { analogy: [40, 2, false], vocab: [35, 1, false], logic: [60, 1, true], similar: [35, 1, false] };
  function adaptStub(key) {
    const a = ADAPT[key];
    return { type: 'adaptive', part: key, scored: false, count: a.n, state: { done: 0, level: a.start, max: a.max, used: [], levels: [], oks: [] } };
  }
  function adaptNext(stub) {
    if (!stub || stub.type !== 'adaptive') return null;
    const st = stub.state, key = stub.part;
    if (st.done >= stub.count) return null;
    const r = U.rng();
    let item;
    if (GEN[key]) item = GEN[key](r, st.level);
    else {
      const pool = POOL[key];
      const all = pool.map(function (it, i) { return { it: it, i: i }; }).filter(function (x) { return st.used.indexOf(x.i) < 0; });
      let cand = [];
      for (let d = 0; d <= 5 && !cand.length; d++) cand = all.filter(function (x) { return x.it.level === st.level - d || x.it.level === st.level + d; });
      if (!cand.length) cand = all;
      if (!cand.length) return null;
      const pick = r.pick(cand);
      st.used.push(pick.i);
      const o = POOL_OPTS[key];
      item = choiceItems(r, [pick.it], key, o[0], o[1], o[2])[0];
    }
    item.adaptive = true;
    return item;
  }
  function adaptRecord(stub, item, answer) {
    if (!stub || stub.type !== 'adaptive' || !item) return;
    const st = stub.state, ok = answer === item.answer;
    st.levels.push(item.level); st.oks.push(ok); st.done += 1;
    st.level = ok ? Math.min(st.max, st.level + 1) : Math.max(1, st.level - 1);
  }
  function taskItemsAdaptive(r, key, withPractice) {
    const a = ADAPT[key];
    const items = [{ type: 'section', sub: true, title: TASKS[key].label, desc: TASKS[key].desc + ' ' + a.start + '단계에서 시작해서 맞히면 한 단계 올라가고 틀리면 내려가요.' + (withPractice && PRACTICE[key] ? ' 먼저 연습 문제를 하나 풀어 볼게요. 연습은 점수에 안 들어가요.' : ''), where: TASKS[key].where, count: a.n + '문항 · 적응형 · 1~' + a.max + '단계' }];
    if (withPractice && PRACTICE[key]) items.push(practiceItem(r, key));
    items.push(adaptStub(key));
    return items;
  }
  function parseMode(mode) {
    if (typeof mode === 'string' && mode.indexOf('task:') === 0 && TASKS[mode.slice(5)]) return { kind: 'task', key: mode.slice(5) };
    return { kind: mode === 'quick' ? 'quick' : mode === 'full' ? 'full' : 'adaptive' };
  }
  function modeLabel(mode) {
    const m = parseMode(mode);
    return m.kind === 'task' ? '과제별 검사 · ' + TASKS[m.key].label : m.kind === 'quick' ? '빠른 검사' : m.kind === 'full' ? '정밀 검사' : '적응형 검사';
  }

  /* opts.practiced: 이미 해 본 과제 키 배열 → 그 과제는 연습 문제를 건너뛴다 */
  function build(mode, opts) {
    opts = opts || {};
    const practiced = opts.practiced || [];
    const wantPractice = function (k) { return opts.practice !== false && practiced.indexOf(k) < 0; };
    const m = parseMode(mode);
    const r = U.rng();
    const adaptive = m.kind === 'adaptive' || m.kind === 'task';
    const make = function (k, full) { return adaptive && ADAPT[k] ? taskItemsAdaptive(r, k, wantPractice(k)) : taskItems(r, k, full, wantPractice(k)); };
    if (m.kind === 'task') return make(m.key, true);
    const full = m.kind !== 'quick';
    const items = [];
    const part = function (num, d, desc, keys) {
      const use = keys.filter(function (k) { return full || QUICK.indexOf(k) >= 0; });
      if (!use.length) return;
      items.push({ type: 'section', num: num, title: d.label, desc: desc, where: d.where, count: use.length + '과제 · ' + use.map(function (k) { return TASKS[k].label; }).join(', ') });
      use.forEach(function (k) { items.push.apply(items, make(k, full)); });
    };
    part(1, DOMAINS[0], '도형과 숫자에 숨은 규칙을 찾아요. 문제마다 제한 시간이 있고, 시간이 다 되면 자동으로 넘어가요.', ['matrix', 'figAnalogy', 'series', 'sequence', 'weights']);
    part(2, DOMAINS[1], '단어의 뜻과 관계, 문장의 앞뒤를 따져요.', ['analogy', 'vocab', 'logic', 'similar']);
    part(3, DOMAINS[2], '머릿속에서 도형을 돌려 봐요.', ['rotation']);
    part(4, DOMAINS[3], '숫자와 위치를 잠깐 기억했다가 그대로, 거꾸로, 또는 정리해서 떠올려요. 틀려도 같은 길이로 한 번 더 기회가 있어요.', ['digitF', 'digitB', 'grid', 'lns']);
    part(5, DOMAINS[4], '최대한 빠르고 정확하게 반응해요. 조용한 곳에서 화면을 똑바로 보고 해 주세요.', ['reaction', 'choicert', 'stroop', 'symbol']);
    return items;
  }

  /* ===== 과제별 통계 → z ===== */
  function taskStats(key, rows, review) {
    const norm = NORMS[key];
    if (norm.kind === 'prop') {
      const n = rows.length, c = rows.filter(function (x) { return x.a === x.it.answer; }).length;
      const lv = {};
      rows.forEach(function (x) { const l = x.it.level || 0; lv[l] = lv[l] || { c: 0, n: 0 }; lv[l].n++; if (x.a === x.it.answer) lv[l].c++; });
      const lvText = Object.keys(lv).filter(function (l) { return l !== '0'; }).sort().map(function (l) { return LEVEL_KO[l] + ' ' + lv[l].c + '/' + lv[l].n; }).join(' · ');
      const ts = rows.map(function (x) { return x.t; }).filter(function (t) { return typeof t === 'number'; });
      const avg = ts.length ? Math.max(1, Math.round(U.mean(ts) / 1000)) : null;
      rows.forEach(function (x, idx) {
        if (x.a === x.it.answer || !x.it.explain) return;
        const rv = { title: TASKS[key].label + ' ' + (idx + 1) + '번' + (x.it.level ? ' · ' + LEVEL_KO[x.it.level] : ''), explain: x.it.explain, prompt: x.it.prompt, scenario: x.it.scenario, promptHtml: x.it.promptHtml };
        if (x.it.optionsHtml) { rv.chosenHtml = x.a == null ? null : x.it.optionsHtml[x.a]; rv.answerHtml = x.it.optionsHtml[x.it.answer]; }
        else { rv.chosen = x.a == null ? null : x.it.options[x.a]; rv.answer = x.it.options[x.it.answer]; }
        review.push(rv);
      });
      const LP = LEVEL_P[key] || LEVEL_P.default;
      const ps = rows.map(function (x) { return LP[x.it.level]; }).filter(function (p) { return typeof p === 'number'; });
      const meanP = ps.length ? U.mean(ps) : 0.6;
      const p = n ? c / n : 0;
      // 문항 난이도를 반영한 능력 추정(라쉬 모형 + 찍기 확률): 어느 단계를 맞혔는지가 점수에 들어간다
      const obs = rows.filter(function (x) { return x.it.level && LP[x.it.level]; }).map(function (x) {
        const pl = LP[x.it.level];
        return { b: Math.log((1 - pl) / pl), c: 1 / (((x.it.options || x.it.optionsHtml || []).length) || 4), ok: x.a === x.it.answer };
      });
      const theta = obs.length ? irtTheta(obs) : (p - meanP) / norm.sd;
      const adaptive = rows.some(function (x) { return x.it.adaptive; });
      const top = rows.filter(function (x) { return x.a === x.it.answer && x.it.level; }).map(function (x) { return x.it.level; });
      const maxReached = top.length ? Math.max.apply(null, top) : 0;
      return { z: U.clamp(theta, -3, 3), raw: c + '/' + n + ' 정답', detail: lvText + (adaptive ? (lvText ? ' · ' : '') + '맞힌 최고 단계 ' + maxReached : '') + (avg != null ? ' · 평균 ' + avg + '초' : ''), meanP: adaptive ? undefined : Math.round(meanP * 100) };
    }
    if (norm.kind === 'span') {
      const it = rows[0].it;
      const s = typeof rows[0].a === 'number' ? rows[0].a : it.start - 1;
      return { z: U.clamp((s - norm.mean) / norm.sd, -3, 3), raw: Math.max(s, it.start - 1) + (key === 'grid' ? '칸' : key === 'lns' ? '개' : '자리'), detail: '' };
    }
    if (norm.kind === 'count') {
      const a = rows[0].a && typeof rows[0].a === 'object' ? rows[0].a : { correct: 0, wrong: 0 };
      const net = Math.max(0, (a.correct || 0) - (a.wrong || 0));
      const tot = (a.correct || 0) + (a.wrong || 0);
      return { z: U.clamp((net - norm.mean) / norm.sd, -3, 3), raw: net + '개/60초', detail: tot ? '정답 ' + a.correct + ' · 오답 ' + a.wrong + ' · 정확도 ' + Math.round(a.correct / tot * 100) + '%' : '' };
    }
    const raw0 = rows[0].a;
    const a = Array.isArray(raw0) ? raw0 : raw0 && Array.isArray(raw0.times) ? raw0.times : [];
    const touchN = Array.isArray(raw0) ? a.filter(function (x) { return x && x.touch; }).length : (raw0 && raw0.touch) || 0;
    const touch = a.length > 0 && touchN / a.length >= 0.5;
    const mean = norm.mean + (touch ? TOUCH_MS : 0), tnote = touch ? ' · 터치 기준' : '';
    if (key === 'reaction') {
      const med = a.length ? U.median(a) : null;
      return { z: med == null ? -3 : U.clamp((mean - med) / norm.sd, -3, 3), raw: med == null ? '측정 안 됨' : Math.round(med) + 'ms', detail: (a.length ? '최고 ' + Math.min.apply(null, a) + 'ms' : '') + tnote };
    }
    const ok = a.filter(function (x) { return x.ok; });
    const acc = a.length ? ok.length / a.length : 0;
    let pool = ok, extra = '';
    if (key === 'stroop') {
      const cong = ok.filter(function (x) { return x.cong; }).map(function (x) { return x.rt; });
      const inc = ok.filter(function (x) { return !x.cong; }).map(function (x) { return x.rt; });
      pool = ok.filter(function (x) { return !x.cong; });
      if (cong.length && inc.length) { const d = Math.round(U.median(inc) - U.median(cong)); extra = ' · 간섭 ' + (d >= 0 ? '+' : '') + d + 'ms'; }
    }
    const med = pool.length ? U.median(pool.map(function (x) { return x.rt; })) : null;
    let z = med == null ? -3 : U.clamp((mean - med) / norm.sd, -3, 3);
    if (acc < 0.75) z = Math.min(z, -1);
    return { z: z, raw: med == null ? '측정 안 됨' : Math.round(med) + 'ms', detail: '정확도 ' + Math.round(acc * 100) + '%' + extra + tnote };
  }

  /* 과제별 z 모음 → 영역·종합 결과 객체 */
  function assemble(tasks, opts) {
    const scales = [], sections = [];
    const domZ = [];
    DOMAINS.forEach(function (d) {
      const keys = TASK_KEYS.filter(function (k) { return TASKS[k].domain === d.key && tasks[k]; });
      if (!keys.length) return;
      const z = compositeZ(keys.map(function (k) { return tasks[k].z; }), 0.6);
      domZ.push(z);
      const iq = iqOf(z);
      scales.push({ key: d.key, label: d.label, value: iq, range: IQ_RANGE, raw: '상위 ' + topPct(z) + '%',
        children: keys.map(function (k) { return { key: k, label: TASKS[k].label, value: iqOf(tasks[k].z), range: IQ_RANGE, raw: tasks[k].raw }; }) });
      sections.push({ title: d.label + ' · 추정 IQ ' + iq, body: '과제별 결과: ' + keys.map(function (k) { return TASKS[k].label + ' ' + tasks[k].raw + (tasks[k].detail ? ' (' + tasks[k].detail + ')' : '') + (tasks[k].meanP ? ' · 기준 정답률 ' + tasks[k].meanP + '%' : ''); }).join(', ') + '.' });
    });
    const keys = Object.keys(tasks);
    const single = keys.length === 1 ? keys[0] : null;
    const z = single ? tasks[single].z : compositeZ(domZ, 0.5);
    const iq = iqOf(z), pct = topPct(z), bd = band(iq);
    const rel = keys.length * 0.45 / (1 + (keys.length - 1) * 0.45);
    const sem = Math.round(15 * Math.sqrt(1 - rel));
    const bandText = {
      '매우 우수': '같은 기준으로 100명 중 두세 명 안에 드는 결과예요.',
      '우수': '대부분의 사람보다 빠르고 정확했어요.',
      '평균 상': '평균보다 조금 높은 범위예요.',
      '평균': '보통 성인의 평균 범위 안에 있어요.',
      '평균 하': '평균보다 조금 낮은 범위예요. 문제 형식에 익숙해지면 오르는 경우가 많아요.',
      '경계선': '시간에 쫓겼거나 주변 환경의 영향이 컸을 수 있어요. 조용한 곳에서 다시 해 보길 권해요.',
      '낮음': '집중하기 어려운 환경이었거나 문제 형식이 낯설었을 수 있어요. 조용한 곳에서 다시 해 보길 권해요.'
    }[bd];
    let summary, headline;
    if (single) {
      headline = TASKS[single].label + ' 추정 IQ ' + iq;
      summary = bandText + ' ' + TASKS[single].label + ' 과제 하나만으로 낸 점수라 전체 검사보다 오차가 커요. 다른 과제도 풀면 하나로 합쳐져요.';
    } else {
      const sorted = scales.slice().sort(function (a, b) { return b.value - a.value; });
      headline = (opts.merged ? '종합 ' : '') + '추정 IQ ' + iq;
      const weak = sorted[sorted.length - 1];
      summary = bandText + ' 가장 강한 쪽은 ' + sorted[0].label + ' ' + sorted[0].value + '이고, ' + weak.label + ' ' + U.josa(weak.value, '은', '는') + ' 연습하면 더 오를 여지가 있어요.' +
        (keys.length < TASK_KEYS.length ? ' ' + TASK_KEYS.length + '개 과제 중 ' + keys.length + '개를 반영했어요.' : '');
    }
    sections.push({ title: '점수 읽는 법', body: '추정 IQ는 평균이 100인 IQ 눈금으로 바꾼 점수예요. 열 명 중 일곱 명쯤이 85~115 사이에 들어가요. "상위 %"는 그 눈금에서 내 위치고, ±' + U.josa(sem, '은', '는') + ' 오차 범위예요. 실제 값이 그 안에 있을 확률이 70% 정도고, 과제를 많이 풀수록 범위가 좁아져요. 점수는 몇 개를 맞혔는지가 아니라 어느 단계 문제를 맞혔는지로 계산해요. 각 단계의 난이도는 설계할 때 정한 예상 정답률이라, 실제 응시 데이터로 보정하기 전까지는 공인 지능검사의 IQ와 같다고 볼 수 없어요. 같은 과제를 여러 번 하면 익숙해져서 점수가 올라요.' });
    return { headline: headline, value: iq, sem: sem, label: bd + ' · 상위 ' + pct + '% · ±' + sem, summary: summary, scales: single ? scales[0].children : scales, sections: sections, tasks: tasks, z: z };
  }

  function score(answers, items, meta) {
    meta = meta || {};
    const times = meta.times || [];
    const byPart = {};
    items.forEach(function (it, i) { if (!it.scored) return; (byPart[it.part] = byPart[it.part] || []).push({ it: it, a: answers[i], t: times[i] }); });
    const review = [];
    const tasks = {};
    TASK_KEYS.forEach(function (k) { if (byPart[k]) tasks[k] = taskStats(k, byPart[k], review); });
    const res = assemble(tasks, {});
    res.modeLabel = modeLabel(meta.mode);
    res.review = review;
    return res;
  }

  /* 저장된 결과들에서 과제별 최근 z를 모아 종합 프로필을 만든다 */
  function merge(results) {
    const latest = {};
    (results || []).forEach(function (r) {
      if (!r || r.testId !== 'cognitive' || !r.tasks) return;
      Object.keys(r.tasks).forEach(function (k) {
        if (!TASKS[k]) return;
        if (!latest[k] || (r.at || 0) >= latest[k].at) latest[k] = { at: r.at || 0, stat: r.tasks[k] };
      });
    });
    const keys = Object.keys(latest);
    if (!keys.length) return null;
    const tasks = {};
    keys.forEach(function (k) { tasks[k] = latest[k].stat; });
    const res = assemble(tasks, { merged: true });
    const missing = TASK_KEYS.filter(function (k) { return !tasks[k]; });
    res.modeLabel = '종합 프로필';
    res.coverage = { done: keys.length, total: TASK_KEYS.length, missing: missing.map(function (k) { return TASKS[k].label; }) };
    res.sections.unshift({ title: '합친 범위', body: TASK_KEYS.length + '개 과제 중 ' + keys.length + '개의 가장 최근 결과를 합쳤어요.' + (missing.length ? ' 아직 안 한 과제: ' + res.coverage.missing.join(', ') + '.' : ' 모든 과제가 들어갔어요.') + ' 과제를 다시 풀면 그 과제의 최신 결과로 바뀌어요.' });
    return res;
  }

  BL.tests.cognitive = {
    id: 'cognitive',
    num: 1,
    kind: 'measure',
    kindLabel: '측정',
    title: '인지 능력 검사',
    subtitle: '규칙 찾기, 언어, 공간 감각, 기억력, 반응 속도와 집중. 머리 쓰는 힘 다섯 가지를 18개 과제로 재서 추정 IQ로 보여 줘요. 한 번에 다 풀어도 되고 하나씩 해도 돼요.',
    duration: '과제당 1~9분',
    length: '18과제',
    timed: true,
    modes: [
      { id: 'adaptive', label: '적응형 검사', desc: '맞히면 다음 문제가 어려워지고 틀리면 쉬워져요. 내 실력 근처에서 집중해서 재니까 짧아도 정확해요. 처음이면 이걸 추천해요.', duration: '약 35분', length: '18과제' },
      { id: 'quick', label: '빠른 검사', desc: '대표 과제 6개만 골라 다섯 영역을 한 번씩 훑어요. 시간이 없을 때 맛보기로 좋아요.', duration: '약 12분', length: '6과제' },
      { id: 'full', label: '정밀 검사', desc: '18개 과제의 모든 단계를 처음부터 끝까지 다 풀어요. 가장 길지만, 단계별 정답률과 틀린 문제 다시 보기까지 볼 수 있어요.', duration: '약 50분', length: '18과제' }
    ],
    glyphSVG: glyphSVG,
    adaptNext: adaptNext,
    adaptRecord: adaptRecord,
    _internals: { OPS: OPS, logicRows: logicRows, logicK: logicK, kUnique: kUnique, altNext: altNext, VERBAL: VERBAL, VOCAB: VOCAB, LOGIC: LOGIC, SIMILAR: SIMILAR },
    tasks: TASK_KEYS.map(function (k) { return { key: k, label: TASKS[k].label, domain: TASKS[k].domain, domainLabel: DOMAINS.filter(function (d) { return d.key === TASKS[k].domain; })[0].label, minutes: TASKS[k].minutes }; }),
    domains: DOMAINS.map(function (d) { return { key: d.key, label: d.label }; }),
    explain: DOMAINS.map(function (d) { return { label: d.label, what: d.what, where: d.where, tasks: TASK_KEYS.filter(function (k) { return TASKS[k].domain === d.key; }).map(function (k) { return TASKS[k].label; }).join(', ') }; }),
    intro: [
      '결과는 IQ 점수로 나와요. 보통 사람 평균이 100이고, 열 명 중 일곱 명쯤이 85에서 115 사이에 들어가요. 병원이나 기관에서 받는 공인 검사의 IQ는 아니고 참고용 추정치예요.',
      '문제는 쉬운 것부터 시작해서 점점 어려워져요. 뒤쪽 단계는 실제 지능검사에서 어려운 문제로 나오는 유형이에요.',
      '도형과 숫자 문제는 할 때마다 새로 만들어져서 같은 문제가 두 번 나오지 않아요.',
      '한 번에 다 풀어도 되고, 오늘은 기억력만, 내일은 수열만 이렇게 따로 풀어도 돼요. 따로 푼 결과는 알아서 하나로 합쳐져요.',
      '점수는 몇 개 맞혔는지가 아니라 어느 단계까지 맞혔는지로 계산해요. 어려운 문제를 맞히면 더 크게 올라가요.'
    ],
    build: build,
    score: score,
    merge: merge
  };
})();
