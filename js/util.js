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

  return { rng: rng, esc: esc, clamp: clamp, mean: mean, median: median, fmtDate: fmtDate, level: level, store: store, sstore: sstore, pad2: pad2, josa: josa, batchim: batchim, normCdf: normCdf };
})();
