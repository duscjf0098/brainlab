/* 두뇌실험실 · 화면 엔진 (해시 라우팅, 문항 렌더러, 결과 화면) */
(function () {
  const U = BL.util;
  const app = document.getElementById('app');
  const ORDER = ['cognitive', 'eq', 'personality', 'attachment', 'interest', 'love'];
  /* 첫 화면 카드와 검사 소개의 질문형 제목 (색은 css의 .tint-<id>) */
  const LOOK = {
    cognitive: { q: '내 아이큐는 몇 점일까?', line: '규칙 찾기, 언어, 공간, 기억, 속도. 다섯 가지 힘으로 추정 IQ를 재요.' },
    eq: { q: '남의 마음, 얼마나 잘 읽을까?', line: '짧은 상황을 읽고, 기분을 알아채고 다루는 힘을 봐요.' },
    personality: { q: '나는 어떤 사람일까?', line: '다섯 갈래, 열다섯 가지 특성으로 내 성격을 그려요.' },
    attachment: { q: '연애할 때 나는 어떤 모습일까?', line: '불안해지는 편인지, 거리를 두는 편인지 네 가지 유형으로 봐요.' },
    interest: { q: '나한테 맞는 일은 뭘까?', line: '어떤 일을 할 때 즐거운지 여섯 가지 흥미 유형으로 알아봐요.' },
    love: { q: '나는 어떻게 사랑할까?', line: '첫눈에 반하는 편인지, 천천히 스며드는 편인지. 여섯 가지 스타일로 봐요.' }
  };
  function look(id) { return LOOK[id] || { q: BL.tests[id].title, line: BL.tests[id].subtitle }; }
  const STORE_KEY = 'bl.results';
  const SESSION_KEY = 'bl.session';
  const MAX_RESULTS = 40;
  let session = null;
  let lastResult = null;   // 저장이 막힌 브라우저에서도 방금 결과를 보여 주기 위한 메모리 사본
  let cleanup = null;
  function saveSession() { if (session) U.sstore.set(SESSION_KEY, session); }
  const TIME_KEY = 'bl.timeFactor';   // 1 표준 · 1.5 여유 · 0 무제한
  function getTimeFactor() { const v = U.store.get(TIME_KEY, 1); return v === 0 || v === 1.5 ? v : 1; }
  function setTimeFactor(v) { U.store.set(TIME_KEY, v); }
  /* 화면 꺼짐 막기(2026-10-18): 인지 검사 중에는 Wake Lock을 요청해서, 40~60초짜리 문항을 들여다보는 동안 휴대폰 화면이 어두워지거나 꺼지지 않게 한다.
     지원하지 않는 브라우저(카카오톡 안드로이드 인앱 등)에서는 조용히 넘어가는 보조 수단이다. 화면을 벗어나면 브라우저가 풀어 버리므로 돌아올 때 다시 요청한다.
     화면을 벗어난 동안의 제한 시간·제시는 렌더러가 따로 멈추거나 다시 한다(choice·spanTask·choicert·stroop·reaction·symsearch). */
  let wake = null, wakeWanted = false, wakeAsking = false;
  function wakeOn() {
    wakeWanted = true;
    if (wake || wakeAsking || document.hidden || !navigator.wakeLock || typeof navigator.wakeLock.request !== 'function') return;
    wakeAsking = true;
    try {
      navigator.wakeLock.request('screen').then(function (s) {
        wakeAsking = false;
        if (!wakeWanted) { s.release().catch(function () { }); return; }
        wake = s;
        s.addEventListener('release', function () { if (wake === s) wake = null; });
      }, function () { wakeAsking = false; });
    } catch (e) { wakeAsking = false; }
  }
  function wakeOff() {
    wakeWanted = false;
    if (!wake) return;
    const s = wake; wake = null;
    try { s.release().catch(function () { }); } catch (e) { }
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && wakeWanted) wakeOn(); });

  function setScreen(html, mount) {
    if (cleanup) { try { cleanup(); } catch (e) { } cleanup = null; }
    document.body.classList.remove('running');
    app.innerHTML = html;
    window.scrollTo(0, 0);
    if (mount) { const c = mount(); if (typeof c === 'function') cleanup = c; }
  }
  function go(hash) { location.hash = hash; }
  function results() { return U.store.get(STORE_KEY, []); }

  /* ---------- 라우팅 ---------- */
  function route() {
    const p = (location.hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean);
    const a = p[0], b = p[1], c = p[2];
    if (a !== 'run') wakeOff();   // 검사 화면을 떠나면 화면 꺼짐 막기를 푼다
    if (!a) return renderHome();
    if (a === 'test' && BL.tests[b]) return renderIntro(b);
    if (a === 'run' && BL.tests[b]) return renderRun(b);
    if (a === 'result' && BL.tests[b]) return renderResult(b, c);
    if (a === 'preview' && BL.tests[b]) return renderPreview(b, c);
    if (a === 'gallery' && b) return renderGallery(b, c, p[3]);
    if (a === 'profile' && BL.tests[b] && BL.tests[b].merge) return renderProfile(b);
    if (a === 'history') return renderHistory();
    if (a === 'about') return renderAbout();
    go('#/');
  }

  /* ---------- 홈 ---------- */
  function testCard(id) {
    const t = BL.tests[id], lk = look(id);
    return '<a class="test-card tint-' + id + '" href="#/test/' + id + '">' +
      '<span class="card-kicker">' + U.esc(t.title) + ' · ' + U.esc(t.kindLabel) + '</span>' +
      '<h2>' + U.esc(lk.q) + '</h2>' +
      '<p>' + U.esc(lk.line) + '</p>' +
      '<div class="test-card-meta"><span class="chip">' + U.esc(t.duration) + '</span><span class="chip">' + U.esc(t.length) + '</span></div>' +
      '<span class="card-go" aria-hidden="true">→</span>' +
      '</a>';
  }
  function rowHtml(r, idx) {
    const t = BL.tests[r.testId];
    if (!t) return '';
    return '<a class="row tint-' + t.id + '" href="#/result/' + t.id + '/' + idx + '"><span class="row-title">' + U.esc(t.title) + (r.modeLabel ? ' · ' + U.esc(r.modeLabel) : '') + '</span><span class="row-sub">' + U.esc(r.headline) + (r.label ? ' · ' + U.esc(r.label) : '') + '</span><span class="row-date mono">' + U.fmtDate(r.at) + '</span></a>';
  }
  function renderHome() {
    const all = results();
    const recent = all.map(function (r, i) { return { r: r, i: i }; }).slice(-3).reverse();
    const recentHtml = recent.length ? '<section class="block"><div class="block-head"><h3>최근 기록</h3><a href="#/history" class="link">전체 보기</a></div>' +
      recent.map(function (x) { return rowHtml(x.r, x.i); }).join('') + '</section>' : '';
    const cog = BL.tests.cognitive && BL.tests.cognitive.merge ? BL.tests.cognitive.merge(all) : null;
    const profileHtml = cog ? '<a class="profile-card tinted tint-cognitive" href="#/profile/cognitive"><span class="eyebrow">인지 종합 프로필</span><span class="profile-main">' + U.esc(cog.headline) + '</span><span class="muted small">' + U.esc(cog.label) + (cog.timeExtended ? ' · 일부 시간 늘림' : '') + ' · ' + (cog.coverage.scored != null ? cog.coverage.scored : cog.coverage.done) + '/' + cog.coverage.total + ' 과제 반영</span></a>' : '';
    setScreen(
      '<div class="wrap">' +
      '<section class="hero">' +
      '<p class="hero-chips"><span>무료</span><span>로그인 없음</span><span>개인정보 안 받아요</span></p>' +
      '<h1>궁금했던 나,<br><em>여기서 알아봐요</em></h1>' +
      '<p class="lead">머리 쓰는 힘부터 성격, 연애, 끌리는 일까지 여섯 가지 실험이 있어요. 결과마다 그게 생활 어디에 쓰이는지도 알려 드려요.</p>' +
      '</section>' +
      '<section class="grid">' + ORDER.filter(function (id) { return BL.tests[id]; }).map(testCard).join('') + '</section>' +
      profileHtml +
      recentHtml +
      '</div>'
    );
  }

  /* ---------- 소개 ---------- */
  function taskGridHtml(t) {
    if (!t.tasks) return '';
    const merged = t.merge ? t.merge(results()) : null;
    const done = merged && merged.tasks ? merged.tasks : {};
    const groups = {};
    t.tasks.forEach(function (k) { (groups[k.domainLabel] = groups[k.domainLabel] || []).push(k); });
    const doneCount = Object.keys(done).length;
    return '<div class="task-head"><p class="modes-label">과제별로 따로 풀기</p>' +
      (merged ? '<a class="link" href="#/profile/' + t.id + '">종합 프로필 보기 (' + doneCount + '/' + t.tasks.length + ')</a>' : '<span class="muted small">따로 푼 결과는 알아서 하나로 합쳐져요</span>') + '</div>' +
      Object.keys(groups).map(function (g) {
        return '<div class="task-group"><span class="task-group-label mono">' + U.esc(g) + '</span><div class="task-chips">' +
          groups[g].map(function (k) {
            const d = done[k.key];
            return '<button class="task-chip' + (d ? ' done' : '') + '" data-mode="task:' + k.key + '"><span>' + U.esc(k.label) + '</span><span class="mono">' + (d ? 'IQ ' + Math.round(U.clamp(100 + 15 * d.z, 55, 145)) + (typeof d.timeFactor === 'number' ? (d.timeFactor === 0 ? ' · 무제한' : ' · 여유') : '') : '약 ' + k.minutes + '분') + '</span></button>';
          }).join('') + '</div></div>';
      }).join('');
  }
  /* 결과 화면: 이 검사가 잰 능력·성향이 무엇이고 일상 어디에 쓰이는지. 결과에 나온 영역만 보여 준다. */
  function explainHtml(t, result) {
    if (!t.explain || !t.explain.length) return '';
    const scales = (result && result.scales) || [];
    const labels = [];
    scales.forEach(function (s) { labels.push(s.label); (s.children || []).forEach(function (c) { labels.push(c.label); }); });
    // 측정 안 된 결과(점수 막대가 없음)는 그 과제의 설명만 보여 준다
    if (!labels.length && result && Array.isArray(result.invalidLabels)) result.invalidLabels.forEach(function (l) { labels.push(l); });
    const rows = t.explain.filter(function (x) {
      const parts = x.tasks ? x.tasks.split(', ') : [];
      return !labels.length || labels.some(function (l) { return l === x.label || l.indexOf(x.label + ' ') === 0 || parts.indexOf(l) >= 0; });
    });
    if (!rows.length) return '';
    return '<section class="explain"><h3>무엇을 잰 걸까요, 어디에 쓰일까요</h3>' + rows.map(function (x) {
      return '<div class="explain-row"><h4>' + U.esc(x.label) + '</h4><p>' + U.esc(x.what) + '</p>' +
        '<p class="explain-where"><span class="mono">일상에서</span>' + U.esc(x.where) + '</p>' +
        (x.tasks ? '<p class="explain-tasks">과제: ' + U.esc(x.tasks) + '</p>' : '') + '</div>';
    }).join('') + '</section>';
  }
  function renderIntro(id) {
    const t = BL.tests[id];
    const modes = t.modes;
    const savedSession = U.sstore.get(SESSION_KEY, null);
    const canResume = savedSession && savedSession.id === id && Array.isArray(savedSession.items) && savedSession.index < savedSession.items.length;
    const resumeHtml = canResume
      ? '<div class="resume"><div><strong>진행 중인 검사가 있어요</strong><span class="muted small">' + savedSession.items.slice(0, savedSession.index).filter(function (x) { return x.scored; }).length + ' / ' + savedSession.items.filter(function (x) { return x.scored; }).length + ' 문항 완료</span></div><div class="resume-btns"><a class="btn btn-primary" href="#/run/' + id + '">이어서 하기</a><button class="btn" id="discard">새로 시작</button></div></div>'
      : '';
    const tf = getTimeFactor();
    const timeHtml = t.timed
      ? '<div class="time-set"><span class="modes-label">제한 시간</span><div class="seg">' + [[1, '표준'], [1.5, '여유 ×1.5'], [0, '무제한']].map(function (o) { return '<button class="seg-btn' + (tf === o[0] ? ' on' : '') + '" data-tf="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div><span class="muted small">제한 시간이 있는 규칙 찾기·언어·공간 문제에만 적용돼요. 여유나 무제한으로 풀면 점수가 조금 높게 나올 수 있어서, 결과와 종합 프로필에 그렇게 풀었다고 표시돼요.</span></div>'
      : '';
    const startHtml = modes
      ? '<p class="modes-label">' + (t.tasks ? '한 번에 풀기' : '검사 길이 고르기') + '</p><div class="modes">' + modes.map(function (m) {
        return '<button class="mode" data-mode="' + m.id + '"><span class="mode-title">' + U.esc(m.label) + '</span><span class="mode-desc">' + U.esc(m.desc) + '</span><span class="mode-meta mono">' + U.esc(m.duration) + ' · ' + U.esc(m.length) + '</span></button>';
      }).join('') + '</div>' + taskGridHtml(t)
      : '<button class="btn btn-primary btn-block" id="start">시작하기</button>';
    setScreen(
      '<div class="wrap tinted tint-' + id + '">' +
      '<a class="back" href="#/">← 실험 목록</a>' +
      '<div class="intro-hero"><p class="eyebrow">' + U.esc(t.title) + ' · ' + U.esc(t.kindLabel) + '</p>' +
      '<h1 class="title">' + U.esc(look(id).q) + '</h1>' +
      '<p class="lead">' + U.esc(t.subtitle) + '</p></div>' +
      '<ul class="intro-list">' + t.intro.map(function (s) { return '<li>' + U.esc(s) + '</li>'; }).join('') + '</ul>' +
      '<div class="spec"><div><span class="mono">소요 시간</span>' + U.esc(t.duration) + '</div><div><span class="mono">구성</span>' + U.esc(t.length) + '</div><div><span class="mono">저장</span>이 브라우저</div></div>' +
      resumeHtml + timeHtml + startHtml +
      '<p class="notice">참고용 자기평가예요. 전문가의 심리검사나 의학적 진단을 대신하지는 않아요.</p>' +
      '</div>',
      function () {
        const start = function (mode) {
          const merged = t.merge ? t.merge(results()) : null;
          const practiced = merged && merged.tasks ? Object.keys(merged.tasks) : [];
          session = { id: id, mode: mode, items: t.build(mode, { practiced: practiced }), index: 0, answers: [], times: [], startedAt: Date.now(), shownAt: Date.now(), timeFactor: getTimeFactor() };
          saveSession();
          go('#/run/' + id);
        };
        const discard = document.getElementById('discard');
        if (discard) discard.addEventListener('click', function () { U.sstore.remove(SESSION_KEY); session = null; renderIntro(id); });
        document.querySelectorAll('.seg-btn').forEach(function (b) {
          b.addEventListener('click', function () {
            setTimeFactor(Number(b.getAttribute('data-tf')));
            document.querySelectorAll('.seg-btn').forEach(function (x) { x.classList.toggle('on', x === b); });
          });
        });
        const btn = document.getElementById('start');
        if (btn) btn.addEventListener('click', function () { start(undefined); });
        document.querySelectorAll('.mode, .task-chip').forEach(function (b) { b.addEventListener('click', function () { start(b.getAttribute('data-mode')); }); });
      }
    );
  }

  /* ---------- 진행 ---------- */
  function renderRun(id) {
    const t = BL.tests[id];
    if (!session || session.id !== id) {
      // 새로고침이나 탭 복원 뒤에는 진행 중이던 검사를 이어 간다
      const saved = U.sstore.get(SESSION_KEY, null);
      if (saved && saved.id === id && Array.isArray(saved.items)) session = saved;
      else { go('#/test/' + id); return; }
    }
    const it = session.items[session.index];
    if (!it) { finish(); return; }
    if (it.type === 'adaptive') {
      // 적응형 스텁: 다음 문항을 만들어 스텁 앞에 끼우거나, 다 끝났으면 건너뛴다
      const nx = t.adaptNext ? t.adaptNext(it) : null;
      if (nx) session.items.splice(session.index, 0, nx); else session.index += 1;
      saveSession();
      renderRun(id);
      return;
    }
    const pending = session.items.reduce(function (s, x) { return s + (x.type === 'adaptive' && x.state ? Math.max(0, x.count - x.state.done) : 0); }, 0);
    // 화면에 띄운 적응형 문항은 목록에도 있고 스텁의 남은 수에도 들어 있어 한 번 뺀다
    const scoredTotal = session.items.filter(function (x) { return x.scored; }).length + pending - (it.adaptive ? 1 : 0);
    const scoredDone = session.items.slice(0, session.index).filter(function (x) { return x.scored; }).length;
    const pct = Math.round(scoredDone / scoredTotal * 100);
    // 시간 제한이 없는 검사는 이전 문항으로 돌아가 답을 바꿀 수 있다. 인지 검사는 제한 시간과 적응형 진행 때문에 되돌리지 않는다.
    const answerable = function (x) { return x && x.scored && (x.type === 'likert' || x.type === 'choice'); };
    let prevIdx = -1;
    if (!t.timed) for (let j = session.index - 1; j >= 0; j--) if (answerable(session.items[j])) { prevIdx = j; break; }
    const answeredHere = !t.timed && answerable(it) && session.answers[session.index] != null;
    const nav = prevIdx >= 0 || answeredHere ? '<div class="run-nav">' + (prevIdx >= 0 ? '<button class="btn btn-ghost" id="prev">← 이전 문항</button>' : '<span></span>') +
      (answeredHere ? '<button class="btn btn-ghost" id="next">다음 →</button>' : '') + '</div>' : '';
    const chrome = '<div class="run-head"><a class="run-title" href="#/test/' + id + '">' + U.esc(t.title) + '</a>' +
      '<span class="run-count mono">' + (scoredDone + (it.scored ? 1 : 0)) + ' / ' + scoredTotal + '</span></div>' +
      '<div class="progress"><div class="progress-bar" style="width:' + pct + '%"></div></div>';
    setScreen('<div class="wrap run tinted tint-' + id + '">' + chrome + '<div id="item" class="item"></div>' + nav + '</div>', function () {
      session.shownAt = Date.now();
      const pb = document.getElementById('prev');
      if (pb) pb.addEventListener('click', function () { session.index = prevIdx; saveSession(); renderRun(id); });
      const nb = document.getElementById('next');
      if (nb) nb.addEventListener('click', function () { session.index += 1; saveSession(); renderRun(id); });
      return RENDER[it.type](it, document.getElementById('item'), function (answer) {
        session.answers[session.index] = answer;
        session.times[session.index] = Date.now() - session.shownAt;
        if (it.adaptive && t.adaptRecord) t.adaptRecord(session.items[session.index + 1], it, answer);
        session.index += 1;
        saveSession();
        renderRun(id);
      }, {
        timeFactor: session.timeFactor, prev: session.answers[session.index], save: saveSession,
        // 렌더러가 화면을 벗어나 멈추거나 다시 한 횟수를 센다(결과에 남김)
        paused: function () { session.pauses = (session.pauses || 0) + 1; saveSession(); },
        // 화면을 벗어나 멈춘 적응형 문항: 답을 기록하지 않고(단계 그대로) 빼서, 스텁이 같은 단계의 새 문항을 내게 한다
        redo: it.adaptive ? function () {
          if (session.items[session.index] !== it) return;
          session.items.splice(session.index, 1);
          saveSession();
          renderRun(id);
        } : null
      });
    });
    document.body.classList.add('running');   // 검사 화면에서는 상단 바를 고정하지 않는다(style.css .running .topbar)
    if (t.timed) wakeOn();   // 인지 검사 중에는 화면 꺼짐 막기를 요청한다(지원하는 브라우저만)
  }

  function finish() {
    const t = BL.tests[session.id];
    const result = t.score(session.answers, session.items, { times: session.times, mode: session.mode });
    // 시간 설정 배수는 제한 시간이 있는 객관식 문항(규칙 찾기·언어·공간)에만 쓰인다. 그런 문항이 없는 결과(기억·속도 과제만)에는 붙이지 않는다(2026-10-18).
    const timedItems = session.items.some(function (x) { return x && x.scored && x.type === 'choice' && x.timeLimit > 0; });
    if (t.timed && timedItems && typeof session.timeFactor === 'number' && session.timeFactor !== 1) {
      result.timeFactor = session.timeFactor;
      result.modeLabel = (result.modeLabel || '') + (session.timeFactor === 0 ? ' · 시간 무제한' : ' · 시간 여유 ×' + session.timeFactor);
      (result.sections = result.sections || []).push({ title: '시간 설정', body: session.timeFactor === 0
        ? '제한 시간 없이 풀었어요. 기준값은 표준 시간 기준이라 추정 IQ가 실제보다 높게 나올 수 있어요.'
        : '제한 시간을 표준의 ' + session.timeFactor + '배로 두고 풀었어요. 기준값은 표준 시간 기준이라 추정 IQ가 조금 높게 나올 수 있어요.' });
    }
    if (session.pauses) {
      result.pauses = session.pauses;
      (result.sections = result.sections || []).push({ title: '중간에 멈춤', body: '검사 중에 화면을 벗어나 ' + session.pauses + '번 멈췄어요. 멈춘 동안은 제한 시간이 흐르지 않았어요. 그때 풀던 문제는 같은 단계의 새 문제로 바꾸거나 남은 시간으로 이어서 풀었고, 숫자나 칸이 나오던 중이었으면 그 시도는 세지 않고 다시 했어요.' });
    }
    result.testId = session.id;
    result.mode = session.mode;
    result.at = Date.now();
    result.elapsed = Date.now() - session.startedAt;
    if (BL.stats) result.sid = BL.stats.newId();   // 익명 통계용 결과 id (무작위, 같은 결과를 두 번 보내지 않게)
    let all = results();
    all.push(result);
    if (all.length > MAX_RESULTS) all = all.slice(all.length - MAX_RESULTS);
    const saved = U.store.set(STORE_KEY, all);
    lastResult = result;
    if (BL.stats) BL.stats.enqueue(result);   // 익명 통계 참여 중이면 결과 화면에서 보낸다
    session = null;
    U.sstore.remove(SESSION_KEY);
    go('#/result/' + t.id + '/' + (saved ? all.length - 1 : 'last'));
  }

  /* ---------- 문항 렌더러 ---------- */
  /* 과제 시작 카드. html = 그림 예시처럼 렌더러가 만든 마크업(사용자 입력이 아니다) */
  function introCard(el, it, onStart, extra, html) {
    el.innerHTML = '<div class="section-card"><p class="eyebrow">과제</p><h2>' + U.esc(it.title) + '</h2><p>' + U.esc(it.desc) + '</p>' + (html || '') +
      (extra ? '<p class="muted small">' + U.esc(extra) + '</p>' : '') +
      '<button class="btn btn-primary btn-block" id="go">시작</button></div>';
    el.querySelector('#go').addEventListener('click', onStart);
  }
  /* ---------- 반응 과제 공용 (2026-10-18) ---------- */
  // 자극을 넣은 뒤 두 번째 화면 갱신 때 부른다. 그때가 자극이 실제로 화면에 그려진 시각에 가깝다. 화면 갱신이 멈춘 상태(숨은 탭)면 늦게 불리거나 안 불린다.
  function afterPaint(fn) { if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { requestAnimationFrame(fn); }); }
  // 입력이 실제로 일어난 시각(e.timeStamp). 메인 스레드가 바빠 처리기가 늦게 돌아도 그만큼이 반응 시간에 섞이지 않는다.
  // 오래된 WebView는 다른 기준(1970년부터 ms)을 주기도 해서, 지금 시각과 1초 넘게 차이 나면 지금 시각을 쓴다.
  function evTime(e) { const now = performance.now(), ts = e && typeof e.timeStamp === 'number' ? e.timeStamp : NaN; return ts > 0 && Math.abs(now - ts) < 1000 ? Math.min(ts, now) : now; }
  // 입력 방식: t 터치·펜, m 마우스, k 키보드 (결과에 "마우스로 눌러 느리게 나왔을 수 있어요"를 붙이고 익명 통계로 입력 방식별 기준을 따로 만들려고 센다)
  function inputOf(e) { return !e || e.type === 'keydown' ? 'k' : e.pointerType === 'touch' || e.pointerType === 'pen' ? 't' : 'm'; }
  // 점수에 드는 본 시행을 시작한 횟수를 문항에 적어 세션에 저장한다(연습은 세지 않음). 새로고침으로 처음부터 다시 하면 그 횟수가 결과에 남는다. 반환값 = 다시 시작한 횟수
  function markStart(it, ctx) { it.starts = (it.starts || 0) + 1; if (ctx && typeof ctx.save === 'function') ctx.save(); return it.starts - 1; }
  /* 선택 반응·색-단어 간섭 공용(2026-10-18): 화면을 벗어나면(카톡 알림, 다른 앱) 진행 중이던 한 번(대기·자극)은 기록하지 않고 버리고, 돌아와서
     "이어서 하기"를 누르면 같은 번호를 다시 잰다. 버린 횟수는 결과(obs.away)에 남는다. 예전에는 가려진 동안의 시간이 그 번의 반응 시간에 섞였다.
     busy() = 진행 중인 번이 있는지, stop(discard) = 타이머를 멈추고 상태를 바꿈, resume() = 다음 번 시작. 반환값: on/off(리스너), hold(discard)(직접 멈추기) */
  function rtAway(el, busy, stop, resume) {
    function hold(discard) {
      stop(discard);
      el.innerHTML = '<div class="section-card"><p class="eyebrow">잠깐 멈췄어요</p><p>' + (discard ? '화면을 벗어나서 이번 번은 세지 않았어요. ' : '') + '준비되면 이어서 해요.</p>' +
        '<button class="btn btn-primary btn-block" id="resume">이어서 하기</button></div>';
      el.querySelector('#resume').addEventListener('click', resume);
    }
    const onVis = function () { if (document.hidden && busy()) hold(true); };
    const onHide = function () { if (busy()) hold(true); };
    return {
      hold: hold,
      on: function () { document.addEventListener('visibilitychange', onVis); window.addEventListener('pagehide', onHide); },
      off: function () { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', onHide); }
    };
  }
  function practiceEnd(el, text, onGo) {
    el.innerHTML = '<div class="section-card"><p class="eyebrow">연습 끝</p><h2>이제 진짜예요</h2><p>' + U.esc(text) + '</p><button class="btn btn-primary btn-block" id="go">시작</button></div>';
    el.querySelector('#go').addEventListener('click', onGo);
  }

  /* ---------- 기억 폭 과제 공용 (2026-10-18) ----------
     흐름: 시작 카드 → 연습(처음 하는 과제만. 2자리·2칸·2개짜리 순서로 최대 it.practiceTrials 번, 맞히면 바로 끝, 점수 없음) → "이제 진짜예요" 카드 → 본 시행.
     본 시행은 it.start 길이부터 맞히면 한 길이 늘리고, 같은 길이에서 두 번 틀리면 끝난다(it.max까지).
     순서는 엔진(cognitive.js SPAN_GEN)이 만들어서 한 시행 안에 같은 숫자·칸이 다시 나오지 않는다.
     입력은 화면 버튼으로만 받는다(휴대폰 키보드를 띄우지 않아, 키보드가 늦게 뜨거나 화면이 밀리는 동안 기억을 붙들고 있지 않아도 된다).
     길이만큼 다 넣어야 "확인"이 켜지고, 확인 전에는 "하나 지우기"로 고칠 수 있다. 바로 앞과 같은 숫자·칸을 또 누르면 두 번 탭으로 보고 무시한다
     (정답에 그런 경우가 없어서 맞는 답을 막지 않는다). PC는 숫자키(숫자 과제)·Backspace·Enter도 받는다.
     답 = { best: 맞힌 가장 긴 길이, log: [[길이, 정답 1·오답 0], …], restarts: 본 시행을 처음부터 다시 시작한 횟수 }. 엔진이 log로 부분 점수를 낸다.
     예전 세션에서 만든 문항(practiceTrials 없음, 예전 최대 길이)도 그대로 돈다(연습 없이 바로 본 시행).
     spec = { gen(n), show(stim, n, practice, T, then), ask(stim, n, practice, judge) → 정리 함수, answerHtml(stim), intro, rule, real } */
  const SPAN_PRACTICE_LEN = 2;
  function spanTask(it, el, done, ctx, spec) {
    const timers = [], log = [];
    let gone = false, finished = false, askOff = null;
    let pdone = 0, len = it.start, fails = 0, best = it.start - 1, starts = 0;
    let phase = 'idle', cur = null, pending = null;   // phase: show 순서를 보여 주는 중 · ask 답을 넣는 중 · fb 결과를 잠깐 보여 주는 중 · idle
    const practiceN = it.practiceTrials || 0;
    const T = function (fn, ms) { timers.push(setTimeout(function () { if (!gone) fn(); }, ms)); };
    const stopTimers = function () { timers.forEach(clearTimeout); timers.length = 0; };
    /* 본 시행 진행 상태(2026-10-18)를 문항(it.span)에 적어 세션에 저장한다. 새로고침이나 탭 복원 뒤에는 처음 길이부터가 아니라 하던 길이부터 이어 간다.
       ask = 순서를 다 보고 답을 넣던 중. 그때 다시 열리면 그 시도는 틀린 것으로 센다(새로고침으로 같은 길이를 새 순서로 다시 받는 요령 막기). */
    function persist(ask) { it.span = { len: len, fails: fails, best: best, log: log.slice(), ask: !!ask }; if (ctx && typeof ctx.save === 'function') ctx.save(); }
    function trial(n, practice, then) {
      cur = { n: n, practice: practice, then: then };
      if (document.hidden) { interrupted(); return; }   // 화면이 가려진 채로 다음 시도가 시작되려 하면(백그라운드 타이머) 보여 주지 않는다
      const stim = spec.gen(n);
      phase = 'show';
      spec.show(stim, n, practice, T, function () {
        phase = 'ask';
        if (!practice) persist(true);
        askOff = spec.ask(stim, n, practice, function (ok) {
          phase = 'idle';
          if (askOff) { askOff(); askOff = null; }
          then(ok, stim);
        });
      });
    }
    /* 순서가 나오는 중에 화면을 벗어나면(카톡 알림, 다른 앱, 화면 꺼짐) 그 시도는 세지 않고(실패·기록에 넣지 않음) 같은 길이로 새 순서를 다시 보여 준다.
       예전에는 백그라운드에서 타이머가 계속 돌거나(안드로이드) 돌아오는 순간 밀린 타이머가 한꺼번에 돌아(iOS) 못 본 순서가 실패로 셌다.
       답을 넣는 중에는 제한 시간이 없어서 따로 멈추지 않는다. */
    function interrupted() {
      stopTimers();
      phase = 'idle'; pending = null;
      if (ctx && typeof ctx.paused === 'function') ctx.paused();
      const c = cur;
      el.innerHTML = '<div class="section-card"><p class="eyebrow">잠깐 멈췄어요</p><h2>방금 시도는 다시 할게요</h2>' +
        '<p>순서가 나오는 중에 화면을 벗어나서 방금 시도는 세지 않았어요. 같은 길이로 새 순서를 보여 드려요.</p>' +
        '<button class="btn btn-primary btn-block" id="again">다시 보기</button></div>';
      el.querySelector('#again').addEventListener('click', function () { if (!gone) trial(c.n, c.practice, c.then); });
    }
    // 결과를 잠깐 보여 주는 사이에 화면을 벗어나면 다음 순서를 바로 시작하지 않고, 돌아와서 누르면 이어 간다
    function held() {
      const step = pending;
      stopTimers();
      phase = 'idle'; pending = null;
      el.innerHTML = '<div class="section-card"><p class="eyebrow">잠깐 멈췄어요</p><p>화면을 벗어나서 다음 순서를 기다리고 있어요. 준비되면 이어서 해요.</p>' +
        '<button class="btn btn-primary btn-block" id="again">이어서 하기</button></div>';
      el.querySelector('#again').addEventListener('click', function () { if (!gone) step(); });
    }
    function away() { if (gone || finished) return; if (phase === 'show') interrupted(); else if (phase === 'fb' && pending) held(); }
    const onVis = function () { if (document.hidden) away(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', away);
    function practiceStep() {
      trial(SPAN_PRACTICE_LEN, true, function (ok, stim) {
        pdone += 1;
        const again = !ok && pdone < practiceN;
        el.innerHTML = '<div class="practice-fb ' + (ok ? 'ok' : 'bad') + '"><p class="practice-title">' + (ok ? '정답이에요.' : '아쉽네요. 틀렸어요.') + '</p>' +
          (ok ? '' : spec.answerHtml(stim)) + '<p class="practice-explain">' + U.esc(spec.rule) + '</p>' +
          '<button class="btn btn-primary btn-block" id="pnext">' + (again ? '한 번 더 연습' : '연습 끝내기') + '</button></div>';
        el.querySelector('#pnext').addEventListener('click', function () {
          if (gone) return;
          if (again) practiceStep(); else practiceEnd(el, spec.real, startRun);
        });
      });
    }
    function startRun() { starts = markStart(it, ctx); persist(false); next(); }
    function next() {
      trial(len, false, function (ok, stim) {
        log.push([len, ok ? 1 : 0]);
        el.innerHTML = '<div class="span-stage"><p class="span-fb ' + (ok ? 'ok' : 'bad') + '">' + (ok ? '정답' : '오답') + '</p>' + (ok ? '' : spec.answerHtml(stim)) + '</div>';
        if (ok) { best = len; fails = 0; len += 1; } else fails += 1;
        persist(false);
        const step = len > it.max || fails >= 2 ? end : next;
        phase = 'fb'; pending = step;
        T(function () { phase = 'idle'; pending = null; step(); }, ok ? 900 : 1400);
      });
    }
    function end() { if (finished) return; finished = true; it.span = null; done({ best: best, log: log, restarts: starts }); }
    const saved = it.span && typeof it.span.len === 'number' && Array.isArray(it.span.log) ? it.span : null;
    if (saved) {
      // 새로고침·탭 복원 뒤: 저장한 길이·실패 수·기록에서 이어 간다
      len = saved.len; fails = saved.fails || 0; best = typeof saved.best === 'number' ? saved.best : it.start - 1;
      saved.log.forEach(function (e) { log.push(e); });
      starts = Math.max(0, (it.starts || 1) - 1);
      const lost = !!saved.ask;
      if (lost) { log.push([len, 0]); fails += 1; }
      persist(false);
      const over = len > it.max || fails >= 2;
      el.innerHTML = '<div class="section-card"><p class="eyebrow">이어서 하기</p><h2>' + U.esc(it.title) + '</h2><p>' +
        (lost ? '답을 넣던 중에 페이지가 다시 열려서 그 시도는 틀린 것으로 셌어요. ' : '') +
        (over ? '이 과제는 여기까지예요.' : '하던 곳(' + len + spec.unit + ')부터 이어서 해요.') + '</p>' +
        '<button class="btn btn-primary btn-block" id="go">' + (over ? '다음' : '이어서 하기') + '</button></div>';
      el.querySelector('#go').addEventListener('click', function () { if (gone) return; if (over) end(); else next(); });
    } else {
      introCard(el, it, function () { if (practiceN) practiceStep(); else startRun(); },
        spec.intro + (practiceN ? ' 먼저 짧은 순서로 연습해요. 연습은 점수에 안 들어가요.' : ''));
    }
    return function () { gone = true; stopTimers(); if (askOff) { askOff(); askOff = null; } document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', away); };
  }
  function practiceTag(p) { return p ? '<div class="practice-tag">연습 · 점수에 안 들어가요</div>' : ''; }
  // 넣은 답 칸: 넣은 것은 글자(위치 기억은 점)로, 남은 자리는 빈 밑줄로 보여 줘서 몇 개를 더 넣어야 하는지 보이게 한다
  function spanSlots(vals, n, dot) {
    let h = '';
    for (let i = 0; i < n; i++) h += i < vals.length ? '<span class="on">' + U.esc(dot ? '●' : vals[i]) + '</span>' : '<span></span>';
    return h;
  }
  // 넣은 개수·하나 지우기·확인을 한 줄에 둬서 작은 폰에서도 키패드와 확인이 한 화면에 든다
  const SPAN_INPUT_TOOLS = '<div class="span-tools"><span class="mono muted small" id="cnt"></span><button class="btn btn-ghost" id="undo">하나 지우기</button>' +
    '<button class="btn btn-primary" id="ok" disabled>확인</button></div>';
  // 버튼 입력 공용: put(값) 넣기(꽉 찼거나 바로 앞과 같은 값이면 false), 하나 지우기, 확인(다 채워야 켜짐). 화면에 #slots·#cnt·#undo·#ok가 있어야 한다.
  function spanInput(el, n, opts, judge) {
    const vals = [];
    let sent = false;
    const slots = el.querySelector('#slots'), cnt = el.querySelector('#cnt'), ok = el.querySelector('#ok'), undo = el.querySelector('#undo');
    function refresh() {
      slots.innerHTML = spanSlots(vals, n, opts.dot);
      cnt.textContent = vals.length + ' / ' + n;
      ok.disabled = vals.length !== n;
      undo.disabled = !vals.length;
      if (opts.onChange) opts.onChange(vals);
    }
    function put(v) {
      if (sent || vals.length >= n) return false;
      if (vals.length && vals[vals.length - 1] === v) return false;
      vals.push(v); refresh(); return true;
    }
    function pop() { if (sent || !vals.length) return; vals.pop(); refresh(); }
    function submit() { if (sent || vals.length !== n) return; sent = true; ok.disabled = true; undo.disabled = true; judge(vals.slice()); }
    undo.addEventListener('click', pop);
    ok.addEventListener('click', submit);
    // Enter는 기본 동작(포커스된 버튼 누르기)을 막아 마지막에 누른 버튼이 한 번 더 들어가지 않게 한다
    const onKey = function (e) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Backspace') { e.preventDefault(); pop(); }
      else if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (opts.key) opts.key(e.key);
    };
    document.addEventListener('keydown', onKey);
    refresh();
    return { put: put, off: function () { document.removeEventListener('keydown', onKey); } };
  }

  const RENDER = {
    section: function (it, el, done) {
      el.innerHTML = '<div class="section-card' + (it.sub ? ' section-sub' : '') + '">' +
        '<p class="eyebrow">' + (it.sub ? '과제' : '파트 ' + it.num) + '</p>' +
        '<h2>' + U.esc(it.title) + '</h2>' +
        '<p>' + U.esc(it.desc) + '</p>' +
        (it.where ? '<p class="where"><span class="mono">일상에서</span>' + U.esc(it.where) + '</p>' : '') +
        (it.count ? '<p class="mono muted small">' + U.esc(it.count) + '</p>' : '') +
        '<button class="btn btn-primary btn-block" id="go">' + (it.sub ? '시작' : '다음') + '</button></div>';
      el.querySelector('#go').addEventListener('click', function () { done(null); });
    },

    choice: function (it, el, done, ctx) {
      let answered = false, gone = false, timer = null, tick = null, paused = false, left = 0, clockAt = 0;
      const factor = ctx && typeof ctx.timeFactor === 'number' ? ctx.timeFactor : 1;
      const limit = it.practice || !it.timeLimit || factor === 0 ? 0 : Math.round(it.timeLimit * factor);
      const opts = it.optionsHtml ? it.optionsHtml : it.options.map(function (o) { return '<span class="opt-text">' + U.esc(o) + '</span>'; });
      el.innerHTML =
        (limit ? '<div class="timer-row"><div class="timer"><div class="timer-bar" id="tbar"></div></div><span class="timer-num mono" id="tnum">' + limit + '</span></div>' : '') +
        (it.practice ? '<div class="practice-tag">연습 문제 · 점수에 안 들어가요</div>' : '') +
        (it.level ? '<div class="q-meta"><span class="level-dots" aria-hidden="true">' + '●'.repeat(it.level) + '○'.repeat(Math.max(0, 6 - it.level)) + '</span><span class="mono">' + it.level + '단계' + (it.level >= 4 ? ' · 상위 문항' : '') + '</span></div>' : '') +
        (it.scenario ? '<div class="scenario">' + U.esc(it.scenario) + '</div>' : '') +
        '<p class="q-prompt">' + U.esc(it.prompt) + '</p>' +
        (it.promptHtml || '') +
        '<div class="options cols-' + (it.optionCols || 1) + (it.optionsHtml ? ' options-visual' : '') + '">' +
        opts.map(function (o, i) { return '<button class="opt" data-i="' + i + '">' + (it.optionsHtml ? o : '<span class="opt-key mono">' + (i + 1) + '</span>' + o) + '</button>'; }).join('') +
        '</div>';
      // 연습 문제: 고르면 정답과 규칙을 보여 주고, 버튼을 눌러야 본 문항으로 간다
      const showPractice = function (i) {
        const ok = i === it.answer;
        const box = document.createElement('div');
        box.className = 'practice-fb ' + (ok ? 'ok' : 'bad');
        // 그림 보기에는 번호가 안 보이므로 "N번" 대신 초록 테두리로 표시한 보기를 가리킨다
        box.innerHTML = '<p class="practice-title">' + (ok ? '정답이에요.' : it.optionsHtml ? '아쉽네요. 정답은 초록 테두리로 표시한 보기예요.' : '아쉽네요. 정답은 ' + (it.answer + 1) + '번이에요.') + '</p>' +
          (it.optionsHtml ? '<div class="rv-opt">' + it.optionsHtml[it.answer] + '</div>' : '') +
          '<p class="practice-explain">' + U.esc(it.explain || '') + '</p>' +
          '<button class="btn btn-primary btn-block" id="pnext">본 문항 시작</button>';
        el.appendChild(box);
        el.querySelectorAll('.opt').forEach(function (b, k) { b.disabled = true; if (k === it.answer) b.classList.add('correct'); });
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        el.querySelector('#pnext').addEventListener('click', function () { if (!gone) done(null); });
      };
      // 누르는 순간 타이머를 멈춘다. 마지막 순간에 누른 답이 시간 초과로 처리되지 않도록.
      const pick = function (i) {
        if (answered || gone || paused) return;
        answered = true;
        if (timer) clearTimeout(timer);
        if (tick) clearInterval(tick);
        el.querySelectorAll('.opt.selected').forEach(function (x) { x.classList.remove('selected'); });
        const b = el.querySelector('.opt[data-i="' + i + '"]');
        if (b) b.classList.add('selected');
        if (it.practice) { showPractice(i); return; }
        setTimeout(function () { if (!gone) done(i); }, 180);
      };
      el.querySelectorAll('.opt').forEach(function (b) {
        b.addEventListener('click', function () { pick(Number(b.getAttribute('data-i'))); });
      });
      // 이전 문항으로 돌아왔을 때는 전에 고른 답을 표시해 둔다
      if (ctx && typeof ctx.prev === 'number') { const pv = el.querySelector('.opt[data-i="' + ctx.prev + '"]'); if (pv) pv.classList.add('selected'); }
      const onKey = function (e) {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= opts.length && !e.ctrlKey && !e.metaKey && !e.altKey) pick(n - 1);
      };
      document.addEventListener('keydown', onKey);
      /* 제한 시간: 남은 시간(left, ms)만큼 막대·숫자·마감 타이머를 돌린다. 화면을 벗어나면(카톡 알림, 다른 앱, 화면 꺼짐) 멈춘다(2026-10-18).
         예전에는 자리를 비운 사이에도 시간이 흘러 돌아오자마자 시간 초과(오답)가 되고, 적응형이면 단계도 한 칸 내려갔다. */
      const bar = el.querySelector('#tbar'), num = el.querySelector('#tnum'), row = el.querySelector('.timer-row');
      function runClock() {
        clockAt = Date.now();
        const endAt = clockAt + left;
        bar.style.transition = 'none';
        bar.style.width = (left / (limit * 1000) * 100) + '%';
        bar.getBoundingClientRect();
        bar.style.transition = 'width ' + (left / 1000) + 's linear';
        bar.style.width = '0%';
        const show = function () { const l = Math.max(0, Math.round((endAt - Date.now()) / 1000)); num.textContent = l; if (l <= 10) row.classList.add('urgent'); };
        show();
        tick = setInterval(show, 250);
        // 시간이 다 되면 말없이 넘어가지 않고 잠깐 알려 준 뒤 넘어간다
        timer = setTimeout(function () {
          if (answered || gone || paused) return;
          answered = true; if (tick) clearInterval(tick);
          el.querySelectorAll('.opt').forEach(function (b) { b.disabled = true; });
          const toast = document.createElement('div'); toast.className = 'toast'; toast.setAttribute('role', 'status');
          toast.textContent = '시간이 다 됐어요. 다음 문항으로 넘어가요.';
          el.appendChild(toast);
          setTimeout(function () { if (!gone) done(null); }, 1100);
        }, left);
      }
      /* 화면을 벗어나면 시간을 멈추고 문제와 보기를 가린다(.item.paused). 돌아와서 "이어서 풀기"를 누르면, 적응형 문항은 답을 기록하지 않고 같은 단계의
         새 문항으로 바꾸고(ctx.redo, 멈춘 동안 보던 문제를 생각해 두는 요령 막기), 단계표대로 푸는 정밀 검사 문항은 남은 시간으로 이어 간다. 멈춘 횟수는 결과에 남는다. */
      function pause() {
        if (!limit || answered || gone || paused) return;
        paused = true;
        if (timer) clearTimeout(timer);
        if (tick) clearInterval(tick);
        timer = tick = null;
        left = Math.max(1000, left - (Date.now() - clockAt));
        if (ctx && typeof ctx.paused === 'function') ctx.paused();
        const swap = !!(ctx && typeof ctx.redo === 'function');
        el.classList.add('paused');
        const card = document.createElement('div');
        card.className = 'section-card pause-card'; card.setAttribute('role', 'status');
        card.innerHTML = '<p class="eyebrow">잠깐 멈췄어요</p><h2>화면을 벗어나서 시간을 멈췄어요</h2><p>' +
          (swap ? '보던 문제는 점수에 넣지 않고, 같은 단계의 새 문제로 바꿔서 이어 가요.' : '남은 시간 ' + Math.ceil(left / 1000) + '초로 이 문제를 이어서 풀어요.') + '</p>' +
          '<button class="btn btn-primary btn-block" id="resume">이어서 풀기</button>';
        el.appendChild(card);
        card.querySelector('#resume').addEventListener('click', function () {
          if (gone || !paused) return;
          if (swap) { ctx.redo(); return; }
          paused = false;
          el.classList.remove('paused');
          if (card.parentNode) card.parentNode.removeChild(card);
          runClock();
        });
      }
      const onVis = function () { if (document.hidden) pause(); };
      if (limit) {
        left = limit * 1000;
        runClock();
        document.addEventListener('visibilitychange', onVis);
        window.addEventListener('pagehide', pause);
        if (document.hidden) pause();
      }
      return function () { gone = true; if (timer) clearTimeout(timer); if (tick) clearInterval(tick); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', pause); };
    },

    likert: function (it, el, done, ctx) {
      const labels = it.labels || ['전혀 아니다', '아니다', '보통이다', '그렇다', '매우 그렇다'];
      let finished = false;
      el.innerHTML = (it.lead ? '<p class="q-lead">' + U.esc(it.lead) + '</p>' : '') + '<p class="q-prompt q-likert">' + U.esc(it.text) + '</p>' +
        '<div class="likert">' + labels.map(function (l, i) {
          return '<button class="lk lk-' + (i + 1) + '" data-v="' + (i + 1) + '"><span class="lk-dot"></span><span class="lk-label">' + U.esc(l) + '</span></button>';
        }).join('') + '</div>';
      let gone = false;
      const pick = function (v) {
        if (finished || gone) return;
        finished = true;
        el.querySelectorAll('.lk.selected').forEach(function (x) { x.classList.remove('selected'); });
        const b = el.querySelector('.lk[data-v="' + v + '"]');
        if (b) b.classList.add('selected');
        setTimeout(function () { if (!gone) done(v); }, 150);
      };
      el.querySelectorAll('.lk').forEach(function (b) {
        b.addEventListener('click', function () { pick(Number(b.getAttribute('data-v'))); });
      });
      if (ctx && typeof ctx.prev === 'number') { const pv = el.querySelector('.lk[data-v="' + ctx.prev + '"]'); if (pv) pv.classList.add('selected'); }
      const onKey = function (e) { const n = parseInt(e.key, 10); if (n >= 1 && n <= 5) pick(n); };
      document.addEventListener('keydown', onKey);
      return function () { gone = true; document.removeEventListener('keydown', onKey); };
    },

    digitspan: function (it, el, done, ctx) {
      const back = it.mode === 'backward', G = BL.tests.cognitive.spanGen;
      const expectOf = function (d) { return back ? d.slice().reverse() : d; };
      return spanTask(it, el, done, ctx, {
        gen: function (n) { return G.digits(n); },
        show: function (d, n, p, T, then) {
          el.innerHTML = '<div class="span-stage">' + practiceTag(p) + '<p class="mono muted">' + n + '자리 · ' + (back ? '거꾸로' : '순서대로') + '</p><div class="span-digit mono" id="digit">&nbsp;</div><p class="muted small">숫자를 잘 보세요</p></div>';
          const box = el.querySelector('#digit');
          d.forEach(function (x, i) {
            T(function () { box.textContent = String(x); box.classList.add('on'); }, 500 + i * 1000);
            T(function () { box.textContent = ' '; box.classList.remove('on'); }, 500 + i * 1000 + 750);
          });
          T(then, 500 + d.length * 1000 + 150);
        },
        ask: function (d, n, p, judge) {
          const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
          el.innerHTML = '<div class="span-stage">' + practiceTag(p) + '<p class="q-prompt">' + (back ? '거꾸로 뒤집어' : '보인 순서대로') + ' 누르세요</p>' +
            '<div class="span-slots mono" id="slots" aria-live="polite"></div>' +
            '<div class="lns-btns digit-pad">' + keys.map(function (k) { return '<button class="lns-btn mono" data-v="' + k + '">' + k + '</button>'; }).join('') + '</div>' +
            SPAN_INPUT_TOOLS + '</div>';
          const expect = expectOf(d).join('');
          const inp = spanInput(el, n, { key: function (k) { if (/^[0-9]$/.test(k)) inp.put(k); } }, function (vals) { judge(vals.join('') === expect); });
          el.querySelectorAll('.lns-btn').forEach(function (b) { b.addEventListener('click', function () { inp.put(b.getAttribute('data-v')); }); });
          return inp.off;
        },
        answerHtml: function (d) { return '<p class="mono muted">정답은 ' + expectOf(d).join(' ') + '</p>'; },
        unit: '자리',
        intro: it.start + '자리부터 시작해서 맞힐 때마다 한 자리씩 늘어나요. 같은 길이에서 두 번 틀리면 끝나요. 최대 ' + it.max + '자리까지예요. 다 나온 뒤 화면의 숫자 버튼으로 누르고 확인을 눌러요.',
        rule: back ? '거꾸로 뒤집어 눌러요. 예를 들어 7 3이 보였으면 3 7, 2 8 5가 보였으면 5 8 2를 눌러요. 잘못 눌렀으면 확인 전에 하나 지우기로 고쳐요.'
          : '보인 순서 그대로 눌러요. 예를 들어 4 9가 보였으면 4 9를 눌러요. 잘못 눌렀으면 확인 전에 하나 지우기로 고쳐요.',
        real: '이제부터 점수에 들어가요. ' + it.start + '자리부터 시작해서 맞히면 한 자리씩 늘어나고, 같은 길이에서 두 번 틀리면 끝나요.'
      });
    },

    gridspan: function (it, el, done, ctx) {
      const G = BL.tests.cognitive.spanGen;
      // cls: show(보여 주기) · input(누르기) · answer(틀렸을 때 정답 순서를 번호로)
      function gridHtml(cls, labels) {
        let h = '<div class="gspan ' + cls + '">';
        for (let i = 0; i < 9; i++) h += cls === 'answer' ? '<div class="gcell' + (labels[i] ? ' num' : '') + '">' + (labels[i] || '') + '</div>' : '<button class="gcell" data-i="' + i + '" aria-label="칸 ' + (i + 1) + '"></button>';
        return h + '</div>';
      }
      return spanTask(it, el, done, ctx, {
        gen: function (n) { return G.cells(n); },
        show: function (seq, n, p, T, then) {
          el.innerHTML = '<div class="span-stage">' + practiceTag(p) + '<p class="mono muted">칸 ' + n + '개 · 잘 보세요</p>' + gridHtml('show') + '</div>';
          const cells = el.querySelectorAll('.gcell');
          seq.forEach(function (c, i) {
            T(function () { cells[c].classList.add('on'); }, 500 + i * 900);
            T(function () { cells[c].classList.remove('on'); }, 500 + i * 900 + 600);
          });
          T(then, 500 + seq.length * 900 + 200);
        },
        ask: function (seq, n, p, judge) {
          el.innerHTML = '<div class="span-stage">' + practiceTag(p) + '<p class="q-prompt">켜진 순서대로 누르세요</p>' + gridHtml('input') +
            '<div class="span-slots" id="slots" aria-live="polite"></div>' + SPAN_INPUT_TOOLS + '</div>';
          const inp = spanInput(el, n, { dot: true }, function (vals) { judge(vals.join(',') === seq.join(',')); });
          el.querySelectorAll('.gcell').forEach(function (b) {
            b.addEventListener('click', function () {
              if (!inp.put(Number(b.getAttribute('data-i')))) return;
              // 누른 칸은 0.3초 동안 진하게 칠해서 눌렸는지 바로 보이게 한다
              b.classList.add('tap');
              setTimeout(function () { b.classList.remove('tap'); }, 300);
            });
          });
          return inp.off;
        },
        answerHtml: function (seq) { const lab = []; seq.forEach(function (c, i) { lab[c] = i + 1; }); return '<p class="muted small">정답 순서</p>' + gridHtml('answer', lab); },
        unit: '칸',
        intro: '켜지는 칸이 ' + it.start + '개부터 시작해서 맞힐 때마다 하나씩 늘어나요. 같은 길이에서 두 번 틀리면 끝나요. 같은 칸이 두 번 켜지지는 않아서' +
          (it.max >= 9 ? ', 가장 길면 아홉 칸이 모두 한 번씩 켜져요.' : ' 최대 ' + it.max + '개까지예요.') + ' 다 누른 뒤 확인을 눌러요.',
        rule: '칸이 켜진 순서 그대로 눌러요. 다 누른 뒤 확인을 눌러야 채점돼요. 잘못 눌렀으면 확인 전에 하나 지우기로 고쳐요.',
        real: '이제부터 점수에 들어가요. 칸 ' + it.start + '개부터 시작해서 맞히면 하나씩 늘어나고, 같은 길이에서 두 번 틀리면 끝나요.'
      });
    },

    seqspan: function (it, el, done, ctx) {
      const G = BL.tests.cognitive.spanGen, LETTERS = G.letters;
      return spanTask(it, el, done, ctx, {
        gen: function (n) { return G.lns(n); },
        show: function (g, n, p, T, then) {
          el.innerHTML = '<div class="span-stage">' + practiceTag(p) + '<p class="mono muted">' + n + '개 · 잘 보세요</p><div class="span-digit mono" id="digit">&nbsp;</div><p class="muted small">숫자와 자음이 섞여 나와요</p></div>';
          const box = el.querySelector('#digit');
          g.seq.forEach(function (x, i) {
            T(function () { box.textContent = x; box.classList.add('on'); }, 500 + i * 1000);
            T(function () { box.textContent = ' '; box.classList.remove('on'); }, 500 + i * 1000 + 750);
          });
          T(then, 500 + g.seq.length * 1000 + 150);
        },
        /* 응답은 전체 키패드(숫자 1~9, 자음 ㄱ~ㅅ)에서 고른다. 방금 본 것만 버튼으로 주면 외울 필요 없이 정렬만 하면 되어
           기억 과제가 아니게 된다 (실제로 점수가 부풀었던 원인). 누른 버튼은 꺼 두고, 하나 지우면 다시 켠다. */
        ask: function (g, n, p, judge) {
          const btn = function (k) { return '<button class="lns-btn mono" data-v="' + k + '">' + k + '</button>'; };
          el.innerHTML = '<div class="span-stage">' + practiceTag(p) + '<p class="q-prompt">본 것을 떠올려 숫자는 작은 것부터, 그다음 자음은 ㄱㄴㄷ 순서로 누르세요</p>' +
            '<div class="span-slots mono" id="slots" aria-live="polite"></div>' +
            '<div class="lns-pad"><div class="lns-grp"><span class="lns-grp-label mono">숫자</span><div class="lns-btns lns-nums">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(btn).join('') + '</div></div>' +
            '<div class="lns-grp"><span class="lns-grp-label mono">자음</span><div class="lns-btns lns-cons">' + LETTERS.map(btn).join('') + '</div></div></div>' +
            SPAN_INPUT_TOOLS + '</div>';
          const btns = el.querySelectorAll('.lns-btn');
          const inp = spanInput(el, n, { onChange: function (vals) { btns.forEach(function (b) { b.disabled = vals.indexOf(b.getAttribute('data-v')) >= 0; }); } },
            function (vals) { judge(vals.join('') === g.target.join('')); });
          btns.forEach(function (b) { b.addEventListener('click', function () { if (!b.disabled) inp.put(b.getAttribute('data-v')); }); });
          return inp.off;
        },
        answerHtml: function (g) { return '<p class="mono muted">정답 순서: ' + g.target.join(' ') + '</p>'; },
        unit: '개',
        intro: it.start + '개부터 시작해서 맞힐 때마다 하나씩 늘어나요. 같은 길이에서 두 번 틀리면 끝나요. 최대 ' + it.max + '개까지예요. 다 누른 뒤 확인을 눌러요.',
        rule: '숫자를 작은 것부터 먼저 누르고, 그다음 자음을 ㄱㄴㄷ 순서로 눌러요. 예를 들어 7 ㄷ 2 ㄱ이 보였으면 2 7 ㄱ ㄷ을 눌러요. 잘못 눌렀으면 확인 전에 하나 지우기로 고쳐요.',
        real: '이제부터 점수에 들어가요. ' + it.start + '개부터 시작해서 맞히면 하나씩 늘어나고, 같은 길이에서 두 번 틀리면 끝나요.'
      });
    },

    symsearch: function (it, el, done, ctx) {
      const G = BL.tests.cognitive.glyphSVG;
      // 새 문제가 뜬 뒤 GAP ms 안에 들어온 입력은 받지 않고 따로 센다(보지 않고 연타하기·두 번 탭·키 누르고 있기 막기).
      // 정직하게 풀면 문제마다 1~3초가 걸려서 걸리지 않고, 연타는 1초에 최대 4번만 답이 된다.
      const GAP = 250, ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const practiceN = it.practiceTrials || 0;
      let timers = [], correct = 0, wrong = 0, fast = 0, pauses = 0, starts = 0, finished = false, cur = null, tick = null, endAt = 0, left = 0, shownAt = 0, pdone = 0;
      let mode = 'intro';   // intro · practice · run · paused · done
      const T = function (fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; };
      const rnd = function (n) { return Math.floor(Math.random() * n); };
      const sampleN = function (arr, n) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a.slice(0, n); };
      function makeItem() {
        const ids = sampleN(ALL, 7);
        const c = { targets: ids.slice(0, 2), row: ids.slice(2, 7), present: Math.random() < 0.5, hit: -1, lure: -1 };
        if (c.present) { c.hit = rnd(5); c.row[c.hit] = c.targets[rnd(2)]; }
        return c;
      }
      // 연습 문제: 있음과 없음을 번갈아 내고, 없음 문제에는 왼쪽 기호와 모양은 같고 방향만 다른 기호를 꼭 넣는다
      function makePractice(i) {
        const c = makeItem();
        c.present = i % 2 === 0; c.hit = -1; c.lure = -1;
        c.row = sampleN(ALL.filter(function (g) { return c.targets.indexOf(g) < 0; }), 5);
        if (c.present) { c.hit = rnd(5); c.row[c.hit] = c.targets[rnd(2)]; return c; }
        const shape = Math.floor(c.targets[rnd(2)] / 4) * 4;
        const lures = [0, 1, 2, 3].map(function (r) { return shape + r; }).filter(function (g) { return c.targets.indexOf(g) < 0; });
        const lure = lures[rnd(lures.length)];
        c.lure = c.row.indexOf(lure);
        if (c.lure < 0) { c.lure = rnd(5); c.row[c.lure] = lure; }
        return c;
      }
      function mountBoard(head) {
        el.innerHTML = '<div class="ss"><div class="ss-head mono">' + head + '</div>' +
          '<div class="ss-board" id="ss-board"><div class="ss-targets" id="ss-t"></div><div class="ss-div"></div><div class="ss-row" id="ss-r"></div></div>' +
          '<div class="ss-pause" id="ss-pause" hidden></div>' +
          '<div class="crt-btns" id="ss-btns"><button class="btn crt-btn" data-y="1">있음</button><button class="btn crt-btn" data-y="0">없음</button></div>' +
          '<div id="ss-fb"></div>' +
          '<p class="muted small">왼쪽 두 기호 중 하나라도 오른쪽에 똑같은 게 있으면 "있음". 방향이 다르면 다른 기호예요. PC: ← 있음 · → 없음</p></div>';
        el.querySelectorAll('.crt-btn').forEach(function (b) { b.addEventListener('pointerdown', function (e) { e.preventDefault(); answer(b.getAttribute('data-y') === '1'); }); });
      }
      function show(c) {
        cur = c;
        el.querySelector('#ss-t').innerHTML = c.targets.map(G).join('');
        el.querySelector('#ss-r').innerHTML = c.row.map(G).join('');
        shownAt = performance.now();
      }
      function answer(yes) {
        if (!cur || (mode !== 'run' && mode !== 'practice')) return;
        if (performance.now() - shownAt < GAP) { if (mode === 'run') fast++; return; }
        if (mode === 'practice') { practiceFeedback(yes); return; }
        if (yes === cur.present) correct++; else wrong++;
        el.querySelector('#ss-cnt').textContent = (correct + wrong) + '문항';   // 맞힌 수는 끝난 뒤에 보여 준다(앞서 있을 때 멈추는 요령 막기)
        show(makeItem());
      }
      function practiceStep() {
        mode = 'practice';
        mountBoard('<span>연습 ' + (pdone + 1) + ' / ' + practiceN + ' · 점수에 안 들어가요</span><span>시간 제한 없음</span>');
        show(makePractice(pdone));
      }
      function practiceFeedback(yes) {
        const c = cur; cur = null;
        const ok = yes === c.present;
        const glyphs = el.querySelectorAll('#ss-r .glyph');
        const mark = function (i, cls) { if (glyphs[i]) glyphs[i].classList.add(cls); };
        let why;
        if (c.present) { mark(c.hit, 'hit'); why = '오른쪽 ' + (c.hit + 1) + '번째 기호가 왼쪽 기호와 모양도 방향도 똑같아요.'; }
        else if (c.lure >= 0) { mark(c.lure, 'lure'); why = '오른쪽 ' + (c.lure + 1) + '번째 기호는 왼쪽 기호와 모양은 같지만 방향이 달라요. 방향이 다르면 다른 기호예요.'; }
        else why = '오른쪽에 똑같은 기호가 없어요.';
        pdone++;
        const btns = el.querySelector('#ss-btns'); if (btns) btns.hidden = true;
        const fb = el.querySelector('#ss-fb');
        fb.className = 'practice-fb ' + (ok ? 'ok' : 'bad');
        fb.innerHTML = '<p class="practice-title">' + (ok ? '정답이에요.' : '아쉽네요. 정답은 "' + (c.present ? '있음' : '없음') + '"이에요.') + '</p><p class="practice-explain">' + U.esc(why) + '</p>' +
          '<button class="btn btn-primary btn-block" id="ss-next">' + (pdone >= practiceN ? '연습 끝내기' : '다음 연습') + '</button>';
        fb.querySelector('#ss-next').addEventListener('click', function () {
          if (pdone < practiceN) { practiceStep(); return; }
          mode = 'intro';
          practiceEnd(el, it.seconds + '초 동안 최대한 많이, 정확하게 풀어요. 틀린 답은 맞힌 수에서 빼고, 맞힌 수는 끝난 뒤에 알려 드려요.', startRun);
        });
      }
      function startTick() {
        tick = setInterval(function () {
          const l = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
          const tEl = el.querySelector('#ss-time'); if (tEl) { tEl.textContent = l; if (l <= 10) tEl.classList.add('urgent'); }
          if (l <= 0) { clearInterval(tick); tick = null; finish(); }
        }, 200);
      }
      function startRun() {
        starts = markStart(it, ctx);
        mode = 'run';
        mountBoard('<span id="ss-cnt">0문항</span><span id="ss-time">' + it.seconds + '</span>');
        endAt = Date.now() + it.seconds * 1000;
        startTick();
        show(makeItem());
      }
      // 화면을 벗어나면(카톡 알림, 화면 꺼짐) 시간을 멈추고 판을 가린다. 돌아와서 "이어서 하기"를 누르면 남은 시간으로 새 문제부터 이어 간다.
      function setBoard(on) { ['#ss-board', '#ss-btns'].forEach(function (s) { const x = el.querySelector(s); if (x) x.hidden = !on; }); }
      function pause() {
        if (mode !== 'run') return;
        mode = 'paused'; pauses++; cur = null;
        left = Math.max(0, endAt - Date.now());
        if (tick) { clearInterval(tick); tick = null; }
        setBoard(false);
        const p = el.querySelector('#ss-pause');
        if (!p) return;
        p.hidden = false;
        p.innerHTML = '<p>화면을 벗어나서 멈췄어요. 남은 시간 ' + Math.ceil(left / 1000) + '초는 그대로예요.</p><button class="btn btn-primary btn-block" id="ss-resume">이어서 하기</button>';
        p.querySelector('#ss-resume').addEventListener('click', resume);
      }
      function resume() {
        if (mode !== 'paused') return;
        const p = el.querySelector('#ss-pause'); if (p) { p.hidden = true; p.innerHTML = ''; }
        setBoard(true);
        mode = 'run';
        endAt = Date.now() + left;
        startTick();
        show(makeItem());
      }
      function onVis() { if (document.hidden) pause(); }
      function finish() {
        if (finished) return;
        finished = true; mode = 'done'; cur = null;
        el.innerHTML = '<div class="span-stage"><p class="span-fb ok">끝</p><p class="mono muted">정답 ' + correct + ' · 오답 ' + wrong + '</p></div>';
        T(function () { done({ correct: correct, wrong: wrong, fast: fast, pauses: pauses, restarts: starts }); }, 900);
      }
      function onKey(e) {
        if (e.repeat) return;   // 키를 누르고 있을 때 생기는 자동 반복은 답으로 치지 않는다
        if (e.key === 'ArrowLeft' || e.key === '1') answer(true); else if (e.key === 'ArrowRight' || e.key === '2') answer(false);
      }
      document.addEventListener('keydown', onKey);
      document.addEventListener('visibilitychange', onVis);
      // 시작 화면의 그림 예시: 있음 하나, 방향만 다른 기호가 섞인 없음 하나
      const example = function (t, r, at, cls, cap) {
        return '<div class="ss-ex"><div class="ss-ex-board"><span class="ss-ex-g">' + t.map(G).join('') + '</span><span class="ss-div"></span><span class="ss-ex-g">' +
          r.map(function (g, i) { const s = G(g); return i === at ? s.replace('class="glyph"', 'class="glyph ' + cls + '"') : s; }).join('') + '</span></div><p>' + cap + '</p></div>';
      };
      const examples = '<div class="ss-exs">' +
        example([1, 6], [8, 3, 6, 11, 0], 2, 'hit', '<b>있음</b> · 오른쪽 셋째 기호가 왼쪽 둘째 기호와 모양도 방향도 똑같아요.') +
        example([4, 10], [5, 1, 11, 2, 9], 0, 'lure', '<b>없음</b> · 오른쪽 첫째 기호는 왼쪽 첫째와 모양은 같지만 방향이 달라요. 방향이 다르면 다른 기호예요.') + '</div>';
      introCard(el, it, function () { if (practiceN) { pdone = 0; practiceStep(); } else startRun(); },
        it.seconds + '초 동안 해요. 빠르기와 정확도를 같이 봐요. 틀린 답은 맞힌 수에서 빼고, 문제가 바뀌자마자 누른 건 세지 않아요. 정확도가 너무 낮으면 점수 대신 다시 해 달라고 알려 드려요.' +
        (practiceN ? ' 먼저 시간 제한 없이 연습 ' + practiceN + '문제를 풀어요. 연습은 점수에 안 들어가요.' : ''), examples);
      return function () { timers.forEach(clearTimeout); if (tick) clearInterval(tick); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); };
    },

    reaction: function (it, el, done, ctx) {
      const practiceN = it.practiceTrials || 0;
      // 대기 시간: 1초 + 지수분포(평균 1.2초), 5초가 넘으면 다시 뽑는다. 기다린 시간과 상관없이 곧 바뀔 확률이 비슷해서, 박자를 세어 미리 누르는 요령이 통하지 않는다.
      const foreperiod = function () { let x; do { x = 1000 - 1200 * Math.log(1 - Math.random()); } while (x > 5000); return x; };
      const MIN = { t: 150, m: 130, k: 130 }, MAX = 1500;   // 이보다 빠르면 일찍 누름(짐작해서 누른 것), 이보다 느리면 딴 데를 본 것이라 다시 잰다
      let timers = [], times = [], state = 'idle', t0 = 0, finished = false, touches = 0, mouse = 0, early = 0, slow = 0, away = 0, starts = 0, pdone = 0, goId = 0;
      let practice = practiceN > 0;
      const T = function (fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; };
      function pad() { return el.querySelector('#pad'); }
      function count() { return practice ? '연습 ' + Math.min(pdone + 1, practiceN) + ' / ' + practiceN + ' · 점수에 안 들어가요' : times.length + ' / ' + it.trials; }
      function draw(cls, big, small) {
        el.innerHTML = '<div class="rt-wrap"><p class="mono muted">' + count() + '</p>' +
          '<button class="rt-pad ' + cls + '" id="pad"><span class="rt-big">' + big + '</span><span class="rt-small">' + (small || '') + '</span></button></div>';
        pad().addEventListener('pointerdown', onTap);
      }
      function arm() {
        state = 'wait';
        draw('wait', '기다리세요', '화면이 밝아지고 "지금!"이 뜨면 탭');
        T(function () {
          if (state !== 'wait') return;
          const p = pad();
          p.className = 'rt-pad go';
          p.querySelector('.rt-big').textContent = '지금!';
          p.querySelector('.rt-small').textContent = '';
          state = 'go';
          const id = ++goId;
          t0 = performance.now();
          // 신호가 실제로 화면에 그려진 프레임 시각으로 기준점을 당겨 잡는다(그리기 지연이 반응 시간에 섞이지 않게)
          afterPaint(function () { if (state === 'go' && id === goId) t0 = performance.now(); });
        }, foreperiod());
      }
      function retry(cls, big, small, isEarly) {
        if (!practice) { if (isEarly) early++; else slow++; }
        state = 'again'; timers.forEach(clearTimeout); timers = [];
        draw(cls, big, small);
      }
      function onTap(e) {
        e.preventDefault();
        if (finished) return;
        if (state === 'idle' || state === 'shown' || state === 'again') { arm(); return; }
        if (state === 'wait') { retry('early', '너무 빨라요', '"지금!"을 보고 누르세요 · 탭해서 다시', true); return; }
        if (state !== 'go') return;
        const inp = inputOf(e);
        const ms = Math.round(evTime(e) - t0);
        if (ms < MIN[inp]) { retry('early', '너무 빨라요', '신호를 보고 누르세요 · 탭해서 다시', true); return; }
        if (ms > MAX) { retry('early', '조금 늦었어요', '화면을 보고 있다가 바로 누르세요 · 탭해서 다시', false); return; }
        state = 'shown';
        if (practice) {
          pdone++;
          if (pdone >= practiceN) { practice = false; starts = markStart(it, ctx); draw('shown', ms + ' ms', '연습 끝 · 이제 진짜예요 · 탭해서 시작'); }
          else draw('shown', ms + ' ms', '연습이에요 · 탭해서 다음');
          return;
        }
        times.push(ms);
        if (inp === 't') touches++; else mouse++;
        if (times.length >= it.trials) {
          finished = true;
          draw('done', ms + ' ms', '측정 완료');
          T(function () { done({ times: times, touch: touches, mouse: mouse, early: early, slow: slow, away: away, restarts: starts }); }, 800);
        } else {
          draw('shown', ms + ' ms', '탭해서 다음');
        }
      }
      // 화면을 벗어나면 진행 중이던 한 번은 취소하고 다시 잰다(일찍 누름으로 세지 않음)
      function onVis() {
        if (!document.hidden || finished || (state !== 'wait' && state !== 'go')) return;
        if (!practice) away++;
        state = 'again'; timers.forEach(clearTimeout); timers = [];
        draw('idle', '탭해서 다시', '화면을 벗어나서 이번 번은 다시 해요');
      }
      document.addEventListener('visibilitychange', onVis);
      introCard(el, it, function () { if (!practice) starts = markStart(it, ctx); draw('idle', '탭하여 시작', '화면이 밝아지고 "지금!"이 뜨면 최대한 빨리 탭'); },
        it.trials + '번 재요.' + (practiceN ? ' 먼저 연습으로 ' + practiceN + '번 해 봐요. 연습은 점수에 안 들어가요.' : '') +
        ' "지금!"이 뜨기 전이나 뜨자마자 누르면 그 번은 다시 하고 일찍 누름으로 세요. 일찍 누름이 3번 이상이면 평균(100)까지만 인정해요.');
      return function () { timers.forEach(clearTimeout); document.removeEventListener('visibilitychange', onVis); };
    },

    choicert: function (it, el, done, ctx) {
      const practiceN = it.practiceTrials || 0;
      const MIN = { t: 180, m: 150, k: 150 }, MAX = 2000;   // 이보다 빠르면 화살표를 보기 전에 누른 것, 이보다 느리면 딴 데를 본 것이라 그 번은 다시 잰다
      let timers = [], trials = [], state = 'idle', t0 = 0, cur = null, finished = false, fast = 0, slow = 0, away = 0, starts = 0, pdone = 0, goId = 0;
      let practice = practiceN > 0;
      const T = function (fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; };
      function count() { return practice ? '연습 ' + Math.min(pdone + 1, practiceN) + ' / ' + practiceN + ' · 점수에 안 들어가요' : trials.length + ' / ' + it.trials; }
      const onVis = rtAway(el, function () { return !finished && (state === 'wait' || state === 'go'); }, function (discard) { timers.forEach(clearTimeout); timers = []; if (discard && !practice) away++; state = 'away'; }, function () { if (state === 'away' && !finished) next(); });
      function stage() {
        el.innerHTML = '<div class="crt"><p class="mono muted">' + count() + '</p>' +
          '<div class="crt-stim" id="stim"></div>' +
          '<div class="crt-btns"><button class="btn crt-btn" data-d="L">← 왼쪽</button><button class="btn crt-btn" data-d="R">오른쪽 →</button></div></div>';
        el.querySelectorAll('.crt-btn').forEach(function (b) { b.addEventListener('pointerdown', function (e) { e.preventDefault(); answer(b.getAttribute('data-d'), e); }); });
      }
      function msg(text, cls, after) { const s = el.querySelector('#stim'); if (s) { s.textContent = text; s.className = 'crt-stim ' + cls; } T(next, after); }
      function next() {
        if (finished) return;
        if (practice && pdone >= practiceN) { practice = false; practiceEnd(el, '화살표와 같은 쪽 버튼을 최대한 빨리 눌러요. ' + it.trials + '번 해요.', function () { starts = markStart(it, ctx); next(); }); return; }
        if (!practice && trials.length >= it.trials) { finished = true; done({ trials: trials, fast: fast, slow: slow, away: away, restarts: starts }); return; }
        if (document.hidden) { onVis.hold(false); return; }   // 화면이 가려진 채로 다음 번이 시작되려 하면(백그라운드 타이머) 기다린다
        state = 'wait';
        stage();
        T(function () {
          if (state !== 'wait') return;
          if (document.hidden) { onVis.hold(true); return; }
          cur = Math.random() < 0.5 ? 'L' : 'R';
          const s = el.querySelector('#stim');
          s.textContent = cur === 'L' ? '←' : '→';
          s.className = 'crt-stim';
          state = 'go';
          const id = ++goId;
          t0 = performance.now();
          afterPaint(function () { if (state === 'go' && id === goId) t0 = performance.now(); });
          T(function () { if (state === 'go' && id === goId) late(); }, MAX);
        }, 500 + Math.random() * 900);
      }
      function late() { state = 'fb'; if (!practice) slow++; msg('조금 늦었어요 · 다시 해요', 'early', 900); }
      function answer(d, e) {
        if (state !== 'go') return;
        const inp = inputOf(e), rt = Math.round(evTime(e) - t0);
        state = 'fb';
        if (rt < MIN[inp]) { if (!practice) fast++; msg('너무 빨라요', 'early', 600); return; }   // 기록하지 않고 같은 번호를 다시 잰다
        if (rt > MAX) { late(); return; }
        const ok = d === cur;
        if (practice) { pdone++; msg(ok ? '✓' : '화살표와 같은 쪽을 눌러요', ok ? 'ok' : 'early', ok ? 450 : 1200); return; }
        trials.push({ rt: rt, ok: ok, touch: inp === 't', inp: inp });
        msg(ok ? '✓' : '✗', ok ? 'ok' : 'bad', 350);
      }
      function onKey(e) { if (e.repeat) return; if (e.key === 'ArrowLeft') answer('L', e); else if (e.key === 'ArrowRight') answer('R', e); }
      document.addEventListener('keydown', onKey);
      onVis.on();
      introCard(el, it, function () { if (!practice) starts = markStart(it, ctx); next(); },
        it.trials + '번 해요.' + (practiceN ? ' 먼저 연습으로 ' + practiceN + '번 해 봐요. 연습은 점수에 안 들어가요.' : '') +
        ' 화살표가 나오기 전이나 나오자마자 누른 건 세지 않고 다시 해요. 실수 한 번은 봐주고, 그다음부터는 실수마다 속도 점수를 조금씩 깎아요.');
      return function () { timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey); onVis.off(); };
    },

    stroop: function (it, el, done, ctx) {
      // 색각 이상이 있어도 구분되는 조합(Okabe-Ito 팔레트 바탕). 흰 바탕에서 잘 안 보이는 노랑은 쓰지 않는다.
      // 보라는 2026-10-18에 #cc79a7(색상각 327°, 분홍에 가까워 '보라'로 안 읽힘)을 #be6efa(274°)로 바꿨다. 적록·청황 색각 이상 흉내(Machado 2009)에서
      // 네 색 중 가장 헷갈리는 쌍의 색차(CIEDE2000)는 12.2에서 12.4로 그대로이고, 흰 바탕과의 대비는 3.1:1이다. 더 진한 보라는 적록 색각 이상에서 파랑과 겹친다.
      const COLORS = [
        { k: 'blue', ko: '파랑', hex: '#0072b2' }, { k: 'orange', ko: '주황', hex: '#d55e00' },
        { k: 'purple', ko: '보라', hex: '#be6efa' }, { k: 'green', ko: '초록', hex: '#009e73' }
      ];
      const practiceN = it.practiceTrials || 0;
      const MIN = { t: 200, m: 170, k: 170 }, MAX = 3000;
      let timers = [], trials = [], state = 'idle', t0 = 0, cur = null, finished = false, fast = 0, slow = 0, away = 0, starts = 0, pdone = 0, goId = 0;
      let practice = practiceN > 0;
      const T = function (fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; };
      const onVis = rtAway(el, function () { return !finished && (state === 'wait' || state === 'go'); }, function (discard) { timers.forEach(clearTimeout); timers = []; if (discard && !practice) away++; state = 'away'; }, function () { if (state === 'away' && !finished) next(); });
      const shuffle = function (a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
      const plan = [], pplan = [];
      for (let i = 0; i < it.trials; i++) plan.push(i % 2 === 0);
      for (let i = 0; i < practiceN; i++) pplan.push(i % 4 === 2);   // 연습은 글자와 색이 다른 문제 위주
      shuffle(plan); shuffle(pplan);
      function count() { return practice ? '연습 ' + Math.min(pdone + 1, practiceN) + ' / ' + practiceN + ' · 점수에 안 들어가요' : trials.length + ' / ' + it.trials; }
      function stage() {
        el.innerHTML = '<div class="crt"><p class="mono muted">' + count() + '</p>' +
          '<p class="muted small">글자의 색을 고르세요</p><div class="stroop-word" id="stim"></div>' +
          '<div class="stroop-btns">' + COLORS.map(function (c, i) { return '<button class="stroop-btn" data-k="' + c.k + '" style="background:' + c.hex + '" aria-label="' + c.ko + '"><span class="mono">' + (i + 1) + '</span></button>'; }).join('') + '</div></div>';
        el.querySelectorAll('.stroop-btn').forEach(function (b) { b.addEventListener('pointerdown', function (e) { e.preventDefault(); answer(b.getAttribute('data-k'), e); }); });
      }
      function msg(text, color, note, after) { const s = el.querySelector('#stim'); if (s) { s.textContent = text; s.style.color = color; s.classList.toggle('note', !!note); } T(next, after); }
      function next() {
        if (finished) return;
        if (practice && pdone >= practiceN) { practice = false; practiceEnd(el, '글자의 색을 최대한 빨리 골라요. ' + it.trials + '번 해요.', function () { starts = markStart(it, ctx); next(); }); return; }
        if (!practice && trials.length >= it.trials) { finished = true; done({ trials: trials, fast: fast, slow: slow, away: away, restarts: starts }); return; }
        if (document.hidden) { onVis.hold(false); return; }
        state = 'wait';
        stage();
        T(function () {
          if (state !== 'wait') return;
          if (document.hidden) { onVis.hold(true); return; }
          const ink = COLORS[Math.floor(Math.random() * 4)];
          const cong = practice ? pplan[pdone] : plan[trials.length];
          let word = ink;
          if (!cong) { const others = COLORS.filter(function (c) { return c.k !== ink.k; }); word = others[Math.floor(Math.random() * others.length)]; }
          cur = { ink: ink.k, cong: cong };
          const s = el.querySelector('#stim');
          s.textContent = word.ko;
          s.style.color = ink.hex;
          state = 'go';
          const id = ++goId;
          t0 = performance.now();
          afterPaint(function () { if (state === 'go' && id === goId) t0 = performance.now(); });
          T(function () { if (state === 'go' && id === goId) late(); }, MAX);
        }, 400 + Math.random() * 600);
      }
      function late() { state = 'fb'; if (!practice) slow++; msg('조금 늦었어요 · 다시 해요', 'var(--warn)', true, 900); }
      function answer(k, e) {
        if (state !== 'go') return;
        const inp = inputOf(e), rt = Math.round(evTime(e) - t0);
        state = 'fb';
        if (rt < MIN[inp]) { if (!practice) fast++; msg('너무 빨라요', 'var(--warn)', true, 600); return; }
        if (rt > MAX) { late(); return; }
        const ok = k === cur.ink;
        if (practice) { pdone++; msg(ok ? '✓' : '글자 뜻이 아니라 색을 골라요', ok ? 'var(--ok)' : 'var(--warn)', !ok, ok ? 450 : 1400); return; }
        trials.push({ rt: rt, ok: ok, cong: cur.cong, touch: inp === 't', inp: inp });
        msg(ok ? '✓' : '✗', ok ? 'var(--ok)' : 'var(--bad)', false, 350);
      }
      function onKey(e) { if (e.repeat) return; const i = ['1', '2', '3', '4'].indexOf(e.key); if (i >= 0) answer(COLORS[i].k, e); }
      document.addEventListener('keydown', onKey);
      onVis.on();
      introCard(el, it, function () { if (!practice) starts = markStart(it, ctx); next(); },
        it.trials + '번 해요. 절반은 글자와 색이 같고 절반은 달라요.' + (practiceN ? ' 먼저 연습으로 ' + practiceN + '번 해 봐요. 연습은 점수에 안 들어가요.' : '') +
        ' 너무 빨리 누른 건 세지 않고 다시 해요. 글자와 색이 다른 문제에서 실수 한 번은 봐주고, 그다음부터는 실수마다 속도 점수를 조금씩 깎아요.');
      return function () { timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey); onVis.off(); };
    }
  };
  /* ---------- 결과 ---------- */
  function scaleHtml(s, child) {
    const lo = s.range ? s.range[0] : 0, hi = s.range ? s.range[1] : 100;
    const pct = U.clamp((s.value - lo) / (hi - lo) * 100, 0, 100);
    const tick = s.range ? '<div class="bar-tick" style="left:' + ((100 - lo) / (hi - lo) * 100) + '%" title="평균 100"></div>' : '';
    return '<div class="scale' + (child ? ' scale-child' : '') + (s.range ? ' scale-iq' : '') + '"><div class="scale-head"><span>' + U.esc(s.label) + '</span>' +
      '<span class="mono">' + s.value + (s.raw ? ' <small>' + U.esc(s.raw) + '</small>' : '') + (child && s.key ? '<small class="real" data-real="' + U.esc(s.key) + '"></small>' : '') + '</span></div>' +
      '<div class="bar">' + tick + '<div class="bar-fill" style="width:' + pct + '%"></div></div></div>' +
      (s.children && s.children.length ? '<div class="scale-children">' + s.children.map(function (c) { return scaleHtml(c, true); }).join('') + '</div>' : '');
  }
  function reviewHtml(review) {
    if (!review || !review.length) return '';
    return '<details class="review"><summary>틀린 문항 다시 보기 (' + review.length + ')</summary>' + review.map(function (rv) {
      const chosen = rv.chosenHtml ? '<div class="rv-opt">' + rv.chosenHtml + '</div>' : '<span>' + U.esc(rv.chosen == null ? '시간 초과' : rv.chosen) + '</span>';
      const answer = rv.answerHtml ? '<div class="rv-opt">' + rv.answerHtml + '</div>' : '<span>' + U.esc(rv.answer) + '</span>';
      return '<div class="rv"><p class="rv-title mono">' + U.esc(rv.title) + '</p>' +
        (rv.scenario ? '<p class="rv-prompt muted">' + U.esc(rv.scenario) + '</p>' : '') +
        (rv.promptHtml ? '<div class="rv-visual">' + rv.promptHtml + '</div>' : '<p class="rv-prompt">' + U.esc(rv.prompt) + '</p>') +
        '<div class="rv-ans"><div><span class="rv-k">내 답</span>' + chosen + '</div><div><span class="rv-k">정답</span>' + answer + '</div></div>' +
        '<p class="rv-explain">' + U.esc(rv.explain) + '</p></div>';
    }).join('') + '</details>';
  }
  /* 이어서 해 보기: 검사 정의의 related [{ id, why }]를 다른 검사로 가는 카드로 보여 준다 */
  function relatedHtml(t) {
    return (t.related || []).filter(function (x) { return BL.tests[x.id]; }).map(function (x) {
      return '<a class="profile-card profile-link tinted tint-' + x.id + '" href="#/test/' + x.id + '"><span class="eyebrow">이어서 해 보기</span><span class="profile-main">' + U.esc(BL.tests[x.id].title) + '</span><span class="muted small">' + U.esc(x.why) + '</span></a>';
    }).join('');
  }
  /* 익명 통계(js/stats.js): 인지 검사 결과를 처음 볼 때 한 번 안내하고 끌 수 있는 스위치를 준다. 종합 프로필·미리보기에는 안 붙인다. */
  function statsNoticeHtml(t, opts) {
    if (!BL.stats || !BL.stats.available() || t.id !== 'cognitive' || opts.profile || opts.preview || BL.stats.noticed()) return '';
    return '<div class="stats-notice" id="stats-notice"><strong>익명 통계에 참여하고 있어요</strong>' +
      '<p>문항별 정답 여부와 응답 시간을 이름 없이 모아 문항 난이도와 추정 IQ 기준값을 맞추는 데 써요. 문항 내용은 보내지 않고 번호만 보내고, 이름·연락처·IP·기기 식별자는 받지 않아요. ' + BL.stats.MIN_N + '명이 넘으면 결과에 "실제 응시자 기준 상위 %"도 함께 보여 드려요. 안내 페이지에서 언제든 끌 수 있어요.</p>' +
      '<label class="switch"><input type="checkbox" id="stats-opt"' + (BL.stats.enabled() ? ' checked' : '') + '><span>익명 통계에 참여</span></label></div>';
  }
  /* "실제 응시자 n명 기준 상위 %" 자리(집계가 오고 표본이 충분하면 mountStats 가 채운다)와,
     기준값이 실제 응시 자료로 보정된 판이면 "기준값 · 응시자 N명 자료 반영" 줄 */
  function realNormSlot(t, result) {
    if (t.id !== 'cognitive' || !BL.stats) return '';
    const n = BL.stats.normsN(result && result.norms);
    return (n ? '<p class="real-norm">기준값 · 응시자 ' + n + '명 자료 반영</p>' : '') + (BL.stats.available() ? '<p class="real-norm" id="real-overall" hidden></p>' : '');
  }
  function resultHtml(t, result, opts) {
    opts = opts || {};
    const sections = (result.sections || []).map(function (sec) {
      return '<section class="rs"><h3>' + U.esc(sec.title) + '</h3><p>' + U.esc(sec.body) + '</p></section>';
    }).join('');
    return '<div class="wrap result tinted tint-' + t.id + '">' +
      (opts.banner ? '<div class="banner">' + opts.banner + '</div>' : '') +
      '<a class="back" href="#/">← 실험 목록</a>' +
      '<div class="result-hero"><p class="eyebrow">결과 · ' + U.esc(t.title) + (result.modeLabel ? ' · ' + U.esc(result.modeLabel) : '') + (result.at ? ' · ' + U.fmtDate(result.at) : '') + '</p>' +
      '<h1 class="headline">' + U.esc(result.headline) + '</h1>' +
      (result.label ? '<span class="badge">' + U.esc(result.label) + '</span>' : '') + realNormSlot(t, result) + '</div>' +
      '<p class="summary">' + U.esc(result.summary) + '</p>' +
      statsNoticeHtml(t, opts) +
      (result.plot || '') +
      '<div class="scales">' + (result.scales || []).map(function (s) { return scaleHtml(s, false); }).join('') + '</div>' +
      '<div class="actions actions-share">' +
      (BL.card.hasKakao() ? '<button class="btn btn-kakao" id="kakao">카카오톡 공유</button>' : '') +
      '<button class="btn" id="share">공유</button><button class="btn" id="copy">링크 복사</button><button class="btn" id="save">이미지 저장</button></div>' +
      '<p class="action-note muted small" id="note"></p>' +
      (t.merge && !opts.profile ? '<a class="btn btn-block profile-link" href="#/profile/' + t.id + '">종합 프로필 보기 · 따로 푼 과제를 합친 결과</a>' : '') +
      explainHtml(t, result) +
      sections +
      reviewHtml(result.review) +
      relatedHtml(t) +
      '<div class="actions"><a class="btn btn-primary" href="#/test/' + t.id + '">' + (opts.profile ? '다른 과제 풀기' : '다시 하기') + '</a><a class="btn" href="#/">다른 실험</a></div>' +
      '<p class="notice">이 결과는 참고용 자기평가예요. 전문가의 심리검사나 의학적 진단을 대신하지 않고, 점수는 그날의 상태와 환경에 따라 달라질 수 있어요.</p>' +
      '</div>';
  }
  /* 휴대폰용 이미지 저장 창: 결과 이미지를 띄우고 길게 눌러 저장하게 한다. 가능하면 파일 받기·공유로 저장 버튼도 준다. */
  function openImageSheet(r, result, t) {
    const old = document.querySelector('.sheet'); if (old) old.remove();
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', '결과 이미지 저장');
    sheet.innerHTML = '<div class="sheet-card"><h3>결과 이미지</h3>' +
      '<img src="' + r.url + '" alt="' + U.esc(t.title + ' 결과 이미지') + '">' +
      '<p>이미지를 <strong>길게 눌러</strong> "사진에 저장"이나 "이미지 저장"을 고르세요.' + (r.inApp ? ' 카카오톡 같은 앱 안에서는 파일 내려받기가 막혀 있어서 이 방법이 가장 확실해요.' : '') + '</p>' +
      '<div class="sheet-btns">' + (r.canShareFile ? '<button class="btn" id="sheet-share">공유로 저장</button>' : '') + (r.canDownload ? '<button class="btn" id="sheet-dl">파일로 받기</button>' : '') +
      '<button class="btn btn-primary" id="sheet-close">닫기</button></div></div>';
    const close = function () { sheet.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = function (e) { if (!document.body.contains(sheet)) { document.removeEventListener('keydown', onKey); return; } if (e.key === 'Escape') close(); };
    sheet.addEventListener('click', function (e) { if (e.target === sheet) close(); });
    document.addEventListener('keydown', onKey);
    (document.querySelector('.result') || app).appendChild(sheet);
    sheet.querySelector('#sheet-close').addEventListener('click', close);
    const dl = sheet.querySelector('#sheet-dl'); if (dl) dl.addEventListener('click', function () { BL.card.triggerDownload(r.url, r.name); });
    const sh = sheet.querySelector('#sheet-share'); if (sh) sh.addEventListener('click', function () { BL.card.shareFile(r.url, r.name, BL.card.shareText(result, t)); });
    sheet.querySelector('#sheet-close').focus();
  }
  function mountResult(t, result) {
    const note = document.getElementById('note');
    document.getElementById('save').addEventListener('click', function () {
      const r = BL.card.saveImage(result, t);
      note.textContent = r.how === 'downloaded' ? '이미지를 내려받았어요. 다운로드 폴더를 확인해 주세요.' : r.how === 'preview' ? '' : '이미지를 만들지 못했어요. 화면을 캡처해서 저장해 주세요.';
      if (r.how === 'preview') openImageSheet(r, result, t);
    });
    document.getElementById('share').addEventListener('click', function () {
      BL.card.share(result, t).then(function (how) {
        note.textContent = { shared: '공유했어요.', copied: '공유 기능이 없는 브라우저라 결과 텍스트를 복사했어요.', cancel: '', none: '이 브라우저에서는 공유를 지원하지 않아요. 링크 복사나 이미지 저장을 이용해 주세요.', error: '공유에 실패했어요. 링크 복사나 이미지 저장을 이용해 주세요.' }[how] || '';
      });
    });
    document.getElementById('copy').addEventListener('click', function () {
      BL.card.copyLink(result, t).then(function (how) {
        note.textContent = how === 'copied' ? '결과와 사이트 링크를 복사했어요. 카카오톡 대화창에 붙여 넣으세요.' : '복사하지 못했어요. 주소창의 주소를 직접 복사해 주세요.';
      });
    });
    const kakao = document.getElementById('kakao');
    if (kakao) {
      BL.card.preloadKakao();   // 누르는 순간 바로 공유 창을 열 수 있게 미리 불러 둔다
      const KAKAO_MSG = { shared: '', loading: '카카오톡 공유를 준비하고 있어요. 1~2초 뒤에 한 번 더 눌러 주세요.', nokey: '카카오 앱 키가 아직 설정되지 않았어요.', popup: '공유 창이 팝업 차단으로 열리지 않았어요. 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.', error: '카카오톡 공유를 불러오지 못했어요. 링크 복사나 이미지 저장을 이용해 주세요.' };
      kakao.addEventListener('click', function () {
        // 처음 누르면 결과 이미지를 카카오에 올린다. 다 올라갔을 때 "누른 직후" 상태가 아직 살아 있으면(브라우저가 대개 5초까지 쳐 준다)
        // 바로 보내고, 끝났으면 한 번 더 누르게 한다. 그 상태 밖에서 보내면 휴대폰에서 카카오톡이 안 열릴 수 있다.
        const how = BL.card.kakaoShare(result, t, function (state) {
          kakao.disabled = false;
          if (navigator.userActivation && navigator.userActivation.isActive) {
            kakao.textContent = '카카오톡 공유';
            const again = BL.card.kakaoShare(result, t);
            note.textContent = KAKAO_MSG[again] !== undefined ? KAKAO_MSG[again] : KAKAO_MSG.error;
            return;
          }
          kakao.textContent = '카카오톡으로 보내기';
          note.textContent = state === 'ready' ? '결과 이미지가 준비됐어요. 한 번 더 누르면 카카오톡이 열려요.' : '결과 이미지를 올리지 못해서 사이트 대표 이미지로 보낼게요. 한 번 더 눌러 주세요.';
        });
        if (how === 'uploading') { kakao.disabled = true; kakao.textContent = '이미지 준비 중…'; note.textContent = '카카오톡에 함께 보낼 결과 이미지를 올리고 있어요. 잠시만요.'; return; }
        note.textContent = KAKAO_MSG[how] !== undefined ? KAKAO_MSG[how] : KAKAO_MSG.error;
      });
    }
    if (BL.stats && BL.stats.available() && t.id === 'cognitive') return mountStats(result);
  }
  /* 익명 통계: 첫 안내의 스위치를 연결하고, 큐에 든 결과를 보내고, 집계가 오면 임시 기준값 옆에 "실제 응시자 기준 상위 %"를 채운다 */
  function mountStats(result) {
    const notice = document.getElementById('stats-notice');
    if (notice) {
      BL.stats.markNoticed();
      notice.querySelector('#stats-opt').addEventListener('change', function (e) { BL.stats.setEnabled(e.target.checked); });
    }
    // 처음 안내가 보일 때는 끌 시간을 주고 8초 뒤에, 아니면 바로 보낸다. 화면을 먼저 떠나면 그때 보낸다(꺼져 있으면 안 보냄).
    const timer = setTimeout(function () { BL.stats.flush(); }, notice ? 8000 : 300);
    BL.stats.get().then(function (stats) {
      const line = document.getElementById('real-overall');
      if (!stats || !stats.tasks || !line) return;
      const kind = result.coverage ? null : BL.stats.modeKind(result.mode);   // 종합 프로필은 과제별로만 비교
      const dist = kind === 'task' ? (stats.tasks[result.mode.slice(5)] || {}).z : kind ? (stats.overall || {})[kind] : null;
      const tp = BL.stats.topPct(result.z, dist);
      if (tp) { line.textContent = '실제 응시자 ' + tp.n + '명 기준 상위 ' + tp.top + '% (표준 시간으로 푼 사람들과 비교)'; line.hidden = false; }
      document.querySelectorAll('[data-real]').forEach(function (el) {
        const k = el.getAttribute('data-real'), task = result.tasks && result.tasks[k];
        const r = task ? BL.stats.topPct(task.z, stats.tasks[k] && stats.tasks[k].z) : null;
        if (r) el.textContent = '· 실제 상위 ' + r.top + '% (' + r.n + '명)';
      });
    });
    return function () { clearTimeout(timer); BL.stats.flush(); };
  }
  function renderResult(id, idx) {
    const t = BL.tests[id];
    if (idx === 'last') {
      if (!lastResult || lastResult.testId !== id) { go('#/test/' + id); return; }
      setScreen(resultHtml(t, lastResult, { banner: '이 브라우저는 저장이 꺼져 있어 결과가 기록에 남지 않아요. 창을 닫기 전에 이미지로 저장해 두세요.' }), function () { mountResult(t, lastResult); });
      return;
    }
    const all = results();
    const result = all[Number(idx)];
    if (!result || result.testId !== id) { go('#/test/' + id); return; }
    const view = withComparison(t, result, all.slice(0, Number(idx)));
    setScreen(resultHtml(t, view), function () { mountResult(t, view); });
  }
  /* 같은 검사의 직전 결과와 비교하는 항목을 맨 앞에 덧붙인다 (표시용, 저장하지 않음) */
  function withComparison(t, result, earlier) {
    const prev = earlier.filter(function (r) { return r && r.testId === t.id; }).pop();
    if (!prev) return result;
    const iq = function (z) { return Math.round(U.clamp(100 + 15 * z, 55, 145)); };
    const delta = function (a, b) { return a + ' → ' + b + ' (' + (b - a >= 0 ? '+' : '') + (b - a) + ')'; };
    const lines = [];
    if (result.tasks && prev.tasks) {
      const labelOf = function (k) {
        let l = k;
        (result.scales || []).forEach(function (s) { if (s.key === k) l = s.label; (s.children || []).forEach(function (c) { if (c.key === k) l = c.label; }); });
        return l;
      };
      const scored = function (x) { return x && !x.invalid && typeof x.z === 'number'; };   // 측정 안 된 과제는 비교하지 않는다
      Object.keys(result.tasks).forEach(function (k) { if (scored(prev.tasks[k]) && scored(result.tasks[k])) lines.push(labelOf(k) + ' ' + delta(iq(prev.tasks[k].z), iq(result.tasks[k].z))); });
    } else {
      (result.scales || []).forEach(function (s) {
        const p = (prev.scales || []).filter(function (x) { return x.key === s.key; })[0];
        if (p) lines.push(s.label + ' ' + delta(p.value, s.value));
      });
    }
    if (!lines.length) return result;
    const copy = Object.assign({}, result);
    copy.sections = [{ title: '지난 결과와 비교 (' + U.fmtDate(prev.at) + ')', body: lines.join(' · ') + '. 같은 과제를 다시 풀면 익숙해져서 오르는 것이 보통이니, 큰 차이만 의미 있게 보세요.' }].concat(result.sections || []);
    return copy;
  }

  function renderProfile(id) {
    const t = BL.tests[id];
    const merged = t.merge(results());
    if (!merged) {
      setScreen('<div class="wrap tinted tint-' + id + '"><a class="back" href="#/test/' + id + '">← ' + U.esc(t.title) + '</a><p class="eyebrow">' + U.esc(t.title) + '</p><h1 class="title">종합 프로필</h1><p class="empty">아직 합칠 결과가 없어요. 과제를 하나라도 풀면 여기에 모여요.</p><a class="btn btn-primary btn-block" href="#/test/' + id + '">과제 고르러 가기</a></div>');
      return;
    }
    merged.testId = id; merged.at = Date.now();
    setScreen(resultHtml(t, merged, { profile: true, banner: '종합 프로필 · 과제별 가장 최근 결과를 합친 값이에요. 과제를 다시 풀면 자동으로 갱신돼요.' }), function () { mountResult(t, merged); });
  }

  function randomAnswer(it, r) {
    if (it.type === 'choice') return r.int(0, (it.options || it.optionsHtml).length - 1);
    if (it.type === 'likert') return r.int(1, 5);
    if (it.type === 'digitspan' || it.type === 'gridspan' || it.type === 'seqspan') {
      // 기억 폭 과제: 맞힌 길이마다 가끔 두 번째 시도에서 맞히고, 다음 길이에서 두 번 틀려 끝나는 시행 기록
      const best = r.int(it.start - 1, it.max), log = [];
      for (let L = it.start; L <= best; L++) { if (r.next() < 0.3) log.push([L, 0]); log.push([L, 1]); }
      if (best < it.max) log.push([best + 1, 0], [best + 1, 0]);
      return { best: best, log: log, restarts: 0 };
    }
    if (it.type === 'symsearch') return { correct: r.int(14, 34), wrong: r.int(0, 4) };
    if (it.type === 'reaction') { const n = it.trials || 5; const times = []; for (let i = 0; i < n; i++) times.push(r.int(190, 380)); return { times: times, touch: 0, mouse: n, early: r.int(0, 2) }; }
    if (it.type === 'choicert') { const a = []; for (let i = 0; i < it.trials; i++) a.push({ rt: r.int(320, 650), ok: r.next() < 0.95, inp: 'k' }); return { trials: a, fast: 0 }; }
    if (it.type === 'stroop') { const a = []; for (let i = 0; i < it.trials; i++) { const cong = i % 2 === 0; a.push({ rt: r.int(cong ? 500 : 650, cong ? 850 : 1050), ok: r.next() < 0.92, cong: cong, inp: 'k' }); } return { trials: a, fast: 0 }; }
    return null;
  }
  /* ---------- 문항 갤러리 (검수용, 저장 안 됨): #/gallery/<과제 키>/<단계 또는 all>[/<단계당 개수>] ---------- */
  function renderGallery(key, level, n) {
    const t = BL.tests.cognitive;
    const tk = t.tasks.filter(function (k) { return k.key === key; })[0];
    if (!tk) return go('#/');
    const MAXL = { matrix: 6, figAnalogy: 5, series: 3, sequence: 5, weights: 5, rotation: 5, fold: 5, blocks: 5 };
    const cnt = Math.min(12, parseInt(n, 10) || (level === 'all' ? 1 : 4));
    const levels = level === 'all' ? Array.from({ length: MAXL[key] || 5 }, function (_, i) { return i + 1; }) : [Math.max(1, parseInt(level, 10) || 1)];
    setScreen('<div class="wrap"><a class="back" href="#/">← 실험 목록</a><p class="eyebrow mono">GALLERY · 검수용</p><h1 class="title">' + U.esc(tk.label) + ' · ' + (level === 'all' ? '모든 단계' : levels[0] + '단계') + ' · 단계당 ' + cnt + '문항</h1><div id="gal"></div></div>', function () {
      const g = document.getElementById('gal');
      const cleanups = [];   // 문항마다 붙는 키보드 리스너를 화면을 떠날 때 모두 뗀다
      levels.forEach(function (lv) {
        for (let i = 0; i < cnt; i++) {
          const stub = { type: 'adaptive', part: key, scored: false, count: 999, noHistory: true, state: { done: 0, level: lv, max: lv, used: [], levels: [], oks: [] } };
          const it = t.adaptNext(stub);
          if (!it) return;
          it.practice = true;
          const box = document.createElement('div'); box.className = 'gal-item';
          box.innerHTML = '<p class="mono muted small">' + lv + '단계 #' + (i + 1) + ' · 정답 ' + (it.answer + 1) + '번 · ' + U.esc(it.explain || '') + '</p>';
          const el = document.createElement('div'); box.appendChild(el); g.appendChild(box);
          const c = RENDER.choice(it, el, function () {}, { timeFactor: 0 });
          if (typeof c === 'function') cleanups.push(c);
          const ans = el.querySelector('.opt[data-i="' + it.answer + '"]'); if (ans) ans.classList.add('correct');
        }
      });
      return function () { cleanups.forEach(function (c) { try { c(); } catch (e) { } }); };
    });
  }
  function renderPreview(id, mode) {
    const t = BL.tests[id];
    const r = U.rng();
    const items = t.build(mode);
    const answers = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.type === 'adaptive') { const nx = t.adaptNext ? t.adaptNext(it) : null; if (nx) { items.splice(i, 0, nx); i -= 1; } continue; }
      answers[i] = randomAnswer(it, r);
      if (it.adaptive && t.adaptRecord) t.adaptRecord(items[i + 1], it, answers[i]);
    }
    const result = t.score(answers, items, { times: items.map(function () { return r.int(4000, 20000); }), mode: mode });
    result.testId = id; result.at = Date.now();
    setScreen(resultHtml(t, result, { banner: '미리보기 · 무작위 응답으로 만든 결과예요. 저장되지 않아요.', preview: true }), function () { mountResult(t, result); });
  }

  /* ---------- 기록 ---------- */
  function renderHistory() {
    const all = results();
    const rows = all.map(function (r, i) { return rowHtml(r, i); }).reverse().join('');
    setScreen(
      '<div class="wrap">' +
      '<a class="back" href="#/">← 실험 목록</a>' +
      '<p class="eyebrow">이 브라우저에 남은 결과</p><h1 class="title">내 기록</h1>' +
      (rows ? '<div class="rows">' + rows + '</div><button class="btn btn-ghost btn-block" id="clear">기록 모두 삭제</button>' : '<p class="empty">아직 기록이 없어요. 첫 실험을 시작해 보세요.</p>') +
      '<p class="notice">기록은 이 브라우저의 저장 공간에만 있어요. 브라우저 데이터를 지우면 함께 사라져요.</p>' +
      '</div>',
      function () {
        const btn = document.getElementById('clear');
        if (btn) btn.addEventListener('click', function () {
          if (confirm('모든 기록을 삭제할까요? 되돌릴 수 없어요.')) { U.store.remove(STORE_KEY); renderHistory(); }
        });
      }
    );
  }

  /* ---------- 안내 ---------- */
  function renderAbout() {
    setScreen(
      '<div class="wrap about">' +
      '<a class="back" href="#/">← 실험 목록</a>' +
      '<p class="eyebrow">무료 · 로그인 없음</p><h1 class="title">두뇌실험실 안내</h1>' +
      '<section class="rs"><h3>무엇을 하는 곳인가요</h3><p>머리 쓰는 힘, 감정 다루는 힘, 성격, 연애 패턴, 끌리는 일을 스스로 재 보는 곳이에요. 돈을 받지 않고 로그인도 없어요. 문항은 전부 이 사이트를 위해 직접 만들었거나, 누구나 쓸 수 있게 공개된 문항을 우리말로 옮긴 거예요.</p></section>' +
      '<section class="rs"><h3>검사는 어떻게 만들었나요</h3><p>인지 능력 검사는 지능 연구에서 오래 쓰인 과제 형식을 따라요. 규칙 찾기(도형 행렬, 도형 유추, 도형 계열, 수열, 저울 추론), 언어(유추, 어휘, 논리, 공통점 찾기), 공간(도형 회전, 전개도 접기, 블록 세기), 기억(숫자 앞으로와 거꾸로, 위치, 숫자-문자 순서), 속도와 주의(단순 반응, 선택 반응, 색-단어 간섭, 기호 찾기)예요. 도형과 숫자 문제는 규칙을 바탕으로 매번 새로 만들어져요.</p><p>정서 지능 검사는 감정을 알아채고, 쓰고, 이해하고, 다루는 네 갈래로 보는 모델을 틀로 삼고, 갈래마다 두 가지를 상황 판단 문제로 재요.</p><p>성격 검사는 빅파이브 모델을 따르고, 문항은 공개된 국제 성격 문항(IPIP)을 번역해서 손봤어요.</p><p>연애 애착 유형 검사는 성인 애착을 불안과 회피 두 축으로 보는 모델을 바탕으로, 축마다 세 가지 패턴을 봐요.</p><p>진로 흥미 유형 검사는 심리학자 존 홀랜드의 여섯 가지 흥미 유형(현실·탐구·예술·사회·진취·관습)을 틀로 삼아, 유형마다 두 갈래씩 해 보고 싶은 활동으로 재요. 문항은 이 사이트를 위해 직접 썼어요. 흥미는 하고 싶은 마음이라서 적성이나 능력과는 달라요.</p><p>연애 스타일 검사는 사회학자 존 리가 나눈 사랑의 여섯 가지 스타일(에로스, 루두스, 스토르게, 프래그마, 마니아, 아가페)을 틀로 삼고, 문항은 이 사이트를 위해 직접 썼어요.</p></section>' +
      '<section class="rs"><h3>점수는 어디에 쓰면 좋나요</h3><p>검사를 마치면 결과 화면에서 그 능력이나 성향이 생활 어디에 쓰이고 어떤 영향을 주는지 함께 보여 드려요. 결과는 "내가 뭘 잘하고 뭘 연습하면 좋은지" 감을 잡는 용도로 보면 딱 좋아요. 사람을 평가하거나 줄 세우는 데 쓰라고 만든 게 아니에요.</p></section>' +
      '<section class="rs"><h3>한계</h3><p>모든 결과는 참고용이에요. 많은 사람에게 실시해서 검증한 공인 검사가 아니고, 공식 IQ나 진단을 내주지 않아요. 점수는 그날 컨디션, 기기, 환경에 따라 달라져요. 마음 건강이 걱정된다면 전문가와 상담하세요.</p></section>' +
      '<section class="rs"><h3>개인정보</h3><p>이름, 생년월일, 연락처를 묻지 않아요. 결과 기록은 이 브라우저에 저장돼요. ' + (BL.stats && BL.stats.available() ? '인지 능력 검사는 문항별 정답 여부를 이름 없이 모아 난이도를 맞추는 데 써요(아래 \u0022익명 통계\u0022에서 끌 수 있어요). ' : '') + '카카오톡 공유를 누를 때만, 함께 보낼 결과 이미지가 카카오 서버에 올라가요. "내 기록"에서 언제든 지울 수 있어요.</p></section>' +
      statsAboutHtml() +
      '</div>',
      function () { const c = document.getElementById('stats-opt'); if (c) c.addEventListener('change', function (e) { BL.stats.setEnabled(e.target.checked); }); }
    );
  }
  /* 안내 페이지의 익명 통계 설명과 스위치 (수집 서버 주소가 설정돼 있을 때만) */
  function statsAboutHtml() {
    if (!BL.stats || !BL.stats.available()) return '';
    return '<section class="rs"><h3>익명 통계</h3><p>인지 능력 검사의 문항별 정답 여부를 이름 없이 모아 문항 난이도와 추정 IQ 기준값을 실제 응시자에 맞게 맞추는 데 써요.</p>' +
      '<p>보내는 것: 문항 번호(그때그때 만드는 도형·숫자 문제는 난이도 단계), 맞았는지, 응답 시간, 과제별 점수(기억 폭, 반응 시간), 검사 종류와 시간 설정, 터치인지 마우스인지. 서버는 날짜만 일 단위로 남겨요.</p>' +
      '<p>보내지 않는 것: 이름, 연락처, IP 주소, 기기 식별자, 정확한 시각, 문항 내용. 결과마다 새로 만든 무작위 번호만 붙여서, 보낸 자료를 나와 연결할 방법이 없어요. 자료가 ' + BL.stats.MIN_N + '명이 넘으면 결과 화면에 "실제 응시자 기준 상위 %"를 함께 보여 드려요.</p>' +
      '<label class="switch"><input type="checkbox" id="stats-opt"' + (BL.stats.enabled() ? ' checked' : '') + '><span>익명 통계에 참여</span></label></section>';
  }

  window.addEventListener('hashchange', route);
  route();
  if (BL.stats && BL.stats.available()) {
    const foot = document.getElementById('stats-foot'); if (foot) foot.hidden = false;   // 푸터의 익명 통계 문장은 수집 서버가 설정돼 있을 때만
    BL.stats.flush();   // 아직 못 보낸 익명 통계가 있으면 보낸다
  }
})();
