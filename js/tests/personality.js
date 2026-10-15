/* 실험 03 · 성격 검사 (빅파이브, 15개 세부 특성)
   문항은 공개 도메인인 IPIP(International Personality Item Pool)의 요인·세부 척도 항목을 바탕으로 한국어로 번역·각색한 것이다.
   요인 5 × 세부 3 × 문항 3 = 45문항, 5점 척도. true는 역채점. */
(function () {
  const U = BL.util;

  const F = {
    E: { label: '외향성', nick: '에너자이저형',
      what: '사람들과 어울리면서 에너지를 얻는지, 혼자 있을 때 충전되는지를 봐요.',
      where: '사람 만나는 일(영업, 발표, 모임 이끌기)에서는 높은 쪽이 편하고, 혼자 오래 집중하는 일에서는 낮은 쪽이 편해요. 어느 쪽이 좋고 나쁜 게 아니라 에너지가 어디서 채워지는지의 차이예요.',
      high: '사람들과 어울리면서 에너지를 얻고 먼저 다가가는 편이에요. 모임에서 분위기를 이끄는 역할이 자연스러워요.',
      mid: '상황에 따라 어울리기도 하고 혼자 충전하기도 해요. 둘 다 편한 균형형이에요.',
      low: '혼자 있는 시간에서 힘을 얻고, 넓은 관계보다 깊은 관계 몇 개를 좋아해요. 조용히 관찰하는 힘이 강점이에요.' },
    A: { label: '친화성', nick: '조력자형',
      what: '남의 기분을 얼마나 헤아리고, 부딪히기보다 맞춰 주는 편인지를 봐요.',
      where: '팀으로 일하기, 돌보는 일, 서비스 일에서는 높은 쪽이 빛나요. 협상하거나 비판해야 하거나 어려운 결정을 내리는 자리에서는 낮은 쪽이 유리할 때가 있어요.',
      high: '남의 감정을 잘 헤아리고 함께하는 걸 중요하게 여겨요. 사람들이 당신 곁에서 편안함을 느껴요.',
      mid: '필요할 땐 양보하지만 내 입장도 분명히 해요.',
      low: '솔직하고 직설적이고, 경쟁이나 협상 자리에서 강해요. 가끔 차갑다는 오해를 받을 수 있어요.' },
    C: { label: '성실성', nick: '설계자형',
      what: '계획을 세우고 꾸준히 끝까지 해내는 정도예요.',
      where: '성적, 업무 성과, 건강 습관, 저축처럼 꾸준함이 필요한 거의 모든 일과 가장 관계가 깊은 성격이에요. 너무 높으면 융통성이 떨어질 수 있고, 낮으면 즉흥적인 대응과 변화 적응이 빨라요.',
      high: '계획을 세우고 끈기 있게 마무리해요. 믿고 맡길 수 있는 사람이라는 평을 들어요.',
      mid: '중요한 일엔 꼼꼼하고 나머지는 유연하게 넘겨요.',
      low: '즉흥적이고 변화에 빨리 적응해요. 마무리가 느슨해질 수 있으니 작은 마감 장치를 두면 좋아요.' },
    N: { label: '정서 민감성', nick: '감지기형',
      what: '걱정이나 기분 변화를 얼마나 쉽게, 크게 느끼는지를 봐요.',
      where: '높으면 스트레스와 걱정을 더 크게 느끼지만, 위험이나 문제를 남들보다 먼저 알아채요. 낮으면 위기에서 침착하지만 가끔 신호를 놓치기도 해요. 높은 쪽은 자기만의 스트레스 푸는 방법을 갖추는 게 중요해요.',
      high: '감정을 깊게 느끼고 위험 신호를 빨리 알아채요. 그만큼 스트레스 관리가 중요한 타입이에요.',
      mid: '대체로 안정적이지만 압박이 크면 흔들려요. 보통 수준의 민감성이에요.',
      low: '웬만한 일에 흔들리지 않고 침착해요. 위기 상황에서 주변을 안정시키는 역할을 해요.' },
    O: { label: '개방성', nick: '탐험가형',
      what: '새로운 생각이나 경험을 얼마나 반기는지, 상상과 예술을 즐기는지를 봐요.',
      where: '새로운 것 배우기, 창작, 낯선 환경에 적응하기, 다른 생각 받아들이기에서 높은 쪽이 편해요. 낮은 쪽은 검증된 방법을 꾸준히 지키는 일과 눈앞의 실무적인 문제 해결에 강해요.',
      high: '새로운 생각과 경험에 열려 있고 상상력이 풍부해요. 추상적인 주제를 즐겨요.',
      mid: '검증된 방식과 새로운 시도를 균형 있게 골라요.',
      low: '현실적이고 실용적이고 익숙한 방식을 믿어요. 구체적인 문제 해결에 강해요.' }
  };
  const ORDER = ['E', 'A', 'C', 'N', 'O'];

  const FACETS = [
    { key: 'greg', f: 'E', label: '사교성', hi: '사람 많은 자리에서 힘을 얻어요.', lo: '소수와 깊게 어울리는 쪽을 택해요.' },
    { key: 'assert', f: 'E', label: '주도성', hi: '의견을 분명히 말하고 앞장서요.', lo: '이끌기보다 지켜보다가 합류하는 편이에요.' },
    { key: 'active', f: 'E', label: '활력', hi: '늘 바쁘게 움직이고 여러 일을 동시에 해요.', lo: '느긋한 속도로 한 번에 하나씩 해요.' },
    { key: 'symp', f: 'A', label: '공감', hi: '다른 사람의 감정이 내 일처럼 느껴져요.', lo: '감정보다 사실에 집중하는 편이에요.' },
    { key: 'coop', f: 'A', label: '협조', hi: '갈등보다 양보와 조율을 택해요.', lo: '필요하면 부딪히는 걸 두려워하지 않아요.' },
    { key: 'trust', f: 'A', label: '신뢰', hi: '사람의 선의를 믿는 편이에요.', lo: '확인되기 전엔 의심을 거두지 않아요.' },
    { key: 'order', f: 'C', label: '체계성', hi: '정돈과 계획이 편해요.', lo: '어수선해도 크게 신경 쓰지 않아요.' },
    { key: 'disc', f: 'C', label: '끈기', hi: '지루한 일도 끝까지 마무리해요.', lo: '미루다가 마감에 몰아서 하는 편이에요.' },
    { key: 'achv', f: 'C', label: '성취 지향', hi: '높은 목표를 세우고 밀어붙여요.', lo: '적당한 선에서 만족할 줄 알아요.' },
    { key: 'anx', f: 'N', label: '불안', hi: '걱정이 많고 최악의 상황을 자주 떠올려요.', lo: '웬만한 일은 걱정하지 않아요.' },
    { key: 'mood', f: 'N', label: '기분 기복', hi: '기분이 자주 오르내리고 쉽게 속상해져요.', lo: '기분이 고르고 잘 가라앉지 않아요.' },
    { key: 'vuln', f: 'N', label: '스트레스 취약성', hi: '압박이 겹치면 감당하기 어려워요.', lo: '급한 상황에서도 침착함을 지켜요.' },
    { key: 'imag', f: 'O', label: '상상력', hi: '공상과 상상을 즐겨요.', lo: '현실적인 것에 집중해요.' },
    { key: 'art', f: 'O', label: '예술 감수성', hi: '음악, 그림, 글에 깊이 빠져들어요.', lo: '예술보다 실용을 우선해요.' },
    { key: 'intel', f: 'O', label: '지적 호기심', hi: '복잡한 문제와 추상적인 생각을 즐겨요.', lo: '구체적이고 손에 잡히는 걸 좋아해요.' }
  ];

  /* [세부, 문항, 역채점] */
  const ITEMS = [
    ['greg', '사람이 많은 곳을 좋아한다.', false],
    ['greg', '모임에 어울리는 것을 즐긴다.', false],
    ['greg', '사람들을 피하는 편이다.', true],
    ['greg', '파티나 모임에서 여러 사람과 두루 이야기를 나눈다.', false],
    ['greg', '혼자 조용히 있는 시간이 더 좋다.', true],
    ['greg', '사람이 붐비는 곳은 될 수 있으면 피한다.', true],
    ['assert', '내 의견을 분명하게 말한다.', false],
    ['assert', '모임에서 주도적으로 나선다.', false],
    ['assert', '다른 사람이 이끌어 주기를 기다린다.', true],
    ['assert', '다른 사람을 설득하는 데 자신이 있다.', false],
    ['assert', '눈에 띄지 않게 뒤에 있는 편이 편하다.', true],
    ['assert', '하고 싶은 말이 있어도 속으로 삼킬 때가 많다.', true],
    ['active', '늘 바쁘게 움직인다.', false],
    ['active', '여러 가지 일을 동시에 할 수 있다.', false],
    ['active', '여유롭고 느긋하게 지내는 것을 좋아한다.', true],
    ['active', '쉬는 날에도 이것저것 많이 한다.', false],
    ['active', '일을 내 속도대로 천천히 하는 편이다.', true],
    ['active', '급하게 움직여야 하는 상황을 좋아하지 않는다.', true],

    ['symp', '다른 사람의 감정에 공감한다.', false],
    ['symp', '힘든 처지의 사람을 보면 마음이 쓰인다.', false],
    ['symp', '다른 사람의 문제에는 별 관심이 없다.', true],
    ['symp', '어려운 사람을 도울 방법을 자주 생각한다.', false],
    ['symp', '각자 힘든 일은 스스로 해결해야 한다고 생각한다.', true],
    ['symp', '마음이 여린 사람을 보면 답답하다.', true],
    ['coop', '갈등을 피하기 위해 양보하는 편이다.', false],
    ['coop', '다른 사람과 함께 일하는 것이 편하다.', false],
    ['coop', '말로 사람을 깎아내릴 때가 있다.', true],
    ['coop', '의견이 부딪히면 먼저 서로 맞출 방법을 찾는다.', false],
    ['coop', '다른 사람의 말에 반박하는 일이 잦다.', true],
    ['coop', '말다툼에서 지는 것을 참기 어렵다.', true],
    ['trust', '사람들을 쉽게 믿는 편이다.', false],
    ['trust', '다른 사람의 선의를 믿는다.', false],
    ['trust', '사람들의 숨은 의도를 의심한다.', true],
    ['trust', '대부분의 사람은 기본적으로 착하다고 생각한다.', false],
    ['trust', '처음 만난 사람은 일단 경계한다.', true],
    ['trust', '사람들의 친절에는 대개 다른 속셈이 있다고 본다.', true],

    ['order', '정돈된 상태를 좋아한다.', false],
    ['order', '계획표대로 움직이는 것이 편하다.', false],
    ['order', '물건을 제자리에 두는 것을 자주 잊는다.', true],
    ['order', '일을 시작하기 전에 순서부터 정한다.', false],
    ['order', '방이 어질러져 있어도 별로 신경 쓰이지 않는다.', true],
    ['order', '책상 위가 늘 어수선하다.', true],
    ['disc', '해야 할 일을 바로 처리한다.', false],
    ['disc', '지루한 일도 끝까지 마무리한다.', false],
    ['disc', '일을 미루다가 시간에 쫓긴다.', true],
    ['disc', '세운 계획은 끝까지 실행에 옮긴다.', false],
    ['disc', '일을 시작하기까지 시간이 오래 걸린다.', true],
    ['disc', '누가 재촉해야 겨우 일을 시작한다.', true],
    ['achv', '기대 이상의 성과를 내려고 한다.', false],
    ['achv', '높은 목표를 세우고 밀어붙인다.', false],
    ['achv', '적당히 해도 된다고 생각한다.', true],
    ['achv', '맡은 일에는 늘 최선을 다한다.', false],
    ['achv', '크게 성공하고 싶은 욕심은 없다.', true],
    ['achv', '일에는 딱 필요한 만큼만 힘을 쓴다.', true],

    ['anx', '이런저런 걱정을 많이 한다.', false],
    ['anx', '최악의 상황을 자주 떠올린다.', false],
    ['anx', '대부분의 시간 동안 느긋하다.', true],
    ['anx', '사소한 일에도 쉽게 긴장한다.', false],
    ['anx', '이미 지난 일은 크게 걱정하지 않는다.', true],
    ['anx', '웬만한 일에는 마음이 흔들리지 않는다.', true],
    ['mood', '기분 변화가 잦다.', false],
    ['mood', '쉽게 속상해진다.', false],
    ['mood', '우울해지는 일이 거의 없다.', true],
    ['mood', '별일 아닌 일로 기분이 확 가라앉을 때가 있다.', false],
    ['mood', '대체로 기분이 고르게 유지된다.', true],
    ['mood', '속상한 일이 있어도 금방 털어 낸다.', true],
    ['vuln', '압박을 받으면 쉽게 무너진다.', false],
    ['vuln', '힘든 일이 겹치면 감당하기 어렵다.', false],
    ['vuln', '급한 상황에서 침착함을 유지한다.', true],
    ['vuln', '예상하지 못한 일이 생기면 쉽게 당황한다.', false],
    ['vuln', '어려운 문제가 생겨도 해결할 방법을 찾아낸다.', true],
    ['vuln', '실패해도 금방 다시 일어선다.', true],

    ['imag', '상상력이 풍부하다.', false],
    ['imag', '공상에 잠기는 것을 좋아한다.', false],
    ['imag', '상상력이 좋은 편이 아니다.', true],
    ['imag', '생각에 빠져 시간 가는 줄 모를 때가 있다.', false],
    ['imag', '공상에 잠기는 일은 거의 없다.', true],
    ['imag', '머릿속으로 무언가를 그려 보는 게 어렵다.', true],
    ['art', '예술 작품을 보면 감동을 받는다.', false],
    ['art', '음악이나 그림에 깊이 빠져든다.', false],
    ['art', '시를 읽는 것은 시간 낭비라고 느낀다.', true],
    ['art', '남들이 그냥 지나치는 것에서도 아름다움을 발견한다.', false],
    ['art', '미술관이나 공연장에 가는 것은 지루하다.', true],
    ['art', '예술이 생활에 꼭 필요하다고 생각하지 않는다.', true],
    ['intel', '복잡한 문제를 푸는 것을 즐긴다.', false],
    ['intel', '아이디어가 넘친다.', false],
    ['intel', '추상적인 개념에는 관심이 없다.', true],
    ['intel', '어려운 책도 끝까지 읽어 보려고 한다.', false],
    ['intel', '철학적인 이야기는 피하는 편이다.', true],
    ['intel', '이론을 따지는 토론에는 별로 끌리지 않는다.', true]
  ];

  /* 기본 검사: 세부마다 6문항(정 3·역 3) 중 정 2·역 2를 무작위로 골라 60문항. 정밀 검사: 90문항 전부(세부마다 정 3·역 3).
     세부마다 정·역 개수가 같아야 "매우 그렇다"만 고르는 응답 경향이 가짜 성격 유형을 만들지 않는다
     (정 2·역 1과 정 1·역 2를 섞으면 전부 5점에도 특정 갈래가 67점으로 튀었다). */
  function build(mode) {
    const r = U.rng();
    const full = mode === 'full';
    const by = {};
    ITEMS.forEach(function (it) { const g = by[it[0]] = by[it[0]] || { f: [], r: [] }; g[it[2] ? 'r' : 'f'].push(it); });
    const chosen = {};
    FACETS.forEach(function (fc) {
      const g = by[fc.key];
      chosen[fc.key] = r.shuffle(full ? g.f.concat(g.r) : r.sample(g.f, 2).concat(r.sample(g.r, 2)));
    });
    const per = full ? 6 : 4;
    const n = FACETS.length * per;
    const items = [{ type: 'section', num: 1, title: '나에 대한 문장들', desc: '짧은 문장을 읽고 평소의 나와 얼마나 가까운지 골라요. 오래 고민하지 말고 처음 떠오르는 답을 고르면 돼요.', count: n + '문항 · 약 ' + Math.round(n / 7.5) + '분' }];
    for (let i = 0; i < per; i++) FACETS.forEach(function (fc) {
      const it = chosen[fc.key][i];
      items.push({ type: 'likert', scored: true, facet: fc.key, factor: fc.f, reverse: it[2], text: it[1] });
    });
    return items;
  }

  function score(answers, items, meta) {
    const sums = {}, counts = {};
    items.forEach(function (it, i) {
      if (it.type !== 'likert') return;
      const a = answers[i];
      if (typeof a !== 'number') return;
      const v = it.reverse ? 6 - a : a;
      sums[it.facet] = (sums[it.facet] || 0) + v;
      counts[it.facet] = (counts[it.facet] || 0) + 1;
    });
    const facetVal = {};
    FACETS.forEach(function (fc) { const m = counts[fc.key] ? sums[fc.key] / counts[fc.key] : 3; facetVal[fc.key] = Math.round((m - 1) / 4 * 100); });
    const scales = ORDER.map(function (f) {
      const fs = FACETS.filter(function (fc) { return fc.f === f; });
      const v = Math.round(U.mean(fs.map(function (fc) { return facetVal[fc.key]; })));
      return { key: f, label: F[f].label, value: v, children: fs.map(function (fc) { return { key: fc.key, label: fc.label, value: facetVal[fc.key] }; }) };
    });
    const sorted = scales.slice().sort(function (a, b) { return b.value - a.value; });
    const top = sorted[0];
    const balanced = top.value < 60 || top.value - sorted[1].value < 5;
    const fsSorted = FACETS.slice().sort(function (a, b) { return facetVal[b.key] - facetVal[a.key]; });
    const hi = fsSorted.slice(0, 3), lo = fsSorted.slice(-3).reverse();
    // 세부 설명은 점수 구간에 맞는 문장만 쓴다 (높은 점수에 "낮음" 설명이 붙지 않도록)
    const facetText = function (fc) {
      const v = facetVal[fc.key];
      return fc.label + '(' + v + '): ' + (v >= 65 ? fc.hi : v <= 35 ? fc.lo : '보통 수준이에요.');
    };
    const sections = scales.map(function (s) { return { title: s.label + ' ' + s.value, body: F[s.key][U.level(s.value)] }; });
    sections.push({ title: '가장 높은 세부 특성', body: hi.map(facetText).join(' ') });
    sections.push({ title: '가장 낮은 세부 특성', body: lo.map(facetText).join(' ') });
    const summary = (balanced
      ? '다섯 갈래가 고르게 나와서 특별히 두드러진 성격이 없는 균형형이에요. 가장 높은 건 ' + top.label + ' ' + top.value + '점이에요.'
      : '가장 두드러진 성격은 ' + top.label + ' ' + top.value + '점이에요. ' + F[top.key][U.level(top.value)]) +
      ' 세부 특성 중에서는 ' + hi[0].label + ' ' + facetVal[hi[0].key] + '점이 가장 높고 ' + lo[0].label + ' ' + facetVal[lo[0].key] + '점이 가장 낮아요.';
    return {
      modeLabel: meta && meta.mode === 'full' ? '정밀 검사' : '기본 검사',
      headline: balanced ? '균형형' : F[top.key].nick,
      value: top.value,
      label: balanced ? '두드러진 특성 없음' : '두드러진 특성 · ' + top.label,
      summary: summary,
      scales: scales,
      sections: sections
    };
  }

  BL.tests.personality = {
    id: 'personality',
    num: 3,
    kind: 'trait',
    kindLabel: '성향',
    title: '성격 검사',
    subtitle: '사람을 좋아하는지, 꼼꼼한지, 걱정이 많은지, 새로운 걸 즐기는지. 성격을 다섯 갈래, 열다섯 가지로 나눠서 봐요.',
    duration: '약 8~12분',
    length: '60·90문항 · 15세부',
    modes: [
      { id: 'standard', label: '기본 검사', desc: '세부 특성마다 4문항씩 60문항이에요. 90개 문장 중에서 골라 나와서 다시 해도 문항이 조금씩 바뀌어요.', duration: '약 8분', length: '60문항' },
      { id: 'full', label: '정밀 검사', desc: '90개 문장을 모두 풀어요. 세부 특성마다 6문항이라 점수가 더 안정적이에요.', duration: '약 12분', length: '90문항' }
    ],
    explain: ORDER.map(function (f) { return { label: F[f].label, what: F[f].what, where: F[f].where, tasks: FACETS.filter(function (fc) { return fc.f === f; }).map(function (fc) { return fc.label; }).join(', ') }; }),
    intro: [
      '심리학에서 가장 널리 쓰는 성격 모델인 "빅파이브"를 기준으로 해요. 성격을 다섯 갈래로 보고, 갈래마다 세 가지를 더 자세히 봐요.',
      '문항은 누구나 쓸 수 있게 공개된 국제 성격 문항(IPIP)을 우리말로 옮긴 거예요.',
      '정답은 없어요. 솔직하게, 처음 떠오르는 대로 고르면 가장 정확해요.',
      '결과에는 다섯 갈래 점수와 열다섯 가지 세부 점수, 그리고 가장 두드러지는 성격에 붙인 별명이 나와요.'
    ],
    build: build,
    score: score
  };
})();
