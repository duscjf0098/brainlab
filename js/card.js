/* 결과 카드 이미지 생성 · 저장 · 공유 */
BL.card = (function () {
  const U = BL.util;
  const W = 1080, H = 1350, SQ = 800;   // SQ: 카카오톡 공유용 정사각형 이미지
  const FONT = '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
  const MONO = 'ui-monospace, "SF Mono", Consolas, "D2Coding", monospace';
  /* 결과 이미지 색: 화면과 같은 검사별 파스텔 [바탕, 글자, 강조] (css .tint-<id>) */
  const TINT = {
    cognitive: ['#ece8ff', '#2e2470', '#6150e0'], eq: ['#ffe4ee', '#6e1e40', '#c93c76'], personality: ['#d9f5ea', '#0e4d3a', '#14845f'],
    attachment: ['#ffe6db', '#74301a', '#c4532d'], interest: ['#ddeeff', '#10406e', '#2d72c2'], love: ['#fff0c9', '#6a4a06', '#9a6208']
  };

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
    const tc = TINT[test.id] || TINT.cognitive;
    const heroH = result.label ? 412 : 322;
    x.fillStyle = '#fff8f1'; x.fillRect(0, 0, W, H);
    roundRect(x, 48, 48, W - 96, heroH, 56); x.fillStyle = tc[0]; x.fill();

    x.fillStyle = tc[1]; x.font = '800 28px ' + FONT; x.fillText('두뇌실험실', 80, 112);
    x.globalAlpha = 0.78; x.font = '500 32px ' + FONT; x.fillText(test.title + (result.modeLabel ? ' · ' + result.modeLabel : ''), 80, 176); x.globalAlpha = 1;

    x.fillStyle = tc[1];
    let size = 88;
    x.font = '800 ' + size + 'px ' + FONT;
    while (x.measureText(result.headline).width > W - 160 && size > 48) { size -= 4; x.font = '800 ' + size + 'px ' + FONT; }
    x.fillText(result.headline, 80, 290);

    let y = 340;
    if (result.label) {
      x.font = '700 30px ' + FONT;
      const w = x.measureText(result.label).width + 48;
      roundRect(x, 80, y, w, 60, 30); x.fillStyle = tc[2]; x.fill();
      x.fillStyle = '#ffffff'; x.fillText(result.label, 104, y + 41);
      y += 100;
    }

    y = Math.max(y, 48 + heroH + 30);
    x.fillStyle = '#4a413c'; x.font = '400 33px ' + FONT;
    // 요약은 6줄까지 그리고, 넘치면 마지막 줄 끝을 말줄임표로 줄인다 (문장이 말없이 잘리지 않게)
    let lines = wrap(x, result.summary, W - 160);
    if (lines.length > 6) {
      lines = lines.slice(0, 6);
      let last = lines[5];
      while (last && x.measureText(last + '…').width > W - 160) last = last.slice(0, -1);
      lines[5] = last + '…';
    }
    lines.forEach(function (l) { x.fillText(l, 80, y + 20); y += 50; });
    y += 50;

    // 막대가 많으면(진로 흥미 6유형 등) 간격을 줄여 아래 안내 문구와 겹치지 않게 한다
    const step = Math.min(84, Math.floor((H - 150 - y) / Math.max(1, (result.scales || []).length)));
    (result.scales || []).forEach(function (s) {
      x.fillStyle = '#2b2522'; x.font = '600 30px ' + FONT; x.fillText(s.label, 80, y);
      x.fillStyle = tc[2]; x.font = '700 30px ' + MONO; x.textAlign = 'right'; x.fillText(String(s.value), W - 80, y); x.textAlign = 'left';
      roundRect(x, 80, y + 18, W - 160, 16, 8); x.fillStyle = '#f0e6dc'; x.fill();
      const lo = s.range ? s.range[0] : 0, hi = s.range ? s.range[1] : 100;
      const fw = (W - 160) * U.clamp((s.value - lo) / (hi - lo), 0, 1);
      if (fw > 0) { roundRect(x, 80, y + 18, Math.max(fw, 16), 16, 8); x.fillStyle = tc[2]; x.fill(); }
      if (s.range) { x.fillStyle = '#b9aca1'; x.fillRect(80 + (W - 160) * (100 - lo) / (hi - lo) - 1, y + 12, 2, 28); }
      y += step;
    });

    x.fillStyle = '#8a7f78'; x.font = '400 23px ' + FONT;
    x.fillText('참고용 자기평가예요 · 전문 검사를 대신하지 않아요', 80, H - 92);
    x.font = '500 23px ' + MONO; x.fillText(U.fmtDate(result.at || Date.now()), 80, H - 52);
    return c;
  }

  /* 카카오톡 공유용 정사각형 결과 이미지(800×800): 검사 색 블록에 결과 이름, 그 아래 점수 막대 (피드 메시지는 1:1이 잘리지 않는다) */
  function drawSquare(result, test) {
    const c = document.createElement('canvas');
    c.width = SQ; c.height = SQ;
    const x = c.getContext('2d');
    const tc = TINT[test.id] || TINT.cognitive;
    const heroH = result.label ? 300 : 236;
    x.fillStyle = '#fff8f1'; x.fillRect(0, 0, SQ, SQ);
    roundRect(x, 32, 32, SQ - 64, heroH, 40); x.fillStyle = tc[0]; x.fill();
    x.fillStyle = tc[1]; x.font = '800 24px ' + FONT; x.fillText('두뇌실험실', 64, 86);
    x.globalAlpha = 0.78; x.font = '500 26px ' + FONT; x.fillText(test.title + (result.modeLabel ? ' · ' + result.modeLabel : ''), 64, 126); x.globalAlpha = 1;
    let size = 72;
    x.font = '800 ' + size + 'px ' + FONT;
    while (x.measureText(result.headline).width > SQ - 128 && size > 40) { size -= 4; x.font = '800 ' + size + 'px ' + FONT; }
    x.fillText(result.headline, 64, 206);
    if (result.label) {
      x.font = '700 24px ' + FONT;
      let label = result.label;
      if (x.measureText(label).width > SQ - 176) { while (label.length > 1 && x.measureText(label + '…').width > SQ - 176) label = label.slice(0, -1); label += '…'; }
      roundRect(x, 64, 230, x.measureText(label).width + 40, 48, 24); x.fillStyle = tc[2]; x.fill();
      x.fillStyle = '#ffffff'; x.fillText(label, 84, 263);
    }
    const scales = (result.scales || []).slice(0, 6);
    let y = 32 + heroH + 64;
    const step = Math.min(72, Math.floor((SQ - 70 - y) / Math.max(1, scales.length)));
    scales.forEach(function (s) {
      x.fillStyle = '#2b2522'; x.font = '600 24px ' + FONT; x.fillText(s.label, 64, y);
      x.fillStyle = tc[2]; x.font = '700 24px ' + MONO; x.textAlign = 'right'; x.fillText(String(s.value), SQ - 64, y); x.textAlign = 'left';
      roundRect(x, 64, y + 14, SQ - 128, 12, 6); x.fillStyle = '#f0e6dc'; x.fill();
      const lo = s.range ? s.range[0] : 0, hi = s.range ? s.range[1] : 100;
      const fw = (SQ - 128) * U.clamp((s.value - lo) / (hi - lo), 0, 1);
      if (fw > 0) { roundRect(x, 64, y + 14, Math.max(fw, 12), 12, 6); x.fillStyle = tc[2]; x.fill(); }
      y += step;
    });
    x.fillStyle = '#8a7f78'; x.font = '400 19px ' + FONT;
    x.fillText('참고용 자기평가 · ' + siteUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''), 64, SQ - 36);
    return c;
  }

  function siteUrl() { return (window.BL_CONFIG && window.BL_CONFIG.siteUrl) || location.href.split('#')[0]; }
  function kakaoKey() { return (window.BL_CONFIG && window.BL_CONFIG.kakaoKey) || ''; }
  /* 카카오 JavaScript SDK를 불러와 초기화한다 (한 번만, 실패하면 다음에 다시 시도).
     공유는 버튼을 누른 바로 그 순간에 sendDefault를 불러야 휴대폰에서 카카오톡 앱이 열리고 PC에서 공유 창이 막히지 않는다.
     누른 뒤에 SDK를 내려받으면 그 사이 "사용자가 누른 직후" 상태가 끝나 첫 번째 탭이 무시되므로, 결과 화면이 뜰 때 미리 불러 둔다. */
  let kakaoP = null, kakaoFailed = false;
  function loadKakao() {
    if (kakaoP) return kakaoP;
    kakaoFailed = false;
    kakaoP = new Promise(function (res, rej) {
      const key = kakaoKey();
      if (!key) return rej(new Error('nokey'));
      const init = function () { try { if (!window.Kakao.isInitialized()) window.Kakao.init(key); res(window.Kakao); } catch (e) { rej(e); } };
      if (window.Kakao && window.Kakao.init) return init();
      const s = document.createElement('script');
      s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
      s.async = true;
      s.onload = init;
      s.onerror = function () { rej(new Error('load')); };
      document.head.appendChild(s);
    });
    kakaoP.catch(function () { kakaoP = null; kakaoFailed = true; });
    return kakaoP;
  }
  function kakaoReady() { const K = window.Kakao; return !!(K && K.isInitialized && K.isInitialized() && K.Share); }
  function kakaoTemplate(result, test, img) {
    const url = siteUrl();
    return {
      objectType: 'feed',
      content: {
        title: '두뇌실험실 · ' + test.title,
        description: result.headline + (result.label ? ' · ' + result.label : ''),
        imageUrl: img ? img.url : url + 'og.png', imageWidth: img ? img.w : 1200, imageHeight: img ? img.h : 630,
        link: { mobileWebUrl: url, webUrl: url }
      },
      buttons: [{ title: '나도 해보기', link: { mobileWebUrl: url, webUrl: url } }],
      installTalk: true
    };
  }
  /* 클릭 핸들러 안에서 곧바로(동기로) 부른다. 'shared' | 'uploading' | 'loading' | 'nokey' | 'popup' | 'error'
     결과 이미지: 처음 누를 때만 정사각형 이미지를 카카오 이미지 서버에 올리고(누르지 않으면 아무 데도 보내지 않는다) 'uploading'을 돌려준다.
     다 올라가면 onReady('ready' | 'fallback')를 부르고, 다음에 누를 때 그 주소로 바로 보낸다. 올리기에 실패하면 og.png로 보낸다. */
  const kakaoImg = {};   // 결과 키 → { url, w, h } · 'pending' · null(실패)
  function resultKey(result, test) { return test.id + '|' + (result.at || '') + '|' + result.headline; }
  function kakaoShare(result, test, onReady) {
    if (!kakaoKey()) return 'nokey';
    if (!kakaoReady()) { const failed = kakaoFailed; loadKakao(); return failed ? 'error' : 'loading'; }
    const key = resultKey(result, test);
    if (kakaoImg[key] === 'pending') return 'uploading';
    if (kakaoImg[key] === undefined && window.Kakao.Share.uploadImage) {
      let file = null;
      try { file = dataUrlToFile(drawSquare(result, test).toDataURL('image/png'), 'result.png'); } catch (e) { file = null; }
      if (file) {
        kakaoImg[key] = 'pending';
        window.Kakao.Share.uploadImage({ file: [file] }).then(function (res) {
          const o = res && res.infos && res.infos.original;
          kakaoImg[key] = o && o.url ? { url: o.url, w: o.width || SQ, h: o.height || SQ } : null;
          if (onReady) onReady(kakaoImg[key] ? 'ready' : 'fallback');
        }, function () { kakaoImg[key] = null; if (onReady) onReady('fallback'); });
        return 'uploading';
      }
      kakaoImg[key] = null;
    }
    try { window.Kakao.Share.sendDefault(kakaoTemplate(result, test, kakaoImg[key] || null)); return 'shared'; }
    catch (e) { const m = e && e.message ? e.message : ''; return /focus|popup|open|blocked/i.test(m) ? 'popup' : 'error'; }
  }
  function preloadKakao() { if (hasKakao()) loadKakao(); }
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

  function fileName(test) { return '두뇌실험실_' + test.id + '_' + new Date().toISOString().slice(0, 10) + '.png'; }

  /* 이미지는 버튼을 누른 그 순간에 동기로 만든다 (toDataURL). 예전처럼 toBlob을 기다린 뒤 다운로드·공유를 부르면
     "사용자가 누른 직후" 상태가 끝나 휴대폰 브라우저와 카카오톡 안 브라우저에서 아무 일도 안 일어났다.
     blob 주소를 2초 뒤에 지우던 것도 iPhone에서 "다운로드" 확인을 누르기 전에 파일이 사라지게 했다. */
  function dataUrl(result, test) { return draw(result, test).toDataURL('image/png'); }
  function dataUrlToFile(url, name) {
    const bin = atob(url.split(',')[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: 'image/png' });
  }
  /* 앱 안 브라우저(카카오톡·네이버·인스타그램 등)는 파일 다운로드를 대부분 막는다 */
  function inApp() { return /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp|; wv\)/i.test(navigator.userAgent || ''); }
  function touchDevice() { return inApp() || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') || !!(window.matchMedia && matchMedia('(pointer: coarse)').matches); }
  function triggerDownload(url, name) {
    const a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }
  /* 'downloaded'(PC에서 바로 내려받음) | 'preview'(휴대폰: 이미지를 띄워 길게 눌러 저장) | 'error' */
  function saveImage(result, test) {
    let url;
    try { url = dataUrl(result, test); } catch (e) { return { how: 'error' }; }
    const name = fileName(test);
    if (!touchDevice()) { triggerDownload(url, name); return { how: 'downloaded', url: url, name: name }; }
    return { how: 'preview', url: url, name: name, inApp: inApp(), canDownload: !inApp(), canShareFile: canShareFile(url, name) };
  }
  function canShareFile(url, name) {
    try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [dataUrlToFile(url, name)] })); } catch (e) { return false; }
  }
  function shareFile(url, name, text) {
    try {
      return navigator.share({ files: [dataUrlToFile(url, name)], title: '두뇌실험실', text: text || '' })
        .then(function () { return 'shared'; }, function (e) { return e && e.name === 'AbortError' ? 'cancel' : 'error'; });
    } catch (e) { return Promise.resolve('error'); }
  }
  function download(result, test) {
    const r = saveImage(result, test);
    return Promise.resolve(r.how);
  }

  function share(result, test) {
    const text = shareText(result, test);
    const done = function () { return 'shared'; };
    const fail = function (e) { return e && e.name === 'AbortError' ? 'cancel' : 'error'; };
    try {
      let url = null;
      try { url = dataUrl(result, test); } catch (e) { url = null; }
      if (url && canShareFile(url, fileName(test))) return shareFile(url, fileName(test), text);
      if (navigator.share) return navigator.share({ title: '두뇌실험실', text: text }).then(done, fail);
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return 'copied'; }, function () { return 'none'; });
      return Promise.resolve('none');
    } catch (e) { return Promise.resolve(fail(e)); }
  }

  function hasKakao() { return !!kakaoKey() && !/claude\.ai$/.test(location.hostname); }
  return { draw: draw, drawSquare: drawSquare, download: download, saveImage: saveImage, shareFile: shareFile, triggerDownload: triggerDownload, share: share, shareText: shareText, kakaoShare: kakaoShare, kakaoReady: kakaoReady, preloadKakao: preloadKakao, kakaoTemplate: kakaoTemplate, copyLink: copyLink, hasKakao: hasKakao };
})();
