/* 실험 03 · 성격 검사 (빅파이브, 15개 세부 특성)
   문항은 공개 도메인인 IPIP(International Personality Item Pool)의 요인·세부 척도 항목을 바탕으로 한국어로 번역·각색한 것이다.
   요인 5 × 세부 3 × 문항 3 = 45문항, 5점 척도. true는 역채점. */
(function () {
  const U = BL.util;

  const F = {
    E: { label: '외향성', nick: '에너자이저형',
      high: '사람들과의 교류에서 에너지를 얻고 먼저 다가가는 편입니다. 모임에서 분위기를 이끄는 역할이 자연스럽습니다.',
      mid: '상황에 따라 어울리기도 하고 혼자 충전하기도 합니다. 둘 다 편안한 균형형입니다.',
      low: '혼자만의 시간에서 힘을 얻고, 넓은 관계보다 깊은 관계 몇 개를 선호합니다. 조용히 관찰하는 힘이 강점입니다.' },
    A: { label: '친화성', nick: '조력자형',
      high: '타인의 감정을 잘 헤아리고 협력을 중시합니다. 사람들이 당신 곁에서 편안함을 느낍니다.',
      mid: '필요할 때 양보하지만 자기 입장도 분명히 합니다.',
      low: '솔직하고 직설적이며, 경쟁이나 협상 상황에서 강합니다. 때로 차갑다는 오해를 받을 수 있습니다.' },
    C: { label: '성실성', nick: '설계자형',
      high: '계획적이고 끈기 있게 마무리합니다. 믿고 맡길 수 있는 사람이라는 평을 듣습니다.',
      mid: '중요한 일엔 꼼꼼하고 나머지는 유연하게 넘깁니다.',
      low: '즉흥적이고 변화에 빠르게 적응합니다. 마무리가 느슨해질 수 있어 작은 마감 장치를 두면 좋습니다.' },
    N: { label: '정서 민감성', nick: '감지기형',
      high: '감정을 깊게 느끼고 위험 신호를 빨리 알아차립니다. 그만큼 스트레스 관리가 중요한 타입입니다.',
      mid: '대체로 안정적이지만 압박이 크면 흔들립니다. 보통 수준의 민감성입니다.',
      low: '웬만한 일에 동요하지 않고 침착합니다. 위기 상황에서 주변을 안정시키는 역할을 합니다.' },
    O: { label: '개방성', nick: '탐험가형',
      high: '새로운 생각과 경험에 열려 있고 상상력이 풍부합니다. 추상적인 주제를 즐깁니다.',
      mid: '검증된 방식과 새로운 시도를 균형 있게 택합니다.',
      low: '현실적이고 실용적이며 익숙한 방식을 신뢰합니다. 구체적인 문제 해결에 강합니다.' }
  };
  const ORDER = ['E', 'A', 'C', 'N', 'O'];

  const FACETS = [
    { key: 'greg', f: 'E', label: '사교성', hi: '사람 많은 자리에서 힘을 얻습니다.', lo: '소수와 깊게 어울리는 쪽을 택합니다.' },
    { key: 'assert', f: 'E', label: '주도성', hi: '의견을 분명히 말하고 앞장섭니다.', lo: '이끌기보다 지켜보다 합류하는 편입니다.' },
    { key: 'active', f: 'E', label: '활력', hi: '늘 바쁘게 움직이고 여러 일을 동시에 합니다.', lo: '느긋한 속도로 한 번에 하나씩 합니다.' },
    { key: 'symp', f: 'A', label: '공감', hi: '다른 사람의 감정이 내 일처럼 느껴집니다.', lo: '감정보다 사실에 집중하는 편입니다.' },
    { key: 'coop', f: 'A', label: '협조', hi: '갈등보다 양보와 조율을 택합니다.', lo: '필요하면 부딪히는 것을 두려워하지 않습니다.' },
    { key: 'trust', f: 'A', label: '신뢰', hi: '사람의 선의를 믿는 편입니다.', lo: '검증되기 전엔 의심을 거두지 않습니다.' },
    { key: 'order', f: 'C', label: '체계성', hi: '정돈과 계획이 편안합니다.', lo: '어수선해도 크게 신경 쓰지 않습니다.' },
    { key: 'disc', f: 'C', label: '끈기', hi: '지루한 일도 끝까지 마무리합니다.', lo: '미루다가 마감에 몰아서 하는 편입니다.' },
    { key: 'achv', f: 'C', label: '성취 지향', hi: '높은 목표를 세우고 밀어붙입니다.', lo: '적당한 선에서 만족할 줄 압니다.' },
    { key: 'anx', f: 'N', label: '불안', hi: '걱정이 많고 최악의 상황을 자주 떠올립니다.', lo: '웬만한 일은 걱정하지 않습니다.' },
    { key: 'mood', f: 'N', label: '기분 기복', hi: '기분이 자주 오르내리고 쉽게 속상해집니다.', lo: '기분이 고르고 잘 가라앉지 않습니다.' },
    { key: 'vuln', f: 'N', label: '스트레스 취약성', hi: '압박이 겹치면 감당하기 어렵습니다.', lo: '급한 상황에서도 침착함을 유지합니다.' },
    { key: 'imag', f: 'O', label: '상상력', hi: '공상과 상상을 즐깁니다.', lo: '현실적인 것에 집중합니다.' },
    { key: 'art', f: 'O', label: '예술 감수성', hi: '음악·그림·글에 깊이 빠져듭니다.', lo: '예술보다 실용을 우선합니다.' },
    { key: 'intel', f: 'O', label: '지적 호기심', hi: '복잡한 문제와 추상적인 생각을 즐깁니다.', lo: '구체적이고 손에 잡히는 것을 선호합니다.' }
  ];

  /* [세부, 문항, 역채점] */
  const ITEMS = [
    ['greg', '사람이 많은 곳을 좋아한다.', false],
    ['greg', '모임에 어울리는 것을 즐긴다.', false],
    ['greg', '사람들을 피하는 편이다.', true],
    ['assert', '내 의견을 분명하게 말한다.', false],
    ['assert', '모임에서 주도적으로 나선다.', false],
    ['assert', '다른 사람이 이끌어 주기를 기다린다.', true],
    ['active', '늘 바쁘게 움직인다.', false],
    ['active', '여러 가지 일을 동시에 할 수 있다.', false],
    ['active', '여유롭고 느긋하게 지내는 것을 좋아한다.', true],

    ['symp', '다른 사람의 감정에 공감한다.', false],
    ['symp', '힘든 처지의 사람을 보면 마음이 쓰인다.', false],
    ['symp', '다른 사람의 문제에는 별 관심이 없다.', true],
    ['coop', '갈등을 피하기 위해 양보하는 편이다.', false],
    ['coop', '다른 사람과 함께 일하는 것이 편하다.', false],
    ['coop', '말로 사람을 깎아내릴 때가 있다.', true],
    ['trust', '사람들을 쉽게 믿는 편이다.', false],
    ['trust', '다른 사람의 선의를 믿는다.', false],
    ['trust', '사람들의 숨은 의도를 의심한다.', true],

    ['order', '정돈된 상태를 좋아한다.', false],
    ['order', '계획표대로 움직이는 것이 편하다.', false],
    ['order', '물건을 제자리에 두는 것을 자주 잊는다.', true],
    ['disc', '해야 할 일을 바로 처리한다.', false],
    ['disc', '지루한 일도 끝까지 마무리한다.', false],
    ['disc', '일을 미루다가 시간에 쫓긴다.', true],
    ['achv', '기대 이상의 성과를 내려고 한다.', false],
    ['achv', '높은 목표를 세우고 밀어붙인다.', false],
    ['achv', '적당히 해도 된다고 생각한다.', true],

    ['anx', '이런저런 걱정을 많이 한다.', false],
    ['anx', '최악의 상황을 자주 떠올린다.', false],
    ['anx', '대부분의 시간 동안 느긋하다.', true],
    ['mood', '기분 변화가 잦다.', false],
    ['mood', '쉽게 속상해진다.', false],
    ['mood', '우울해지는 일이 거의 없다.', true],
    ['vuln', '압박을 받으면 쉽게 무너진다.', false],
    ['vuln', '힘든 일이 겹치면 감당하기 어렵다.', false],
    ['vuln', '급한 상황에서 침착함을 유지한다.', true],

    ['imag', '상상력이 풍부하다.', false],
    ['imag', '공상에 잠기는 것을 좋아한다.', false],
    ['imag', '상상력이 좋은 편이 아니다.', true],
    ['art', '예술 작품을 보면 감동을 받는다.', false],
    ['art', '음악이나 그림에 깊이 빠져든다.', false],
    ['art', '시를 읽는 것은 시간 낭비라고 느낀다.', true],
    ['intel', '복잡한 문제를 푸는 것을 즐긴다.', false],
    ['intel', '아이디어가 넘친다.', false],
    ['intel', '추상적인 개념에는 관심이 없다.', true]
  ];

  function build() {
    const by = {};
    ITEMS.forEach(function (it) { (by[it[0]] = by[it[0]] || []).push(it); });
    const items = [{ type: 'section', num: 1, title: '나에 대한 진술', desc: '45개의 짧은 문장을 읽고, 평소의 나와 얼마나 가까운지 고릅니다. 오래 고민하지 말고 처음 떠오르는 답을 고르세요.', count: '45문항 · 약 6분' }];
    for (let i = 0; i < 3; i++) FACETS.forEach(function (fc) {
      const it = by[fc.key][i];
      items.push({ type: 'likert', scored: true, facet: fc.key, factor: fc.f, reverse: it[2], text: it[1] });
    });
    return items;
  }

  function score(answers, items) {
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
      return fc.label + '(' + v + '): ' + (v >= 65 ? fc.hi : v <= 35 ? fc.lo : '보통 수준입니다.');
    };
    const sections = scales.map(function (s) { return { title: s.label + ' ' + s.value, body: F[s.key][U.level(s.value)] }; });
    sections.push({ title: '가장 높은 세부 특성', body: hi.map(facetText).join(' ') });
    sections.push({ title: '가장 낮은 세부 특성', body: lo.map(facetText).join(' ') });
    const summary = (balanced
      ? '다섯 요인이 고르게 분포해 특별히 두드러진 특성이 없는 균형형입니다. 가장 높은 요인은 ' + top.label + ' ' + top.value + '점입니다.'
      : '가장 두드러진 특성은 ' + top.label + ' ' + top.value + '점입니다. ' + F[top.key][U.level(top.value)]) +
      ' 세부 특성 중에서는 ' + hi[0].label + ' ' + facetVal[hi[0].key] + '점이 가장 높고 ' + lo[0].label + ' ' + facetVal[lo[0].key] + '점이 가장 낮습니다.';
    return {
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
    subtitle: '외향성, 친화성, 성실성, 정서 민감성, 개방성. 다섯 요인을 열다섯 가지 세부 특성으로 나누어 측정합니다.',
    duration: '약 6분',
    length: '45문항 · 15세부',
    intro: [
      '성격 심리학의 표준 모델인 빅파이브(다섯 요인)를 기준으로, 요인마다 세 가지 세부 특성을 따로 봅니다.',
      '문항은 공개된 국제 성격 문항 풀(IPIP)을 바탕으로 한국어로 번역·각색한 것입니다.',
      '정답이 없으니 솔직하게, 처음 떠오르는 대로 답하세요.',
      '결과는 다섯 요인 점수, 열다섯 세부 특성 점수, 가장 두드러진 특성의 별명으로 나옵니다.'
    ],
    build: build,
    score: score
  };
})();
