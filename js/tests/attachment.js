/* 실험 04 · 연애 애착 유형 검사
   성인 애착의 2차원 모델(불안·회피)을 틀로 쓰고, 축마다 세부 3개 × 4문항 = 24문항. 문항은 전부 직접 썼다. */
(function () {
  const U = BL.util;

  const FACETS = [
    { key: 'aband', dim: 'anx', label: '버림받음 걱정', hi: '관계가 잘 되고 있어도 "언젠가 떠나지 않을까"라는 생각이 바닥에 깔려 있습니다. 상대의 일관된 행동을 기록해 두면 불안이 사실과 다르다는 것을 확인하는 데 도움이 됩니다.' },
    { key: 'reass', dim: 'anx', label: '확인 욕구', hi: '사랑받고 있다는 확인이 자주 필요합니다. 확인을 요구하기 전에 상대가 이미 보여 준 신호를 세 가지 떠올려 보세요.' },
    { key: 'hyper', dim: 'anx', label: '과민 반응', hi: '상대의 사소한 변화를 크게 받아들입니다. "사실"과 "해석"을 나눠 적는 습관이 효과적입니다.' },
    { key: 'close', dim: 'avo', label: '친밀감 불편', hi: '가까워질수록 숨 쉴 공간이 필요해집니다. 거리가 필요할 때 말없이 멀어지기보다 "오늘은 혼자 충전할게"라고 알려 주세요.' },
    { key: 'depend', dim: 'avo', label: '의존 회피', hi: '기대는 것이 어렵고 혼자 해결하려 합니다. 작은 부탁부터 해 보면 관계가 균형을 찾습니다.' },
    { key: 'express', dim: 'avo', label: '감정 표현 억제', hi: '속마음과 애정을 말로 꺼내는 것이 어색합니다. 하루 한 번, 아주 작은 감정이라도 말로 표현해 보세요.' }
  ];
  /* [세부, 문항, 역채점] — 세부마다 정방향 2문항 + 역방향 2문항. "그렇다"만 고르는 응답 경향을 상쇄한다. */
  const ITEMS = [
    ['aband', '상대가 떠날까 봐 걱정될 때가 많다.', false],
    ['aband', '헤어지자는 말을 들을까 봐 조마조마할 때가 있다.', false],
    ['aband', '상대가 나를 떠날 거라는 걱정은 거의 하지 않는다.', true],
    ['aband', '우리 관계가 안정적이라고 느끼며, 앞날을 불안해하지 않는다.', true],
    ['reass', '연인이 나를 정말 좋아하는지 자주 확인하고 싶다.', false],
    ['reass', '사랑한다는 말을 자주 들어야 안심이 된다.', false],
    ['reass', '답장이 늦어도 크게 신경 쓰지 않는다.', true],
    ['reass', '상대의 마음을 굳이 확인하지 않아도 안심이 된다.', true],
    ['hyper', '상대의 사소한 말투 변화에도 마음이 흔들린다.', false],
    ['hyper', '상대가 나를 충분히 아껴 주지 않는다고 느낄 때가 많다.', false],
    ['hyper', '상대의 말투가 조금 달라져도 별 의미를 두지 않는다.', true],
    ['hyper', '상대가 바빠서 연락이 뜸해도 마음이 편하다.', true],
    ['close', '상대가 너무 가까워지려 하면 거리를 두고 싶어진다.', false],
    ['close', '관계가 깊어질수록 오히려 마음이 닫히는 느낌이 든다.', false],
    ['close', '상대와 가까워지는 것이 편안하고 자연스럽다.', true],
    ['close', '연인과 많은 시간을 함께 보내는 것이 좋다.', true],
    ['depend', '누군가에게 기대는 것이 어렵다.', false],
    ['depend', '연인에게 도움을 청하는 것이 불편하다.', false],
    ['depend', '힘들 때 연인에게 기대는 것이 어렵지 않다.', true],
    ['depend', '중요한 결정은 상대와 상의하는 편이다.', true],
    ['express', '감정 이야기를 길게 하는 것이 부담스럽다.', false],
    ['express', '연인 앞에서 약한 모습을 보이고 싶지 않다.', false],
    ['express', '속마음을 연인에게 털어놓는 것이 편하다.', true],
    ['express', '애정 표현이 자연스럽게 나온다.', true]
  ];

  const TYPES = {
    secure: { name: '안정형', nick: '든든한 항구',
      desc: '가까워지는 것도, 혼자 있는 것도 편안합니다. 상대를 믿고, 자신도 사랑받을 만하다고 느낍니다.',
      strength: '갈등이 생기면 대화로 풀고, 상대의 독립을 존중합니다. 관계가 오래 안정적으로 이어지는 편입니다.',
      caution: '상대가 불안형이면 "괜찮겠지"라고 넘기다 서운하게 만들 수 있습니다.',
      tip: '안심시키는 말을 조금 더 자주 해 주세요. 당신에겐 당연한 안정감이 상대에겐 큰 선물입니다.',
      match: '어떤 유형과도 잘 맞고, 특히 불안형이나 회피형 상대에게 안정감을 줍니다.' },
    anxious: { name: '불안 몰입형', nick: '온도계',
      desc: '관계에 깊이 몰입하고 상대의 반응에 민감합니다. 사랑받고 있다는 확인이 자주 필요합니다.',
      strength: '애정 표현이 풍부하고 관계에 헌신적입니다. 상대의 변화를 가장 먼저 알아차립니다.',
      caution: '확인 요구가 잦아지면 상대가 지칠 수 있고, 그 반응에 다시 불안해지는 순환이 생기기 쉽습니다.',
      tip: '불안이 올라올 때 "사실"과 "해석"을 나눠 적어 보세요. 답장이 늦은 것은 사실, 마음이 식었다는 것은 해석입니다.',
      match: '안정형과 가장 잘 맞습니다. 회피형과는 서로의 패턴이 맞물려 힘들어질 수 있습니다.' },
    avoidant: { name: '회피 독립형', nick: '단독 항해사',
      desc: '자율성을 중시하고 감정 표현을 절제합니다. 가까워질수록 숨 쉴 공간이 필요해집니다.',
      strength: '침착하고 흔들림이 적으며, 상대에게 충분한 공간을 줍니다. 의존하지 않는 관계를 만듭니다.',
      caution: '상대가 거리감과 외로움을 느낄 수 있습니다. 정작 중요한 순간에 마음을 닫아 버리기도 합니다.',
      tip: '하루 한 번, 아주 작은 감정이라도 말로 표현해 보세요. "오늘 좀 피곤했어" 정도면 충분합니다.',
      match: '안정형과 잘 맞습니다. 불안형 상대에게는 의식적으로 안심시키는 말이 필요합니다.' },
    fearful: { name: '혼란 양가형', nick: '밀물과 썰물',
      desc: '가까워지고 싶지만 막상 가까워지면 불편해집니다. 다가가기와 물러서기가 번갈아 나타납니다.',
      strength: '깊은 감수성이 있고 관계의 미묘한 결을 잘 느낍니다. 진심으로 연결되면 매우 헌신적입니다.',
      caution: '밀고 당기기가 반복되면 양쪽 다 지칩니다. 상대가 혼란스러워할 수 있습니다.',
      tip: '관계에서 반복되는 패턴을 글로 정리해 보세요. 패턴이 보이면 멈출 수 있습니다. 필요하면 상담도 좋은 선택입니다.',
      match: '안정형과 가장 잘 맞습니다. 서두르지 않고 천천히 신뢰를 쌓는 상대가 좋습니다.' }
  };

  function build() {
    const r = U.rng();
    const by = {};
    ITEMS.forEach(function (it) { (by[it[0]] = by[it[0]] || []).push({ type: 'likert', scored: true, facet: it[0], reverse: it[2], text: it[1] }); });
    const items = [];
    for (let i = 0; i < 4; i++) FACETS.forEach(function (fc) { items.push(by[fc.key][i]); });
    // 세부가 뭉치지 않도록 4개 단위 블록 안에서만 섞는다
    const out = [];
    for (let i = 0; i < items.length; i += 6) out.push.apply(out, r.shuffle(items.slice(i, i + 6)));
    out.unshift({ type: 'section', num: 1, title: '연애에서의 나', desc: '연애 관계에서 평소 느끼는 것에 가까운 정도를 고릅니다. 지금 연애 중이 아니라면 가장 최근의 관계, 또는 보통의 나를 떠올리세요.', count: '24문항 · 약 4분' });
    return out;
  }

  function score(answers, items) {
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
      : '여섯 가지 세부 항목이 모두 낮은 편입니다. 불안과 회피 어느 쪽으로도 크게 기울지 않은, 전형적인 안정형 패턴입니다.';
    return {
      headline: T.name,
      value: anx,
      label: T.nick,
      summary: T.desc + ' 불안 ' + anx + '점, 회피 ' + avo + '점으로, 좌표 위 점이 당신의 위치입니다.',
      scales: [
        { key: 'anx', label: '불안 (버림받을까 걱정하는 정도)', value: anx, children: children('anx') },
        { key: 'avo', label: '회피 (가까워지는 것을 피하는 정도)', value: avo, children: children('avo') }
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
    subtitle: '연애에서 나타나는 불안과 회피를 여섯 가지 세부 패턴으로 나누어, 네 가지 애착 유형 중 어디에 가까운지 알아봅니다.',
    duration: '약 4분',
    length: '24문항 · 6세부',
    intro: [
      '성인 애착 연구의 2차원 모델(불안·회피)을 기준으로 합니다.',
      '불안은 버림받음 걱정·확인 욕구·과민 반응, 회피는 친밀감 불편·의존 회피·감정 표현 억제로 나누어 봅니다.',
      '두 축의 조합으로 안정형, 불안 몰입형, 회피 독립형, 혼란 양가형 중 하나가 나옵니다.',
      '유형은 고정된 것이 아니라 관계 경험에 따라 바뀝니다. 결과는 지금의 경향일 뿐입니다.'
    ],
    build: build,
    score: score
  };
})();
