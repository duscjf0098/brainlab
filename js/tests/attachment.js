/* 실험 04 · 연애 애착 유형 검사
   성인 애착의 2차원 모델(불안·회피)을 틀로 쓰고, 축마다 세부 3개 × 4문항 = 24문항. 문항은 전부 직접 썼다. */
(function () {
  const U = BL.util;

  const DIMS = {
    anx: { label: '불안', what: '연인이 떠날까 봐 걱정하고, 자꾸 확인하고 싶어지는 정도예요.',
      where: '연락이 늦을 때 마음 상태, 상대 기분 변화에 흔들리는 정도, 질투나 확인 요구가 여기서 나와요. 높으면 관계에 많이 쏟지만 그만큼 쉽게 지쳐요.' },
    avo: { label: '회피', what: '너무 가까워지면 불편해서 거리를 두고, 기대거나 속마음 꺼내기를 피하는 정도예요.',
      where: '혼자 있는 시간이 얼마나 필요한지, 힘들 때 기대는지, 속마음을 얼마나 꺼내는지가 여기서 갈려요. 높으면 흔들림이 적지만 상대는 거리감을 느낄 수 있어요.' }
  };
  const FACETS = [
    { key: 'aband', dim: 'anx', label: '떠날까 걱정', hi: '관계가 잘 되고 있어도 "언젠가 떠나지 않을까" 하는 생각이 바닥에 깔려 있어요. 상대가 꾸준히 보여 준 행동을 적어 두면 불안이 사실과 다르다는 걸 확인하는 데 도움이 돼요.' },
    { key: 'reass', dim: 'anx', label: '확인하고 싶음', hi: '사랑받고 있다는 확인이 자주 필요해요. 확인을 요구하기 전에 상대가 이미 보여 준 신호를 세 가지 떠올려 보세요.' },
    { key: 'hyper', dim: 'anx', label: '작은 변화에 흔들림', hi: '상대의 사소한 변화를 크게 받아들여요. "사실"과 "해석"을 나눠 적는 습관이 효과적이에요.' },
    { key: 'close', dim: 'avo', label: '가까워지면 불편', hi: '가까워질수록 숨 쉴 공간이 필요해져요. 거리가 필요할 때 말없이 멀어지기보다 "오늘은 혼자 충전할게"라고 알려 주세요.' },
    { key: 'depend', dim: 'avo', label: '기대기 어려움', hi: '기대는 게 어렵고 혼자 해결하려 해요. 작은 부탁부터 해 보면 관계가 균형을 찾아요.' },
    { key: 'express', dim: 'avo', label: '속마음 안 꺼냄', hi: '속마음과 애정을 말로 꺼내는 게 어색해요. 하루 한 번, 아주 작은 감정이라도 말로 표현해 보세요.' }
  ];
  /* [세부, 문항, 역채점] — 세부마다 정방향 2문항 + 역방향 2문항. "그렇다"만 고르는 응답 경향을 상쇄한다. */
  const ITEMS = [
    ['aband', '상대가 떠날까 봐 걱정될 때가 많다.', false],
    ['aband', '헤어지자는 말을 들을까 봐 조마조마할 때가 있다.', false],
    ['aband', '상대가 나를 떠날 거라는 걱정은 거의 하지 않는다.', true],
    ['aband', '우리 관계가 안정적이라고 느끼며, 앞날을 불안해하지 않는다.', true],
    ['aband', '연인이 나보다 더 좋은 사람을 만날까 봐 불안하다.', false],
    ['aband', '연인이 나에게 싫증을 낼까 봐 걱정된다.', false],
    ['aband', '연인이 내 곁에 계속 있을 거라고 믿는다.', true],
    ['aband', '다투더라도 관계가 끝날까 봐 겁나지는 않는다.', true],
    ['reass', '연인이 나를 정말 좋아하는지 자주 확인하고 싶다.', false],
    ['reass', '사랑한다는 말을 자주 들어야 안심이 된다.', false],
    ['reass', '답장이 늦어도 크게 신경 쓰지 않는다.', true],
    ['reass', '상대의 마음을 굳이 확인하지 않아도 안심이 된다.', true],
    ['reass', '연인에게 나를 사랑하는지 묻고 싶을 때가 자주 있다.', false],
    ['reass', '연인의 연락이나 SNS를 자꾸 확인하게 된다.', false],
    ['reass', '하루쯤 연락이 없어도 마음이 편하다.', true],
    ['reass', '애정 표현이 적은 날에도 상대의 마음을 의심하지 않는다.', true],
    ['hyper', '상대의 사소한 말투 변화에도 마음이 흔들린다.', false],
    ['hyper', '상대가 나를 충분히 아껴 주지 않는다고 느낄 때가 많다.', false],
    ['hyper', '상대의 말투가 조금 달라져도 별 의미를 두지 않는다.', true],
    ['hyper', '상대가 바빠서 연락이 뜸해도 마음이 편하다.', true],
    ['hyper', '상대의 표정이 조금만 어두워도 나 때문인지 걱정된다.', false],
    ['hyper', '작은 다툼에도 감정이 크게 요동친다.', false],
    ['hyper', '상대가 기분이 안 좋아 보여도 나 때문이라고 단정하지 않는다.', true],
    ['hyper', '사소한 다툼은 금방 잊고 넘어간다.', true],
    ['close', '상대가 너무 가까워지려 하면 거리를 두고 싶어진다.', false],
    ['close', '관계가 깊어질수록 오히려 마음이 닫히는 느낌이 든다.', false],
    ['close', '상대와 가까워지는 것이 편안하고 자연스럽다.', true],
    ['close', '연인과 많은 시간을 함께 보내는 것이 좋다.', true],
    ['close', '연인이 내 일상에 깊이 들어오면 답답하다.', false],
    ['close', '관계가 진지해지려 하면 한발 물러서게 된다.', false],
    ['close', '연인과 일상을 많이 나누는 것이 좋다.', true],
    ['close', '관계가 깊어지는 것이 기대된다.', true],
    ['depend', '누군가에게 기대는 것이 어렵다.', false],
    ['depend', '연인에게 도움을 청하는 것이 불편하다.', false],
    ['depend', '힘들 때 연인에게 기대는 것이 어렵지 않다.', true],
    ['depend', '중요한 결정은 상대와 상의하는 편이다.', true],
    ['depend', '힘든 일은 연인에게 말하지 않고 혼자 해결하려 한다.', false],
    ['depend', '연인이 나를 챙겨 주면 고맙기보다 부담스럽다.', false],
    ['depend', '연인이 나를 도와주면 편하게 받아들인다.', true],
    ['depend', '내가 약해졌을 때 연인이 곁에 있어 주기를 바란다.', true],
    ['express', '감정 이야기를 길게 하는 것이 부담스럽다.', false],
    ['express', '연인 앞에서 약한 모습을 보이고 싶지 않다.', false],
    ['express', '속마음을 연인에게 털어놓는 것이 편하다.', true],
    ['express', '애정 표현이 자연스럽게 나온다.', true],
    ['express', '서운한 일이 있어도 말하지 않고 그냥 넘어간다.', false],
    ['express', '"사랑해"라는 말을 하기가 쑥스럽고 어렵다.', false],
    ['express', '서운한 감정도 차분하게 말로 전하는 편이다.', true],
    ['express', '좋아하는 마음을 자주 표현한다.', true]
  ];

  const TYPES = {
    secure: { name: '안정형', nick: '든든한 항구',
      desc: '가까워지는 것도, 혼자 있는 것도 편해요. 상대를 믿고, 나도 사랑받을 만한 사람이라고 느껴요.',
      strength: '갈등이 생기면 대화로 풀고, 상대가 혼자 하고 싶은 것도 존중해요. 관계가 오래 안정적으로 이어지는 편이에요.',
      caution: '상대가 불안형이면 "괜찮겠지" 하고 넘기다가 서운하게 만들 수 있어요.',
      tip: '안심시키는 말을 조금 더 자주 해 주세요. 나한테는 당연한 안정감이 상대에게는 큰 선물이에요.',
      match: '어떤 유형과도 잘 맞고, 특히 불안형이나 회피형 상대에게 안정감을 줘요.' },
    anxious: { name: '불안 몰입형', nick: '온도계',
      desc: '관계에 깊이 빠지고 상대의 반응에 민감해요. 사랑받고 있다는 확인이 자주 필요해요.',
      strength: '애정 표현이 풍부하고 관계에 헌신적이에요. 상대의 변화를 가장 먼저 알아차려요.',
      caution: '확인을 자주 바라면 상대가 지칠 수 있고, 그 반응에 다시 불안해지는 순환이 생기기 쉬워요.',
      tip: '불안이 올라올 때 "사실"과 "해석"을 나눠 적어 보세요. 답장이 늦은 건 사실, 마음이 식었다는 건 해석이에요.',
      match: '안정형과 가장 잘 맞아요. 회피형과는 서로의 패턴이 맞물려 힘들어질 수 있어요.' },
    avoidant: { name: '회피 독립형', nick: '단독 항해사',
      desc: '내 공간을 중요하게 여기고 감정 표현을 아껴요. 가까워질수록 숨 쉴 틈이 필요해져요.',
      strength: '침착하고 흔들림이 적고, 상대에게 충분한 공간을 줘요. 서로 기대지 않는 관계를 만들어요.',
      caution: '상대가 거리감과 외로움을 느낄 수 있어요. 정작 중요한 순간에 마음을 닫아 버리기도 해요.',
      tip: '하루 한 번, 아주 작은 감정이라도 말로 표현해 보세요. "오늘 좀 피곤했어" 정도면 충분해요.',
      match: '안정형과 잘 맞아요. 불안형 상대에게는 의식적으로 안심시키는 말이 필요해요.' },
    fearful: { name: '혼란 양가형', nick: '밀물과 썰물',
      desc: '가까워지고 싶은데 막상 가까워지면 불편해져요. 다가가기와 물러서기가 번갈아 나타나요.',
      strength: '감수성이 깊고 관계의 미묘한 결을 잘 느껴요. 진심으로 연결되면 아주 헌신적이에요.',
      caution: '밀고 당기기가 반복되면 양쪽 다 지쳐요. 상대가 혼란스러워할 수 있어요.',
      tip: '관계에서 반복되는 패턴을 글로 정리해 보세요. 패턴이 보이면 멈출 수 있어요. 필요하면 상담도 좋은 선택이에요.',
      match: '안정형과 가장 잘 맞아요. 서두르지 않고 천천히 신뢰를 쌓는 상대가 좋아요.' }
  };

  /* 기본 검사: 세부마다 8문항(정 4·역 4) 중 정 2·역 2를 무작위로 골라 24문항. 정밀 검사: 48문항 전부.
     정·역이 항상 반반이라 "그렇다"만 고르거나 "보통이다"만 골라도 한쪽 유형으로 기울지 않는다. */
  function build(mode) {
    const r = U.rng();
    const full = mode === 'full';
    const by = {};
    ITEMS.forEach(function (it) { const g = by[it[0]] = by[it[0]] || { f: [], r: [] }; g[it[2] ? 'r' : 'f'].push({ type: 'likert', scored: true, facet: it[0], reverse: it[2], text: it[1] }); });
    const chosen = {};
    FACETS.forEach(function (fc) { const g = by[fc.key]; chosen[fc.key] = r.shuffle(full ? g.f.concat(g.r) : r.sample(g.f, 2).concat(r.sample(g.r, 2))); });
    const per = full ? 8 : 4;
    const items = [];
    for (let i = 0; i < per; i++) FACETS.forEach(function (fc) { items.push(chosen[fc.key][i]); });
    // 세부가 뭉치지 않도록 세부 수(6개) 단위 블록 안에서만 섞는다
    const out = [];
    for (let i = 0; i < items.length; i += FACETS.length) out.push.apply(out, r.shuffle(items.slice(i, i + FACETS.length)));
    out.unshift({ type: 'section', num: 1, title: '연애에서의 나', desc: '연애할 때 평소 느끼는 것과 얼마나 가까운지 골라요. 지금 연애 중이 아니라면 가장 최근의 관계나 보통의 나를 떠올려 주세요.', count: items.length + '문항 · 약 ' + Math.round(items.length / 6) + '분' });
    return out;
  }

  function score(answers, items, meta) {
    const sums = {}, counts = {};
    items.forEach(function (it, i) {
      if (it.type !== 'likert') return;
      const a = answers[i];
      if (typeof a !== 'number') return;
      sums[it.facet] = (sums[it.facet] || 0) + (it.reverse ? 6 - a : a);
      counts[it.facet] = (counts[it.facet] || 0) + 1;
    });
    const fv = {};
    FACETS.forEach(function (fc) { const m = counts[fc.key] ? sums[fc.key] / counts[fc.key] : 3; fv[fc.key] = Math.round((m - 1) / 4 * 100); });
    const dim = function (d) { return Math.round(U.mean(FACETS.filter(function (fc) { return fc.dim === d; }).map(function (fc) { return fv[fc.key]; }))); };
    const anx = dim('anx'), avo = dim('avo');
    // 정확히 중간(50)은 "높음"이 아니다
    const key = anx > 50 ? (avo > 50 ? 'fearful' : 'anxious') : (avo > 50 ? 'avoidant' : 'secure');
    const T = TYPES[key];
    const cx = (40 + anx / 100 * 260).toFixed(1), cy = (280 - avo / 100 * 260).toFixed(1);
    const plot = '<svg class="plot" viewBox="0 0 320 320" role="img" aria-label="애착 좌표">' +
      '<rect x="40" y="20" width="260" height="260" rx="8" fill="none" stroke="var(--line-2)"/>' +
      '<line x1="170" y1="20" x2="170" y2="280" stroke="var(--line)" stroke-dasharray="4 4"/>' +
      '<line x1="40" y1="150" x2="300" y2="150" stroke="var(--line)" stroke-dasharray="4 4"/>' +
      '<text x="48" y="272" class="plot-q">안정형</text>' +
      '<text x="292" y="272" class="plot-q" text-anchor="end">불안 몰입형</text>' +
      '<text x="48" y="40" class="plot-q">회피 독립형</text>' +
      '<text x="292" y="40" class="plot-q" text-anchor="end">혼란 양가형</text>' +
      '<text x="170" y="304" class="plot-axis" text-anchor="middle">불안 →</text>' +
      '<text x="20" y="150" class="plot-axis" text-anchor="middle" transform="rotate(-90 20 150)">회피 →</text>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="13" fill="var(--accent)" opacity=".18"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>' +
      '</svg>';
    const children = function (d) { return FACETS.filter(function (fc) { return fc.dim === d; }).map(function (fc) { return { key: fc.key, label: fc.label, value: fv[fc.key] }; }); };
    const topF = FACETS.slice().sort(function (a, b) { return fv[b.key] - fv[a.key]; }).filter(function (fc) { return fv[fc.key] > 50; }).slice(0, 2);
    const pattern = topF.length
      ? topF.map(function (fc) { return fc.label + '(' + fv[fc.key] + '): ' + fc.hi; }).join(' ')
      : '여섯 가지 세부 항목이 모두 낮은 편이에요. 불안과 회피 어느 쪽으로도 크게 기울지 않은, 전형적인 안정형 패턴이에요.';
    return {
      modeLabel: meta && meta.mode === 'full' ? '정밀 검사' : '기본 검사',
      headline: T.name,
      value: anx,
      label: T.nick,
      summary: T.desc + ' 불안 ' + anx + '점, 회피 ' + avo + '점이고, 좌표 위 점이 내 위치예요.',
      scales: [
        { key: 'anx', label: '불안 (떠날까 봐 걱정하는 정도)', value: anx, children: children('anx') },
        { key: 'avo', label: '회피 (가까워지는 걸 피하는 정도)', value: avo, children: children('avo') }
      ],
      plot: plot,
      sections: [
        { title: '세부 패턴', body: pattern },
        { title: '강점', body: T.strength },
        { title: '주의할 점', body: T.caution },
        { title: '해 볼 만한 것', body: T.tip },
        { title: '잘 맞는 상대', body: T.match }
      ]
    };
  }

  BL.tests.attachment = {
    id: 'attachment',
    num: 4,
    kind: 'trait',
    kindLabel: '성향',
    title: '연애 애착 유형 검사',
    subtitle: '연애할 때 불안해지는 편인지, 거리를 두는 편인지. 내 연애 패턴이 네 가지 유형 중 어디에 가까운지 알아봐요.',
    duration: '약 4~8분',
    length: '24·48문항 · 6세부',
    modes: [
      { id: 'standard', label: '기본 검사', desc: '세부 패턴마다 4문항씩 24문항이에요. 48개 문장 중에서 골라 나와서 다시 해도 문항이 조금씩 바뀌어요.', duration: '약 4분', length: '24문항' },
      { id: 'full', label: '정밀 검사', desc: '48개 문장을 모두 풀어요. 세부 패턴마다 8문항이라 결과가 더 안정적이에요.', duration: '약 8분', length: '48문항' }
    ],
    explain: ['anx', 'avo'].map(function (d) { return { label: DIMS[d].label, what: DIMS[d].what, where: DIMS[d].where, tasks: FACETS.filter(function (fc) { return fc.dim === d; }).map(function (fc) { return fc.label; }).join(', ') }; }),
    intro: [
      '연애에서 사람마다 다른 두 가지, "불안"과 "회피"를 재요. 심리학에서 어른의 애착을 볼 때 쓰는 틀이에요.',
      '불안은 떠날까 걱정하기, 자꾸 확인하기, 작은 변화에 흔들리기로, 회피는 가까워지면 불편하기, 기대기 어려워하기, 속마음 안 꺼내기로 나눠서 봐요.',
      '두 점수를 합치면 안정형, 불안 몰입형, 회피 독립형, 혼란 양가형 중 하나가 나와요.',
      '유형은 평생 정해진 게 아니에요. 누구를 만나느냐, 어떤 경험을 하느냐에 따라 바뀌니까 지금의 경향으로만 봐 주세요.'
    ],
    related: [{ id: 'love', why: '첫눈에 반하는 편인지, 친구처럼 천천히 스며드는 편인지. 사랑의 여섯 가지 스타일 중 어디에 가까운지도 알아봐요.' }],
    build: build,
    score: score
  };
})();
