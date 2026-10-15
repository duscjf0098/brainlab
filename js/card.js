/* 결과 카드 이미지 생성 · 저장 · 공유 */
BL.card = (function () {
  const U = BL.util;
  const W = 1080, H = 1350;
  const FONT = '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
  const MONO = 'ui-monospace, "SF Mono", Consolas, "D2Coding", monospace';

  function roundRect(x, px, py, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    x.beginPath();
    x.moveTo(px + r, py);
    x.arcTo(px + w, py, px + w, py + h, r);
    x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r);
    x.arcTo(px, py, px + w, py, r);
    x.closePath();
  }

  function wrap(x, text, maxW) {
    const words = String(text || '').split(' ');
    const lines = [];
    let line = '';
    words.forEach(function (w) {
      const t = line ? line + ' ' + w : w;
      if (x.measureText(t).width <= maxW) { line = t; return; }
      if (line) lines.push(line);
      if (x.measureText(w).width <= maxW) { line = w; return; }
      let cur = '';
      for (const ch of w) {
        if (x.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch; } else cur += ch;
      }
      line = cur;
    });
    if (line) lines.push(line);
    return lines;
  }

  function draw(result, test) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#fafaf9'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#e5e7eb';
    for (let gx = 60; gx < W; gx += 60) for (let gy = 60; gy < H; gy += 60) x.fillRect(gx - 1, gy - 1, 3, 3);

    x.fillStyle = '#0f766e'; x.font = '600 26px ' + MONO; x.fillText('BRAIN LAB  ·  두뇌실험실', 80, 108);
    x.fillStyle = '#6b7280'; x.font = '500 32px ' + FONT; x.fillText(test.title, 80, 176);

    x.fillStyle = '#15181d';
    let size = 88;
    x.font = '800 ' + size + 'px ' + FONT;
    while (x.measureText(result.headline).width > W - 160 && size > 48) { size -= 4; x.font = '800 ' + size + 'px ' + FONT; }
    x.fillText(result.headline, 80, 290);

    let y = 340;
    if (result.label) {
      x.font = '700 30px ' + FONT;
      const w = x.measureText(result.label).width + 48;
      roundRect(x, 80, y, w, 60, 30); x.fillStyle = '#0f766e'; x.fill();
      x.fillStyle = '#ffffff'; x.fillText(result.label, 104, y + 41);
      y += 100;
    }

    x.fillStyle = '#374151'; x.font = '400 33px ' + FONT;
    wrap(x, result.summary, W - 160).slice(0, 4).forEach(function (l) { x.fillText(l, 80, y + 20); y += 50; });
    y += 50;

    (result.scales || []).forEach(function (s) {
      x.fillStyle = '#15181d'; x.font = '600 30px ' + FONT; x.fillText(s.label, 80, y);
      x.fillStyle = '#0f766e'; x.font = '700 30px ' + MONO; x.textAlign = 'right'; x.fillText(String(s.value), W - 80, y); x.textAlign = 'left';
      roundRect(x, 80, y + 18, W - 160, 16, 8); x.fillStyle = '#e5e7eb'; x.fill();
      const lo = s.range ? s.range[0] : 0, hi = s.range ? s.range[1] : 100;
      const fw = (W - 160) * U.clamp((s.value - lo) / (hi - lo), 0, 1);
      if (fw > 0) { roundRect(x, 80, y + 18, Math.max(fw, 16), 16, 8); x.fillStyle = '#0f766e'; x.fill(); }
      if (s.range) { x.fillStyle = '#9ca3af'; x.fillRect(80 + (W - 160) * (100 - lo) / (hi - lo) - 1, y + 12, 2, 28); }
      y += 84;
    });

    x.fillStyle = '#9ca3af'; x.font = '400 23px ' + FONT;
    x.fillText('참고용 자기평가 · 전문 검사를 대체하지 않습니다', 80, H - 92);
    x.font = '500 23px ' + MONO; x.fillText(U.fmtDate(result.at || Date.now()), 80, H - 52);
    return c;
  }

  function siteUrl() { return (window.BL_CONFIG && window.BL_CONFIG.siteUrl) || location.href.split('#')[0]; }
  function kakaoKey() { return (window.BL_CONFIG && window.BL_CONFIG.kakaoKey) || ''; }
  /* 카카오 JavaScript SDK를 필요할 때만 불러와 초기화한다 (키가 없으면 거부) */
  function loadKakao() {
    return new Promise(function (res, rej) {
      const key = kakaoKey();
      if (!key) return rej(new Error('nokey'));
      if (window.Kakao && window.Kakao.isInitialized && window.Kakao.isInitialized()) return res(window.Kakao);
      if (window.Kakao && window.Kakao.init) { try { window.Kakao.init(key); return res(window.Kakao); } catch (e) { return rej(e); } }
      const s = document.createElement('script');
      s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
      s.async = true;
      s.onload = function () { try { window.Kakao.init(key); res(window.Kakao); } catch (e) { rej(e); } };
      s.onerror = function () { rej(new Error('load')); };
      document.head.appendChild(s);
    });
  }
  function kakaoShare(result, test) {
    const url = siteUrl();
    return loadKakao().then(function (K) {
      K.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: '두뇌실험실 · ' + test.title,
          description: result.headline + (result.label ? ' · ' + result.label : '') + '  나도 해보기 →',
          imageUrl: url + 'og.png',
          link: { mobileWebUrl: url, webUrl: url }
        },
        buttons: [{ title: '나도 해보기', link: { mobileWebUrl: url, webUrl: url } }]
      });
      return 'shared';
    }).catch(function (e) { return e && e.message === 'nokey' ? 'nokey' : 'error'; });
  }
  function copyLink(result, test) {
    const text = shareText(result, test);
    const legacy = function () {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
        const ok = document.execCommand('copy'); ta.remove();
        return ok ? 'copied' : 'error';
      } catch (e) { return 'error'; }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return 'copied'; }).catch(function () { return legacy(); });
    return Promise.resolve(legacy());
  }
  function shareText(result, test) {
    const url = siteUrl();
    return '두뇌실험실 · ' + test.title + '\n' + result.headline + (result.label ? ' (' + result.label + ')' : '') + '\n' +
      (result.scales || []).map(function (s) { return s.label + ' ' + s.value; }).join(' · ') + '\n' + url;
  }

  function toBlob(canvas) {
    return new Promise(function (res) { canvas.toBlob(function (b) { res(b); }, 'image/png'); });
  }

  function fileName(test) { return '두뇌실험실_' + test.id + '_' + new Date().toISOString().slice(0, 10) + '.png'; }

  function download(result, test) {
    return toBlob(draw(result, test)).then(function (blob) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName(test);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    });
  }

  function share(result, test) {
    const text = shareText(result, test);
    return toBlob(draw(result, test)).then(function (blob) {
      const file = new File([blob], fileName(test), { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: '두뇌실험실', text: text }).then(function () { return 'shared'; });
      }
      if (navigator.share) return navigator.share({ title: '두뇌실험실', text: text }).then(function () { return 'shared'; });
      if (navigator.clipboard) return navigator.clipboard.writeText(text).then(function () { return 'copied'; });
      return 'none';
    }).catch(function (e) { return e && e.name === 'AbortError' ? 'cancel' : 'error'; });
  }

  return { draw: draw, download: download, share: share, shareText: shareText, kakaoShare: kakaoShare, copyLink: copyLink, hasKakao: function () { return !!kakaoKey(); } };
})();
