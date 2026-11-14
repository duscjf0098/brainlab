// 도형 회전 과제의 "쌍둥이 도형" 표를 만든다(2026-11-14). node tools/rotation-twins.cjs [--check]
// 5×5 안의 n칸(6~9) 도형을 모두 세고, 돌리기·뒤집기와 상관없는 겉모양(바깥 크기, 줄·열 칸 수 묶음, 끝·곧은·꺾인·갈래·십자 칸 수,
// 2×2 덩어리 수, 가장 긴 줄, 구멍 칸 수)이 같은 자유 도형(돌리고 뒤집어 같은 것은 하나로 침)끼리 묶는다.
// 둘 이상이 묶이고 그중 하나라도 회전 과제에 쓸 수 있는(돌림 넷·거울 넷이 모두 다른) 묶음만 남겨 js/tests/cognitive.js의 ROT_TWINS에 넣는다.
// 도형 하나는 기준 자세(8가지 자세 중 25칸 비트 값이 가장 작은 것)의 비트 값을 36진수로 적는다(비트 y*5+x = (x, y) 칸).
// --check: cognitive.js에 들어 있는 표가 지금 만든 것과 같은지 본다.
'use strict';
const fs = require('fs'), path = require('path');
function cellsOf(m) { const out = []; for (let i = 0; i < 25; i++) if (m & (1 << i)) out.push([i % 5, (i / 5) | 0]); return out; }
function maskOf(cs) { let mx = 99, my = 99; cs.forEach(c => { if (c[0] < mx) mx = c[0]; if (c[1] < my) my = c[1]; }); let m = 0; for (const c of cs) { const x = c[0] - mx, y = c[1] - my; if (x > 4 || y > 4) return -1; m |= 1 << (y * 5 + x); } return m; }
function enumerate(n) {
  let cur = new Set([1]);
  for (let s = 1; s < n; s++) {
    const nxt = new Set();
    cur.forEach(m => { const cs = cellsOf(m); cs.forEach(c => { [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(d => { const x = c[0] + d[0], y = c[1] + d[1]; if (x >= 0 && y >= 0 && x < 5 && y < 5 && (m & (1 << (y * 5 + x)))) return; const nm = maskOf(cs.concat([[x, y]])); if (nm >= 0) nxt.add(nm); }); }); });
    cur = nxt;
  }
  return [...cur];
}
const TF = [c => [c[0], c[1]], c => [-c[1], c[0]], c => [-c[0], -c[1]], c => [c[1], -c[0]], c => [-c[0], c[1]], c => [c[1], c[0]], c => [c[0], -c[1]], c => [-c[1], -c[0]]];
const freeMask = m => { const cs = cellsOf(m); let best = Infinity; TF.forEach(f => { const k = maskOf(cs.map(f)); if (k >= 0 && k < best) best = k; }); return best; };
const eligible = m => { const cs = cellsOf(m), ks = TF.map(f => maskOf(cs.map(f))); return new Set(ks).size === 8; };   // 8자세가 모두 다름 = 돌림 넷·거울 넷이 모두 다름
function feat(m) {
  const cs = cellsOf(m), has = (x, y) => x >= 0 && y >= 0 && x < 5 && y < 5 && !!(m & (1 << (y * 5 + x)));
  let w = 0, h = 0; cs.forEach(c => { if (c[0] + 1 > w) w = c[0] + 1; if (c[1] + 1 > h) h = c[1] + 1; });
  const R = Array(h).fill(0), C = Array(w).fill(0); cs.forEach(c => { R[c[1]]++; C[c[0]]++; });
  const ms = a => a.slice().sort((x, y) => x - y).join('.'), rr = ms(R), cc = ms(C);
  const d = [0, 0, 0, 0, 0]; let sq = 0, run = 0;
  cs.forEach(([x, y]) => { const L = has(x - 1, y), Rt = has(x + 1, y), U = has(x, y - 1), D = has(x, y + 1), k = L + Rt + U + D; if (k === 1) d[0]++; else if (k === 2) d[(L && Rt) || (U && D) ? 1 : 2]++; else if (k === 3) d[3]++; else if (k === 4) d[4]++; if (Rt && D && has(x + 1, y + 1)) sq++; let a = 0; while (has(x + a, y)) a++; let b = 0; while (has(x, y + b)) b++; if (a > run) run = a; if (b > run) run = b; });
  const W2 = w + 2, H2 = h + 2, seen = new Uint8Array(W2 * H2), st = [0]; seen[0] = 1;
  const filled = (x, y) => x >= 1 && y >= 1 && x <= w && y <= h && has(x - 1, y - 1);
  while (st.length) { const p = st.pop(), x = p % W2, y = (p / W2) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const nx = x + a, ny = y + b; if (nx < 0 || ny < 0 || nx >= W2 || ny >= H2) return; const q = ny * W2 + nx; if (seen[q] || filled(nx, ny)) return; seen[q] = 1; st.push(q); }); }
  let holes = 0; for (let x = 1; x <= w; x++) for (let y = 1; y <= h; y++) if (!filled(x, y) && !seen[y * W2 + x]) holes++;
  return Math.min(w, h) + 'x' + Math.max(w, h) + '|' + (rr < cc ? rr + '/' + cc : cc + '/' + rr) + '|' + d.join(',') + '|' + sq + ',' + run + ',' + holes;
}
const out = {};
for (let n = 6; n <= 9; n++) {
  const groups = {};
  enumerate(n).forEach(m => { const f = feat(m), k = freeMask(m); (groups[f] = groups[f] || new Set()).add(k); });
  const keep = Object.keys(groups).sort().map(f => [...groups[f]].sort((a, b) => a - b)).filter(g => g.length > 1 && g.some(eligible));
  out[n] = keep.map(g => g.map(k => k.toString(36)).join(',')).join(';');
  const shapes = keep.reduce((s, g) => s + g.length, 0), elig = keep.reduce((s, g) => s + g.filter(eligible).length, 0);
  console.error('n=' + n + ': 묶음 ' + keep.length + ' · 도형 ' + shapes + '(회전 과제용 ' + elig + ') · ' + out[n].length + '자');
}
const line = '  const ROT_TWINS = ' + JSON.stringify(out) + ';';
if (process.argv.includes('--check')) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'tests', 'cognitive.js'), 'utf8');
  const ok = src.indexOf(line) >= 0;
  console.log(ok ? 'ROT_TWINS 같음' : 'ROT_TWINS 다름(이 도구로 다시 만들어 넣을 것)');
  process.exit(ok ? 0 : 1);
}
console.log(line);
