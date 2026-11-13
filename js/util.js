/* 두뇌실험실 공통 유틸 */
window.BL = window.BL || {};
BL.tests = BL.tests || {};

BL.util = (function () {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rng(seed) {
    if (seed == null) seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    const r = mulberry32(seed);
    const api = {
      seed: seed,
      next: r,
      int: function (min, max) { return min + Math.floor(r() * (max - min + 1)); },
      pick: function (arr) { return arr[Math.floor(r() * arr.length)]; },
      shuffle: function (arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(r() * (i + 1));
          const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      },
      sample: function (arr, n) { return api.shuffle(arr).slice(0, n); }
    };
    return api;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 저장소(localStorage)에서 읽은 그림 마크업을 화면에 넣기 전에 거른다(2026-11-13).
     결과의 다시 보기 그림(promptHtml·chosenHtml·answerHtml)과 애착 좌표 그림(plot)은 마크업 그대로 저장돼서, 같은 출처의 다른 페이지가
     저장소를 건드리면 결과를 열 때마다 심긴 스크립트가 돌 수 있었다. 허용 목록 밖의 요소는 안의 내용까지 통째로 빼고,
     속성은 실제 그림이 쓰는 이름(FIG_ATTRS)만 남기고, 값도 실제 그림 모양만 받는다: class 는 그림이 쓰는 이름(FIG_CLASSES)뿐일 때만, style 은 --w:143 같은
     숫자 변수뿐일 때만, url( 은 문서 안 참조(clip-path="url(#id)")만, id 는 clipPath 의 clipN 만, 역슬래시가 든 값은 지운다. 느슨하게 두면 스크립트는 못 돌려도
     바깥 주소 불러오기(결과를 연 시각 추적), 화면 덮기(style 의 position:fixed, 사이트 CSS 의 .sheet 같은 class), 저장 버튼 id 가로채기가 가능했다.
     그림을 바꿔서 새 태그나 새 모양의 속성을 쓰면 여기 규칙에도 넣는다. 빠진 것은 node .claude/checks/figtags.cjs "$PWD" 가 찾는다
     (figTagOk·figAttrOk 를 그대로 불러 실제 그림 수천 개에 대 본다). 빠뜨리면 결과 화면의 그림이 조용히 사라지거나 깨진다. */
  const FIG_TAGS = /^(svg|g|path|rect|circle|line|polygon|polyline|ellipse|text|tspan|defs|clippath|div|span|p|b|small)$/i;
  const FIG_ATTRS = /^(aria-hidden|aria-label|class|clip-path|cx|cy|d|data-p|fill|font-size|font-weight|height|id|opacity|points|r|role|rx|stroke|stroke-dasharray|stroke-linejoin|stroke-width|style|text-anchor|transform|viewbox|width|x|x1|x2|y|y1|y2)$/;
  const FIG_CLASSES = /^(an-label|an-pair|an-sep|analogy|bl|blk|blk-prompt|blk-rule|br|bt|cell|cell-missing|cf|cs|cs-l|cs-r|cube|fold-net|fold-prompt|matrix|matrix2|mono|pan-opt|plot|plot-axis|plot-q|poly|poly-prompt|scale|scales-given|seq|seq-q|series|sq)$/;
  const BSLASH = String.fromCharCode(92);
  function figTagOk(tag) { return FIG_TAGS.test(String(tag)); }
  function figAttrOk(tag, name, value) {
    const nm = String(name).toLowerCase(), v = String(value);
    if (!FIG_ATTRS.test(nm)) return false;                                                           // on*·href·src·tabindex·cursor·mask 등은 이름에서 걸린다
    if (nm === 'class' && !v.split(/\s+/).filter(Boolean).every(function (c) { return FIG_CLASSES.test(c); })) return false;   // 사이트 CSS 의 다른 class(.sheet 등)로 화면을 덮지 못하게
    if ((nm === 'width' || nm === 'height') && String(tag).toLowerCase() !== 'rect') return false;   // 크기 속성은 그림 안 네모에만(svg 를 화면보다 크게 만들지 못하게)
    if (v.indexOf(BSLASH) >= 0) return false;                                                       // CSS 이스케이프로 아래 검사를 피해 가지 못하게
    if (nm === 'style' && !/^\s*(--[a-z-]+\s*:\s*-?[\d.]+\s*;?\s*)+$/i.test(v)) return false;       // 숫자 변수(--w:143)만
    if (/url\s*\(/i.test(v) && !/^url\(#[\w-]+\)$/.test(v.trim())) return false;                   // 문서 안 참조만
    if (nm === 'id' && !(String(tag).toLowerCase() === 'clippath' && /^clip\d+$/.test(v))) return false;   // 화면의 다른 id(저장 버튼 등)를 가로채지 못하게
    return true;
  }
  function safeFig(html) {
    if (html == null || html === '') return '';
    if (typeof DOMParser !== 'function') return esc(html);   // 거를 수 없는 환경이면 글자로만 보여 준다
    let box;
    try { box = new DOMParser().parseFromString('<div>' + String(html) + '</div>', 'text/html').body.firstChild; } catch (e) { return ''; }
    if (!box) return '';
    Array.prototype.slice.call(box.querySelectorAll('*')).forEach(function (n) {
      if (!figTagOk(n.tagName)) { if (n.parentNode) n.parentNode.removeChild(n); return; }
      Array.prototype.slice.call(n.attributes).forEach(function (a) { if (!figAttrOk(n.tagName, a.name, a.value)) n.removeAttribute(a.name); });
    });
    return box.innerHTML;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function mean(arr) { return arr.length ? arr.reduce(function (s, v) { return s + v; }, 0) / arr.length : 0; }
  function median(arr) {
    if (!arr.length) return 0;
    const a = arr.slice().sort(function (x, y) { return x - y; });
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  /* 표준정규 누적분포 (z → 백분위 0~1) */
  function normCdf(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }
  function level(v, hi, lo) {
    if (hi == null) hi = 65;
    if (lo == null) lo = 35;
    return v >= hi ? 'high' : v <= lo ? 'low' : 'mid';
  }

  /* 한국어 조사: batchim(word) → -1 없음, 0~27 받침 코드. 숫자는 읽는 소리 기준. */
  function batchim(word) {
    const s = String(word == null ? '' : word).replace(/[\s)\]'"»]+$/g, '');
    if (!s) return -1;
    const ch = s.charCodeAt(s.length - 1);
    if (ch >= 0xAC00 && ch <= 0xD7A3) { const b = (ch - 0xAC00) % 28; return b === 0 ? -1 : b; }
    if (ch >= 0x30 && ch <= 0x39) return [21, 8, -1, 16, -1, -1, 1, 8, 8, -1][ch - 0x30]; // 영 일 이 삼 사 오 육 칠 팔 구
    return -1;
  }
  function josa(word, withB, withoutB) {
    const b = batchim(word);
    if (b < 0) return word + withoutB;
    if (withB === '으로' && b === 8) return word + '로';
    return word + withB;
  }

  const sstore = {
    get: function (key, fallback) {
      try { const v = sessionStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set: function (key, val) {
      try { sessionStorage.setItem(key, JSON.stringify(val)); return true; }
      catch (e) { return false; }
    },
    remove: function (key) { try { sessionStorage.removeItem(key); } catch (e) { } }
  };

  const store = {
    get: function (key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set: function (key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); return true; }
      catch (e) { return false; }
    },
    remove: function (key) { try { localStorage.removeItem(key); } catch (e) { } }
  };

  /* 결과 목록 저장 (2026-11-12)
     인지 검사 결과에는 "틀린 문항 다시 보기"(그림 포함)가 붙어서 한 건이 수십~수백 KB다. 그대로 40건을 쌓으면 저장 공간
     (브라우저마다 약 5MB, 아이폰은 그 절반쯤)을 넘겨서 그 뒤로는 어떤 결과도 저장되지 않았다.
     그래서 다시 보기는 최근 몇 건에만 남기고, 그래도 모자라면 다시 보기 → 오래된 결과 순으로 덜어 내며 저장한다. */
  const KEEP_REVIEW = 5;          // 다시 보기를 남기는 결과 수 (최근 것부터)
  const REVIEW_BUDGET = 600000;   // 다시 보기 전체 글자 수 한도 (가장 최근 한 건은 한도를 넘어도 남긴다)
  /* 다시 보기를 덜어 낸 새 목록을 돌려준다. 원본 목록과 결과 객체는 건드리지 않는다(덜어 낸 결과만 사본으로 바뀐다). */
  function packResults(list, keep, budget) {
    if (keep == null) keep = KEEP_REVIEW;
    if (budget == null) budget = REVIEW_BUDGET;
    const out = list.slice();
    let kept = 0, used = 0;
    for (let i = out.length - 1; i >= 0; i--) {
      const r = out[i];
      if (!r || !r.review || !r.review.length) continue;
      const size = JSON.stringify(r.review).length;
      if (kept >= keep || (kept && used + size > budget)) {
        const c = Object.assign({}, r);
        c.reviewDropped = r.review.length;
        delete c.review;
        out[i] = c;
      } else { kept += 1; used += size; }
    }
    return out;
  }
  /* 저장 자체가 막힌 브라우저인지(사생활 보호 모드, 쿠키 차단). 공간이 꽉 차서 못 쓰는 경우와 구분한다: 꽉 찬 저장소에는 이미 든 것이 있다. */
  function storageOff() {
    try { localStorage.setItem('bl.probe', '1'); localStorage.removeItem('bl.probe'); return false; }
    catch (e) { try { return !localStorage.length; } catch (e2) { return true; } }
  }
  /* 결과 목록을 저장한다. 돌려주는 값: { ok 저장됨, off 저장이 꺼진 브라우저, list 실제로 저장한(하려던) 목록, dropped 공간이 모자라 지운 오래된 결과 수 } */
  function saveResults(key, list, max) {
    let out = packResults(max && list.length > max ? list.slice(list.length - max) : list);
    if (store.set(key, out)) return { ok: true, off: false, list: out, dropped: 0 };
    if (storageOff()) return { ok: false, off: true, list: out, dropped: 0 };
    // 공간 부족: 다시 보기를 가장 최근 한 건만 남겨 보고, 그다음엔 전부 뺀다
    for (let keep = 1; keep >= 0; keep--) {
      out = packResults(out, keep);
      if (store.set(key, out)) return { ok: true, off: false, list: out, dropped: 0 };
    }
    // 그래도 안 되면 오래된 결과부터 지운다 (방금 결과 하나는 끝까지 남긴다)
    let dropped = 0;
    while (out.length > 1) {
      out = out.slice(1); dropped += 1;
      if (store.set(key, out)) return { ok: true, off: false, list: out, dropped: dropped };
    }
    return { ok: false, off: false, list: out, dropped: dropped };
  }

  return { rng: rng, esc: esc, safeFig: safeFig, figTagOk: figTagOk, figAttrOk: figAttrOk, clamp: clamp, mean: mean, median: median, fmtDate: fmtDate, level: level, store: store, sstore: sstore, pad2: pad2, josa: josa, batchim: batchim, normCdf: normCdf,
    packResults: packResults, saveResults: saveResults, storageOff: storageOff };
})();
