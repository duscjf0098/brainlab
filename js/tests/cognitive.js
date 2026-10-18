/* 실험 01 · 인지 능력 검사
   5개 영역(규칙 찾기(유동 추론) · 언어 · 공간 · 기억 · 속도·주의), 20개 과제.
   사용자에게 보이는 설명은 쉬운 말, 해요체. 영역·과제마다 what(무엇을 재나)·where(일상에서 어디에 쓰이나)를 둔다.
   빠른 검사(7과제) · 정밀 검사(20과제) · 과제별 단독 검사(task:<key>)를 지원하고,
   따로 본 과제들은 merge()로 종합 프로필에 합쳐진다.

   난이도: 문항마다 1~5단계가 있고 쉬운 것부터 나온다. 4~5단계는 실제 지능검사의 상위 문항 유형
   (레이븐식 회전·논리 연산·선 겹침 규칙, 다단계 수열, 고난도 어휘·삼단논법)을 따른다.
   점수는 IQ 척도(평균 100, 표준편차 15)로 환산한다. 기준값(NORMS, LEVEL_P)은 설계값과 AI 평가자가 어림한 예상 정답률,
   일반 성인 추정치이며 공인 규준이 아니다. 영역·종합 점수는 가상 응시자 시뮬레이션으로 규준화한다(OBS).
   실제 응시 데이터가 쌓이면 바꿔야 한다. 익명 통계(js/stats.js → server/)로 모인 자료는 tools/norms-from-stats.cjs 가 NORMS·LEVEL_P 로 바꿔 준다.
   도형 행렬 · 도형 계열 · 수열 · 도형 회전 · 전개도 접기 · 블록 세기 문항은 규칙 기반으로 매번 새로 생성한다 (원본 문항). */
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
  /* 크기 단계는 약 1.4배씩 벌린다(넓이로는 약 2배). 예전 8·11·14는 "중간"과 "크게"가 1.27배 차이뿐이라, 모양이 다른 칸끼리는 크기를 가리기 어려웠다.
     선 두께도 크기와 함께 조금 바뀐다(작은 도형의 안쪽 채움이 선에 묻히지 않게). */
  const RADIUS = { s: 7.2, m: 10.2, l: 14.2 };
  const STROKE = { s: 2.1, m: 2.4, l: 2.6 };
  /* 모양별 [크기 보정, 반폭]. 크기 보정: 같은 단계면 모양이 달라도 비슷한 크기로 보이게(예전엔 큰 네모가 중간 원만 해 보였다).
     반폭: 도형 여럿을 놓을 때 쓰는, 반지름 대비 가로·세로로 차지하는 반쪽 길이(어느 방향으로 돌려도). */
  const SHAPE_FIT = { circle: [0.94, 0.94], square: [1.2, 0.85], triangle: [1.12, 0.97], diamond: [1.04, 1.04], pentagon: [1.02, 0.97], hexagon: [1, 1], star: [1.08, 1.03], cross: [0.95, 0.95], arrow: [0.98, 0.98], lshape: [0.9, 0.95] };
  /* 점 채움 자리 [x, y, 점 반지름](반지름 대비). ㄱ자는 가운데가 도형 밖이라 꺾인 모서리에, 화살표는 몸통에 찍는다. */
  const DOT_AT = { lshape: [-0.47, 0.67, 0.2], arrow: [0, 0.3, 0.22] };
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
    if (shape === 'circle') el = '<circle cx="' + cx + '" cy="' + cy + '" r="' + +(r * SHAPE_FIT.circle[0]).toFixed(2) + '" ' + attrs + '/>';
    else if (shape === 'arrow') el = poly([[0, -1], [0.66, -0.3], [0.34, -0.3], [0.34, 1], [-0.34, 1], [-0.34, -0.3], [-0.66, -0.3]], SHAPE_FIT.arrow[0]);
    else if (shape === 'lshape') el = poly([[-0.8, -1], [-0.14, -1], [-0.14, 0.34], [0.8, 0.34], [0.8, 1], [-0.8, 1]], SHAPE_FIT.lshape[0]);
    else if (shape === 'cross') el = poly([[-0.33, -1], [0.33, -1], [0.33, -0.33], [1, -0.33], [1, 0.33], [0.33, 0.33], [0.33, 1], [-0.33, 1], [-0.33, 0.33], [-1, 0.33], [-1, -0.33], [-0.33, -0.33]], SHAPE_FIT.cross[0]);
    else if (shape === 'star') {
      const pts = [];
      for (let i = 0; i < 10; i++) { const a = (-90 + i * 36) * Math.PI / 180, rr = (i % 2 === 0 ? 1 : 0.5) * r * SHAPE_FIT.star[0]; pts.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1)); }
      el = '<polygon points="' + pts.join(' ') + '" ' + attrs + '/>';
    } else {
      const n = { triangle: 3, square: 4, diamond: 4, pentagon: 5, hexagon: 6 }[shape];
      const off = { triangle: -90, square: 45, diamond: -90, pentagon: -90, hexagon: 0 }[shape];
      const rr = r * SHAPE_FIT[shape][0];
      el = '<polygon points="' + polygonPoints(cx, cy, rr, n, off) + '" ' + attrs + '/>';
    }
    const tf = (flip ? 'translate(' + (2 * cx) + ' 0) scale(-1 1) ' : '') + (rot ? 'rotate(' + rot + ' ' + cx + ' ' + cy + ')' : '');
    // 변환은 요소에 바로 붙인다. <g>로 감싸면 빗금 칠하기의 clipPath 안에서 <g>가 무시돼, 돌리거나 뒤집은 도형의 빗금이 사라졌다.
    return tf ? el.replace(/^<(\w+) /, '<$1 transform="' + tf.trim() + '" ') : el;
  }
  function frameEl(frame) {
    const a = 'fill="none" stroke="currentColor" stroke-width="1.8" opacity=".9"';
    if (!frame || frame === 'none') return '';
    if (frame === 'square') return '<rect x="7" y="7" width="86" height="86" rx="3" ' + a + '/>';
    if (frame === 'circle') return '<circle cx="50" cy="50" r="44" ' + a + '/>';
    if (frame === 'diamond') return '<polygon points="' + polygonPoints(50, 50, 46, 4, -90) + '" ' + a + '/>';
    // 육각 틀은 대각선 쪽이 안으로 들어와 있어, 큰 도형 3~4개와 닿지 않게 조금 크게 그린다
    return '<polygon points="' + polygonPoints(50, 50, 48, 6, 0) + '" ' + a + '/>';
  }
  function cellSVG(cell) {
    const r = RADIUS[cell.size];
    // 여럿일 때는 크기가 클수록 간격을 벌려 서로 닿지 않게 한다(도형 크기는 그대로라 칸끼리 크기 비교에는 영향이 없다)
    const k = Math.max(1, (2 * SHAPE_FIT[cell.shape][1] * r + STROKE[cell.size] + 2.2) / 30);
    const at = function (cx, cy, list) { return list.map(function (p) { return [+(cx + p[0] * k).toFixed(1), +(cy + p[1] * k).toFixed(1)]; }); };
    let pos;
    if (cell.count === 1) pos = [POS_XY[cell.pos || 'c']];
    else if (cell.count === 2) pos = at(50, 50, [[-16, 0], [16, 0]]);
    else if (cell.count === 3) pos = at(50, 52.5, [[0, -19], [-16.5, 9.5], [16.5, 9.5]]);
    else pos = at(50, 50, [[-15, -15], [15, -15], [-15, 15], [15, 15]]);
    const rot = ASYM.indexOf(cell.shape) >= 0 ? (cell.rot || 0) : 0;
    const flip = cell.shape === 'lshape' ? !!cell.flip : false;
    let body = frameEl(cell.frame), defs = '';
    const base = 'stroke="currentColor" stroke-width="' + STROKE[cell.size] + '" stroke-linejoin="round"';
    (cell.lines || '').split('').forEach(function (k) {
      const l = LINE_DEF[k]; if (!l) return;
      body += '<line x1="' + l[0] + '" y1="' + l[1] + '" x2="' + l[2] + '" y2="' + l[3] + '" stroke="currentColor" stroke-width="1.6" opacity=".7"/>';
    });
    pos.forEach(function (p) {
      if (cell.fill === 'none') body += shapeEl(cell.shape, p[0], p[1], r, base + ' fill="none"', rot, flip);
      else if (cell.fill === 'solid') body += shapeEl(cell.shape, p[0], p[1], r, base + ' fill="currentColor"', rot, flip);
      else if (cell.fill === 'half') {
        const id = 'clip' + (++uid);
        defs += '<clipPath id="' + id + '"><rect x="' + +(p[0] - 1.4 * r - 4).toFixed(1) + '" y="' + +(p[1] - 1.4 * r - 4).toFixed(1) + '" width="' + +(1.4 * r + 4).toFixed(1) + '" height="' + +(2.8 * r + 8).toFixed(1) + '"/></clipPath>';
        body += shapeEl(cell.shape, p[0], p[1], r, 'fill="currentColor" stroke="none" clip-path="url(#' + id + ')"', rot, flip);
        body += shapeEl(cell.shape, p[0], p[1], r, base + ' fill="none"', rot, flip);
      } else if (cell.fill === 'hatch') {
        const id = 'clip' + (++uid);
        defs += '<clipPath id="' + id + '">' + shapeEl(cell.shape, p[0], p[1], r, '', rot, flip) + '</clipPath>';
        let h = '';
        for (let i = -3; i <= 3; i++) { const o = i * r * 0.5, e = 1.3 * r + 2; h += '<line x1="' + +(p[0] - e + o).toFixed(1) + '" y1="' + +(p[1] + e).toFixed(1) + '" x2="' + +(p[0] + e + o).toFixed(1) + '" y2="' + +(p[1] - e).toFixed(1) + '" stroke="currentColor" stroke-width="1.5"/>'; }
        body += '<g clip-path="url(#' + id + ')">' + h + '</g>';
        body += shapeEl(cell.shape, p[0], p[1], r, base + ' fill="none"', rot, flip);
      } else {
        body += shapeEl(cell.shape, p[0], p[1], r, base + ' fill="none"', rot, flip);
        // 점도 도형과 함께 돌리고 뒤집는다(도형의 변환은 돌린 다음 뒤집는 순서)
        const d = DOT_AT[cell.shape] || [0, 0, 0.32], s = SHAPE_FIT[cell.shape][0] * r, t = rot * Math.PI / 180;
        const dx = (d[0] * Math.cos(t) - d[1] * Math.sin(t)) * s * (flip ? -1 : 1), dy = (d[0] * Math.sin(t) + d[1] * Math.cos(t)) * s;
        body += '<circle cx="' + +(p[0] + dx).toFixed(1) + '" cy="' + +(p[1] + dy).toFixed(1) + '" r="' + (r * d[2]).toFixed(1) + '" fill="currentColor"/>';
      }
    });
    (cell.marks || '').split('').forEach(function (k) {
      const m = MARK_POS[k]; if (!m) return;
      body += '<circle cx="' + m[0] + '" cy="' + m[1] + '" r="4" fill="currentColor"/>';
    });
    // zoom: 틀·선·모서리 점·위치가 없는 칸(도형 계열)은 가장자리 빈 곳을 잘라 도형을 크게 보여 준다. 폰에서 계열 칸은 다섯 개가 한 줄이라 작다.
    return '<svg class="cell" viewBox="' + (cell.zoom ? '10 10 80 80' : '0 0 100 100') + '" aria-hidden="true">' + (defs ? '<defs>' + defs + '</defs>' : '') + body + '</svg>';
  }
  const cellKey = function (c) { return ALL_ATTRS.map(function (a) { return c[a] == null ? '' : c[a]; }).join('|'); };
  /* 보기 크기(행렬 칸의 약 2/3)에서 눈으로 가리기 어려운 칸이 있는지. 그림을 픽셀로 그려 서로 비교해 정했다.
     작은(s) 별·십자·화살표·ㄱ자는 안쪽이 좁아 반 채움·점·빗금이 서로 비슷해 보이고(작은 삼각형은 점·빗금이),
     작은 원과 육각형은 거의 같아 보인다. 이런 칸이 나오는 문항은 다시 만든다. 규칙으로는 정답이 하나여도 그림으로 안 보이면 답이 없어 보인다. */
  const FAINT_FILL = { star: ['half', 'dot', 'hatch'], cross: ['half', 'dot', 'hatch'], arrow: ['half', 'dot', 'hatch'], lshape: ['half', 'dot', 'hatch'], triangle: ['dot', 'hatch'] };
  function legible(cells) {
    let circle = false, hexagon = false, smallRound = false;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (c.size === 's' && (FAINT_FILL[c.shape] || []).indexOf(c.fill) >= 0) return false;
      if (c.shape === 'circle') circle = true;
      if (c.shape === 'hexagon') hexagon = true;
      if (c.size === 's' && (c.shape === 'circle' || c.shape === 'hexagon')) smallRound = true;
    }
    return !(circle && hexagon && smallRound);
  }
  const RETRY = 40;
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

  function makeMatrix(r, level, tries) {
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
    if ((tries || 0) < RETRY && !legible(cells.concat(o.options))) return makeMatrix(r, level, (tries || 0) + 1);

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
  function makeFigAnalogy(r, level, tries) {
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
    if ((tries || 0) < RETRY && !legible([A, B, C].concat(o.options))) return makeFigAnalogy(r, level, (tries || 0) + 1);
    const explain = 'A에서 B로: ' + trans.map(function (t) {
      const p = T[t];
      if (p.to) return t === 'frame' && p.to === 'none' ? '틀이 없어짐' : U.josa(TRANS_KO[t], '이', '가') + ' ' + U.josa(VAL_KO[t][p.to], '으로', '로') + ' 바뀜';
      if (t === 'size') return '크기가 한 단계 커짐';
      if (t === 'count') return '개수가 하나 늘어남';
      if (t === 'rot') return (p.step > 0 ? '시계 방향' : '반시계 방향') + '으로 90° 돎';
      if (t === 'flip') return '좌우가 뒤집힘';
      return TRANS_KO[t] + ': ' + OPK_KO[p.op];
    }).join(', ') + '. 같은 변화를 C에 적용한 게 정답이에요.' + (noise.length ? ' C는 A와 ' + U.josa(noise.map(function (a) { return TRANS_KO[a]; }).join('·'), '이', '가') + ' 다르지만 바뀌는 규칙은 같아요.' : '');
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
      prompt: '위 저울들은 모두 균형이 맞아요. 마지막 저울의 물음표 자리에 올려야 균형이 맞는 것은?',
      promptHtml: '<div class="scales-given">' + givens.map(function (g) { return scaleSVG(g[0], g[1]); }).join('') + scaleSVG(qLeft, null) + '</div>',
      optionsHtml: o.options.map(panSVG), answer: o.answer, optionCols: 2,
      explain: '가장 가벼운 ' + U.josa(VAL_KO.shape[shapes[0]], '을', '를') + ' 1로 두면 ' + U.josa(names, '이에요', '예요') + '. 물음표 저울의 왼쪽 무게는 ' + U.josa(cands.t, '이니까', '니까') + ' 무게가 ' + cands.t + '인 보기가 정답이에요.'
    };
  }

  /* ===== 2. 도형 계열 완성 (1~3단계) ===== */
  function makeSeries(r, level, tries) {
    const active = r.sample(ATTRS, level);
    const base = {}; ATTRS.forEach(function (a) { base[a] = r.pick(DOMAIN[a]); });
    base.frame = 'none'; base.pos = 'c'; base.rot = 0; base.flip = 0; base.marks = ''; base.lines = ''; base.zoom = 1;
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
    if ((tries || 0) < RETRY && !legible(cells.concat(o.options))) return makeSeries(r, level, (tries || 0) + 1);
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
      arith: function () { const a = r.int(1, 20), d = r.int(2, 9); return { seq: six(function (i) { return a + d * i; }), explain: '앞의 수에 ' + U.josa(d, '을', '를') + ' 더해요.' }; },
      arithNeg: function () { const a = r.int(50, 95), d = r.int(3, 9); return { seq: six(function (i) { return a - d * i; }), explain: '앞의 수에서 ' + U.josa(d, '을', '를') + ' 빼요.' }; },
      geo: function () { const a = r.int(1, 4), q = r.pick([2, 3]); return { seq: six(function (i) { return a * Math.pow(q, i); }), explain: '앞의 수에 ' + U.josa(q, '을', '를') + ' 곱해요.' }; },
      alt: function () { const a = r.int(1, 15), d1 = r.int(4, 9), d2 = r.int(1, 3); let x = a; const s = []; for (let i = 0; i < 6; i++) { s.push(x); x += i % 2 === 0 ? d1 : -d2; } return { seq: s, explain: '+' + U.josa(d1, '과', '와') + ' −' + U.josa(d2, '이', '가') + ' 번갈아 적용돼요.' }; },
      square: function () { const k = r.int(-3, 5), off = r.int(1, 3); return { seq: six(function (i) { return (i + off) * (i + off) + k; }), explain: '제곱수(' + off + '², ' + (off + 1) + '², ' + (off + 2) + '², …)' + (k === 0 ? '예요.' : k > 0 ? '에 ' + U.josa(k, '을', '를') + ' 더한 수예요.' : '에서 ' + U.josa(-k, '을', '를') + ' 뺀 수예요.') }; },
      fib: function () { const a = r.int(1, 5), b = r.int(a + 1, 9); const s = [a, b]; while (s.length < 6) s.push(s[s.length - 1] + s[s.length - 2]); return { seq: s, explain: '앞의 두 수를 더한 값이 다음 수예요.' }; },
      inter: function () { const a = r.int(1, 9), d1 = r.int(1, 4), b = r.int(10, 40), d2 = r.int(3, 10); return { seq: six(function (i) { return i % 2 === 0 ? a + d1 * (i / 2) : b + d2 * ((i - 1) / 2); }), explain: '두 수열이 번갈아 나와요. ' + a + '부터 ' + d1 + '씩, ' + b + '부터 ' + d2 + '씩 커져요.' }; },
      second: function () { const a = r.int(1, 10), d = r.int(1, 4), inc = r.int(1, 3); let x = a, step = d; const s = []; for (let i = 0; i < 6; i++) { s.push(x); x += step; step += inc; } return { seq: s, explain: '이웃한 수의 차이가 ' + d + ', ' + (d + inc) + ', ' + (d + 2 * inc) + '…처럼 ' + inc + '씩 늘어나요.' }; },
      mulAdd: function () { const a = r.int(2, 5), k = r.pick([1, -1, 3]); let x = a; const s = []; for (let i = 0; i < 6; i++) { s.push(x); x = x * 2 + k; } return { seq: s, explain: '앞의 수를 2배 한 뒤 ' + (k > 0 ? U.josa(k, '을', '를') + ' 더해요.' : U.josa(-k, '을', '를') + ' 빼요.') }; },
      /* 4단계 */
      mulSub: function () { const a = r.int(3, 6), k = r.int(1, 3); let x = a; const s = []; for (let i = 0; i < 6; i++) { s.push(x); x = x * 2 - k; } return { seq: s, explain: '앞의 수를 2배 한 뒤 ' + U.josa(k, '을', '를') + ' 빼요.' }; },
      alt2: function () { const a = r.int(2, 9), d = r.int(2, 5), b = r.int(2, 5); return { seq: six(function (i) { return i % 2 === 0 ? a + d * (i / 2) : b * Math.pow(2, (i - 1) / 2); }), explain: '두 수열이 번갈아 나와요. 홀수 번째는 ' + a + '부터 ' + d + '씩 커지고, 짝수 번째는 ' + b + '부터 2배씩 커져요.' }; },
      primes: function () { const st = r.int(0, 5); return { seq: PRIMES.slice(st, st + 6), explain: '소수(1과 자기 자신으로만 나누어지는 수)가 작은 것부터 차례로 나와요.' }; },
      sqPlusN: function () { const off = r.int(1, 3), sg = r.pick([1, -1]); return { seq: six(function (i) { const n = i + off; return n * n + sg * n; }), explain: 'n²' + (sg > 0 ? '+n' : '−n') + ' (n=' + off + ', ' + (off + 1) + ', …) 꼴이에요. 이웃한 수의 차이가 2씩 늘어나요.' }; },
      /* 5단계 */
      lookback3: function () { const a = r.int(1, 3), b = r.int(1, 3); const s = [a, b, a + b]; while (s.length < 6) s.push(s[s.length - 1] + s[s.length - 2] + s[s.length - 3]); return { seq: s, explain: '앞의 세 수를 더한 값이 다음 수예요.' }; },
      altMulAdd: function () { const a = r.int(2, 5), k = r.int(2, 4); let x = a; const s = []; for (let i = 0; i < 6; i++) { s.push(x); x = i % 2 === 0 ? x * 2 : x + k; } return { seq: s, explain: '×2와 ' + U.josa('+' + k, '이', '가') + ' 번갈아 적용돼요.' }; },
      diffGeo: function () { const a = r.int(1, 5), d = r.pick([1, 2, 3]); let x = a, step = d; const s = []; for (let i = 0; i < 6; i++) { s.push(x); x += step; step *= 2; } return { seq: s, explain: '이웃한 수의 차이가 ' + d + ', ' + d * 2 + ', ' + d * 4 + '…처럼 2배씩 커져요.' }; },
      primesSkip: function () { const st = r.int(0, 3); return { seq: [0, 1, 2, 3, 4, 5].map(function (i) { return PRIMES[st + 2 * i]; }), explain: '소수를 하나씩 건너뛰며 나열한 거예요.' }; }
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

  /* ===== 4. 언어: 유추 · 어휘 · 논리 · 공통점 (원본 문항, 1~5단계. 2026-10-18 단계 재조정 뒤로 단계마다 개수가 다르다) =====
     진행 중인 세션이 문항 번호(state.used)를 저장하므로 순서를 바꾸지 말고 새 문항은 뒤에 붙인다. 쉬운 순서는 byLevel이 맞춘다. */
  const VERBAL = [
    { prompt: '손가락 : 손 = 발가락 : ?', options: ['발', '다리', '무릎', '신발'], answer: 0, level: 1, explain: '손가락이 손의 일부이듯 발가락은 발의 일부예요 (부분과 전체).' },
    { prompt: '뜨겁다 : 차갑다 = 넓다 : ?', options: ['길다', '좁다', '얇다', '작다'], answer: 1, level: 1, explain: '반대말 관계예요.' },
    { prompt: '연필 : 쓰다 = 가위 : ?', options: ['붙이다', '자르다', '재다', '그리다'], answer: 1, level: 1, explain: '도구와 그 도구가 하는 일이에요.' },
    { prompt: '새 : 날개 = 물고기 : ?', options: ['비늘', '아가미', '지느러미', '눈'], answer: 2, level: 2, explain: '움직일 때 쓰는 기관이에요. 날개로 날듯 지느러미로 헤엄쳐요.' },
    { prompt: '온도계 : 온도 = 저울 : ?', options: ['길이', '부피', '무게', '속도'], answer: 2, level: 1, explain: '재는 도구와 그 도구로 재는 대상이에요.' },
    { prompt: '섬 : 바다 = 오아시스 : ?', options: ['강', '사막', '숲', '호수'], answer: 1, level: 2, explain: '넓은 공간 한가운데 따로 떨어진 작은 곳이에요.' },
    { prompt: '나무 : 종이 = 모래 : ?', options: ['시멘트', '유리', '벽돌', '흙'], answer: 1, level: 3, explain: '원료와 그 원료로 만드는 물건이에요. 유리는 모래(규사)로 만들어요.' },
    { prompt: '희소하다 : 흔하다 = 간결하다 : ?', options: ['명확하다', '단순하다', '장황하다', '짤막하다'], answer: 2, level: 2, explain: '반대말 관계예요. 간결하다의 반대는 장황하다예요. 짤막하다·단순하다는 간결하다와 비슷한 쪽이고, 명확하다는 반대말이 아니에요.' },
    { prompt: '지도 : 지형 = 악보 : ?', options: ['음악', '악기', '연주자', '무대'], answer: 0, level: 2, explain: '기호로 옮겨 적은 것과 그 원래 대상이에요. 지도는 지형을, 악보는 음악을 적어요.' },
    { prompt: '증상 : 질병 = 연기 : ?', options: ['불', '공기', '재', '굴뚝'], answer: 0, level: 2, explain: '겉으로 드러나는 신호와 그 원인이에요. 증상은 질병의, 연기는 불의 신호예요.' },
    { prompt: '관대하다 : 엄격하다 = 사치하다 : ?', options: ['검소하다', '인색하다', '빈곤하다', '겸손하다'], answer: 0, level: 3, explain: '반대말 관계예요. 사치의 반대는 검소예요. 인색은 베풀기를 아끼는 것이라 뜻이 달라요.' },
    { prompt: '암시 : 명시 = 함축 : ?', options: ['직설', '생략', '비유', '축약'], answer: 0, level: 5, explain: '넌지시 드러내는 것과 분명히 드러내는 것의 대비예요. 함축의 반대는 직설이에요.' },
    { prompt: '송아지 : 소 = 강아지 : ?', options: ['개', '고양이', '토끼', '돼지'], answer: 0, level: 1, explain: '어린 새끼와 다 자란 동물이에요. 송아지는 소의 새끼이고, 강아지는 개의 새끼예요.' },
    { prompt: '의사 : 병원 = 교사 : ?', options: ['학교', '공장', '은행', '식당'], answer: 0, level: 1, explain: '사람과 그 사람이 일하는 곳이에요. 의사는 병원에서, 교사는 학교에서 일해요.' },
    { prompt: '모자 : 머리 = 장갑 : ?', options: ['손', '발', '목', '귀'], answer: 0, level: 1, explain: '쓰거나 끼는 물건과 그것을 걸치는 몸의 부분이에요. 모자는 머리에 쓰고, 장갑은 손에 껴요.' },
    { prompt: '눈 : 보다 = 귀 : ?', options: ['듣다', '먹다', '맡다', '말하다'], answer: 0, level: 1, explain: '몸의 기관과 그 기관이 하는 일이에요. 눈으로 보고 귀로 들어요. 냄새를 맡는 건 코예요.' },
    { prompt: '애벌레 : 나비 = 올챙이 : ?', options: ['개구리', '물고기', '잠자리', '거북'], answer: 0, level: 1, explain: '어린 모습과 다 자란 모습이에요. 애벌레가 자라 나비가 되고, 올챙이가 자라 개구리가 돼요.' },
    { prompt: '치즈 : 우유 = 두부 : ?', options: ['콩', '쌀', '밀', '깨'], answer: 0, level: 1, explain: '음식과 그 음식을 만드는 재료예요. 치즈는 우유로, 두부는 콩으로 만들어요.' },
    { prompt: '선배 : 후배 = 스승 : ?', options: ['제자', '동료', '친구', '부모'], answer: 0, level: 1, explain: '앞서 이끄는 사람과 뒤따르는 사람의 짝이에요. 선배에게 후배가 있듯 스승에게는 제자가 있어요.' },
    { prompt: '시작 : 끝 = 입구 : ?', options: ['출구', '통로', '문', '계단'], answer: 0, level: 1, explain: '서로 반대되는 짝이에요. 시작의 반대가 끝이고, 입구의 반대는 출구예요.' },
    { prompt: '북 : 치다 = 피리 : ?', options: ['불다', '켜다', '치다', '뜯다'], answer: 0, level: 1, explain: '악기와 그 악기를 연주하는 동작이에요. 북은 치고 피리는 불어요. 바이올린은 켜고, 가야금은 뜯어요.' },
    { prompt: '어둠 : 빛 = 고요 : ?', options: ['소리', '평화', '침묵', '밤'], answer: 0, level: 3, explain: '무엇이 없는 상태와 그 없는 것이에요. 어둠은 빛이 없는 상태이고, 고요는 소리가 없는 상태예요.' },
    { prompt: '탄생 : 죽음 = 개업 : ?', options: ['폐업', '창업', '휴업', '파업'], answer: 0, level: 2, explain: '시작과 끝의 짝이에요. 삶이 탄생으로 시작해 죽음으로 끝나듯, 가게는 개업으로 문을 열고 폐업으로 문을 닫아요. 휴업은 잠시 쉬는 거예요.' },
    { prompt: '항생제 : 세균 = 제초제 : ?', options: ['잡초', '해충', '곰팡이', '비료'], answer: 0, level: 2, explain: '약과 그 약이 없애는 대상이에요. 항생제는 세균을, 제초제는 잡초를 없애요. 해충을 없애는 건 살충제예요.' },
    { prompt: '미소 : 폭소 = 이슬비 : ?', options: ['폭우', '안개', '이슬', '가랑비'], answer: 0, level: 2, explain: '같은 것의 약한 정도와 센 정도예요. 미소는 소리 없이 살짝 웃는 것이고 폭소는 크게 터지는 웃음이듯, 이슬비는 아주 가는 비이고 폭우는 세차게 쏟아지는 비예요.' },
    { prompt: '저자 : 독자 = 화자 : ?', options: ['청자', '작자', '관객', '필자'], answer: 0, level: 3, explain: '전하는 사람과 받는 사람이에요. 글은 저자가 쓰고 독자가 읽으며, 말은 화자가 하고 청자가 들어요. 작자·필자는 글을 쓴 사람이에요.' },
    { prompt: '정밀하다 : 엉성하다 = 신속하다 : ?', options: ['굼뜨다', '날쌔다', '재빠르다', '서투르다'], answer: 0, level: 3, explain: '반대말 관계예요. 정밀하다의 반대가 엉성하다이듯 신속하다의 반대는 굼뜨다예요. 날쌔다·재빠르다는 신속하다와 비슷한 말이에요.' },
    { prompt: '은유 : 비유 = 오각형 : ?', options: ['다각형', '정사각형', '꼭짓점', '원'], answer: 0, level: 3, explain: '좁은 개념과 그것을 품는 넓은 개념이에요. 은유는 비유의 한 방법이고, 오각형은 다각형의 한 종류예요. 정사각형은 오각형과 같은 층에 있는 다른 다각형이에요.' },
    { prompt: '청사진 : 건물 = 각본 : ?', options: ['연극', '배우', '무대', '관객'], answer: 0, level: 2, explain: '미리 짜 둔 계획과 그 계획대로 만들어지는 것이에요. 청사진(설계도)대로 건물을 짓고, 각본대로 연극을 올려요.' },
    { prompt: '천문학 : 별 = 지질학 : ?', options: ['암석', '날씨', '생물', '바다'], answer: 0, level: 2, explain: '학문과 그 학문이 연구하는 대상이에요. 천문학은 별과 우주를, 지질학은 암석과 땅의 구조를 연구해요. 날씨는 기상학이 다뤄요.' },
    { prompt: '분노 : 감정 = 귀납 : ?', options: ['추론', '연역', '결론', '가설'], answer: 0, level: 5, explain: '좁은 개념과 그것이 속한 넓은 개념이에요. 분노는 감정의 한 종류이고, 귀납은 추론의 한 방법이에요. 연역은 귀납과 나란한 다른 추론 방법이에요.' },
    { prompt: '퇴고 : 글 = 조율 : ?', options: ['악기', '음악', '노래', '무대'], answer: 0, level: 4, explain: '바르게 다듬는 일과 그 대상이에요. 퇴고는 글을 여러 번 고쳐 다듬는 일이고, 조율은 악기의 음을 바른 높이로 맞추는 일이에요.' },
    { prompt: '탁월하다 : 뛰어나다 = 진부하다 : ?', options: ['케케묵다', '참신하다', '새롭다', '흔쾌하다'], answer: 0, level: 3, explain: '뜻이 비슷한 말의 짝이에요. 탁월하다는 뛰어나다와, 진부하다는 낡아서 새롭지 못하다는 뜻이라 케케묵다와 가까워요. 참신하다·새롭다는 반대말이에요.' },
    { prompt: '박식하다 : 지식 = 노련하다 : ?', options: ['경험', '나이', '재능', '체력'], answer: 0, level: 3, explain: '무엇이 많아서 갖춘 성질이에요. 박식하다는 아는 것이 많다는 뜻이고, 노련하다는 경험이 많아 익숙하고 능란하다는 뜻이에요. 나이가 많다는 뜻은 아니에요.' },
    { prompt: '구두 : 말 = 서면 : ?', options: ['글', '신발', '얼굴', '서명'], answer: 0, level: 2, explain: '뜻을 전하는 방식이에요. 구두는 입으로 하는 말로, 서면은 종이에 쓴 글로 전한다는 뜻이에요. 여기서 구두는 신발이 아니에요.' },
    { prompt: '다리 : 강 = 통역 : ?', options: ['언어', '번역', '통역사', '외국'], answer: 0, level: 4, explain: '다리가 강에 가로막힌 양쪽을 이어 주듯, 통역은 서로 다른 언어에 가로막힌 사람들을 이어 줘요. 번역도 언어를 옮기는 일이지만 통역과 나란한 다른 방식일 뿐, 통역이 건너게 해 주는 장벽이 아니에요.' },
    { prompt: '이정표 : 목적지 = 실마리 : ?', options: ['해결', '단서', '실타래', '사건'], answer: 0, level: 5, explain: '이정표를 따라가면 끝내 목적지에 이르듯, 실마리를 따라 풀어 가면 끝내 해결에 이르러요. 실타래는 실마리의 본래 뜻(실의 첫머리)에서 떠올리기 쉬운 함정이에요. 단서는 실마리와 비슷한 말이에요. 사건은 실마리로 풀어 갈 대상일 뿐 실마리가 이끌어 내는 결과가 아니에요.' },
    { prompt: '절약 : 인색 = 용기 : ?', options: ['만용', '비겁', '용맹', '자신감'], answer: 0, level: 4, explain: '절약이 지나쳐 흠이 되면 인색이 되듯, 용기가 지나쳐 앞뒤를 가리지 않게 되면 만용이 돼요. 비겁은 용기가 지나친 쪽이 아니라 모자란 쪽이에요. 용맹은 용기가 강한 것일 뿐 여전히 좋은 뜻이라서 \'지나쳐서 흠이 됨\'과 맞지 않아요.' },
    { prompt: '독백 : 대사 = 독주 : ?', options: ['연주', '합주', '독창', '악기'], answer: 0, level: 4, explain: '독백은 혼자서 하는 대사이고, 독주는 혼자서 하는 연주예요. 독창도 \'혼자\'라는 점은 같지만 연주가 아니라 노래를 혼자 부르는 것이에요. 합주는 여럿이 함께하는 연주라 관계가 맞지 않아요.' },
    { prompt: '예방 : 치료 = 대비 : ?', options: ['수습', '준비', '대비책', '사고'], answer: 0, level: 4, explain: '병이 생기기 전에 막는 것이 예방이고 생긴 뒤에 고치는 것이 치료이듯, 일이 생기기 전에 갖추는 것이 대비이고 생긴 뒤에 바로잡는 것이 수습이에요. 준비는 대비처럼 \'일이 생기기 전\'에 하는 일이라서 짝이 되지 않아요.' },
    { prompt: '기후 : 날씨 = 성격 : ?', options: ['기분', '성품', '체질', '기질'], answer: 0, level: 5, explain: '기후는 오랜 기간에 걸친 평균적인 경향이고, 날씨는 그날그날 바뀌는 상태예요. 성격도 오래 유지되는 경향이니 그때그때 바뀌는 상태인 기분이 짝이에요. 성품과 기질은 성격과 비슷한 말이라 둘 다 \'오래가는 쪽\'에 머물러 있어서 짝이 되지 않아요.' },
    { prompt: '화약 : 도화선 = 불만 : ?', options: ['계기', '폭발', '불평', '해소'], answer: 0, level: 5, explain: '화약은 터질 힘이 쌓여 있는 것이고, 도화선은 거기에 불을 옮겨 붙여 터지게 만드는 심지예요. 쌓인 불만도 어떤 계기를 만나야 겉으로 터져 나와요. 폭발은 화약이 터진 결과 쪽이라 도화선 자리에 맞지 않아요.' },
    { prompt: '가설 : 실험 = 초안 : ?', options: ['검토', '원고', '완성본', '작성'], answer: 0, level: 5, explain: '가설은 실험으로 맞는지 확인하고, 초안은 검토로 고칠 곳을 확인해요. 작성은 초안을 만드는 단계이고 완성본은 검토가 끝난 뒤의 결과예요. 그래서 둘 다 이미 만든 것을 확인하는 절차 자리에는 맞지 않아요.' },
    { prompt: '고집 : 소신 = 우유부단 : ?', options: ['신중', '결단력', '소심', '경솔'], answer: 0, level: 5, explain: '고집과 소신은 같은 태도를 나쁘게 보느냐 좋게 보느냐의 차이예요. 우유부단을 좋게 보면 신중이에요. 결단력은 우유부단과 반대되는 성질이라, 같은 태도를 달리 본 관계가 아니에요.' },
    { prompt: '희극 : 연극 = 산문 : ?', options: ['글', '운문', '수필', '시'], answer: 0, level: 5, explain: '희극은 연극의 한 갈래이고, 산문은 글의 한 갈래예요. 운문은 산문과 나란한 다른 갈래예요. 수필은 거꾸로 산문에 속하는 갈래라서 방향이 반대예요.' }
  ];
  /* 어휘: 표준국어대사전에 있는 낱말만 쓴다. 동음이의어의 다른 뜻이 오답 보기와 겹치지 않게 골랐다. */
  const VOCAB = [
    { prompt: '"명료하다"와 뜻이 가장 가까운 말은?', options: ['분명하다', '복잡하다', '느슨하다', '화려하다'], answer: 0, level: 1, explain: '명료하다는 뚜렷하고 분명하다는 뜻이에요.' },
    { prompt: '"빈번하다"와 뜻이 가장 가까운 말은?', options: ['잦다', '드물다', '급하다', '넓다'], answer: 0, level: 1, explain: '빈번하다는 일이 자주 일어나 잦다는 뜻이에요.' },
    { prompt: '"인색하다"의 반대말에 가장 가까운 것은?', options: ['후하다', '검소하다', '무심하다', '성실하다'], answer: 0, level: 2, explain: '인색은 베풀기를 아끼는 것이고, 반대는 "후하다"예요.' },
    { prompt: '"경솔하다"의 반대말에 가장 가까운 것은?', options: ['신중하다', '대담하다', '느리다', '겸손하다'], answer: 0, level: 2, explain: '경솔은 깊이 생각하지 않고 가볍게 행동하는 것이고, 반대는 신중이에요.' },
    { prompt: '"유보하다"와 뜻이 가장 가까운 말은?', options: ['미루다', '결정하다', '거절하다', '보관하다'], answer: 0, level: 2, explain: '유보하다는 결정을 나중으로 미룬다는 뜻이에요.' },
    { prompt: '"미미하다"와 뜻이 가장 가까운 말은?', options: ['보잘것없다', '아름답다', '조용하다', '강하다'], answer: 0, level: 2, explain: '미미하다는 보잘것없이 아주 작다는 뜻이에요.' },
    { prompt: '"완곡하다"와 뜻이 가장 가까운 것은?', options: ['부드럽게 돌려 말하다', '직설적으로 말하다', '단호하게 말하다', '길게 늘여 말하다'], answer: 0, level: 3, explain: '완곡하다는 듣기 좋게 돌려서 부드럽게 말한다는 뜻이에요.' },
    { prompt: '"고루하다"와 뜻이 가장 가까운 것은?', options: ['낡고 융통성이 없다', '고르고 균등하다', '외롭고 쓸쓸하다', '높고 귀하다'], answer: 0, level: 4, explain: '고루하다는 낡은 생각에 매여 융통성이 없다는 뜻이에요.' },
    { prompt: '"서슴다"와 뜻이 가장 가까운 말은?', options: ['망설이다', '서두르다', '숨기다', '다투다'], answer: 0, level: 3, explain: '서슴다는 결정을 내리지 못하고 머뭇거린다는 뜻이에요. "서슴지 않고"라고 할 때의 그 말이에요.' },
    { prompt: '"알음알음"의 뜻으로 가장 알맞은 것은?', options: ['서로 아는 관계를 통해', '아주 천천히 조금씩', '남몰래 은밀하게', '분명하고 뚜렷하게'], answer: 0, level: 3, explain: '알음알음은 서로 아는 관계나 친분을 통해서라는 뜻이에요.' },
    { prompt: '"미쁘다"와 뜻이 가장 가까운 말은?', options: ['믿음직하다', '미심쩍다', '어여쁘다', '변덕이 심하다'], answer: 0, level: 5, explain: '미쁘다는 믿음성이 있다, 곧 믿음직하다는 뜻이에요. 미심쩍다는 오히려 반대에 가까워요.' },
    { prompt: '"사위스럽다"와 뜻이 가장 가까운 것은?', options: ['어쩐지 불길하다', '사이가 서먹하다', '몹시 까다롭다', '몸가짐이 단정하다'], answer: 0, level: 5, explain: '사위스럽다는 마음에 불길한 느낌이 들고 꺼림칙하다는 뜻이에요.' },
    { prompt: '"부족하다"와 뜻이 가장 가까운 말은?', options: ['모자라다', '넘치다', '가볍다', '여유가 있다'], answer: 0, level: 1, explain: '부족하다는 필요한 만큼 넉넉하지 않다는 뜻이라 "모자라다"와 같아요.' },
    { prompt: '"느긋하다"와 뜻이 가장 가까운 말은?', options: ['여유롭다', '조급하다', '부지런하다', '쓸쓸하다'], answer: 0, level: 1, explain: '느긋하다는 서두르지 않고 마음에 여유가 있다는 뜻이에요. 조급하다는 반대말이에요.' },
    { prompt: '"게으르다"의 반대말에 가장 가까운 것은?', options: ['부지런하다', '꾸물꾸물하다', '나른하다', '한가하다'], answer: 0, level: 1, explain: '게으르다는 움직이거나 일하기를 싫어한다는 뜻이고, 반대는 부지런하다예요. 꾸물꾸물하다는 오히려 게으른 모습에 가까워요.' },
    { prompt: '"흔하다"의 반대말에 가장 가까운 것은?', options: ['드물다', '많다', '평범하다', '자주 있다'], answer: 0, level: 1, explain: '흔하다는 보기 쉽고 자주 있다는 뜻이고, 반대는 드물다예요.' },
    { prompt: '"정직하다"와 뜻이 가장 가까운 말은?', options: ['솔직하다', '영리하다', '친절하다', '용감하다'], answer: 0, level: 1, explain: '정직하다는 거짓이나 꾸밈이 없이 바르고 곧다는 뜻이라 "솔직하다"와 가까워요.' },
    { prompt: '"모호하다"와 뜻이 가장 가까운 말은?', options: ['애매하다', '분명하다', '명백하다', '엄격하다'], answer: 0, level: 1, explain: '모호하다는 말이나 태도가 흐릿해서 분명하지 않다는 뜻이라 "애매하다"와 가까워요. 분명하다·명백하다는 반대말이에요.' },
    { prompt: '"단념하다"와 뜻이 가장 가까운 말은?', options: ['포기하다', '결심하다', '기대하다', '집중하다'], answer: 0, level: 2, explain: '단념하다는 품었던 생각을 아주 끊어 버린다는 뜻이라 "포기하다"와 가까워요.' },
    { prompt: '"낙관하다"의 반대말에 가장 가까운 것은?', options: ['비관하다', '기대하다', '확신하다', '안심하다'], answer: 0, level: 1, explain: '낙관하다는 앞일을 밝고 희망적으로 본다는 뜻이고, 반대는 어둡게 보는 "비관하다"예요.' },
    { prompt: '"만류하다"와 뜻이 가장 가까운 말은?', options: ['말리다', '권하다', '허락하다', '재촉하다'], answer: 0, level: 3, explain: '만류하다는 붙들고 못 하게 말린다는 뜻이에요. 권하다·재촉하다는 오히려 하라고 미는 쪽이에요.' },
    { prompt: '"간과하다"와 뜻이 가장 가까운 것은?', options: ['대충 보아 넘기다', '자세히 살펴보다', '간단히 정리하다', '사이를 띄워 두다'], answer: 0, level: 3, explain: '간과하다는 큰 관심 없이 대강 보아 넘긴다는 뜻이에요. "중요한 점을 간과했다"처럼 써요.' },
    { prompt: '"모름지기"의 뜻으로 가장 알맞은 것은?', options: ['마땅히', '아마도', '도무지', '어쩌다가'], answer: 0, level: 4, explain: '모름지기는 사리를 따져 보면 마땅히, 반드시라는 뜻이에요. "모른다"는 뜻으로 쓰는 말이 아니에요.' },
    { prompt: '"겸연쩍다"와 뜻이 가장 가까운 것은?', options: ['쑥스럽고 어색하다', '겸손하고 공손하다', '넉넉하고 여유롭다', '지루하고 따분하다'], answer: 0, level: 3, explain: '겸연쩍다는 쑥스럽거나 미안해서 어색하다는 뜻이에요. "겸손하다"와는 다른 말이에요.' },
    { prompt: '"숙고하다"와 뜻이 가장 가까운 것은?', options: ['곰곰이 생각하다', '잠을 푹 자다', '익숙하게 다루다', '서둘러서 바로 결정하다'], answer: 0, level: 2, explain: '숙고하다는 곰곰이 잘 생각한다는 뜻이에요. 서둘러 정하는 것과는 반대예요.' },
    { prompt: '"시나브로"의 뜻으로 가장 알맞은 것은?', options: ['모르는 사이에 조금씩', '한꺼번에 아주 갑작스럽게', '몹시 서둘러서', '일부러 꾸며서'], answer: 0, level: 4, explain: '시나브로는 모르는 사이에 조금씩 조금씩이라는 뜻이에요. "쌓인 눈이 시나브로 녹았다"처럼 써요.' },
    { prompt: '"막역하다"와 뜻이 가장 가까운 것은?', options: ['허물없이 아주 친하다', '앞일이 보이지 않아 막막하다', '넓고 끝이 없다', '서로 사이가 나쁘다'], answer: 0, level: 4, explain: '막역하다는 허물없이 아주 친하다는 뜻이에요. "막역한 친구"처럼 써요.' },
    { prompt: '"갈음하다"와 뜻이 가장 가까운 것은?', options: ['다른 것으로 대신하다', '숫돌에 칼을 갈아 날을 세우다', '서로 나누어 가지다', '갈라서서 따로 가다'], answer: 0, level: 4, explain: '갈음하다는 다른 것으로 바꾸어 대신한다는 뜻이에요. "짧은 인사로 축사를 갈음했다"처럼 써요.' },
    { prompt: '"답습하다"와 뜻이 가장 가까운 것은?', options: ['옛 방식을 그대로 따르다', '전에 없던 새로운 방법을 찾아내다', '대답을 뒤로 미루다', '나쁜 습관을 바로 고치다'], answer: 0, level: 3, explain: '답습하다는 예로부터 해 오던 방식을 그대로 따라 한다는 뜻이에요. "관행을 답습하다"처럼 써요.' },
    { prompt: '"짐짓"의 뜻으로 가장 알맞은 것은?', options: ['마음과 달리 일부러', '짐을 진 것처럼 아주 무겁게', '한참 동안', '서로 번갈아 가며'], answer: 0, level: 4, explain: '짐짓은 마음으로는 그렇지 않으면서 일부러 그렇게라는 뜻이에요. "짐짓 모른 체했다"처럼 써요.' },
    { prompt: '"자발없다"와 뜻이 가장 가까운 것은?', options: ['가볍고 참을성이 없다', '시키지 않아도 스스로 나서다', '몹시 게으르다', '말수가 적다'], answer: 0, level: 5, explain: '자발없다는 행동이 가볍고 참을성이 없다는 뜻이에요. 스스로 나선다는 "자발적"과는 다른 말이에요.' },
    { prompt: '"미증유"의 뜻으로 가장 알맞은 것은?', options: ['일찍이 없었던 일', '눈에 띄지 않을 만큼 작은 차이', '흔히 있는 일', '뚜렷한 증거가 없음'], answer: 0, level: 5, explain: '미증유는 지금까지 한 번도 있어 본 적이 없음이라는 뜻이에요. "미증유의 사태"처럼 써요.' },
    { prompt: '"천착하다"와 뜻이 가장 가까운 것은?', options: ['깊이 파고들어 연구하다', '겉만 대강 훑어보다', '천천히 자리를 잡다', '하늘 높이 힘차게 솟아오르다'], answer: 0, level: 5, explain: '천착하다는 원인이나 내용을 깊이 파고들어 알아내거나 연구한다는 뜻이에요. "한 주제에 천착하다"처럼 써요.' },
    { prompt: '"가없다"와 뜻이 가장 가까운 것은?', options: ['끝이 없다', '불쌍하다', '값어치가 없다', '가장자리가 있다'], answer: 0, level: 5, explain: '가없다는 끝이 없다는 뜻이에요. "가없는 사랑"처럼 써요. 불쌍하다는 뜻의 "가엾다"와 헷갈리기 쉬워요.' },
    { prompt: '"느껍다"와 뜻이 가장 가까운 것은?', options: ['느낌이 북받쳐 벅차다', '움직임이 몹시 느릿하다', '두껍고 무겁다', '싫증이 나다'], answer: 0, level: 5, explain: '느껍다는 어떤 느낌이 마음에 북받쳐서 벅차다는 뜻이에요. "느꺼운 마음"처럼 써요.' },
    { prompt: '"과묵하다"의 반대말에 가장 가까운 것은?', options: ['수다스럽다', '묵묵하다', '과감하다', '무뚝뚝하다'], answer: 0, level: 2, explain: '\'과묵하다\'는 말이 적고 침착하다는 뜻이라, 쓸데없이 말수가 많은 \'수다스럽다\'가 반대말이에요. \'묵묵하다\'는 말없이 잠잠하다는 뜻이어서 반대말이 아니라 오히려 비슷한 말이에요.' },
    { prompt: '"흐드러지다"의 뜻으로 가장 알맞은 것은?', options: ['탐스럽고 한창 성하다', '흩어져서 몹시 어지럽다', '흐릿하고 희미하다', '힘없이 축 늘어지다'], answer: 0, level: 4, explain: '\'흐드러지다\'는 \'흐드러지게 핀 벚꽃\'처럼 매우 탐스럽거나 한창 성한 모양을 뜻해요. 소리가 비슷한 \'흐트러지다\'가 \'흩어져 어지럽다\'는 뜻이라 헷갈리기 쉽지만 다른 말이에요.' }
  ];
  /* 논리: 정답은 전제에서 "반드시" 따라 나오는 것 하나뿐이고, 오답은 거짓이거나 참일 수도 있을 뿐인 문장이다.
     전제에 "거짓말"이 들어가면 질문이 "거짓말을 하는 사람은 누구일까요?"로 바뀐다(choiceItems). */
  const LOGIC = [
    { premise: '모든 고래는 포유류다. 모든 포유류는 폐로 숨 쉰다.', options: ['모든 고래는 폐로 숨 쉰다', '폐로 숨 쉬는 동물은 모두 고래다', '어떤 포유류는 고래가 아니다', '고래는 물고기다'], answer: 0, level: 1, explain: '고래 → 포유류 → 폐호흡이니까 모든 고래는 폐로 숨 쉬어요.' },
    { premise: '민수는 지호보다 키가 크다. 지호는 수아보다 키가 크다.', options: ['민수는 수아보다 키가 크다', '수아는 민수보다 키가 크다', '지호가 가장 크다', '셋의 키는 같다'], answer: 0, level: 1, explain: '민수 > 지호 > 수아니까 민수 > 수아예요.' },
    { premise: '어떤 학생은 안경을 쓴다. 안경을 쓴 사람은 모두 시력이 나쁘다.', options: ['어떤 학생은 시력이 나쁘다', '모든 학생은 시력이 나쁘다', '시력이 나쁜 사람은 모두 학생이다', '안경을 안 쓴 학생은 시력이 좋다'], answer: 0, level: 2, explain: '안경 쓴 학생이 적어도 한 명 있고 그 사람은 시력이 나쁘니까 "어떤 학생은 시력이 나쁘다"만 반드시 참이에요.' },
    { premise: '이 상자의 공은 모두 빨갛거나 파랗다. 상자에서 꺼낸 공은 빨갛지 않다.', options: ['꺼낸 공은 파랗다', '꺼낸 공은 빨갛다', '상자에는 파란 공만 있다', '알 수 없다'], answer: 0, level: 2, explain: '빨강 아니면 파랑인데 빨강이 아니니까 파랑이에요.' },
    { premise: '시험이 쉬웠다면 평균이 80점을 넘었을 것이다. 평균은 80점을 넘지 않았다.', options: ['시험은 쉽지 않았다', '시험은 쉬웠다', '평균은 정확히 80점이었다', '알 수 없다'], answer: 0, level: 3, explain: '"쉬우면 80점 초과"인데 80점을 넘지 않았으니까 쉽지 않았던 거예요 (후건 부정).' },
    { premise: '비가 오면 땅이 젖는다. 지금 땅이 젖어 있다.', options: ['비가 왔는지는 알 수 없다', '비가 왔다', '비가 오지 않았다', '땅은 항상 젖어 있다'], answer: 0, level: 4, explain: '땅은 물을 뿌려도 젖어요. "비 → 젖음"에서 "젖음 → 비"는 따라 나오지 않아요.' },
    { premise: '어떤 A도 B가 아니다. 어떤 C는 A다.', options: ['어떤 C는 B가 아니다', '어떤 C도 B가 아니다', '어떤 B는 C다', '모든 B는 A다'], answer: 0, level: 5, explain: 'A인 C가 적어도 하나 있고, A는 하나도 B가 아니니까 그 C는 B가 아니에요. A가 아닌 C는 B일 수도 있어요.' },
    { premise: '어떤 새는 날지 못한다. 모든 새는 알을 낳는다.', options: ['알을 낳는 동물 중에 날지 못하는 것이 있다', '날지 못하는 동물은 모두 새다', '알을 낳지 않는 새가 있다', '모든 새는 날지 못한다'], answer: 0, level: 3, explain: '날지 못하는 새가 적어도 하나 있고 그 새도 알을 낳으니까, 알을 낳으면서 날지 못하는 동물이 있어요.' },
    { premise: '회의에 참석한 사람은 모두 보고서를 읽었다. 지수는 보고서를 읽지 않았다.', options: ['지수는 회의에 참석하지 않았다', '지수는 회의에 참석했다', '보고서를 읽은 사람은 모두 회의에 참석했다', '알 수 없다'], answer: 0, level: 3, explain: '참석했다면 읽었어야 하는데 읽지 않았으니까 참석하지 않은 거예요 (후건 부정).' },
    { premise: '모든 B는 C다. 어떤 A는 B가 아니다.', options: ['A와 C의 관계는 알 수 없다', '어떤 A는 C가 아니다', '모든 A는 C다', '어떤 A는 C다'], answer: 0, level: 5, explain: 'B가 아닌 A가 C인지 아닌지는 전제에 없어요. "B가 아니면 C도 아니다"로 읽기 쉬운 함정이에요.' },
    { premise: '진우, 민아, 서준 중 한 명만 거짓말을 한다. 진우: "민아는 거짓말쟁이다." 민아: "서준은 거짓말쟁이다." 서준: "나는 거짓말쟁이가 아니다."', options: ['민아', '진우', '서준', '알 수 없다'], answer: 0, level: 5, explain: '민아가 거짓말쟁이라면 진우의 말도 참, 서준의 말도 참이라 거짓말쟁이가 한 명뿐이라는 조건에 맞아요. 다른 경우에는 거짓말쟁이가 둘이 돼요.' },
    { premise: '비가 오면 소풍은 취소된다. 오늘은 비가 온다.', options: ['오늘 소풍은 취소된다', '오늘 소풍을 간다', '내일은 맑다', '소풍은 늘 취소된다'], answer: 0, level: 1, explain: '"비가 오면 취소"이고 오늘 비가 오니까 오늘 소풍은 취소돼요.' },
    { premise: '모든 장미는 꽃이다. 이 식물은 장미다.', options: ['이 식물은 꽃이다', '모든 꽃은 장미다', '이 식물은 빨간색이다', '이 식물은 장미가 아니다'], answer: 0, level: 1, explain: '장미는 모두 꽃이고 이 식물은 장미니까 꽃이에요. 꽃이 모두 장미인 것은 아니에요.' },
    { premise: '이 가게는 월요일에만 문을 닫는다. 오늘은 수요일이다.', options: ['오늘 가게는 문을 연다', '오늘은 가게가 쉰다', '가게는 일주일 내내 문을 연다', '내일은 가게가 문을 닫는다'], answer: 0, level: 1, explain: '월요일에만 닫으니까 수요일인 오늘은 문을 열어요. 내일인 목요일에도 열어요.' },
    { premise: '지민이는 영호보다 나이가 많다. 영호는 지민이보다 키가 크다.', options: ['영호는 지민이보다 어리다', '지민이가 키가 더 크다', '영호가 나이가 더 많다', '둘은 동갑이다'], answer: 0, level: 1, explain: '지민이가 영호보다 나이가 많다는 말은 영호가 지민이보다 어리다는 말과 같아요. 키는 영호가 더 커요.' },
    { premise: '세 사람이 한 줄로 섰다. 가은이는 맨 앞에 있고, 나래는 다온이 바로 앞에 있다.', options: ['다온이는 맨 뒤에 있다', '나래는 맨 앞에 있다', '가은이는 맨 뒤에 있다', '다온이는 가은이 바로 뒤에 있다'], answer: 0, level: 2, explain: '가은이가 맨 앞이고 나래가 다온이 바로 앞이니까 순서는 가은, 나래, 다온이에요.' },
    { premise: '출입증이 있는 사람만 이 건물에 들어올 수 있다. 은지는 이 건물에 들어왔다.', options: ['은지는 출입증이 있다', '출입증이 있으면 누구나 들어온다', '은지는 이 건물 직원이다', '은지는 출입증이 없다'], answer: 0, level: 2, explain: '출입증이 있는 사람"만" 들어올 수 있으니까 들어온 은지는 출입증이 있어요. 출입증이 있다고 모두 들어오는 것은 아니에요.' },
    { premise: '네 사람이 달리기를 했다. 하준이는 시우보다 빨랐고, 시우는 도윤이보다 빨랐고, 도윤이는 유준이보다 빨랐다.', options: ['하준이가 가장 빨랐다', '유준이는 시우보다 빨랐다', '도윤이가 가장 빨랐다', '시우가 가장 느렸다'], answer: 0, level: 1, explain: '빠른 차례가 하준, 시우, 도윤, 유준이니까 하준이가 가장 빨랐어요.' },
    { premise: '이 상자에 든 사과는 하나도 썩지 않았다.', options: ['이 상자에 썩은 사과는 없다', '이 상자의 사과 중 몇 개는 썩었다', '이 상자에는 배도 들어 있다', '썩은 사과는 다른 상자에 있다'], answer: 0, level: 1, explain: '"하나도 썩지 않았다"는 썩은 사과가 없다는 뜻이에요. 배나 다른 상자에 대해서는 알 수 없어요.' },
    { premise: '어제는 월요일이었다.', options: ['모레는 목요일이다', '오늘은 수요일이다', '내일은 화요일이다', '그저께는 토요일이다'], answer: 0, level: 2, explain: '어제가 월요일이면 오늘은 화요일, 내일은 수요일, 모레는 목요일이에요. 그저께는 일요일이고요.' },
    { premise: '수빈이의 엄마는 외동딸이다.', options: ['수빈이에게는 이모가 없다', '수빈이에게는 고모가 없다', '수빈이는 형제자매가 없는 외동이다', '수빈이에게는 삼촌이 없다'], answer: 0, level: 2, explain: '엄마가 외동딸이면 엄마에게는 형제자매가 없으니 이모(엄마의 언니나 여동생)가 없어요. 고모와 삼촌은 아빠 쪽이라 알 수 없어요.' },
    { premise: '이 반 학생이 모두 안경을 쓴 것은 아니다.', options: ['안경을 쓰지 않은 학생이 있다', '이 반 학생은 아무도 안경을 쓰지 않았다', '안경을 쓴 학생이 적어도 한 명 있다', '이 반 학생은 안경을 싫어한다'], answer: 0, level: 3, explain: '"모두 그런 것은 아니다"는 그렇지 않은 사람이 적어도 한 명 있다는 뜻이에요. 안경을 쓴 학생이 있는지는 알 수 없어요. 아무도 안 썼을 수도 있고 몇 명은 썼을 수도 있으니, 아무도 안 썼다고 단정할 수도 없어요.' },
    { premise: '이 정원의 꽃은 모두 장미 아니면 튤립이다. 이 정원의 튤립은 모두 노랗다. 정원에 핀 이 꽃은 노랗지 않다.', options: ['정원에 핀 이 꽃은 장미다', '정원에 핀 이 꽃은 튤립이다', '이 정원의 장미는 모두 빨갛다', '정원의 꽃은 모두 노랗다'], answer: 0, level: 3, explain: '튤립이라면 노래야 하는데 노랗지 않으니 튤립이 아니에요. 장미 아니면 튤립이니까 이 꽃은 장미예요.' },
    { premise: '어떤 운동선수는 채식주의자다. 채식주의자는 아무도 고기를 먹지 않는다.', options: ['고기를 먹지 않는 운동선수가 있다', '운동선수는 모두 고기를 먹지 않는다', '고기를 먹지 않는 사람은 모두 채식주의자다', '채식주의자는 모두 운동선수다'], answer: 0, level: 2, explain: '채식주의자인 운동선수가 적어도 한 명 있고, 그 사람은 고기를 먹지 않아요. 그러니 고기를 먹지 않는 운동선수가 있어요.' },
    { premise: '서랍에 검은 양말과 흰 양말이 여러 짝 섞여 있다. 불을 끈 채로 양말을 꺼낸다.', options: ['세 짝을 꺼내면 같은 색 두 짝이 꼭 있다', '두 짝만 꺼내도 반드시 같은 색이다', '같은 색 두 짝을 얻으려면 네 짝은 꺼내야 한다', '검은 양말이 흰 양말보다 많다'], answer: 0, level: 3, explain: '색이 두 가지뿐이라 세 짝을 꺼내면 적어도 두 짝은 색이 같아요. 두 짝만 꺼내면 색이 다를 수 있어요.' },
    { premise: '공연표가 매진되면 추가 공연을 연다. 추가 공연을 열면 배우들은 휴가를 미룬다. 배우들은 휴가를 미루지 않았다.', options: ['공연표는 매진되지 않았다', '추가 공연을 열었다', '공연표가 매진되었다', '배우들은 휴가 중이다'], answer: 0, level: 3, explain: '휴가를 미루지 않았으니 추가 공연은 없었고, 추가 공연이 없었으니 표도 매진되지 않았어요. 뒤에서부터 거꾸로 따지면 돼요.' },
    { premise: '책 다섯 권을 한 줄로 꽂았다. 국어책은 맨 왼쪽, 과학책은 맨 오른쪽에 있다. 사회책은 국어책 바로 오른쪽에 있고, 수학책은 영어책 바로 오른쪽에 있다.', options: ['영어책은 한가운데에 있다', '수학책은 사회책 바로 오른쪽에 있다', '영어책은 과학책 바로 왼쪽에 있다', '사회책은 한가운데에 있다'], answer: 0, level: 3, explain: '왼쪽부터 국어, 사회가 오고 과학이 맨 오른쪽이니 남은 셋째·넷째 자리에 영어, 수학이 차례로 들어가요. 그래서 영어책이 한가운데예요.' },
    { premise: '이 동아리에서 기타를 치는 회원은 모두 노래도 한다. 노래를 하는 회원은 아무도 피아노를 치지 않는다.', options: ['기타를 치는 회원은 피아노를 치지 않는다', '노래를 하는 회원은 모두 기타를 친다', '피아노를 치지 않는 회원은 모두 기타를 친다', '피아노를 치는 회원도 노래를 한다'], answer: 0, level: 3, explain: '기타를 치면 노래를 하고, 노래를 하면 피아노를 치지 않으니 기타를 치는 회원은 피아노를 치지 않아요. 문장을 거꾸로 뒤집은 것은 따라 나오지 않아요.' },
    { premise: '이 자격시험에 합격하려면 필기와 실기를 모두 통과해야 한다. 윤서는 이 시험에 합격했다.', options: ['윤서는 실기를 통과했다', '필기와 실기를 통과하면 반드시 합격한다', '윤서는 필기만 통과했다', '윤서는 실기에서 떨어졌다'], answer: 0, level: 3, explain: '합격하려면 둘 다 통과해야 하니까 합격한 윤서는 실기도 통과했어요. 둘을 통과하면 꼭 합격한다는 말은 없어요. 다른 조건이 더 있을 수도 있거든요.' },
    { premise: '가람, 나리, 다빈은 빨강, 파랑, 초록 우산을 하나씩 썼고 셋의 색은 모두 달랐다. 가람이는 빨간 우산을 쓰지 않았고, 나리는 파란 우산을 썼다.', options: ['다빈이는 빨간 우산을 썼다', '가람이는 파란 우산을 썼다', '다빈이는 초록 우산을 썼다', '나리와 다빈이는 같은 색 우산을 썼다'], answer: 0, level: 2, explain: '나리가 파랑이니 가람이는 빨강도 파랑도 아닌 초록이에요. 남은 빨강은 다빈이 차지예요.' },
    { premise: '가온, 나은, 다올 중 한 명만 거짓말을 한다. 가온: "나은이는 진실을 말한다." 나은: "다올이는 거짓말을 한다." 다올: "가온이는 거짓말을 한다."', options: ['다올', '가온', '나은', '알 수 없다'], answer: 0, level: 5, explain: '다올이가 거짓말을 한다면 가온이와 나은이의 말은 참이고 다올이의 말만 거짓이라 조건에 맞아요. 가온이나 나은이가 거짓말을 한다고 두면 거짓말하는 사람이 둘이 돼요.' },
    { premise: '다섯 명이 시험을 봤고 점수는 모두 달랐다. 가영이는 나영이보다, 나영이는 라영이보다, 라영이는 다영이보다 점수가 높다. 마영이는 1등도 꼴찌도 아니다.', options: ['다영이가 꼴찌다', '마영이는 나영이보다 높다', '가영이는 2등이다', '라영이는 4등이다'], answer: 0, level: 4, explain: '가영, 나영, 라영, 다영 차례는 정해져 있고, 마영이는 맨 위도 맨 아래도 아니니 그 사이 어딘가에 들어가요. 그래서 1등은 가영이, 꼴찌는 다영이예요. 라영이의 등수는 마영이 자리에 따라 달라져요.' },
    { premise: '토요일이 아니면 도서관은 문을 연다. 도서관이 문을 열면 지호는 도서관에 간다. 오늘 지호는 도서관에 가지 않았다.', options: ['오늘은 토요일이다', '오늘 도서관은 문을 열었다', '토요일에는 도서관이 늘 쉰다', '지호는 토요일마다 도서관에 안 간다'], answer: 0, level: 4, explain: '지호가 가지 않았으니 도서관은 문을 열지 않았어요. 토요일이 아니었다면 문을 열었을 테니 오늘은 토요일이에요. 토요일마다 쉰다는 말은 없어요.' },
    { premise: '모임에 온 20명은 모두 커피와 차 가운데 적어도 하나를 마셨다. 커피를 마신 사람은 12명, 차를 마신 사람은 10명이다.', options: ['둘 다 마신 사람은 2명이다', '차만 마신 사람은 10명이다', '커피만 마신 사람은 12명이다', '둘 다 마신 사람은 한 명도 없다'], answer: 0, level: 3, explain: '12명과 10명을 더하면 22명인데 실제로는 20명이에요. 두 번 센 2명이 커피와 차를 모두 마신 사람이에요.' },
    { premise: '모든 A는 B이거나 C다. 어떤 A는 B가 아니다.', options: ['어떤 A는 C다', '모든 A는 C다', '어떤 A는 B이면서 C다', 'B가 아닌 것은 모두 C다'], answer: 0, level: 4, explain: 'B가 아닌 A가 적어도 하나 있고, A는 모두 B나 C이니 그 A는 C예요. A가 모두 C인지, A가 아닌 것은 어떤지는 알 수 없어요.' },
    { premise: '민재와 소희가 둘 다 모임에 오면 그날은 꼭 보드게임을 한다. 오늘 모임에서는 보드게임을 하지 않았다.', options: ['민재와 소희 중 적어도 한 명은 오지 않았다', '민재와 소희는 둘 다 오늘 모임에 오지 않았다', '민재는 왔지만 소희는 오늘 모임에 오지 않았다', '민재가 오지 않았다면 소희는 모임에 왔다'], answer: 0, level: 4, explain: '둘 다 왔다면 보드게임을 했어야 하니, 하지 않았다는 건 \'둘 다 온 것은 아니다\'라는 뜻이에요. 이 말은 한 명만 빠진 경우도 포함하므로 \'둘 다 오지 않았다\'까지는 알 수 없어요.' },
    { premise: '이 카페에서 얼음이 들어간 음료는 모두 차갑다. 이 카페의 단 음료가 모두 차가운 것은 아니다.', options: ['얼음이 안 들어간 단 음료가 있다', '단 음료에는 얼음이 들어가지 않는다', '차가운 음료에는 모두 얼음이 들어간다', '차가운 음료 중에 단 것은 없다'], answer: 0, level: 4, explain: '얼음이 들어간 음료는 모두 차가우니, 차갑지 않은 음료에는 얼음이 들어갈 수 없어요. 단 음료 중 차갑지 않은 것이 적어도 하나 있으니 그 음료가 바로 얼음이 안 들어간 단 음료예요. 그렇다고 단 음료 전부에 얼음이 없다고까지는 말할 수 없어요.' },
    { premise: '도서관 우수 이용자로 뽑힌 사람은 모두 이 동네 주민이다. 독서 동아리 회원 중에는 이 동네 주민이 아닌 사람이 있다.', options: ['독서 동아리 회원 중에는 우수 이용자가 아닌 사람이 있다', '우수 이용자 중에는 독서 동아리 회원이 아닌 사람이 있다', '독서 동아리 회원은 아무도 도서관 우수 이용자로 뽑히지 않았다', '이 동네 주민은 모두 도서관 우수 이용자로 뽑혔다'], answer: 0, level: 5, explain: '이 동네 주민이 아닌 그 회원은 우수 이용자일 수 없으니, 우수 이용자가 아닌 회원이 적어도 한 명은 있어요. 반면 우수 이용자가 모두 동아리 회원이어도 전제와 어긋나지 않으니, 순서를 뒤집은 \'우수 이용자 중 회원이 아닌 사람이 있다\'는 반드시 참은 아니에요.' },
    { premise: '등산 모임에서는 도시락을 챙겨 오지 않으면 누구도 정상까지 오를 수 없었다. 그리고 모임 사람 중 정상까지 오른 사람이 한 명도 없는 것은 아니다.', options: ['도시락을 챙겨 온 사람이 적어도 한 명 있다', '정상까지 오르지 못한 사람이 적어도 한 명 있다', '도시락을 챙겨 온 사람은 모두 정상까지 올랐다', '도시락을 챙겨 오지 않은 사람이 적어도 한 명 있다'], answer: 0, level: 5, explain: '\'오른 사람이 한 명도 없는 것은 아니다\'는 정상에 오른 사람이 적어도 한 명 있다는 뜻이에요. 그 사람은 도시락을 챙겨 왔을 수밖에 없어요. 하지만 모두 도시락을 챙겨 와서 모두 정상에 올랐을 수도 있으니 \'도시락을 안 챙겨 온 사람이 있다\'와 \'못 오른 사람이 있다\'는 반드시 참은 아니에요. 도시락을 챙겨 오고도 못 올랐을 수 있으니 \'챙겨 온 사람은 모두 올랐다\'도 알 수 없어요.' },
    { premise: '지수, 민호, 서윤, 태현, 유나 다섯 명이 한 줄로 나란히 앉았다. 서윤이는 지수 바로 오른쪽에 앉았다. 태현이는 양쪽 맨 끝자리 중 하나에 앉았다. 유나는 지수와도 서윤이와도 이웃하지 않았다. 민호는 가운데 자리에 앉지 않았다.', options: ['민호와 유나는 이웃해 앉았다', '지수는 가운데 자리에 앉았다', '태현이는 지수와 이웃해 앉았다', '유나는 태현이와 이웃해 앉았다'], answer: 0, level: 5, explain: '조건을 모두 만족하는 자리는 \'태현 지수 서윤 민호 유나\'와 \'유나 민호 지수 서윤 태현\' 두 가지뿐이에요. 두 경우 모두 민호와 유나가 붙어 있고, 지수가 가운데에 앉는 건 두 번째 경우뿐이라 반드시 참은 아니에요.' }
  ];
  /* 공통점 찾기: 두 낱말의 본질적 공통점(범주·기능)을 고른다. 오답은 한쪽에만 맞거나 둘 다에 틀린 것이고, 보기 길이는 정답과 무관하게 섞었다. */
  const SIMILAR = [
    { pair: ['사과', '바나나'], options: ['둘 다 과일이다', '둘 다 노란색이다', '둘 다 껍질째 먹는다', '둘 다 씨가 하나도 없다'], answer: 0, level: 1, explain: '둘을 묶는 범주는 "과일"이에요. 노란색과 껍질째 먹는 것은 한쪽에만 해당하고, 사과에는 씨가 있어요.' },
    { pair: ['개', '고양이'], options: ['네 발 달린 포유류다', '사람을 보면 짖는다', '주인을 따라다닌다', '주로 밤에 활동한다'], answer: 0, level: 1, explain: '둘 다 포유류예요. 나머지는 한쪽에만 해당해요.' },
    { pair: ['시계', '달력'], options: ['시간을 재는 도구다', '바늘이 돌아간다', '한 해가 지나면 새것으로 바꾼다', '전기가 있어야 움직인다'], answer: 0, level: 1, explain: '둘 다 시간을 재고 알려 주는 도구예요. 바늘은 시계에만, 해마다 바꾸는 것은 달력에만 해당해요.' },
    { pair: ['연필', '붓'], options: ['그리거나 쓰는 도구다', '글씨를 쓰는 데만 쓴다', '잉크를 묻혀 쓴다', '지우개로 지울 수 있다'], answer: 0, level: 1, explain: '하는 일(그리기·쓰기)이 본질적인 공통점이에요. 나머지는 한쪽에만 해당해요.' },
    { pair: ['증기', '얼음'], options: ['물의 다른 상태다', '만지면 차갑다', '사람이 만들어 낸 것이다', '하늘 위에 떠 있다'], answer: 0, level: 2, explain: '둘 다 물이 상태만 바뀐 거예요.' },
    { pair: ['칭찬', '벌'], options: ['행동을 바꾸는 수단이다', '받으면 기분이 좋다', '아이에게만 쓰는 것이다', '말로만 할 수 있다'], answer: 0, level: 2, explain: '정반대로 보이지만 둘 다 행동을 바꾸려고 쓰는 수단이에요.' },
    { pair: ['지도', '설명서'], options: ['모르는 것을 안내한다', '길을 찾을 때만 쓴다', '한 번 보면 다시 볼 일이 없다', '반드시 전문가가 만든다'], answer: 0, level: 2, explain: '둘 다 모르는 것을 찾아가게 돕는 안내 도구예요. 나머지는 한쪽에만 맞거나 사실이 아니에요.' },
    { pair: ['뿌리', '기초'], options: ['전체를 떠받치는 바탕이다', '위로 갈수록 두꺼워진다', '시간이 지나면 저절로 사라진다', '식물에게만 있는 것이다'], answer: 0, level: 2, explain: '보이지 않는 곳에서 전체를 받친다는 점이 핵심이에요.' },
    { pair: ['민주주의', '독재'], options: ['사회를 다스리는 방식이다', '국민이 직접 투표한다', '권력이 한 사람에게 있다', '현대에 와서 생긴 제도다'], answer: 0, level: 2, explain: '정반대의 체제지만 둘 다 "나라를 다스리는 방식"이라는 범주에 속해요.' },
    { pair: ['희망', '두려움'], options: ['앞일에 대한 감정이다', '마음이 편해지는 감정이다', '주로 밤에 생기는 감정이다', '남에게 숨기는 감정이다'], answer: 0, level: 2, explain: '둘 다 아직 오지 않은 일을 향한 감정이에요.' },
    { pair: ['소문', '뉴스'], options: ['사람들에게 퍼지는 정보다', '언제나 사실에 근거한다', '신문과 방송에만 실린다', '며칠 지나면 모두 잊힌다'], answer: 0, level: 2, explain: '사실인지와 퍼지는 경로는 다르지만 둘 다 사람들 사이에 퍼지는 정보예요.' },
    { pair: ['셔츠', '바지'], options: ['몸에 입는 옷이다', '다리를 넣어 입는다', '단추가 꼭 달려 있다', '추운 겨울에만 입는다'], answer: 0, level: 1, explain: '둘 다 몸에 입는 옷이에요. 다리를 넣어 입는 것은 바지뿐이고, 단추나 계절과는 상관없어요.' },
    { pair: ['피아노', '기타'], options: ['소리를 내는 악기다', '줄을 손가락으로 튕긴다', '건반을 눌러 연주한다', '전기가 있어야 소리가 난다'], answer: 0, level: 1, explain: '둘 다 연주해서 소리를 내는 악기예요. 줄을 튕기는 것은 기타, 건반을 누르는 것은 피아노예요.' },
    { pair: ['버스', '기차'], options: ['사람이 타는 탈것이다', '도로로만 다닌다', '철길로만 달린다', '하늘을 난다'], answer: 0, level: 1, explain: '둘 다 사람을 태워 나르는 탈것이에요. 도로로 다니는 것은 버스, 철길로 다니는 것은 기차예요.' },
    { pair: ['숟가락', '젓가락'], options: ['밥 먹을 때 쓰는 도구다', '국물을 떠먹기에 알맞다', '두 짝이 모여야 한 벌이 된다', '반드시 나무로만 만든다'], answer: 0, level: 1, explain: '둘 다 밥을 먹을 때 쓰는 도구예요. 국물을 뜨는 것은 숟가락, 두 짝이 한 벌인 것은 젓가락이에요.' },
    { pair: ['비', '눈'], options: ['하늘에서 내리는 물이다', '얼음 알갱이로 되어 있다', '여름에 많이 내린다', '땅에서 솟아오른다'], answer: 0, level: 1, explain: '둘 다 구름에서 땅으로 떨어지는 물이에요. 눈은 얼어서, 비는 물방울로 내린다는 것만 달라요.' },
    { pair: ['간장', '식초'], options: ['음식에 맛을 내는 재료다', '짠맛이 강하게 난다', '신맛이 강하게 난다', '과일을 그대로 짜서 만든 즙이다'], answer: 0, level: 1, explain: '둘 다 음식의 맛을 내는 조미료예요. 짠맛은 간장, 신맛은 식초에만 해당해요.' },
    { pair: ['의자', '침대'], options: ['몸을 쉬게 하는 가구다', '누워서 잠을 잔다', '등받이가 꼭 있다', '바퀴가 달려 있다'], answer: 0, level: 1, explain: '둘 다 몸을 올려 쉬게 하는 가구예요. 누워 자는 것은 침대의 쓰임이고, 등받이가 없는 의자도 있어요.' },
    { pair: ['꿀벌', '나비'], options: ['꽃가루를 옮기는 곤충이다', '꿀을 모아 저장한다', '꽁무니의 침으로 쏜다', '날개에 화려한 무늬가 있다'], answer: 0, level: 1, explain: '둘 다 꽃을 찾아다니며 꽃가루를 옮기는 곤충이에요. 꿀을 모으고 침이 있는 것은 꿀벌, 화려한 날개는 나비의 특징이에요.' },
    { pair: ['항구', '공항'], options: ['탈것이 드나드는 곳이다', '배가 닻을 내린다', '비행기가 하늘로 뜨고 내린다', '바닷가에만 있다'], answer: 0, level: 1, explain: '둘 다 탈것이 사람과 짐을 싣고 드나드는 곳이에요. 배는 항구로, 비행기는 공항으로 드나들어요.' },
    { pair: ['소방관', '경찰관'], options: ['사람들의 안전을 지킨다', '불이 나면 출동해 불을 끈다', '범인을 쫓아가 붙잡는다', '밤에는 일하지 않는다'], answer: 0, level: 1, explain: '둘 다 사람들의 안전을 지키는 일을 해요. 불을 끄는 것은 소방관, 범인을 잡는 것은 경찰관의 일이에요.' },
    { pair: ['물', '공기'], options: ['생물이 사는 데 꼭 필요하다', '눈에 전혀 보이지 않는다', '목마를 때 마신다', '불을 붙이면 잘 탄다'], answer: 0, level: 1, explain: '둘 다 생물이 살아가는 데 꼭 있어야 해요. 눈에 안 보이는 것은 공기, 마시는 것은 물이에요.' },
    { pair: ['고래', '박쥐'], options: ['새끼를 낳아 젖을 먹인다', '물속에서 헤엄쳐 다닌다', '날개를 펴고 밤하늘을 날아다닌다', '알을 낳아 품는다'], answer: 0, level: 2, explain: '사는 곳은 바다와 하늘로 다르지만, 둘 다 새끼를 낳아 젖을 먹이는 포유류예요.' },
    { pair: ['일기', '사진'], options: ['지난 일을 기록해 남긴다', '날마다 글로 적어서 남긴다', '카메라로 찍어서 남긴다', '반드시 남에게 보여 준다'], answer: 0, level: 1, explain: '둘 다 지나간 일을 기록으로 남겨요. 글로 적는 것은 일기, 카메라로 찍는 것은 사진이에요.' },
    { pair: ['박물관', '도서관'], options: ['자료를 모아 두고 보여 준다', '책을 집으로 빌려 가게 해 준다', '옛 유물을 전시한다', '돈을 내야만 들어갈 수 있다'], answer: 0, level: 1, explain: '둘 다 자료를 모아 두고 사람들이 보거나 쓰게 하는 곳이에요. 책을 빌려주는 것은 도서관, 유물을 전시하는 것은 박물관이에요.' },
    { pair: ['등대', '신호등'], options: ['불빛으로 안전을 돕는다', '바닷가 높은 곳에 서 있다', '세 가지 색으로 바뀐다', '낮에만 불을 밝힌다'], answer: 0, level: 1, explain: '둘 다 불빛으로 신호를 보내 사고를 막아요. 바닷가에 서 있는 것은 등대, 색이 바뀌는 것은 신호등이에요.' },
    { pair: ['소금', '냉장고'], options: ['음식이 상하는 것을 늦춘다', '음식에 짠맛을 더해 준다', '전기를 꽂아야 움직인다', '음식을 달고 부드럽게 만든다'], answer: 0, level: 2, explain: '하나는 양념이고 하나는 가전제품이지만, 둘 다 음식이 쉽게 상하지 않게 해요. 소금에 절이거나 차갑게 두면 오래가요.' },
    { pair: ['관절', '경첩'], options: ['이어진 부분을 움직이게 한다', '몸속에서 뼈와 뼈를 잇는다', '문짝과 문틀 사이에 붙어 있다', '닳아도 저절로 다시 낫는다'], answer: 0, level: 2, explain: '둘 다 두 부분을 이어 주면서 굽히거나 돌 수 있게 해요. 관절은 몸에서, 경첩은 문에서 그 일을 해요.' },
    { pair: ['백신', '안전띠'], options: ['위험에 미리 대비하게 한다', '주사기로 몸속에 넣어 준다', '자동차 좌석마다 달려 있다', '다친 다음에 상처를 치료한다'], answer: 0, level: 2, explain: '둘 다 일이 생기기 전에 미리 몸을 지켜 줘요. 백신은 병에, 안전띠는 사고에 대비해요. 다친 뒤에 치료하는 것과는 달라요.' },
    { pair: ['나침반', '북극성'], options: ['방향을 찾게 도와준다', '밤하늘에서 빛난다', '자석의 힘을 이용한다', '동쪽을 가리킨다'], answer: 0, level: 2, explain: '둘 다 길을 잃었을 때 북쪽, 곧 방향을 알려 줘요. 밤하늘에서 빛나는 것은 북극성, 자석을 쓰는 것은 나침반이에요.' },
    { pair: ['시험', '체온계'], options: ['상태를 재서 알려 준다', '정해진 시간에 문제를 푼다', '열이 나는지 알려 준다', '숫자가 높을수록 좋다'], answer: 0, level: 2, explain: '둘 다 눈에 안 보이는 상태를 재서 알려 줘요. 시험은 실력을, 체온계는 몸의 열을 재요.' },
    { pair: ['사막', '남극'], options: ['비나 눈이 아주 적게 내린다', '낮이면 숨이 막힐 만큼 덥다', '온통 두꺼운 얼음으로 덮여 있다', '사람이 많이 모여 산다'], answer: 0, level: 3, explain: '하나는 덥고 하나는 춥지만, 둘 다 비나 눈이 아주 적게 내리는 메마른 곳이에요. 그래서 남극을 추운 사막이라고도 해요.' },
    { pair: ['문', '눈꺼풀'], options: ['열고 닫아 안쪽을 지킨다', '손잡이를 돌려 연다', '깜빡여 눈물을 고루 퍼뜨린다', '잠잘 때도 늘 열려 있다'], answer: 0, level: 2, explain: '둘 다 열었다 닫았다 하며 안쪽을 지켜요. 문은 집 안을, 눈꺼풀은 눈을 보호해요.' },
    { pair: ['화폐', '언어'], options: ['사람들이 함께 정한 약속이다', '물건을 사고팔 때 주고받는다', '입으로 소리 내어 뜻을 전한다', '어느 나라에서나 다 똑같다'], answer: 0, level: 3, explain: '종이돈이 값을 갖고 낱말이 뜻을 갖는 것은 사람들이 그렇게 쓰자고 약속했기 때문이에요. 둘 다 그 약속 위에서 주고받는 수단이에요.' },
    { pair: ['미끼', '광고'], options: ['상대를 끌어들이려고 쓴다', '물고기를 잡을 때 쓴다', '텔레비전이나 신문에 실려 나온다', '늘 사실만을 알려 준다'], answer: 0, level: 2, explain: '둘 다 상대의 관심을 끌어 다가오게 만드는 수단이에요. 물고기를 낚는 것은 미끼, 매체에 실리는 것은 광고예요.' },
    { pair: ['그림자', '메아리'], options: ['가로막는 것이 있어야 생긴다', '빛이 되돌아와서 생긴다', '소리가 산에 부딪혀 되돌아온다', '해가 떠 있는 낮에만 생긴다'], answer: 0, level: 3, explain: '그림자는 빛을 가로막는 물체가 있어야 생기고, 메아리는 소리를 막아 되돌려 보내는 산이나 벽이 있어야 생겨요. \'빛이 되돌아와서 생긴다\'는 그럴듯하지만, 그림자는 빛이 닿지 못한 자리이고 메아리는 빛이 아니라 소리예요.' },
    { pair: ['둑', '눈썹'], options: ['흘러드는 물을 막아 준다', '물을 가두었다가 전기를 만든다', '표정을 짓는 데 쓰인다', '흙과 돌을 높이 쌓아 만든다'], answer: 0, level: 3, explain: '둑은 강물이 마을로 넘쳐 들어오지 않게 막고, 눈썹은 이마의 땀이나 빗물이 눈으로 흘러들지 않게 막아 줘요. 둑을 댐과 헷갈려 \'전기를 만든다\'를 고르기 쉽지만, 둑도 눈썹도 전기를 만들지 않아요.' },
    { pair: ['진주', '굳은살'], options: ['거슬리는 자극에 맞서 생겨난다', '바닷속 조개의 몸 안에서 자란다', '손바닥이나 발바닥에 두툼하게 생긴다', '물로 씻으면 금세 없어진다'], answer: 0, level: 3, explain: '진주는 조개 속에 파고든 작은 기생충 같은 이물질이나 상처 때문에, 굳은살은 자꾸 쓸리는 마찰을 견디려고 몸이 만들어 낸 것이에요. 조개 몸 안에서 자라는 것은 진주에만 해당하니 공통점이 아니에요.' },
    { pair: ['산호', '말미잘'], options: ['촉수로 먹이를 잡는 동물이다', '바위에 붙어 자라는 식물이다', '죽고 나면 단단한 뼈대가 남는다', '물살을 따라 이리저리 떠다닌다'], answer: 0, level: 3, explain: '산호와 말미잘은 꽃이나 풀처럼 보이지만 촉수로 먹이를 잡아먹는 동물이에요. \'바위에 붙어 자라는 식물\'은 겉모습만 보고 고르기 쉬운 오답이고, 죽은 뒤 단단한 뼈대가 남는 것은 산호뿐이에요.' },
    { pair: ['구름', '입김'], options: ['수증기가 식어서 맺힌 물방울이다', '물이 기체로 바뀐 수증기 그 자체다', '추운 날 입에서 하얗게 나온다', '하늘 높이 떠서 바람에 흘러간다'], answer: 0, level: 4, explain: '구름과 입김은 모두 공기 속 수증기가 차갑게 식어 작은 물방울로 맺힌 거예요. 수증기는 눈에 보이지 않는 기체라서, 하얗게 보인다면 이미 물방울로 바뀐 뒤예요. 그래서 수증기 그 자체라는 보기는 틀려요.' },
    { pair: ['쇠붙이', '대리석'], options: ['열을 빨리 빼앗아 차게 느껴진다', '같은 방 안에서도 온도가 더 낮다', '오래 두면 붉은 녹이 슨다', '돌을 캐서 매끈하게 갈아 쓴다'], answer: 0, level: 4, explain: '쇠붙이와 대리석은 열을 잘 전해서 손의 열을 빠르게 빼앗아 가기 때문에 차갑게 느껴져요. 같은 방에 오래 둔 물건은 나무든 쇠든 온도가 같아서, 실제로 온도가 더 낮다는 보기는 틀려요.' },
    { pair: ['낙타의 혹', '선인장 줄기'], options: ['모자랄 때를 대비해 쌓아 둔다', '속에 물을 가득 채워 저장해 둔다', '날카로운 가시로 몸을 지켜 준다', '걸을 때 몸의 균형을 잡아 준다'], answer: 0, level: 4, explain: '낙타의 혹과 선인장 줄기는 모두 먹이나 물이 모자랄 때를 대비해 쌓아 두는 곳이에요. 낙타의 혹에는 물이 아니라 지방이 들어 있어서 \'물을 채워 저장한다\'는 선인장에만 맞아요.' },
    { pair: ['눈송이', '설탕'], options: ['투명한 결정이 모여 희게 보인다', '본래부터 하얀 빛깔을 띤 물질이다', '혀에 닿으면 단맛이 퍼진다', '겨울 하늘에서 흩날려 내린다'], answer: 0, level: 4, explain: '눈송이는 얼음 결정, 설탕은 설탕 결정이 잔뜩 모여 빛을 사방으로 흩뜨리기 때문에 하얗게 보여요. 알갱이 하나하나는 유리처럼 투명해서, 본래 하얀 물질이라는 보기는 틀려요.' },
    { pair: ['깁스', '거푸집'], options: ['제 모양이 잡힐 때까지만 붙든다', '석고 가루를 물에 개어 굳힌 것이다', '콘크리트를 부어 모양을 만든다', '부서진 것을 다시 이어 붙여 준다'], answer: 0, level: 4, explain: '깁스는 뼈가 붙을 때까지, 거푸집은 콘크리트가 굳을 때까지만 모양을 잡아 주고 나중에 떼어 내요. 부러진 뼈가 붙도록 돕는 것은 깁스뿐이고, 거푸집은 무언가를 이어 붙이지 않고 틀 노릇만 해요.' },
    { pair: ['감자', '고구마'], options: ['땅속에서 자란 부분을 먹는다', '땅속으로 뻗은 뿌리 부분을 먹는다', '싹이 돋으면 독이 생긴다', '줄기를 나물로 무쳐 먹는다'], answer: 0, level: 4, explain: '감자와 고구마는 모두 땅속에서 자라 굵어진 부분을 캐서 먹어요. 하지만 고구마는 뿌리가, 감자는 땅속줄기가 부푼 것이라서 둘 다 뿌리라는 보기는 틀려요.' },
    { pair: ['추위', '어둠'], options: ['무언가가 모자라서 생기는 상태다', '해가 지고 나면 반드시 찾아온다', '몸속까지 스며드는 차가운 기운이다', '무언가가 빛을 가로막아서 생긴다'], answer: 0, level: 5, explain: '추위는 열이, 어둠은 빛이 모자라서 생기는 상태예요. \'차가운 기운이 스며든다\'는 추위에만 그럴듯하고, 해가 진다고 늘 추워지는 것도 아니니 그 보기도 틀려요.' },
    { pair: ['공룡 화석', '밤하늘의 별빛'], options: ['먼 옛날의 모습을 지금 보여 준다', '이미 사라져 버린 것이 남긴 모습이다', '땅을 깊이 파야만 찾아낼 수 있다', '어두운 밤이 되어야만 볼 수 있다'], answer: 0, level: 5, explain: '별빛은 아주 오래전에 별을 떠나 이제야 닿은 빛이라, 화석처럼 먼 옛날의 모습을 지금 보여 줘요. 그 별들은 대부분 지금도 빛나고 있으니 \'이미 사라진 것\'은 화석에만 맞아요.' }
  ].map(function (it) { it.prompt = U.josa('"' + it.pair[0] + '"', '과', '와') + ' "' + it.pair[1] + '"의 공통점으로 가장 알맞은 것은?'; return it; });
  /* 연습 문제로 쓰는 문항 번호(모두 1단계). 연습에서 정답과 해설을 보여 주므로 점수 문항으로는 다시 내지 않는다. */
  const PRACTICE_ITEM = { analogy: 0, logic: 1, similar: 0 };
  function practiceUsed(key) { return PRACTICE_ITEM[key] != null ? [PRACTICE_ITEM[key]] : []; }
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
        options: o.options, answer: o.answer, optionCols: cols, explain: v.explain,
        pid: POOL[part] ? POOL[part].indexOf(v) : undefined   // 고정 문항 풀의 번호 (익명 통계에 문항 내용 대신 보낸다)
      };
    });
  }

  /* 다시 볼 때 같은 문항이 덜 나오게, 과제마다 최근에 낸 문항 번호를 이 기기에 남긴다 (정밀 검사 두 번 분량).
     새 문항이 없는 단계에서는 최근 문항도 다시 낸다. 단계를 맞추는 것이 새 문항보다 먼저다. */
  const SEEN_KEY = 'bl.verbalSeen', SEEN_MAX = 24;
  function recentSeen(key) { const all = U.store.get(SEEN_KEY, {}); return Array.isArray(all[key]) ? all[key] : []; }
  function markSeen(key, ids) {
    const all = U.store.get(SEEN_KEY, {});
    const list = (Array.isArray(all[key]) ? all[key] : []).filter(function (i) { return ids.indexOf(i) < 0; }).concat(ids);
    all[key] = list.slice(-SEEN_MAX);
    U.store.set(SEEN_KEY, all);
  }
  /* 고정 문항 풀에서 level에 가장 가까운 단계의 안 쓴 문항 번호를 무작위로 고른다 (남은 문항이 없으면 -1).
     avoid(최근에 본 문항)가 아닌 문항이 같은 단계에 있으면 그중에서 고른다. */
  function pickFromPool(r, pool, level, used, avoid) {
    let cand = [];
    for (let d = 0; d <= 5 && !cand.length; d++) {
      cand = pool.map(function (it, i) { return i; }).filter(function (i) { return used.indexOf(i) < 0 && (pool[i].level === level - d || pool[i].level === level + d); });
    }
    const fresh = avoid ? cand.filter(function (i) { return avoid.indexOf(i) < 0; }) : [];
    return fresh.length ? r.pick(fresh) : cand.length ? r.pick(cand) : -1;
  }
  /* 정밀·빠른 검사: 단계 목록대로 한 문항씩 겹치지 않게 뽑는다 (연습 문항은 빼고) */
  function drawPool(r, key, levels) {
    const pool = POOL[key], used = practiceUsed(key), avoid = recentSeen(key);
    const out = levels.map(function (l) { const i = pickFromPool(r, pool, l, used, avoid); used.push(i); return i; });
    markSeen(key, out);
    return out.map(function (i) { return pool[i]; });
  }

  /* ===== 5. 도형 회전 (1~5단계) =====
     단계마다 칸 수가 하나씩 늘어난다(5·6·7·8·9칸, 5×5 격자 안). 오답 셋은 모두 원래 도형을 거울에 비춘 모양을 서로 다른 방향으로
     돌린 것이라 칸 수·줄마다 칸 수·바깥 크기가 정답과 같다. 칸만 세어서는 거를 수 없고, 돌려 보고 왼쪽·오른쪽 방향까지 가려야 풀린다.
     (2026-10-18 전에는 오답 둘이 칸 하나를 옮긴 모양이라 칸 수만 비교해도 둘이 지워졌고, 1·2단계와 4·5단계가 같은 조건으로 만들어졌다.) */
  const ROT_SIZE = { 1: 5, 2: 6, 3: 7, 4: 8, 5: 9 }, ROT_TIME = { 1: 40, 2: 40, 3: 45, 4: 50, 5: 55 };
  function makePolyomino(r, n) {
    const cells = {}; cells['1,1'] = true;
    let count = 1, guard = 0;
    while (count < n && guard++ < 400) {
      const arr = Object.keys(cells).map(function (s) { return s.split(',').map(Number); });
      const c = r.pick(arr), d = r.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      const nx = c[0] + d[0], ny = c[1] + d[1];
      if (nx < 0 || ny < 0 || nx > 4 || ny > 4) continue;
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
    const size = ROT_SIZE[level] || 5;
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
    // 오답 셋: 거울에 비춘 모양을 네 방향 중 서로 다른 세 방향으로 돌린 것. 위에서 네 방향이 서로 다르고 정답의 어떤 회전과도 다름을 확인했다
    const dis = r.sample(mirs, 3);
    const o = shuffleOptions(r, [rots[k]].concat(dis), 0);
    return {
      type: 'choice', part: 'rotation', scored: true, level: level, timeLimit: ROT_TIME[level] || 40,
      prompt: '위 도형을 돌리기만 해서 만들 수 있는 것은? (뒤집으면 안 돼요)',
      promptHtml: '<div class="poly-prompt">' + polySVG(shape) + '</div>',
      optionsHtml: o.options.map(polySVG), answer: o.answer, optionCols: 4,
      explain: '정답은 원래 도형을 ' + (k * 90) + '° 돌린 모양이에요. 나머지 셋은 모두 원래 도형을 거울에 비춘 모양을 돌린 것이라, 칸 수와 크기는 같아도 돌리기만 해서는 만들 수 없어요.'
    };
  }

  /* ===== 6. 전개도 접기 (1~5단계) =====
     정육면체 전개도 11가지 중 하나에 면마다 다른 무늬를 넣고, 접었을 때 위·왼쪽 앞·오른쪽 앞 세 면이 보이는
     그림 4개 중 나올 수 있는 것을 고른다. 무늬는 상자 바깥면에 있다(바깥면이 위로 오게 펼친 전개도).
     접기: 칸마다 (바깥 법선 n, 종이 오른쪽 r, 종이 위쪽 u)를 정육면체 좌표로 옮긴다. 오른쪽 이웃 칸은 n' = r, r' = −n.
     보기끼리, 그리고 보기와 정육면체를 놓는 24가지 방법이 같은 그림인지는 실제로 그린 무늬 꼭짓점의 화면 좌표로 비교한다
     (무늬 자체의 대칭까지 반영된다). 오답: 마주 보는 면이 함께 보임 · 무늬 하나가 돌아감 · 두 면 자리 바뀜 · 거울상.
     오답은 정답이 아니라 나올 수 있는 모습 24가지 중 무작위로 고른 것에서 한 군데를 바꿔 만든다(2026-10-18). 정답에서 바꾸면 정답이
     모든 오답과 면을 가장 많이 공유해서, 전개도를 보지 않고 보기끼리만 비교해도 정답이 드러났다. */
  const FOLD_NETS = [
    ['X...', 'XXXX', 'X...'], ['X...', 'XXXX', '.X..'], ['X...', 'XXXX', '..X.'], ['X...', 'XXXX', '...X'], ['.X..', 'XXXX', '.X..'], ['.X..', 'XXXX', '..X.'],
    ['XX..', '.XXX', '.X..'], ['XX..', '.XXX', '..X.'], ['XX..', '.XXX', '...X'], ['XX..', '.XX.', '..XX'], ['XXX..', '..XXX']
  ];
  const SEMI = [];
  for (let i = 0; i <= 12; i++) SEMI.push([Math.round(50 + 34 * Math.cos(Math.PI * i / 12)), Math.round(18 + 34 * Math.sin(Math.PI * i / 12))]);
  /* 무늬 (칸 좌표 0~100, y는 아래로). 점은 칸 가운데에 있어 돌려도 같고, 막대는 칸 가운데 가로 띠라 반 바퀴 돌려도 같다.
     눈으로 방향이 안 보이는 무늬는 그림도 대칭으로 그려서, 보이지 않는 "방향"으로 정답·오답이 갈리지 않게 한다(sameView가 그린 꼭짓점으로
     비교하므로 점·막대만 돌린 오답은 정답과 같은 그림으로 판정돼 다시 뽑힌다). 나머지는 돌리면 달라 보이고, ㄴ자·깃발은 뒤집어도 달라 보인다. */
  const FOLD_PAT = {
    arrow: { ko: '화살표', poly: [[50, 12], [82, 46], [61, 46], [61, 88], [39, 88], [39, 46], [18, 46]] },
    corner: { ko: '삼각형', poly: [[14, 14], [70, 14], [14, 70]] },
    dot: { ko: '점', circle: [50, 50, 15] },
    bar: { ko: '막대', poly: [[14, 39], [86, 39], [86, 61], [14, 61]] },
    tee: { ko: 'T자', poly: [[14, 14], [86, 14], [86, 34], [60, 34], [60, 88], [40, 88], [40, 34], [14, 34]] },
    semi: { ko: '반원', poly: SEMI },
    ell: { ko: 'ㄴ자', poly: [[18, 12], [38, 12], [38, 66], [82, 66], [82, 88], [18, 88]] },
    flag: { ko: '깃발', poly: [[24, 12], [38, 12], [82, 32], [38, 52], [38, 88], [24, 88]] }
  };
  const FOLD_BASIC = ['arrow', 'corner', 'dot', 'bar', 'tee', 'semi'];
  function patPts(p) { const P = FOLD_PAT[p]; return P.poly || [[P.circle[0], P.circle[1]]]; }
  function patEl(p) {
    const P = FOLD_PAT[p];
    return P.poly ? '<polygon points="' + P.poly.map(function (q) { return q.join(','); }).join(' ') + '"/>' : '<circle cx="' + P.circle[0] + '" cy="' + P.circle[1] + '" r="' + P.circle[2] + '"/>';
  }
  /* 2차원 아핀 행렬 [a b c d e f] (SVG matrix 순서): x' = a·x + c·y + e, y' = b·x + d·y + f */
  function mMul(A, B) { return [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]]; }
  function mApply(M, q) { return [M[0] * q[0] + M[2] * q[1] + M[4], M[1] * q[0] + M[3] * q[1] + M[5]]; }
  function mStr(M) { return 'matrix(' + M.map(function (v) { return +v.toFixed(3); }).join(' ') + ')'; }
  /* 칸 가운데(50,50)를 중심으로 반시계 k×90° (화면은 y가 아래라 SVG 각도로는 −90k) */
  function mRot(k) {
    const cs = [[1, 0], [0, -1], [-1, 0], [0, 1]][((k % 4) + 4) % 4], c = cs[0], s = cs[1];
    return [c, s, -s, c, 50 - 50 * c + 50 * s, 50 - 50 * s - 50 * c];
  }
  const vNeg = function (v) { return [-v[0], -v[1], -v[2]]; };
  const vEq = function (a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; };
  const vAdd = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; };
  function netCells(rows) {
    const cells = [];
    rows.forEach(function (row, y) { row.split('').forEach(function (ch, x) { if (ch === 'X') cells.push([x, y]); }); });
    return cells;
  }
  /* 칸 0을 윗면으로 두고 이웃 칸을 차례로 아래로 접는다. 칸마다 { n: 바깥 법선, r: 종이 오른쪽, u: 종이 위쪽 } (격자는 y가 아래로) */
  function foldNet(cells) {
    const at = {};
    cells.forEach(function (c, i) { at[c[0] + ',' + c[1]] = i; });
    const fr = [{ n: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0] }], queue = [0];
    while (queue.length) {
      const i = queue.shift(), c = cells[i], f = fr[i];
      [[1, 0], [-1, 0], [0, -1], [0, 1]].forEach(function (d) {
        const j = at[(c[0] + d[0]) + ',' + (c[1] + d[1])];
        if (j == null || fr[j]) return;
        fr[j] = d[0] === 1 ? { n: f.r, r: vNeg(f.n), u: f.u } : d[0] === -1 ? { n: vNeg(f.r), r: f.n, u: f.u }
          : d[1] === -1 ? { n: f.u, r: f.r, u: vNeg(f.n) } : { n: vNeg(f.u), r: f.r, u: f.n };
        queue.push(j);
      });
    }
    return fr;
  }
  /* 칸 안에서 무늬를 반시계로 j×90° 돌려 놓았을 때 무늬의 오른쪽·위쪽 */
  function patFrame(f, j) { return [{ r: f.r, u: f.u }, { r: f.u, u: vNeg(f.r) }, { r: vNeg(f.r), u: vNeg(f.u) }, { r: vNeg(f.u), u: f.r }][j]; }
  /* 정육면체를 놓는 24가지 방법 (행렬식이 +1인 부호 있는 순열 행렬) */
  const ROT24 = [];
  [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].forEach(function (p) {
    for (let s = 0; s < 8; s++) {
      const M = [0, 1, 2].map(function (i) { const row = [0, 0, 0]; row[p[i]] = (s >> i) & 1 ? -1 : 1; return row; });
      if (M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]) === 1) ROT24.push(M);
    }
  });
  function mv(M, v) { return M.map(function (row) { return row[0] * v[0] + row[1] * v[1] + row[2] * v[2]; }); }
  function mtv(M, v) { return [0, 1, 2].map(function (i) { return M[0][i] * v[0] + M[1][i] * v[1] + M[2][i] * v[2]; }); }
  /* 등각 투영: 정육면체(모서리 42)가 100×100 가운데에 오고, 위(+z)·왼쪽 앞(−y)·오른쪽 앞(+x) 세 면이 보인다 */
  const ISO_C = Math.sqrt(3) / 2, CUBE_S = 42;
  function isoP(p) { return [50 + (p[0] + p[1] - 1) * ISO_C * CUBE_S, 50 + CUBE_S / 2 + (p[0] - p[1]) * CUBE_S / 2 - p[2] * CUBE_S]; }
  /* 보이는 면: N = 바깥 법선, R·U = 밖에서 볼 때 오른쪽·위쪽, o = 왼쪽 아래 꼭짓점. M = 무늬 좌표 → 화면 */
  const CUBE_VIEW = [
    { N: [0, 0, 1], R: [1, 0, 0], U: [0, 1, 0], o: [0, 0, 1] },
    { N: [0, -1, 0], R: [1, 0, 0], U: [0, 0, 1], o: [0, 0, 0] },
    { N: [1, 0, 0], R: [0, 1, 0], U: [0, 0, 1], o: [1, 0, 0] }
  ];
  CUBE_VIEW.forEach(function (v) {
    const o = isoP(v.o), a = isoP(vAdd(v.o, v.R)), b = isoP(vAdd(v.o, v.U)), ab = isoP(vAdd(vAdd(v.o, v.R), v.U));
    v.M = [(a[0] - o[0]) / 100, (a[1] - o[1]) / 100, (o[0] - b[0]) / 100, (o[1] - b[1]) / 100, b[0], b[1]];
    v.pts = [o, a, ab, b].map(function (q) { return +q[0].toFixed(2) + ',' + +q[1].toFixed(2); }).join(' ');
  });
  const MIRROR_M = [-1, 0, 0, 1, 100, 0];
  /* 몸체를 Q로 돌렸을 때 보이는 세 면: { i: 전개도 칸, k: 그 면에서 무늬가 반시계로 돈 양(90° 단위) } */
  function cubeView(fr, pf, Q) {
    return CUBE_VIEW.map(function (v) {
      const b = mtv(Q, v.N);
      let i = 0;
      while (!vEq(fr[i].n, b)) i++;
      const w = mv(Q, pf[i].r);
      return { i: i, k: vEq(w, v.R) ? 0 : vEq(w, v.U) ? 1 : vEq(w, vNeg(v.R)) ? 2 : 3 };
    });
  }
  function viewFaces(spec, pats) {
    return spec.f.map(function (x, pos) {
      const M = mMul(CUBE_VIEW[pos].M, mRot(x.k));
      return { p: pats[x.i], M: spec.mirror ? mMul(MIRROR_M, M) : M };
    });
  }
  /* 두 그림이 같은지: 무늬마다 꼭짓점 화면 좌표가 (순서와 상관없이) 모두 겹치면 같다 */
  function sameView(A, B) {
    return A.every(function (fa) {
      const fb = B.filter(function (x) { return x.p === fa.p; })[0];
      if (!fb) return false;
      const pb = patPts(fb.p).map(function (q) { return mApply(fb.M, q); });
      return patPts(fa.p).every(function (q) { const a = mApply(fa.M, q); return pb.some(function (b) { return Math.abs(a[0] - b[0]) < 0.5 && Math.abs(a[1] - b[1]) < 0.5; }); });
    });
  }
  function cubeSVG(spec, pats) {
    // 보기 높이를 줄이려고 정육면체 둘레(가로 13.6~86.4, 세로 8~92)에 맞게 잘라 그린다. 무늬 좌표는 그대로다
    return '<svg class="cell cube" viewBox="12.5 7 75 86" aria-hidden="true">' +
      CUBE_VIEW.map(function (v) { return '<polygon class="cf" points="' + v.pts + '"/>'; }).join('') +
      '<polygon class="cs cs-l" points="' + CUBE_VIEW[1].pts + '"/><polygon class="cs cs-r" points="' + CUBE_VIEW[2].pts + '"/>' +
      viewFaces(spec, pats).map(function (f) { return '<g data-p="' + f.p + '" transform="' + mStr(f.M) + '">' + patEl(f.p) + '</g>'; }).join('') + '</svg>';
  }
  function netSVG(cells, pats, rots) {
    const W = Math.max.apply(null, cells.map(function (c) { return c[0]; })) + 1, H = Math.max.apply(null, cells.map(function (c) { return c[1]; })) + 1;
    return '<svg class="fold-net" style="--c:' + W + '" viewBox="0 0 ' + (W * 100 + 16) + ' ' + (H * 100 + 16) + '" aria-hidden="true">' + cells.map(function (c, i) {
      const x = 8 + c[0] * 100, y = 8 + c[1] * 100;
      return '<rect class="sq" x="' + x + '" y="' + y + '" width="100" height="100"/><g data-p="' + pats[i] + '" transform="' + mStr(mMul([1, 0, 0, 1, x, y], mRot(rots[i]))) + '">' + patEl(pats[i]) + '</g>';
    }).join('') + '</svg>';
  }
  const FOLD_WRONG = { opp: '마주 보는 두 면이 함께 보이는', rot: '무늬 하나가 돌아간', rot2: '무늬 하나가 거꾸로 된', swap: '두 면의 자리가 서로 바뀐', mirror: '전체를 거울에 비춘' };
  const FOLD_KINDS = { 1: ['opp', 'opp', 'opp'], 2: ['opp', 'opp', 'rot2'], 3: ['opp', 'rot', 'swap'], 4: ['rot', 'swap', 'mirror'], 5: ['rot', 'rot', 'mirror'] };
  /* 1~2단계는 1-4-1 꼴 6가지, 3단계는 2-3-1 꼴까지, 4단계는 11가지 모두, 5단계는 1-4-1이 아닌 5가지 */
  const FOLD_NET_POOL = { 1: [0, 1, 2, 3, 4, 5], 2: [0, 1, 2, 3, 4, 5], 3: [0, 1, 2, 3, 4, 5, 6, 7, 8], 4: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5: [6, 7, 8, 9, 10] };
  function makeFold(r, level) {
    for (let guard = 0; guard < 200; guard++) {
      // 전개도 모양은 돌리거나 뒤집어 놓임 하나를 고르되, 폰 한 화면에 문항이 다 들어가게 늘 가로로 눕힌다(8가지 놓임 중 가로로 긴 4가지)
      let cells = netCells(FOLD_NETS[r.pick(FOLD_NET_POOL[level])]);
      if (r.next() < 0.5) cells = cells.map(function (c) { return [-c[0], c[1]]; });
      for (let t = r.int(0, 3); t > 0; t--) cells = cells.map(function (c) { return [-c[1], c[0]]; });
      cells = normalize(cells);
      const span = function (ax) { return Math.max.apply(null, cells.map(function (c) { return c[ax]; })); };
      if (span(1) > span(0)) cells = normalize(cells.map(function (c) { return [-c[1], c[0]]; }));
      const fr = foldNet(cells);
      const pats = r.sample(level <= 3 ? FOLD_BASIC : Object.keys(FOLD_PAT), 6);
      const rots = cells.map(function () { return level <= 2 ? 0 : r.int(0, 3); });
      const pf = fr.map(function (f, i) { return patFrame(f, rots[i]); });
      const opp = fr.map(function (f) { let j = 0; while (!vEq(fr[j].n, vNeg(f.n))) j++; return j; });
      const valid = ROT24.map(function (Q) { return { f: cubeView(fr, pf, Q), mirror: false }; });
      const validFaces = valid.map(function (s) { return viewFaces(s, pats); });
      // 쉬운 단계는 보이는 세 면이 전개도에서도 이어 붙은 그림을 정답으로 고른다
      const adj = function (a, b) { return Math.abs(cells[a][0] - cells[b][0]) + Math.abs(cells[a][1] - cells[b][1]) === 1 ? 1 : 0; };
      const need = level === 1 ? 2 : level === 2 ? 1 : 0;
      const ans = r.pick(valid.filter(function (s) { return adj(s.f[0].i, s.f[1].i) + adj(s.f[0].i, s.f[2].i) + adj(s.f[1].i, s.f[2].i) >= need; }));
      const opts = [ans], seen = [viewFaces(ans, pats)];
      let rotAt = -1;
      const wrong = function (kind) {
        for (let t = 0; t < 40; t++) {
          // 정답이 아니라 무작위로 고른 '나올 수 있는 모습'에서 한 군데를 바꾼다(정답에서 바꾸면 보기끼리만 비교해도 정답이 드러난다)
          const base = r.pick(valid);
          const s = { f: base.f.map(function (x) { return { i: x.i, k: x.k }; }), mirror: kind === 'mirror' };
          let p = -1;
          if (kind === 'opp') {
            p = r.int(0, 2);
            const q = r.pick([0, 1, 2].filter(function (x) { return x !== p; }));
            s.f[p] = { i: opp[s.f[q].i], k: r.int(0, 3) };   // 남아 있는 면의 맞은편 면을 그 옆에 둔다
          } else if (kind === 'rot' || kind === 'rot2') {
            p = r.pick([0, 1, 2].filter(function (x) { return x !== rotAt; }));
            s.f[p].k = (s.f[p].k + (kind === 'rot2' ? 2 : level >= 5 ? r.pick([1, 3]) : r.int(1, 3))) % 4;
          } else if (kind === 'swap') {
            const pq = r.sample([0, 1, 2], 2), tmp = s.f[pq[0]];
            s.f[pq[0]] = s.f[pq[1]]; s.f[pq[1]] = tmp;
          }
          const fs = viewFaces(s, pats);
          if (validFaces.some(function (v) { return sameView(v, fs); }) || seen.some(function (v) { return sameView(v, fs); })) continue;
          if (kind === 'rot') rotAt = p;
          opts.push(s); seen.push(fs);
          return true;
        }
        return false;
      };
      if (!FOLD_KINDS[level].every(wrong)) continue;
      const pairs = [];
      opp.forEach(function (j, i) { if (i < j) pairs.push([FOLD_PAT[pats[i]].ko, FOLD_PAT[pats[j]].ko]); });
      const faceKo = ans.f.map(function (x) { return FOLD_PAT[pats[x.i]].ko; });
      const kinds = FOLD_KINDS[level].filter(function (k, i, a) { return a.indexOf(k) === i; });
      const o = shuffleOptions(r, opts, 0);
      return {
        type: 'choice', part: 'fold', scored: true, level: level, timeLimit: level >= 4 ? 60 : 45,
        prompt: '전개도를 접으면 나올 수 있는 모양은?',
        promptHtml: '<div class="fold-prompt">' + netSVG(cells, pats, rots) + '</div>',
        optionsHtml: o.options.map(function (s) { return cubeSVG(s, pats); }), answer: o.answer, optionCols: 2,
        explain: '접었을 때 마주 보는 면은 ' + pairs.map(function (p, i) { return U.josa(p[0], '과', '와') + ' ' + (i === pairs.length - 1 ? U.josa(p[1], '이에요', '예요') : p[1]); }).join(', ') +
          '. 마주 보는 두 면은 한 그림에 함께 보일 수 없어요. 정답은 위에 ' + faceKo[0] + ', 왼쪽에 ' + faceKo[1] + ', 오른쪽에 ' + U.josa(faceKo[2], '이', '가') + ' 보이는 그림이에요. ' +
          (kinds.length === 1 ? '오답은 모두 ' + FOLD_WRONG[kinds[0]] + ' 그림이에요.' : '오답에는 ' + kinds.map(function (k) { return FOLD_WRONG[k] + ' 것'; }).join(', ') + '이 있어요.')
      };
    }
    return makeFold(r, Math.max(1, level - 1));
  }

  /* ===== 7. 블록 세기 (1~5단계) =====
     뒤쪽 구석이 가장 높고 앞(왼쪽 앞·오른쪽 앞)으로 올수록 낮거나 같은 모양으로만 쌓는다. 그러면 모든 기둥의 윗면이 다 보이고
     보이는 면이 끊김 없이 이어진다. 다만 등각 그림에서는 맨 아래가 가려진 뒤쪽 기둥을 대각선 뒤로 한 칸 옮기고 한 층 낮춰도 그림이
     똑같다(투영에서 (x, y, z)와 (x−1, y+1, z−1)이 같은 점). 그렇게 옮긴 기둥은 다른 블록과 면으로 닿지 않으므로, 문항에 적는 규칙으로
     그 읽기를 막는다: 블록은 모두 바닥이나 다른 블록 위에 놓여 있고(위에 블록이 있으면 그 아래에도 블록이 있다) 옆 블록과 면이 맞닿아
     한 덩어리로 붙어 있으며, 그 밖에 숨은 블록은 없다. 그림이 같은 다른 쌓기는 기둥 한두 개를 옮겨 보는 검사(단계마다 200문항)와
     가려진 기둥을 모두 옮기는 검사(단계마다 1000문항)에서 모두 한 덩어리가 아니었다(2026-10-18).
     h[a][b]: a는 오른쪽 앞(+x), b는 왼쪽 앞(−y)으로 갈수록 커진다.
     보기는 정답이 들어간 연속한 네 수이고 정답 자리는 고르게 정한다(2026-10-18 전에는 정답 ±1~3을 따로 뽑아, 보기 간격 모양만 보고도
     정답 자리를 짐작할 수 있었다). 가려진 블록 수가 정답보다 작은 보기 수 이하이면 보이는 블록만 센 수가 저절로 오답에 들어간다. */
  const BLK_SPEC = {
    1: { a: [2, 3], b: [2, 2], h: 2, n: [4, 8], hid: 0, t: 30 },
    2: { a: [2, 3], b: [3, 3], h: 3, n: [7, 13], hid: 1, t: 40 },
    3: { a: [3, 3], b: [3, 3], h: 3, n: [11, 18], hid: 2, t: 45 },
    4: { a: [3, 4], b: [4, 4], h: 4, n: [16, 26], hid: 3, t: 55 },
    5: { a: [4, 4], b: [4, 4], h: 4, n: [24, 34], hid: 5, t: 60 }
  };
  function blocksSVG(h, A, B) {
    const S = 20, H = function (a, b) { return a < A && b < B ? h[a][b] : 0; };
    const P = function (x, y, z) { return [(x + y) * ISO_C * S, (x - y) * S / 2 - z * S]; };
    const faces = [];
    for (let a = 0; a < A; a++) for (let b = 0; b < B; b++) for (let z = 0; z < h[a][b]; z++) {
      const x = a, y = B - 1 - b, d = x - y + z;   // d가 클수록 보는 사람에게 가깝다 → 작은 것부터 그린다
      if (z === h[a][b] - 1) faces.push([d, 'bt', [P(x, y, z + 1), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)]]);
      if (H(a, b + 1) <= z) faces.push([d, 'bl', [P(x, y, z), P(x + 1, y, z), P(x + 1, y, z + 1), P(x, y, z + 1)]]);
      if (H(a + 1, b) <= z) faces.push([d, 'br', [P(x + 1, y, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x + 1, y, z + 1)]]);
    }
    faces.sort(function (p, q) { return p[0] - q[0]; });
    const xs = [], ys = [];
    faces.forEach(function (f) { f[2].forEach(function (q) { xs.push(q[0]); ys.push(q[1]); }); });
    const x0 = Math.min.apply(null, xs) - 2, y0 = Math.min.apply(null, ys) - 2, w = Math.max.apply(null, xs) + 2 - x0, hh = Math.max.apply(null, ys) + 2 - y0;
    const f2 = function (v) { return +v.toFixed(2); };
    return '<svg class="blk" style="--w:' + Math.round(w) + '" viewBox="' + [x0, y0, w, hh].map(f2).join(' ') + '" aria-hidden="true">' + faces.map(function (f) {
      return '<polygon class="' + f[1] + '" points="' + f[2].map(function (q) { return f2(q[0]) + ',' + f2(q[1]); }).join(' ') + '"/>';
    }).join('') + '</svg>';
  }
  function makeBlocks(r, level) {
    const sp = BLK_SPEC[level];
    let h, A, B, total, hidden;
    for (let guard = 0; guard < 500; guard++) {
      A = r.int(sp.a[0], sp.a[1]); B = r.int(sp.b[0], sp.b[1]);
      if (r.next() < 0.5) { const t = A; A = B; B = t; }
      h = [];
      for (let a = 0; a < A; a++) {
        h.push([]);
        for (let b = 0; b < B; b++) h[a].push(Math.max(0, Math.min(a ? h[a - 1][b] : sp.h, b ? h[a][b - 1] : sp.h) - r.pick([0, 0, 0, 1, 1, 2])));
      }
      if (!h[A - 1][0] || !h[0][B - 1]) continue;   // 바닥 칸을 양쪽 끝까지 쓴다
      total = 0; hidden = 0;
      for (let a = 0; a < A; a++) for (let b = 0; b < B; b++) {
        total += h[a][b];
        // 가려진 블록: 기둥 맨 위가 아니고, 오른쪽 앞·왼쪽 앞 이웃 기둥이 그 높이까지 차 있다
        for (let z = 0; z < h[a][b] - 1; z++) if ((a + 1 < A ? h[a + 1][b] : 0) > z && (b + 1 < B ? h[a][b + 1] : 0) > z) hidden++;
      }
      if (h[0][0] >= 2 && total >= sp.n[0] && total <= sp.n[1] && hidden >= sp.hid) break;   // 뒤 구석(가장 높은 기둥)은 두 층 이상
    }
    const below = r.int(0, 3);   // 정답보다 작은 보기 수 = 정답 자리(0~3, 고르게)
    const vals = [0, 1, 2, 3].map(function (d) { return total - below + d; });   // 정답이 들어간 연속한 네 수. total ≥ 4라 가장 작은 수도 1 이상
    const layers = [];
    for (let z = 0; ; z++) {
      let c = 0;
      h.forEach(function (row) { row.forEach(function (v) { if (v > z) c++; }); });
      if (!c) break;
      layers.push((z + 1) + '층 ' + c + '개');
    }
    return {
      type: 'choice', part: 'blocks', scored: true, level: level, timeLimit: sp.t,
      prompt: '블록은 모두 몇 개일까요?',
      promptHtml: '<div class="blk-prompt">' + blocksSVG(h, A, B) + '<p class="blk-rule">블록은 모두 바닥이나 다른 블록 위에 놓여 있고, 옆 블록과 면이 맞닿아 한 덩어리로 붙어 있어요. 위에 블록이 있으면 그 아래에도 블록이 있고, 그 밖에 숨은 블록은 없어요.</p></div>',
      options: vals.map(function (v) { return v + '개'; }), answer: vals.indexOf(total), optionCols: 2,
      explain: '층별로 세면 ' + layers.join(', ') + '로 모두 ' + total + '개예요. ' + (hidden ? '겉에서 보이는 블록은 ' + (total - hidden) + '개이고, 나머지 ' + hidden + '개는 위에 블록이 있어서 아래도 차 있다고 세야 하는 가려진 블록이에요.' : '이 그림에서는 모든 블록이 겉에서 보여요.')
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
      what: '머릿속에서 모양을 돌리고, 뒤집고, 접어 보는 힘이에요. 그림에서 안 보이는 쪽까지 그려 보는 힘도 여기에 들어가요.',
      where: '주차할 때, 지도를 보고 길을 찾을 때, 가구를 어디에 놓을지 그려 볼 때, 상자를 접거나 짐을 쌓을 때, 뭔가 조립할 때 쓰여요. 그림, 설계, 운동처럼 손과 눈을 함께 쓰는 일에서 특히 중요해요.' },
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
    rotation: { label: '도형 회전', domain: 'spatial', minutes: 4, desc: '위 도형을 돌리기만 해서 만들 수 있는 걸 골라요. 거울처럼 뒤집은 건 정답이 아니에요.', where: '머릿속에서 모양을 돌리는 힘이에요. 주차, 지도 읽기, 조립, 그림 그리기에 쓰여요.' },
    fold: { label: '전개도 접기', domain: 'spatial', minutes: 5, desc: '펼쳐 놓은 전개도를 접어 정육면체를 만들었을 때 나올 수 있는 모양을 골라요. 무늬는 상자 바깥쪽에 그려져 있어요. 화살표처럼 방향이 있는 무늬는 놓인 방향까지 맞아야 하고, 점처럼 돌려도 똑같은 무늬는 방향을 따지지 않아요.', where: '평면을 머릿속에서 입체로 접어 보는 힘이에요. 상자 포장, 종이접기, 옷 개기, 설명서 보고 조립하기에 쓰여요.' },
    blocks: { label: '블록 세기', domain: 'spatial', minutes: 5, desc: '쌓아 놓은 블록이 모두 몇 개인지 세요. 블록은 모두 바닥이나 다른 블록 위에 놓여 있어서, 위에 블록이 있으면 그 아래에도 블록이 있어요. 예를 들어 2층 블록 아래 1층 자리가 가려져 안 보여도 거기에 블록이 있다고 세요. 또 블록은 옆 블록과 면이 맞닿아 한 덩어리로 붙어 있어서, 따로 떨어져 선 블록이나 그 밖에 숨은 블록은 없어요.', where: '보이는 모습만으로 안 보이는 부분까지 그려 보는 힘이에요. 짐 싣기, 창고 정리, 도면 읽기, 물건이 몇 개 들었는지 어림하기에 쓰여요.' },
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
  /* 빠른 검사: 영역마다 대표 과제를 골라 적응형으로 푼다. 숫자 앞으로·단순 반응은 지능과의 관계가 약해 숫자 거꾸로·기호 찾기로,
     유추는 같은 시간에 문항을 더 풀 수 있는 어휘로 바꿨다. 참값을 아는 가상 응시자 시뮬레이션에서 오차(RMSE)가 IQ 9.5 → 8 안팎
     (2026-10-18 영역·종합 규준화 뒤에는 평균 쪽으로 눌리던 몫을 풀어 8.4 안팎).
     2026-10-18: 공간을 도형 회전 하나로만 재지 않도록 전개도 접기를 더해 7과제로 했다(사용자 결정). */
  const QUICK = ['matrix', 'sequence', 'vocab', 'rotation', 'fold', 'digitB', 'symbol'];
  const LEVEL_KO = { 1: '쉬움', 2: '보통', 3: '어려움', 4: '매우 어려움', 5: '최상', 6: '극상' };

  /* 난이도 단계별 예상 정답률(찍기 몫을 뺀 값: 정답 확률 = c + (1−c)·σ(θ−b), b = ln((1−p)/p)의 p). 2026-10-18 AI 평가자(과제마다 따로 3번 실행)가 문항마다 보통 성인의 정답률을 추정한 평균에서 찍기 몫을 빼서 매겼다. 언어 4풀은 문항마다 그 추정값으로 단계를 다시 매기고(경계는 default 단계표와 같은 눈금) 빈 상위 단계는 새로 쓴 문항으로 채웠다(공통점은 어렵게 쓰기가 힘들어 5단계가 아직 2개뿐이라, 모자란 자리는 4단계 문항이 대신 나온다). 그림 과제는 평가자가 그림을 직접 보지 못하고 규칙 설명만 읽었으므로 설계값과 반반 섞었다. 실제 응시 자료가 쌓이면 그 값으로 바꾼다.
     2026-10-18 공간 수정: 도형 회전은 오답을 모두 거울상으로 바꾸고 단계마다 칸 수를 늘려(5·6·7·8·9칸) 단계가 실제로 달라졌으므로, 다시 매기기 전까지
     단조로 내려가는 임시값(.85/.75/.62/.48/.36)을 둔다. 전개도(오답 출발점·대칭 무늬)와 블록(연속한 네 수 보기)도 문항 만드는 방식이 바뀌어 다시 매겨야 한다. */
  const LEVEL_P = {
    default: { 1: 0.92, 2: 0.80, 3: 0.62, 4: 0.42, 5: 0.25, 6: 0.12 },
    analogy: { 1: 0.94, 2: 0.77, 3: 0.60, 4: 0.38, 5: 0.25 },
    vocab: { 1: 0.90, 2: 0.80, 3: 0.63, 4: 0.44, 5: 0.13 },
    logic: { 1: 0.92, 2: 0.78, 3: 0.61, 4: 0.41, 5: 0.23 },
    similar: { 1: 0.92, 2: 0.81, 3: 0.63, 4: 0.44, 5: 0.30 },
    matrix: { 1: 0.92, 2: 0.80, 3: 0.61, 4: 0.42, 5: 0.25, 6: 0.12 },
    figAnalogy: { 1: 0.93, 2: 0.82, 3: 0.63, 4: 0.49, 5: 0.31 },
    series: { 1: 0.89, 2: 0.73, 3: 0.53 },
    sequence: { 1: 0.90, 2: 0.69, 3: 0.58, 4: 0.43, 5: 0.24 },
    weights: { 1: 0.90, 2: 0.84, 3: 0.57, 4: 0.44, 5: 0.31 },
    rotation: { 1: 0.85, 2: 0.75, 3: 0.62, 4: 0.48, 5: 0.36 },
    fold: { 1: 0.85, 2: 0.68, 3: 0.47, 4: 0.32, 5: 0.20 },
    blocks: { 1: 0.90, 2: 0.76, 3: 0.60, 4: 0.38, 5: 0.21 }
  };
  /* 임시 기준값: prop = 정답률(평균은 LEVEL_P에 찍기 몫을 더해 계산), span = 폭, rt = 반응 시간(ms, 낮을수록 좋음). 공인 규준이 아니다. */
  const NORMS = {
    matrix: { kind: 'prop', sd: 0.20 }, figAnalogy: { kind: 'prop', sd: 0.20 }, series: { kind: 'prop', sd: 0.22 }, sequence: { kind: 'prop', sd: 0.20 }, weights: { kind: 'prop', sd: 0.22 },
    analogy: { kind: 'prop', sd: 0.18 }, vocab: { kind: 'prop', sd: 0.18 }, logic: { kind: 'prop', sd: 0.20 }, similar: { kind: 'prop', sd: 0.18 }, rotation: { kind: 'prop', sd: 0.22 },
    fold: { kind: 'prop', sd: 0.22 }, blocks: { kind: 'prop', sd: 0.22 },
    /* 폭 과제: 한 개씩 보여 주고 같은 길이를 두 번까지 시도하는 방식(공인 검사와 같은 규칙)의 20~30대 기준.
       숫자 앞으로 7, 거꾸로 5, 위치(코르시) 6, 숫자-문자 5~6 정도가 보통이라 그 근처에 둔다. 기준을 낮게 잡으면 기억 IQ가 부풀어 보인다. */
    digitF: { kind: 'span', mean: 7.0, sd: 1.1 }, digitB: { kind: 'span', mean: 5.2, sd: 1.2 }, grid: { kind: 'span', mean: 6.0, sd: 1.1 }, lns: { kind: 'span', mean: 5.3, sd: 1.1 },
    reaction: { kind: 'rt', mean: 280, sd: 45 }, choicert: { kind: 'rt', mean: 480, sd: 80 }, stroop: { kind: 'rt', mean: 800, sd: 130 },
    symbol: { kind: 'count', mean: 24, sd: 6 }
  };
  /* 기준값 버전. 익명 통계로 보내는 결과에 붙어서 어느 기준값으로 낸 z인지 구분한다. NORMS·LEVEL_P를 바꾸면 함께 바꾼다(tools/norms-from-stats.cjs --write 가 자동으로 바꿈). */
  const NORMS_VERSION = 'ai-est-2026-10-18b';
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
  /* 영역·종합 점수 규준화 (2026-10-18). 과제 점수(z)에는 측정 오차가 섞여 있어 과제끼리의 상관이 참 능력끼리보다 훨씬 낮다.
     예전에는 참 능력 사이 상관(영역 안 0.6, 영역 사이 0.5)을 가정한 합성 공식으로 합쳐서, 종합 점수의 표준편차가 15가 아니라
     11~12로 줄고 참값이 높은 사람(122.5 이상)은 7점 안팎 낮게, 낮은 사람(77.5 미만)은 8~10점 높게 나왔다. 그래서 과제 점수를 더한 뒤, 같은 과제를 푼
     가상 응시자 집단에서 그 합이 평균 0·표준편차 1이 되도록 나눈다(관측 점수 규준화). 값은 참값을 아는 가상 응시자 9000명
     시뮬레이션(적응형 5000·정밀 4000, 20과제, 2026-10-18 단계표 기준)에서 구했다. within·between = 관측 과제 점수끼리의 상관(같은 영역·다른 영역), spread = 과제 점수의
     표준편차(채점 종류별), shift = 정답률 과제 점수의 평균이 0보다 높은 정도(라쉬 사후 최빈값은 찍기 확률 때문에 낮은 쪽이 덜
     내려간다). 과제 점수 자체는 그대로 두므로 예전에 저장한 결과도 같은 방식으로 합쳐진다. 실제 응시 자료가 쌓이면 실제 분포로 바꾼다. */
  const OBS = {
    within: { fluid: 0.28, verbal: 0.30, spatial: 0.17, memory: 0.30, speed: 0.25 }, between: 0.19,
    spread: { prop: 0.94, span: 1.12, rt: 1.08, count: 1.09 }, shift: { adaptive: 0.08, full: 0.04 }
  };
  // 정답률 과제의 평균 이동: 기준 정답률(meanP)은 단계표대로 푼 결과(정밀 검사)에만 있고 적응형에는 없다
  function obsShift(k, st) { return NORMS[k].kind !== 'prop' ? 0 : st.meanP == null ? OBS.shift.adaptive : OBS.shift.full; }
  function obsCov(a, b) {
    const r = a === b ? 1 : TASKS[a].domain === TASKS[b].domain ? OBS.within[TASKS[a].domain] : OBS.between;
    return r * OBS.spread[NORMS[a].kind] * OBS.spread[NORMS[b].kind];
  }
  function sumCov(A, B) { let v = 0; A.forEach(function (a) { B.forEach(function (b) { v += obsCov(a, b); }); }); return v; }
  /* 영역 점수: 과제가 하나면 그 과제 점수 그대로, 둘 이상이면 평균 이동을 뺀 합을 그 합의 표준편차로 나눈다 */
  function domainZ(keys, tasks) {
    if (keys.length === 1) return tasks[keys[0]].z;
    const sum = keys.reduce(function (s, k) { return s + tasks[k].z - obsShift(k, tasks[k]); }, 0);
    return U.clamp(sum / Math.sqrt(sumCov(keys, keys)), -3, 3);
  }
  /* 종합 점수: 영역 점수를 더하고(과제 하나짜리 영역은 평균 이동을 빼고) 그 합의 표준편차로 나눈다. groups = [{ keys, z }] */
  function overallZ(groups, tasks) {
    const S = groups.map(function (g) { return g.keys.length > 1 ? Math.sqrt(sumCov(g.keys, g.keys)) : 1; });
    let sum = 0, v = 0;
    groups.forEach(function (g, i) {
      sum += g.z - (g.keys.length > 1 ? 0 : obsShift(g.keys[0], tasks[g.keys[0]]));
      groups.forEach(function (h, j) { v += sumCov(g.keys, h.keys) / (S[i] * S[j]); });
    });
    return U.clamp(sum / Math.sqrt(v), -3, 3);
  }
  /* 영역 점수의 측정 오차(SEM): 과제 하나의 신뢰도 ρ(영역별)를 그 영역에서 푼 과제 수 n만큼 스피어먼-브라운으로 합쳐 15·√(1−신뢰도).
     ρ는 2026-10-18 가상 응시자 1000명에게 적응형 검사를 두 번씩 풀게 한 영역 점수 재검사 상관(규칙 .71·언어 .70·공간 .64·기억 .84·
     속도 .92)을 그 영역 과제 수로 거꾸로 나눈 값이다(규칙 5·언어 4·공간 3·기억 4·속도 4과제). 실제 응시 자료가 쌓이면 다시 구한다.
     요약에서 "가장 약한 영역" 문구는 가장 높은 영역과 가장 낮은 영역의 차이가 두 영역 SEM을 합친 √(SEM_a² + SEM_b²) 이상일 때만 쓴다.
     예전 기준(차이 8점 이상)은 영역 점수의 오차보다 작아서, 모든 과제 실력이 같은 사람도 거의 다 약점 문구를 받았다(가상 응시자 적응형 94%·빠른 98%
     → 이 기준으로 83%·78%). 다섯 영역 중 가장 높은 것과 낮은 것을 견주는 것이라 차이가 커지기 쉽다. 1.96배(95% 기준)로 하면 30%·19%까지 줄지만
     한 영역만 1.5 SD 낮은 사람을 잡는 비율도 적응형 84~97% → 65~90%, 빠른 53~79% → 28~55%로 떨어진다. 화면의 "오차 범위"(±SEM, 약 70%)와 맞춰 1배로 둔다. */
  const TASK_REL = { fluid: 0.33, verbal: 0.37, spatial: 0.37, memory: 0.57, speed: 0.74 };
  function domainSem(d, n) { const q = TASK_REL[d] || 0.35, rel = n * q / (1 + (n - 1) * q); return 15 * Math.sqrt(1 - rel); }
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
    rotation: { full: [1, 2, 3, 4, 5, 5], quick: [1, 2, 4, 5] },
    fold: { full: [1, 2, 3, 4, 5, 5] },
    blocks: { full: [1, 2, 3, 4, 5, 5] },
    /* 언어 4과제: 문항 풀에서 단계마다 2~3개씩 뽑는다. 그 단계 문항이 모자라면 가장 가까운 단계에서 뽑는다(pickFromPool) */
    analogy: { full: [1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5], quick: [1, 2, 3, 4, 5, 5] },
    vocab: { full: [1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5] },
    logic: { full: [1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5] },
    similar: { full: [1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5] }
  };
  const byLevel = function (list) { return list.slice().sort(function (a, b) { return a.level - b.level; }); };
  const BUILD = {
    matrix: function (r, full) { return (full ? LEVELS.matrix.full : LEVELS.matrix.quick).map(function (l) { return makeMatrix(r, l); }); },
    figAnalogy: function (r) { return LEVELS.figAnalogy.full.map(function (l) { return makeFigAnalogy(r, l); }); },
    weights: function (r) { return LEVELS.weights.full.map(function (l) { return makeWeights(r, l); }); },
    similar: function (r) { return choiceItems(r, byLevel(drawPool(r, 'similar', LEVELS.similar.full)), 'similar', 35, 1); },
    lns: function () { return [{ type: 'seqspan', part: 'lns', scored: true, start: 2, max: 8, title: '숫자-문자 순서', desc: TASKS.lns.desc }]; },
    symbol: function () { return [{ type: 'symsearch', part: 'symbol', scored: true, seconds: 60, title: '기호 찾기', desc: TASKS.symbol.desc }]; },
    series: function (r) { return LEVELS.series.full.map(function (l) { return makeSeries(r, l); }); },
    sequence: function (r, full) { return (full ? LEVELS.sequence.full : LEVELS.sequence.quick).map(function (l) { return makeSequence(r, l); }); },
    analogy: function (r, full) { return choiceItems(r, byLevel(drawPool(r, 'analogy', full ? LEVELS.analogy.full : LEVELS.analogy.quick)), 'analogy', function (l) { return l >= 4 ? 45 : 40; }, 2); },
    vocab: function (r) { return choiceItems(r, byLevel(drawPool(r, 'vocab', LEVELS.vocab.full)), 'vocab', 35, 1); },
    logic: function (r) { return choiceItems(r, byLevel(drawPool(r, 'logic', LEVELS.logic.full)), 'logic', function (l) { return l >= 4 ? 75 : 60; }, 1, true); },
    rotation: function (r, full) { return (full ? LEVELS.rotation.full : LEVELS.rotation.quick).map(function (l) { return makeRotation(r, l); }); },
    fold: function (r) { return LEVELS.fold.full.map(function (l) { return makeFold(r, l); }); },
    blocks: function (r) { return LEVELS.blocks.full.map(function (l) { return makeBlocks(r, l); }); },
    digitF: function () { return [{ type: 'digitspan', part: 'digitF', scored: true, mode: 'forward', start: 3, max: 9, title: '숫자 앞으로 외우기', desc: TASKS.digitF.desc }]; },
    digitB: function () { return [{ type: 'digitspan', part: 'digitB', scored: true, mode: 'backward', start: 2, max: 8, title: '숫자 거꾸로 외우기', desc: TASKS.digitB.desc }]; },
    grid: function () { return [{ type: 'gridspan', part: 'grid', scored: true, start: 3, max: 9, title: '위치 기억', desc: TASKS.grid.desc }]; },
    reaction: function () { return [{ type: 'reaction', part: 'reaction', scored: true, trials: 5, title: '단순 반응', desc: TASKS.reaction.desc }]; },
    choicert: function () { return [{ type: 'choicert', part: 'choicert', scored: true, trials: 16, title: '선택 반응', desc: TASKS.choicert.desc }]; },
    stroop: function () { return [{ type: 'stroop', part: 'stroop', scored: true, trials: 16, title: '색-단어 간섭', desc: TASKS.stroop.desc }]; }
  };
  const COUNT_KO = {
    matrix: function (f) { return (f ? 12 : 6) + '문항 · 60~120초 · 1~6단계 · 보기 8개'; }, series: function () { return '6문항 · 40~50초 · 1~3단계'; },
    figAnalogy: function () { return '10문항 · 45~60초 · 1~5단계'; }, weights: function () { return '8문항 · 60~90초 · 1~5단계'; }, similar: function () { return '12문항 · 35초 · 1~5단계'; },
    sequence: function (f) { return (f ? 8 : 5) + '문항 · 50~60초 · 1~5단계'; }, analogy: function (f) { return (f ? 12 : 6) + '문항 · 40~45초 · 1~5단계'; },
    vocab: function () { return '12문항 · 35초 · 1~5단계'; }, logic: function () { return '12문항 · 60~75초 · 1~5단계'; }, rotation: function (f) { return (f ? 6 : 4) + '문항 · 40~55초 · 1~5단계'; },
    fold: function () { return '6문항 · 45~60초 · 1~5단계'; }, blocks: function () { return '6문항 · 30~60초 · 1~5단계'; }
  };

  /* 처음 보는 과제 앞에 붙는 연습 문제 (시간 제한 없음, 점수 없음, 풀고 나면 정답과 규칙을 보여 준다) */
  const PRACTICE = {
    matrix: function (r) { return makeMatrix(r, 1); },
    figAnalogy: function (r) { return makeFigAnalogy(r, 1); },
    weights: function (r) { return makeWeights(r, 1); },
    similar: function (r) { return choiceItems(r, [SIMILAR[PRACTICE_ITEM.similar]], 'similar', 0, 1)[0]; },
    series: function (r) { return makeSeries(r, 1); },
    sequence: function (r) { return makeSequence(r, 1); },
    rotation: function (r) { return makeRotation(r, 1); },
    fold: function (r) { return makeFold(r, 1); },
    blocks: function (r) { return makeBlocks(r, 1); },
    analogy: function (r) { return choiceItems(r, [VERBAL[PRACTICE_ITEM.analogy]], 'analogy', 0, 2)[0]; },
    logic: function (r) { return choiceItems(r, [LOGIC[PRACTICE_ITEM.logic]], 'logic', 0, 1, true)[0]; }
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
     답이 오면 adaptRecord()로 상태를 갱신한다. 스텁 상태는 세션에 함께 저장된다.
     공간 세 과제(회전·전개도·블록)는 보기가 4개라 문항 하나가 주는 정보가 적어 2026-10-18에 5 → 7문항으로 늘렸다
     (같은 날 생성기 수정까지 합쳐 가상 응시자 1000명 재검사 신뢰도: 적응형 공간 영역 .59 → .64, 빠른 검사 .47 → .54). */
  const ADAPT = {
    matrix: { n: 8, start: 3, max: 6 }, figAnalogy: { n: 7, start: 3, max: 5 }, series: { n: 5, start: 2, max: 3 },
    sequence: { n: 6, start: 3, max: 5 }, weights: { n: 6, start: 2, max: 5 }, rotation: { n: 7, start: 3, max: 5 },
    fold: { n: 7, start: 3, max: 5 }, blocks: { n: 7, start: 3, max: 5 },
    analogy: { n: 7, start: 3, max: 5 }, vocab: { n: 7, start: 3, max: 5 }, logic: { n: 7, start: 3, max: 5 }, similar: { n: 7, start: 3, max: 5 }
  };
  const GEN = { matrix: makeMatrix, figAnalogy: makeFigAnalogy, series: makeSeries, sequence: makeSequence, weights: makeWeights, rotation: makeRotation, fold: makeFold, blocks: makeBlocks };
  const POOL = { analogy: VERBAL, vocab: VOCAB, logic: LOGIC, similar: SIMILAR };
  const POOL_OPTS = { analogy: [40, 2, false], vocab: [35, 1, false], logic: [60, 1, true], similar: [35, 1, false] };
  function adaptStub(key) {
    const a = ADAPT[key];
    return { type: 'adaptive', part: key, scored: false, count: a.n, state: { done: 0, level: a.start, max: a.max, used: practiceUsed(key), levels: [], oks: [] } };
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
      const i = pickFromPool(r, pool, st.level, st.used, stub.noHistory ? null : recentSeen(key));
      if (i < 0) return null;
      st.used.push(i);
      if (!stub.noHistory) markSeen(key, [i]);
      const o = POOL_OPTS[key];
      item = choiceItems(r, [pool[i]], key, o[0], o[1], o[2])[0];
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
    const adaptive = m.kind !== 'full'; // 빠른 검사도 적응형이라 LEVELS의 quick 단계표는 쓰이지 않는다
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
    part(3, DOMAINS[2], '머릿속에서 도형을 돌리고, 접고, 쌓인 블록을 세어 봐요.', ['rotation', 'fold', 'blocks']);
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
      const ps = rows.map(function (x) { const pl = LP[x.it.level]; if (typeof pl !== 'number') return null; const cc = 1 / (((x.it.options || x.it.optionsHtml || []).length) || 4); return cc + (1 - cc) * pl; }).filter(function (p) { return typeof p === 'number'; }); // 화면의 기준 정답률은 찍기 몫을 더한 관측 척도
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
      return { z: U.clamp(theta, -3, 3), raw: c + '/' + n + ' 정답', detail: lvText + (adaptive ? (lvText ? ' · ' : '') + '맞힌 최고 단계 ' + maxReached : '') + (avg != null ? ' · 평균 ' + avg + '초' : ''), meanP: adaptive ? undefined : Math.round(meanP * 100), obs: propObs(rows, n, c, lv, adaptive, avg) };
    }
    if (norm.kind === 'span') {
      const it = rows[0].it;
      const s = typeof rows[0].a === 'number' ? rows[0].a : it.start - 1;
      return { z: U.clamp((s - norm.mean) / norm.sd, -3, 3), raw: Math.max(s, it.start - 1) + (key === 'grid' ? '칸' : key === 'lns' ? '개' : '자리'), detail: '', obs: { value: Math.max(0, s) } };
    }
    if (norm.kind === 'count') {
      const a = rows[0].a && typeof rows[0].a === 'object' ? rows[0].a : { correct: 0, wrong: 0 };
      const net = Math.max(0, (a.correct || 0) - (a.wrong || 0));
      const tot = (a.correct || 0) + (a.wrong || 0);
      return { z: U.clamp((net - norm.mean) / norm.sd, -3, 3), raw: net + '개/60초', detail: tot ? '정답 ' + a.correct + ' · 오답 ' + a.wrong + ' · 정확도 ' + Math.round(a.correct / tot * 100) + '%' : '', obs: { value: net, acc: tot ? a.correct / tot : null } };
    }
    const raw0 = rows[0].a;
    const a = Array.isArray(raw0) ? raw0 : raw0 && Array.isArray(raw0.times) ? raw0.times : [];
    const touchN = Array.isArray(raw0) ? a.filter(function (x) { return x && x.touch; }).length : (raw0 && raw0.touch) || 0;
    const touch = a.length > 0 && touchN / a.length >= 0.5;
    const mean = norm.mean + (touch ? TOUCH_MS : 0), tnote = touch ? ' · 터치 기준' : '';
    if (key === 'reaction') {
      const med = a.length ? U.median(a) : null;
      return { z: med == null ? -3 : U.clamp((mean - med) / norm.sd, -3, 3), raw: med == null ? '측정 안 됨' : Math.round(med) + 'ms', detail: (a.length ? '최고 ' + Math.min.apply(null, a) + 'ms' : '') + tnote, obs: med == null ? null : { value: med, touch: touch } };
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
    return { z: z, raw: med == null ? '측정 안 됨' : Math.round(med) + 'ms', detail: '정확도 ' + Math.round(acc * 100) + '%' + extra + tnote, obs: med == null ? null : { value: med, acc: acc, touch: touch } };
  }

  /* 익명 통계용 원점수(z 계산 전 값). 결과의 tasks[k].obs 에 들어가고 js/stats.js 가 보낸다.
     items = 문항마다 [풀 번호(생성 문항은 -1), 단계, 정답 1·오답 0·시간 초과 -1, 응답 시간(0.1초)]. 문항 내용은 넣지 않는다. */
  function propObs(rows, n, c, lv, adaptive, avg) {
    const levels = {};
    Object.keys(lv).forEach(function (l) { if (l !== '0') levels[l] = { n: lv[l].n, c: lv[l].c }; });
    const items = rows.map(function (x) {
      return [typeof x.it.pid === 'number' && x.it.pid >= 0 ? x.it.pid : -1, x.it.level || 0, x.a == null ? -1 : x.a === x.it.answer ? 1 : 0, typeof x.t === 'number' ? Math.round(x.t / 100) : null];
    });
    const o = { n: n, c: c, levels: levels, adaptive: adaptive, items: items };
    if (avg != null) o.rtAvg = avg;
    return o;
  }

  /* 과제별 z 모음 → 영역·종합 결과 객체 */
  function assemble(tasks, opts) {
    const scales = [], sections = [];
    const groups = [], domSem = {};
    DOMAINS.forEach(function (d) {
      const keys = TASK_KEYS.filter(function (k) { return TASKS[k].domain === d.key && tasks[k]; });
      if (!keys.length) return;
      const z = domainZ(keys, tasks);
      groups.push({ keys: keys, z: z });
      domSem[d.key] = domainSem(d.key, keys.length);
      const iq = iqOf(z);
      scales.push({ key: d.key, label: d.label, value: iq, range: IQ_RANGE, raw: '상위 ' + topPct(z) + '%',
        children: keys.map(function (k) { return { key: k, label: TASKS[k].label, value: iqOf(tasks[k].z), range: IQ_RANGE, raw: tasks[k].raw }; }) });
      sections.push({ title: d.label + ' · 추정 IQ ' + iq, body: '과제별 결과: ' + keys.map(function (k) { return TASKS[k].label + ' ' + tasks[k].raw + (tasks[k].detail ? ' (' + tasks[k].detail + ')' : '') + (tasks[k].meanP ? ' · 기준 정답률 ' + tasks[k].meanP + '%' : ''); }).join(', ') + '.' });
    });
    const keys = Object.keys(tasks);
    const single = keys.length === 1 ? keys[0] : null;
    const z = single ? tasks[single].z : overallZ(groups, tasks);
    const iq = iqOf(z), pct = topPct(z), bd = band(iq);
    /* ±(SEM) = √(측정 오차² + 덜 푼 몫²). 측정 오차는 과제 하나의 몫을 0.3으로 보고 과제 수 n만큼 합친 신뢰도 n·0.3/(1+(n−1)·0.3)로
       15·√(1−신뢰도)(스피어먼-브라운). 덜 푼 몫은 전체 K과제 중 n개, 다섯 영역 중 m개만 풀어 종합 IQ를 덜 대표하는 만큼으로
       6²·(1−n/K) + 4²·(1−m/5)를 더한다. 규준화 뒤 참값을 아는 가상 응시자로 돌려 보면 ± 안에 실제 값이 빠른 검사(±9) 74%,
       20과제(±5) 74~75%, 따로 푼 과제를 합친 프로필 69~77%로 들어온다(측정 오차만 쓰면 빠른 검사가 ±7, 63%).
       과제 하나만 푼 결과는 그 과제 점수의 오차라 0.45만 둔다(±11, 75%). */
    const q = single ? 0.45 : 0.3, n = keys.length;
    const meas = 15 * Math.sqrt(1 - n * q / (1 + (n - 1) * q));
    const sem = Math.round(single ? meas : Math.sqrt(meas * meas + 36 * (1 - n / TASK_KEYS.length) + 16 * (1 - groups.length / DOMAINS.length)));
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
      const spread = sorted[0].value - weak.value;
      // 차이가 두 영역 오차를 합친 값보다 작으면 어느 영역이 약하다고 하지 않는다(위 TASK_REL 설명)
      const noise = sorted.length < 2 ? 0 : Math.sqrt(Math.pow(domSem[sorted[0].key], 2) + Math.pow(domSem[weak.key], 2));
      summary = bandText + (sorted.length < 2 ? '' : spread < 8
          ? ' 영역별 점수가 ' + weak.value + '~' + sorted[0].value + ' 사이로 고르게 나왔어요.'
          : spread < noise
          ? ' 영역별 점수는 ' + weak.value + '~' + sorted[0].value + ' 사이예요. 이 정도 차이는 오차 범위 안이라 어느 영역이 특별히 약하다고 보기는 어려워요.'
          : ' 가장 강한 쪽은 ' + sorted[0].label + ' ' + sorted[0].value + '이고, ' + weak.label + ' ' + U.josa(weak.value, '은', '는') + ' 연습하면 더 오를 여지가 있어요.') +
        (keys.length < TASK_KEYS.length ? (opts.quick ? ' 빠른 검사라 대표 과제 ' + keys.length + '개로 낸 점수예요. 나머지 과제도 풀면 종합 프로필이 더 정확해져요.' : ' ' + TASK_KEYS.length + '개 과제 중 ' + keys.length + '개를 반영했어요.') : '');
    }
    sections.push({ title: '점수 읽는 법', body: '추정 IQ는 평균이 100, 표준편차가 15인 IQ 눈금으로 바꾼 점수예요. 열 명 중 일곱 명쯤이 85~115 사이에 들어가요. ' +
      (single ? '과제 하나만으로 낸 점수는 문항이 적어서, 실력이 아주 높거나 낮으면 실제보다 100에 가깝게 나오기 쉬워요. '
        : '여러 과제를 합친 영역·종합 점수는 실력을 미리 정해 둔 가상 응시자 수천 명에게 같은 문제를 풀게 해 보고, 점수가 이 눈금대로 퍼지도록 맞췄어요. ') +
      '"상위 %"는 그 눈금에서 내 위치고, ±' + U.josa(sem, '은', '는') + ' 오차 범위예요. 실제 값이 그 안에 있을 확률이 70% 정도고, 과제를 많이 풀수록' + (single ? '' : ', 다섯 영역을 고루 풀수록') + ' 범위가 좁아져요. ' +
      (single ? '' : '아주 높거나 낮은 점수에는 그날의 운도 섞이기 쉬워서, 다시 하면 100 쪽으로 조금 돌아오는 경우가 많아요. ') + '점수는 몇 개를 맞혔는지가 아니라 어느 단계 문제를 맞혔는지로 계산해요. 각 단계의 난이도는 실제 응시 자료 없이, 설계할 때 정한 값과 AI가 문제를 보고 보통 성인의 정답률을 어림한 값으로 정했어요. 그래서 실제 응시 데이터로 보정하기 전까지는 공인 지능검사의 IQ와 같다고 볼 수 없어요. 같은 과제를 여러 번 하면 익숙해져서 점수가 올라요.' });
    return { headline: headline, value: iq, sem: sem, label: bd + ' · 상위 ' + pct + '% · ±' + sem, summary: summary, scales: single ? scales[0].children : scales, sections: sections, tasks: tasks, z: z, norms: NORMS_VERSION };
  }

  function score(answers, items, meta) {
    meta = meta || {};
    const times = meta.times || [];
    const byPart = {};
    items.forEach(function (it, i) { if (!it.scored) return; (byPart[it.part] = byPart[it.part] || []).push({ it: it, a: answers[i], t: times[i] }); });
    const review = [];
    const tasks = {};
    TASK_KEYS.forEach(function (k) { if (byPart[k]) tasks[k] = taskStats(k, byPart[k], review); });
    const res = assemble(tasks, { quick: parseMode(meta.mode).kind === 'quick' });
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
    subtitle: '규칙 찾기, 언어, 공간 감각, 기억력, 반응 속도와 집중. 머리 쓰는 힘 다섯 가지를 20개 과제로 재서 추정 IQ로 보여 줘요. 한 번에 다 풀어도 되고 하나씩 해도 돼요.',
    duration: '과제당 1~9분',
    length: '20과제',
    timed: true,
    modes: [
      { id: 'adaptive', label: '적응형 검사', desc: '맞히면 다음 문제가 어려워지고 틀리면 쉬워져요. 내 실력 근처에서 집중해서 재니까 짧아도 정확해요. 처음이면 이걸 추천해요.', duration: '약 43분', length: '20과제' },
      { id: 'quick', label: '빠른 검사', desc: '다섯 영역에서 대표 과제 7개만 골라, 적응형처럼 내 실력에 맞춰 문제를 내요. 시간이 없을 때 좋아요. 과제가 적은 만큼 오차 범위는 더 넓어요.', duration: '약 18분', length: '7과제' },
      { id: 'full', label: '정밀 검사', desc: '20개 과제의 모든 단계를 처음부터 끝까지 다 풀어요. 가장 길지만, 단계별 정답률과 틀린 문제 다시 보기까지 볼 수 있어요.', duration: '약 1시간', length: '20과제' }
    ],
    glyphSVG: glyphSVG,
    adaptNext: adaptNext,
    adaptRecord: adaptRecord,
    _internals: { cellSVG: cellSVG, legible: legible, OPS: OPS, logicRows: logicRows, logicK: logicK, kUnique: kUnique, altNext: altNext, VERBAL: VERBAL, VOCAB: VOCAB, LOGIC: LOGIC, SIMILAR: SIMILAR },
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
    merge: merge,
    normsVersion: NORMS_VERSION
  };
})();
