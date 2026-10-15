/* 두뇌실험실 · 화면 엔진 (해시 라우팅, 문항 렌더러, 결과 화면) */
(function () {
  const U = BL.util;
  const app = document.getElementById('app');
  const ORDER = ['cognitive', 'eq', 'personality', 'attachment'];
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

  function setScreen(html, mount) {
    if (cleanup) { try { cleanup(); } catch (e) { } cleanup = null; }
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
    const t = BL.tests[id];
    return '<a class="test-card" href="#/test/' + id + '">' +
      '<div class="test-card-top"><span class="mono num">' + U.pad2(t.num) + '</span><span class="tag tag-' + t.kind + '">' + U.esc(t.kindLabel) + '</span></div>' +
      '<h2>' + U.esc(t.title) + '</h2>' +
      '<p>' + U.esc(t.subtitle) + '</p>' +
      '<div class="test-card-meta mono">' + U.esc(t.duration) + ' · ' + U.esc(t.length) + '</div>' +
      '</a>';
  }
  function rowHtml(r, idx) {
    const t = BL.tests[r.testId];
    if (!t) return '';
    return '<a class="row" href="#/result/' + t.id + '/' + idx + '"><span class="row-title">' + U.esc(t.title) + (r.modeLabel ? ' · ' + U.esc(r.modeLabel) : '') + '</span><span class="row-sub">' + U.esc(r.headline) + (r.label ? ' · ' + U.esc(r.label) : '') + '</span><span class="row-date mono">' + U.fmtDate(r.at) + '</span></a>';
  }
  function renderHome() {
    const all = results();
    const recent = all.map(function (r, i) { return { r: r, i: i }; }).slice(-3).reverse();
    const recentHtml = recent.length ? '<section class="block"><div class="block-head"><h3>최근 기록</h3><a href="#/history" class="link">전체 보기</a></div>' +
      recent.map(function (x) { return rowHtml(x.r, x.i); }).join('') + '</section>' : '';
    const cog = BL.tests.cognitive && BL.tests.cognitive.merge ? BL.tests.cognitive.merge(all) : null;
    const profileHtml = cog ? '<a class="profile-card" href="#/profile/cognitive"><span class="eyebrow mono">인지 종합 프로필</span><span class="profile-main">' + U.esc(cog.headline) + '</span><span class="muted small">' + U.esc(cog.label) + ' · ' + cog.coverage.done + '/' + cog.coverage.total + ' 과제 반영</span></a>' : '';
    setScreen(
      '<div class="wrap">' +
      '<section class="hero">' +
      '<img class="hero-banner" src="banner.svg" alt="두뇌실험실 배너" width="1200" height="420">' +
      '<p class="eyebrow mono">무료 · 로그인 없음</p>' +
      '<h1>나를 측정하는<br><em>네 가지 실험</em></h1>' +
      '<p class="lead">머리가 얼마나 잘 돌아가는지, 남의 기분을 얼마나 잘 읽는지, 나는 어떤 성격이고 연애할 때는 어떤 사람인지. 검사마다 그 능력이 생활 어디에 쓰이는지도 같이 알려 드려요. 결과는 내 폰이나 컴퓨터에만 남아요.</p>' +
      '</section>' +
      '<section class="grid">' + ORDER.map(testCard).join('') + '</section>' +
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
            return '<button class="task-chip' + (d ? ' done' : '') + '" data-mode="task:' + k.key + '"><span>' + U.esc(k.label) + '</span><span class="mono">' + (d ? 'IQ ' + Math.round(U.clamp(100 + 15 * d.z, 55, 145)) : '약 ' + k.minutes + '분') + '</span></button>';
          }).join('') + '</div></div>';
      }).join('');
  }
  /* 결과 화면: 이 검사가 잰 능력·성향이 무엇이고 일상 어디에 쓰이는지. 결과에 나온 영역만 보여 준다. */
  function explainHtml(t, result) {
    if (!t.explain || !t.explain.length) return '';
    const scales = (result && result.scales) || [];
    const labels = [];
    scales.forEach(function (s) { labels.push(s.label); (s.children || []).forEach(function (c) { labels.push(c.label); }); });
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
      ? '<div class="time-set"><span class="modes-label">제한 시간</span><div class="seg">' + [[1, '표준'], [1.5, '여유 ×1.5'], [0, '무제한']].map(function (o) { return '<button class="seg-btn' + (tf === o[0] ? ' on' : '') + '" data-tf="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div><span class="muted small">여유나 무제한으로 풀면 점수가 조금 높게 나올 수 있어서, 결과에 그렇게 풀었다고 표시돼요.</span></div>'
      : '';
    const startHtml = modes
      ? '<p class="modes-label">한 번에 풀기</p><div class="modes">' + modes.map(function (m) {
        return '<button class="mode" data-mode="' + m.id + '"><span class="mode-title">' + U.esc(m.label) + '</span><span class="mode-desc">' + U.esc(m.desc) + '</span><span class="mode-meta mono">' + U.esc(m.duration) + ' · ' + U.esc(m.length) + '</span></button>';
      }).join('') + '</div>' + taskGridHtml(t)
      : '<button class="btn btn-primary btn-block" id="start">시작하기</button>';
    setScreen(
      '<div class="wrap">' +
      '<a class="back" href="#/">← 실험 목록</a>' +
      '<p class="eyebrow mono">EXPERIMENT ' + U.pad2(t.num) + ' · ' + U.esc(t.kindLabel) + '</p>' +
      '<h1 class="title">' + U.esc(t.title) + '</h1>' +
      '<p class="lead">' + U.esc(t.subtitle) + '</p>' +
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
    const scoredTotal = session.items.filter(function (x) { return x.scored; }).length + pending;
    const scoredDone = session.items.slice(0, session.index).filter(function (x) { return x.scored; }).length;
    const pct = Math.round(scoredDone / scoredTotal * 100);
    const chrome = '<div class="run-head"><a class="run-title" href="#/test/' + id + '">' + U.esc(t.title) + '</a>' +
      '<span class="run-count mono">' + (scoredDone + (it.scored ? 1 : 0)) + ' / ' + scoredTotal + '</span></div>' +
      '<div class="progress"><div class="progress-bar" style="width:' + pct + '%"></div></div>';
    setScreen('<div class="wrap run">' + chrome + '<div id="item" class="item"></div></div>', function () {
      session.shownAt = Date.now();
      return RENDER[it.type](it, document.getElementById('item'), function (answer) {
        session.answers[session.index] = answer;
        session.times[session.index] = Date.now() - session.shownAt;
        if (it.adaptive && t.adaptRecord) t.adaptRecord(session.items[session.index + 1], it, answer);
        session.index += 1;
        saveSession();
        renderRun(id);
      }, { timeFactor: session.timeFactor });
    });
  }

  function finish() {
    const t = BL.tests[session.id];
    const result = t.score(session.answers, session.items, { times: session.times, mode: session.mode });
    if (t.timed && typeof session.timeFactor === 'number' && session.timeFactor !== 1) {
      result.timeFactor = session.timeFactor;
      result.modeLabel = (result.modeLabel || '') + (session.timeFactor === 0 ? ' · 시간 무제한' : ' · 시간 여유 ×' + session.timeFactor);
      (result.sections = result.sections || []).push({ title: '시간 설정', body: session.timeFactor === 0
        ? '제한 시간 없이 풀었어요. 기준값은 표준 시간 기준이라 추정 IQ가 실제보다 높게 나올 수 있어요.'
        : '제한 시간을 표준의 ' + session.timeFactor + '배로 두고 풀었어요. 기준값은 표준 시간 기준이라 추정 IQ가 조금 높게 나올 수 있어요.' });
    }
    result.testId = session.id;
    result.mode = session.mode;
    result.at = Date.now();
    result.elapsed = Date.now() - session.startedAt;
    let all = results();
    all.push(result);
    if (all.length > MAX_RESULTS) all = all.slice(all.length - MAX_RESULTS);
    const saved = U.store.set(STORE_KEY, all);
    lastResult = result;
    session = null;
    U.sstore.remove(SESSION_KEY);
    go('#/result/' + t.id + '/' + (saved ? all.length - 1 : 'last'));
  }

  /* ---------- 문항 렌더러 ---------- */
  function introCard(el, it, onStart, extra) {
    el.innerHTML = '<div class="section-card"><p class="eyebrow mono">TASK</p><h2>' + U.esc(it.title) + '</h2><p>' + U.esc(it.desc) + '</p>' +
      (extra ? '<p class="muted small">' + U.esc(extra) + '</p>' : '') +
      '<button class="btn btn-primary btn-block" id="go">시작</button></div>';
    el.querySelector('#go').addEventListener('click', onStart);
  }

  const RENDER = {
    section: function (it, el, done) {
      el.innerHTML = '<div class="section-card' + (it.sub ? ' section-sub' : '') + '">' +
        '<p class="eyebrow mono">' + (it.sub ? 'TASK' : 'PART ' + it.num) + '</p>' +
        '<h2>' + U.esc(it.title) + '</h2>' +
        '<p>' + U.esc(it.desc) + '</p>' +
        (it.where ? '<p class="where"><span class="mono">일상에서</span>' + U.esc(it.where) + '</p>' : '') +
        (it.count ? '<p class="mono muted small">' + U.esc(it.count) + '</p>' : '') +
        '<button class="btn btn-primary btn-block" id="go">' + (it.sub ? '시작' : '다음') + '</button></div>';
      el.querySelector('#go').addEventListener('click', function () { done(null); });
    },

    choice: function (it, el, done, ctx) {
      let answered = false, gone = false, timer = null, tick = null;
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
        box.innerHTML = '<p class="practice-title">' + (ok ? '정답이에요.' : '아쉽네요. 정답은 ' + (it.answer + 1) + '번이에요.') + '</p>' +
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
        if (answered || gone) return;
        answered = true;
        if (timer) clearTimeout(timer);
        if (tick) clearInterval(tick);
        const b = el.querySelector('.opt[data-i="' + i + '"]');
        if (b) b.classList.add('selected');
        if (it.practice) { showPractice(i); return; }
        setTimeout(function () { if (!gone) done(i); }, 180);
      };
      el.querySelectorAll('.opt').forEach(function (b) {
        b.addEventListener('click', function () { pick(Number(b.getAttribute('data-i'))); });
      });
      const onKey = function (e) {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= opts.length && !e.ctrlKey && !e.metaKey && !e.altKey) pick(n - 1);
      };
      document.addEventListener('keydown', onKey);
      if (limit) {
        const bar = el.querySelector('#tbar'), num = el.querySelector('#tnum'), row = el.querySelector('.timer-row');
        bar.style.width = '100%';
        bar.getBoundingClientRect();
        bar.style.transition = 'width ' + limit + 's linear';
        bar.style.width = '0%';
        const t0 = Date.now();
        tick = setInterval(function () {
          const left = Math.max(0, limit - Math.round((Date.now() - t0) / 1000));
          num.textContent = left;
          if (left <= 10) row.classList.add('urgent');
        }, 250);
        timer = setTimeout(function () { if (answered || gone) return; answered = true; if (tick) clearInterval(tick); done(null); }, limit * 1000);
      }
      return function () { gone = true; if (timer) clearTimeout(timer); if (tick) clearInterval(tick); document.removeEventListener('keydown', onKey); };
    },

    likert: function (it, el, done) {
      const labels = it.labels || ['전혀 아니다', '아니다', '보통이다', '그렇다', '매우 그렇다'];
      let finished = false;
      el.innerHTML = '<p class="q-prompt q-likert">' + U.esc(it.text) + '</p>' +
        '<div class="likert">' + labels.map(function (l, i) {
          return '<button class="lk lk-' + (i + 1) + '" data-v="' + (i + 1) + '"><span class="lk-dot"></span><span class="lk-label">' + U.esc(l) + '</span></button>';
        }).join('') + '</div>';
      let gone = false;
      const pick = function (v) {
        if (finished || gone) return;
        finished = true;
        const b = el.querySelector('.lk[data-v="' + v + '"]');
        if (b) b.classList.add('selected');
        setTimeout(function () { if (!gone) done(v); }, 150);
      };
      el.querySelectorAll('.lk').forEach(function (b) {
        b.addEventListener('click', function () { pick(Number(b.getAttribute('data-v'))); });
      });
      const onKey = function (e) { const n = parseInt(e.key, 10); if (n >= 1 && n <= 5) pick(n); };
      document.addEventListener('keydown', onKey);
      return function () { gone = true; document.removeEventListener('keydown', onKey); };
    },

    digitspan: function (it, el, done) {
      let timers = [];
      const T = function (fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; };
      let len = it.start, fails = 0, best = it.start - 1, finished = false;
      function genDigits(n) {
        const d = [];
        while (d.length < n) { const x = Math.floor(Math.random() * 10); if (d.length && d[d.length - 1] === x) continue; d.push(x); }
        return d;
      }
      function trial() {
        const digits = genDigits(len);
        el.innerHTML = '<div class="span-stage"><p class="mono muted">' + len + '자리 · ' + (it.mode === 'backward' ? '거꾸로' : '순서대로') + '</p><div class="span-digit mono" id="digit">&nbsp;</div><p class="muted small">숫자를 잘 보세요</p></div>';
        const box = el.querySelector('#digit');
        digits.forEach(function (d, i) {
          T(function () { box.textContent = String(d); box.classList.add('on'); }, 500 + i * 1000);
          T(function () { box.textContent = ' '; box.classList.remove('on'); }, 500 + i * 1000 + 750);
        });
        T(function () { ask(digits); }, 500 + digits.length * 1000 + 150);
      }
      function ask(digits) {
        const expect = (it.mode === 'backward' ? digits.slice().reverse() : digits).join('');
        el.innerHTML = '<div class="span-stage"><p class="q-prompt">' + (it.mode === 'backward' ? '거꾸로 뒤집어' : '보인 순서대로') + ' 입력하세요</p>' +
          '<input id="inp" class="span-input mono" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="' + len + '" aria-label="숫자 입력">' +
          '<button class="btn btn-primary btn-block" id="ok">확인</button></div>';
        const inp = el.querySelector('#inp');
        setTimeout(function () { inp.focus(); }, 50);
        let submitted = false;
        const submit = function () {
          const v = inp.value.replace(/\D/g, '');
          if (!v || submitted) return;
          submitted = true;
          const ok = v === expect;
          el.innerHTML = '<div class="span-stage"><p class="span-fb ' + (ok ? 'ok' : 'bad') + '">' + (ok ? '정답' : '오답') + '</p>' +
            (ok ? '' : '<p class="mono muted">정답은 ' + expect.split('').join(' ') + '</p>') + '</div>';
          if (ok) { best = len; fails = 0; len += 1; } else { fails += 1; }
          if (len > it.max || fails >= 2) T(end, 1000); else T(trial, 1000);
        };
        el.querySelector('#ok').addEventListener('click', submit);
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      }
      function end() { if (finished) return; finished = true; done(best); }
      introCard(el, it, trial, it.start + '자리부터 시작해 맞힐 때마다 한 자리씩 늘어납니다. 최대 ' + it.max + '자리.');
      return function () { timers.forEach(clearTimeout); };
    },

    gridspan: function (it, el, done) {
      let timers = [];
      const T = function (fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; };
      let len = it.start, fails = 0, best = it.start - 1, finished = false;
      function gridHtml(cls) {
        let h = '<div class="gspan ' + cls + '">';
        for (let i = 0; i < 9; i++) h += '<button class="gcell" data-i="' + i + '" aria-label="칸 ' + (i + 1) + '"></button>';
        return h + '</div>';
      }
      function trial() {
        const seq = [];
        while (seq.length < len) { const x = Math.floor(Math.random() * 9); if (seq.length && seq[seq.length - 1] === x) continue; seq.push(x); }
        el.innerHTML = '<div class="span-stage"><p class="mono muted">' + len + '칸 · 잘 보세요</p>' + gridHtml('show') + '</div>';
        const cells = el.querySelectorAll('.gcell');
        seq.forEach(function (c, i) {
          T(function () { cells[c].classList.add('on'); }, 500 + i * 900);
          T(function () { cells[c].classList.remove('on'); }, 500 + i * 900 + 600);
        });
        T(function () { ask(seq); }, 500 + seq.length * 900 + 200);
      }
      function ask(seq) {
        el.innerHTML = '<div class="span-stage"><p class="q-prompt">켜진 순서대로 탭하세요</p>' + gridHtml('input') + '<p class="mono muted" id="cnt">0 / ' + len + '</p></div>';
        const taps = [];
        el.querySelectorAll('.gcell').forEach(function (b) {
          b.addEventListener('click', function () {
            if (taps.length >= len) return;
            taps.push(Number(b.getAttribute('data-i')));
            b.classList.add('tap');
            setTimeout(function () { b.classList.remove('tap'); }, 250);
            el.querySelector('#cnt').textContent = taps.length + ' / ' + len;
            if (taps.length === len) T(function () { judge(seq, taps); }, 250);
          });
        });
      }
      function judge(seq, taps) {
        const ok = seq.every(function (v, i) { return v === taps[i]; });
        el.innerHTML = '<div class="span-stage"><p class="span-fb ' + (ok ? 'ok' : 'bad') + '">' + (ok ? '정답' : '오답') + '</p></div>';
        if (ok) { best = len; fails = 0; len += 1; } else { fails += 1; }
        if (len > it.max || fails >= 2) T(end, 900); else T(trial, 900);
      }
      function end() { if (finished) return; finished = true; done(best); }
      introCard(el, it, trial, it.start + '칸부터 시작해 맞힐 때마다 한 칸씩 늘어납니다. 최대 ' + it.max + '칸.');
      return function () { timers.forEach(clearTimeout); };
    },

    seqspan: function (it, el, done) {
      const LETTERS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ'];
      let timers = [], len = it.start, fails = 0, best = it.start - 1, finished = false;
      const T = function (fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; };
      const sampleN = function (arr, n) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a.slice(0, n); };
      function gen(n) {
        const nNum = Math.ceil(n / 2), nLet = Math.floor(n / 2);
        const nums = sampleN([1, 2, 3, 4, 5, 6, 7, 8, 9], nNum).map(String);
        const lets = sampleN(LETTERS, nLet);
        const seq = sampleN(nums.concat(lets), n);
        const target = nums.slice().sort(function (a, b) { return a - b; }).concat(lets.slice().sort(function (a, b) { return LETTERS.indexOf(a) - LETTERS.indexOf(b); }));
        return { seq: seq, target: target };
      }
      function trial() {
        const g = gen(len);
        el.innerHTML = '<div class="span-stage"><p class="mono muted">' + len + '개 · 잘 보세요</p><div class="span-digit mono" id="digit">&nbsp;</div><p class="muted small">숫자와 자음이 섞여 나옵니다</p></div>';
        const box = el.querySelector('#digit');
        g.seq.forEach(function (d, i) {
          T(function () { box.textContent = d; box.classList.add('on'); }, 500 + i * 1000);
          T(function () { box.textContent = ' '; box.classList.remove('on'); }, 500 + i * 1000 + 750);
        });
        T(function () { ask(g); }, 500 + g.seq.length * 1000 + 150);
      }
      function ask(g) {
        const btns = sampleN(g.seq, g.seq.length);
        el.innerHTML = '<div class="span-stage"><p class="q-prompt">숫자는 작은 것부터, 그다음 자음은 ㄱㄴㄷ 순서로 탭하세요</p><div class="lns-picked mono" id="picked">&nbsp;</div>' +
          '<div class="lns-btns">' + btns.map(function (b) { return '<button class="lns-btn mono" data-v="' + b + '">' + b + '</button>'; }).join('') + '</div></div>';
        const taps = [];
        el.querySelectorAll('.lns-btn').forEach(function (b) {
          b.addEventListener('click', function () {
            if (b.disabled) return;
            b.disabled = true;
            taps.push(b.getAttribute('data-v'));
            el.querySelector('#picked').textContent = taps.join(' ');
            if (taps.length === g.seq.length) T(function () { judge(g, taps); }, 250);
          });
        });
      }
      function judge(g, taps) {
        const ok = taps.join('') === g.target.join('');
        el.innerHTML = '<div class="span-stage"><p class="span-fb ' + (ok ? 'ok' : 'bad') + '">' + (ok ? '정답' : '오답') + '</p>' + (ok ? '' : '<p class="mono muted">정답 순서: ' + g.target.join(' ') + '</p>') + '</div>';
        if (ok) { best = len; fails = 0; len += 1; } else { fails += 1; }
        if (len > it.max || fails >= 2) T(end, 1000); else T(trial, 1000);
      }
      function end() { if (finished) return; finished = true; done(best); }
      introCard(el, it, trial, it.start + '개부터 시작해 맞힐 때마다 하나씩 늘어납니다. 최대 ' + it.max + '개.');
      return function () { timers.forEach(clearTimeout); };
    },

    symsearch: function (it, el, done) {
      const G = BL.tests.cognitive.glyphSVG;
      let timers = [], correct = 0, wrong = 0, finished = false, cur = null, tick = null, endAt = 0, keyOn = false;
      const T = function (fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; };
      const sampleN = function (arr, n) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a.slice(0, n); };
      function next() {
        if (finished) return;
        const ids = sampleN([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 7);
        const targets = ids.slice(0, 2), row = ids.slice(2, 7);
        const present = Math.random() < 0.5;
        if (present) row[Math.floor(Math.random() * 5)] = targets[Math.floor(Math.random() * 2)];
        cur = { present: present };
        el.querySelector('#ss-t').innerHTML = targets.map(G).join('');
        el.querySelector('#ss-r').innerHTML = row.map(G).join('');
      }
      function answer(yes) {
        if (finished || !cur) return;
        if (yes === cur.present) correct++; else wrong++;
        el.querySelector('#ss-cnt').textContent = (correct + wrong) + '문항 · 정답 ' + correct;
        next();
      }
      function finish() {
        if (finished) return;
        finished = true; keyOn = false;
        el.innerHTML = '<div class="span-stage"><p class="span-fb ok">끝</p><p class="mono muted">정답 ' + correct + ' · 오답 ' + wrong + '</p></div>';
        T(function () { done({ correct: correct, wrong: wrong }); }, 900);
      }
      function start() {
        el.innerHTML = '<div class="ss"><div class="ss-head mono"><span id="ss-cnt">0문항 · 정답 0</span><span id="ss-time">' + it.seconds + '</span></div>' +
          '<div class="ss-board"><div class="ss-targets" id="ss-t"></div><div class="ss-div"></div><div class="ss-row" id="ss-r"></div></div>' +
          '<div class="crt-btns"><button class="btn crt-btn" data-y="1">있음</button><button class="btn crt-btn" data-y="0">없음</button></div>' +
          '<p class="muted small">왼쪽 두 기호 중 하나라도 오른쪽에 있으면 "있음". PC: ← 있음 · → 없음</p></div>';
        el.querySelectorAll('.crt-btn').forEach(function (b) { b.addEventListener('pointerdown', function (e) { e.preventDefault(); answer(b.getAttribute('data-y') === '1'); }); });
        endAt = Date.now() + it.seconds * 1000; keyOn = true;
        tick = setInterval(function () {
          const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
          const tEl = el.querySelector('#ss-time'); if (tEl) { tEl.textContent = left; if (left <= 10) tEl.classList.add('urgent'); }
          if (left <= 0) { clearInterval(tick); finish(); }
        }, 200);
        next();
      }
      function onKey(e) { if (!keyOn) return; if (e.key === 'ArrowLeft' || e.key === '1') answer(true); else if (e.key === 'ArrowRight' || e.key === '2') answer(false); }
      document.addEventListener('keydown', onKey);
      introCard(el, it, start, it.seconds + '초 동안 진행합니다. 빠르기와 정확도를 함께 봅니다.');
      return function () { timers.forEach(clearTimeout); if (tick) clearInterval(tick); document.removeEventListener('keydown', onKey); };
    },

    reaction: function (it, el, done) {
      let timers = [], times = [], state = 'idle', t0 = 0, finished = false;
      const T = function (fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; };
      function pad() { return el.querySelector('#pad'); }
      function draw(cls, big, small) {
        el.innerHTML = '<div class="rt-wrap"><p class="mono muted">' + times.length + ' / ' + it.trials + '</p>' +
          '<button class="rt-pad ' + cls + '" id="pad"><span class="rt-big">' + big + '</span><span class="rt-small">' + (small || '') + '</span></button></div>';
        pad().addEventListener('pointerdown', onTap);
      }
      function arm() {
        state = 'wait';
        draw('wait', '기다리세요', '초록색이 되면 탭');
        T(function () {
          if (state !== 'wait') return;
          state = 'go';
          const p = pad();
          p.className = 'rt-pad go';
          p.querySelector('.rt-big').textContent = '지금!';
          p.querySelector('.rt-small').textContent = '';
          t0 = performance.now();
        }, 1500 + Math.random() * 2500);
      }
      function onTap(e) {
        e.preventDefault();
        if (finished) return;
        if (state === 'idle' || state === 'shown' || state === 'early') { arm(); return; }
        if (state === 'wait') {
          state = 'early'; timers.forEach(clearTimeout); timers = [];
          draw('early', '너무 빨라요', '탭해서 다시');
          return;
        }
        if (state === 'go') {
          const ms = Math.round(performance.now() - t0);
          if (ms < 100) {
            // 사람의 반응으로는 불가능한 속도: 예측해서 누른 것이므로 다시 잰다
            state = 'early'; timers.forEach(clearTimeout); timers = [];
            draw('early', '너무 빨라요', '초록색을 보고 누르세요 · 탭해서 다시');
            return;
          }
          times.push(ms);
          state = 'shown';
          if (times.length >= it.trials) {
            finished = true;
            draw('done', ms + ' ms', '측정 완료');
            T(function () { done(times); }, 800);
          } else {
            draw('shown', ms + ' ms', '탭해서 다음');
          }
        }
      }
      introCard(el, it, function () { draw('idle', '탭하여 시작', '초록색이 되면 최대한 빨리 탭'); }, it.trials + '회 측정합니다. 초록색이 되기 전에 탭하면 다시 합니다.');
      return function () { timers.forEach(clearTimeout); };
    },

    choicert: function (it, el, done) {
      let timers = [], trials = [], state = 'idle', t0 = 0, cur = null, finished = false;
      const T = function (fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; };
      function stage() {
        el.innerHTML = '<div class="crt"><p class="mono muted">' + trials.length + ' / ' + it.trials + '</p>' +
          '<div class="crt-stim" id="stim"></div>' +
          '<div class="crt-btns"><button class="btn crt-btn" data-d="L">← 왼쪽</button><button class="btn crt-btn" data-d="R">오른쪽 →</button></div></div>';
        el.querySelectorAll('.crt-btn').forEach(function (b) { b.addEventListener('pointerdown', function (e) { e.preventDefault(); answer(b.getAttribute('data-d')); }); });
      }
      function next() {
        if (finished) return;
        if (trials.length >= it.trials) { finished = true; done(trials); return; }
        state = 'wait';
        stage();
        T(function () {
          if (state !== 'wait') return;
          cur = Math.random() < 0.5 ? 'L' : 'R';
          const s = el.querySelector('#stim');
          s.textContent = cur === 'L' ? '←' : '→';
          s.className = 'crt-stim';
          state = 'go';
          t0 = performance.now();
        }, 500 + Math.random() * 900);
      }
      function answer(d) {
        if (state !== 'go') return;
        const rt = Math.round(performance.now() - t0);
        const s = el.querySelector('#stim');
        state = 'fb';
        if (rt < 120) {
          s.textContent = '너무 빨라요'; s.className = 'crt-stim early';
          T(next, 600); return;   // 기록하지 않고 같은 번호를 다시 잰다
        }
        const ok = d === cur;
        trials.push({ rt: rt, ok: ok });
        s.textContent = ok ? '✓' : '✗';
        s.className = 'crt-stim ' + (ok ? 'ok' : 'bad');
        T(next, 350);
      }
      function onKey(e) { if (e.key === 'ArrowLeft') answer('L'); else if (e.key === 'ArrowRight') answer('R'); }
      document.addEventListener('keydown', onKey);
      introCard(el, it, next, it.trials + '회. 화살표가 나타나기 전에 누른 것은 무시됩니다.');
      return function () { timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey); };
    },

    stroop: function (it, el, done) {
      // 색각 이상이 있어도 구분되는 조합(Okabe-Ito 팔레트). 흰 바탕에서 잘 안 보이는 노랑은 쓰지 않는다.
      const COLORS = [
        { k: 'blue', ko: '파랑', hex: '#0072b2' }, { k: 'orange', ko: '주황', hex: '#d55e00' },
        { k: 'purple', ko: '보라', hex: '#cc79a7' }, { k: 'green', ko: '초록', hex: '#009e73' }
      ];
      let timers = [], trials = [], state = 'idle', t0 = 0, cur = null, finished = false;
      const T = function (fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; };
      const plan = [];
      for (let i = 0; i < it.trials; i++) plan.push(i % 2 === 0);
      for (let i = plan.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = plan[i]; plan[i] = plan[j]; plan[j] = t; }
      function stage() {
        el.innerHTML = '<div class="crt"><p class="mono muted">' + trials.length + ' / ' + it.trials + '</p>' +
          '<p class="muted small">글자의 색을 고르세요</p><div class="stroop-word" id="stim"></div>' +
          '<div class="stroop-btns">' + COLORS.map(function (c, i) { return '<button class="stroop-btn" data-k="' + c.k + '" style="background:' + c.hex + '" aria-label="' + c.ko + '"><span class="mono">' + (i + 1) + '</span></button>'; }).join('') + '</div></div>';
        el.querySelectorAll('.stroop-btn').forEach(function (b) { b.addEventListener('pointerdown', function (e) { e.preventDefault(); answer(b.getAttribute('data-k')); }); });
      }
      function next() {
        if (finished) return;
        if (trials.length >= it.trials) { finished = true; done(trials); return; }
        state = 'wait';
        stage();
        T(function () {
          if (state !== 'wait') return;
          const ink = COLORS[Math.floor(Math.random() * 4)];
          const cong = plan[trials.length];
          let word = ink;
          if (!cong) { const others = COLORS.filter(function (c) { return c.k !== ink.k; }); word = others[Math.floor(Math.random() * others.length)]; }
          cur = { ink: ink.k, cong: cong };
          const s = el.querySelector('#stim');
          s.textContent = word.ko;
          s.style.color = ink.hex;
          state = 'go';
          t0 = performance.now();
        }, 400 + Math.random() * 600);
      }
      function answer(k) {
        if (state !== 'go') return;
        const rt = Math.round(performance.now() - t0);
        const s = el.querySelector('#stim');
        state = 'fb';
        if (rt < 120) {
          s.textContent = '너무 빨라요'; s.style.color = 'var(--warn)';
          T(next, 600); return;
        }
        const ok = k === cur.ink;
        trials.push({ rt: rt, ok: ok, cong: cur.cong });
        s.textContent = ok ? '✓' : '✗';
        s.style.color = ok ? 'var(--ok)' : 'var(--bad)';
        T(next, 350);
      }
      function onKey(e) { const i = ['1', '2', '3', '4'].indexOf(e.key); if (i >= 0) answer(COLORS[i].k); }
      document.addEventListener('keydown', onKey);
      introCard(el, it, next, it.trials + '회. 절반은 글자와 색이 같고 절반은 다릅니다. PC에서는 1~4 숫자키도 됩니다.');
      return function () { timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey); };
    }
  };

  /* ---------- 결과 ---------- */
  function scaleHtml(s, child) {
    const lo = s.range ? s.range[0] : 0, hi = s.range ? s.range[1] : 100;
    const pct = U.clamp((s.value - lo) / (hi - lo) * 100, 0, 100);
    const tick = s.range ? '<div class="bar-tick" style="left:' + ((100 - lo) / (hi - lo) * 100) + '%" title="평균 100"></div>' : '';
    return '<div class="scale' + (child ? ' scale-child' : '') + (s.range ? ' scale-iq' : '') + '"><div class="scale-head"><span>' + U.esc(s.label) + '</span>' +
      '<span class="mono">' + s.value + (s.raw ? ' <small>' + U.esc(s.raw) + '</small>' : '') + '</span></div>' +
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
  function resultHtml(t, result, opts) {
    opts = opts || {};
    const sections = (result.sections || []).map(function (sec) {
      return '<section class="rs"><h3>' + U.esc(sec.title) + '</h3><p>' + U.esc(sec.body) + '</p></section>';
    }).join('');
    return '<div class="wrap result">' +
      (opts.banner ? '<div class="banner">' + opts.banner + '</div>' : '') +
      '<a class="back" href="#/">← 실험 목록</a>' +
      '<p class="eyebrow mono">RESULT · ' + U.esc(t.title) + (result.modeLabel ? ' · ' + U.esc(result.modeLabel) : '') + (result.at ? ' · ' + U.fmtDate(result.at) : '') + '</p>' +
      '<h1 class="headline">' + U.esc(result.headline) + '</h1>' +
      (result.label ? '<span class="badge">' + U.esc(result.label) + '</span>' : '') +
      '<p class="summary">' + U.esc(result.summary) + '</p>' +
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
      '<div class="actions"><a class="btn btn-primary" href="#/test/' + t.id + '">' + (opts.profile ? '다른 과제 풀기' : '다시 하기') + '</a><a class="btn" href="#/">다른 실험</a></div>' +
      '<p class="notice">이 결과는 참고용 자기평가예요. 전문가의 심리검사나 의학적 진단을 대신하지 않고, 점수는 그날의 상태와 환경에 따라 달라질 수 있어요.</p>' +
      '</div>';
  }
  function mountResult(t, result) {
    const note = document.getElementById('note');
    document.getElementById('save').addEventListener('click', function () {
      BL.card.download(result, t).then(function () { note.textContent = '이미지를 저장했어요.'; });
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
    if (kakao) kakao.addEventListener('click', function () {
      BL.card.kakaoShare(result, t).then(function (how) {
        note.textContent = how === 'shared' ? '' : how === 'nokey' ? '카카오 앱 키가 아직 설정되지 않았어요.' : how === 'popup' ? '공유 창이 팝업 차단으로 열리지 않았어요. 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.' : '카카오톡 공유를 불러오지 못했어요. 링크 복사를 이용해 주세요.';
      });
    });
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
      Object.keys(result.tasks).forEach(function (k) { if (prev.tasks[k]) lines.push(labelOf(k) + ' ' + delta(iq(prev.tasks[k].z), iq(result.tasks[k].z))); });
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
      setScreen('<div class="wrap"><a class="back" href="#/test/' + id + '">← ' + U.esc(t.title) + '</a><p class="eyebrow mono">PROFILE</p><h1 class="title">종합 프로필</h1><p class="empty">아직 합칠 결과가 없어요. 과제를 하나라도 풀면 여기에 모여요.</p><a class="btn btn-primary btn-block" href="#/test/' + id + '">과제 고르러 가기</a></div>');
      return;
    }
    merged.testId = id; merged.at = Date.now();
    setScreen(resultHtml(t, merged, { profile: true, banner: '종합 프로필 · 과제별 가장 최근 결과를 합친 값이에요. 과제를 다시 풀면 자동으로 갱신돼요.' }), function () { mountResult(t, merged); });
  }

  function randomAnswer(it, r) {
    if (it.type === 'choice') return r.int(0, (it.options || it.optionsHtml).length - 1);
    if (it.type === 'likert') return r.int(1, 5);
    if (it.type === 'digitspan' || it.type === 'gridspan' || it.type === 'seqspan') return r.int(it.start, it.max);
    if (it.type === 'symsearch') return { correct: r.int(14, 34), wrong: r.int(0, 4) };
    if (it.type === 'reaction') return [0, 1, 2, 3, 4].map(function () { return r.int(190, 380); });
    if (it.type === 'choicert') { const a = []; for (let i = 0; i < it.trials; i++) a.push({ rt: r.int(320, 650), ok: r.next() < 0.92 }); return a; }
    if (it.type === 'stroop') { const a = []; for (let i = 0; i < it.trials; i++) { const cong = i % 2 === 0; a.push({ rt: r.int(cong ? 500 : 650, cong ? 850 : 1050), ok: r.next() < 0.9, cong: cong }); } return a; }
    return null;
  }
  /* ---------- 문항 갤러리 (검수용, 저장 안 됨): #/gallery/<과제 키>/<단계 또는 all>[/<단계당 개수>] ---------- */
  function renderGallery(key, level, n) {
    const t = BL.tests.cognitive;
    const tk = t.tasks.filter(function (k) { return k.key === key; })[0];
    if (!tk) return go('#/');
    const MAXL = { matrix: 6, figAnalogy: 5, series: 3, sequence: 5, weights: 5, rotation: 5 };
    const cnt = Math.min(12, parseInt(n, 10) || (level === 'all' ? 1 : 4));
    const levels = level === 'all' ? Array.from({ length: MAXL[key] || 5 }, function (_, i) { return i + 1; }) : [Math.max(1, parseInt(level, 10) || 1)];
    setScreen('<div class="wrap"><a class="back" href="#/">← 실험 목록</a><p class="eyebrow mono">GALLERY · 검수용</p><h1 class="title">' + U.esc(tk.label) + ' · ' + (level === 'all' ? '모든 단계' : levels[0] + '단계') + ' · 단계당 ' + cnt + '문항</h1><div id="gal"></div></div>', function () {
      const g = document.getElementById('gal');
      levels.forEach(function (lv) {
        for (let i = 0; i < cnt; i++) {
          const stub = { type: 'adaptive', part: key, scored: false, count: 999, state: { done: 0, level: lv, max: lv, used: [], levels: [], oks: [] } };
          const it = t.adaptNext(stub);
          if (!it) return;
          it.practice = true;
          const box = document.createElement('div'); box.className = 'gal-item';
          box.innerHTML = '<p class="mono muted small">' + lv + '단계 #' + (i + 1) + ' · 정답 ' + (it.answer + 1) + '번 · ' + U.esc(it.explain || '') + '</p>';
          const el = document.createElement('div'); box.appendChild(el); g.appendChild(box);
          RENDER.choice(it, el, function () {}, { timeFactor: 0 });
          const ans = el.querySelector('.opt[data-i="' + it.answer + '"]'); if (ans) ans.classList.add('correct');
        }
      });
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
    setScreen(resultHtml(t, result, { banner: '미리보기 · 무작위 응답으로 만든 결과예요. 저장되지 않아요.' }), function () { mountResult(t, result); });
  }

  /* ---------- 기록 ---------- */
  function renderHistory() {
    const all = results();
    const rows = all.map(function (r, i) { return rowHtml(r, i); }).reverse().join('');
    setScreen(
      '<div class="wrap">' +
      '<a class="back" href="#/">← 실험 목록</a>' +
      '<p class="eyebrow mono">ARCHIVE</p><h1 class="title">내 기록</h1>' +
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
      '<p class="eyebrow mono">ABOUT</p><h1 class="title">두뇌실험실 안내</h1>' +
      '<section class="rs"><h3>무엇을 하는 곳인가요</h3><p>머리 쓰는 힘, 감정 다루는 힘, 성격, 연애 패턴을 스스로 재 보는 곳이에요. 돈을 받지 않고 로그인도 없어요. 문항은 전부 이 사이트를 위해 직접 만들었거나, 누구나 쓸 수 있게 공개된 문항을 우리말로 옮긴 거예요.</p></section>' +
      '<section class="rs"><h3>검사는 어떻게 만들었나요</h3><p>인지 능력 검사는 지능 연구에서 오래 쓰인 과제 형식을 따라요. 규칙 찾기(도형 행렬, 도형 유추, 도형 계열, 수열, 저울 추론), 언어(유추, 어휘, 논리, 공통점 찾기), 공간(도형 회전), 기억(숫자 앞으로와 거꾸로, 위치, 숫자-문자 순서), 속도와 주의(단순 반응, 선택 반응, 색-단어 간섭, 기호 찾기)예요. 도형과 숫자 문제는 규칙을 바탕으로 매번 새로 만들어져요.</p><p>정서 지능 검사는 감정을 알아채고, 쓰고, 이해하고, 다루는 네 갈래로 보는 모델을 틀로 삼고, 갈래마다 두 가지를 상황 판단 문제로 재요.</p><p>성격 검사는 빅파이브 모델을 따르고, 문항은 공개된 국제 성격 문항(IPIP)을 번역해서 손봤어요.</p><p>연애 애착 유형 검사는 성인 애착을 불안과 회피 두 축으로 보는 모델을 바탕으로, 축마다 세 가지 패턴을 봐요.</p></section>' +
      '<section class="rs"><h3>점수는 어디에 쓰면 좋나요</h3><p>검사마다 소개 페이지에 그 능력이나 성향이 생활 어디에 쓰이고 어떤 영향을 주는지 적어 두었어요. 결과는 "내가 뭘 잘하고 뭘 연습하면 좋은지" 감을 잡는 용도로 보면 딱 좋아요. 사람을 평가하거나 줄 세우는 데 쓰라고 만든 게 아니에요.</p></section>' +
      '<section class="rs"><h3>한계</h3><p>모든 결과는 참고용이에요. 많은 사람에게 실시해서 검증한 공인 검사가 아니고, 공식 IQ나 진단을 내주지 않아요. 점수는 그날 컨디션, 기기, 환경에 따라 달라져요. 마음 건강이 걱정된다면 전문가와 상담하세요.</p></section>' +
      '<section class="rs"><h3>개인정보</h3><p>이름, 생년월일, 연락처를 묻지 않아요. 답과 결과는 이 브라우저 안에만 저장되고 서버로 보내지 않아요. "내 기록"에서 언제든 지울 수 있어요.</p></section>' +
      '</div>'
    );
  }

  window.addEventListener('hashchange', route);
  route();
})();
