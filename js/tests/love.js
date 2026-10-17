/* 실험 06 · 연애 스타일 검사
   존 리(John Alan Lee)가 나눈 사랑의 여섯 가지 스타일(에로스·루두스·스토르게·프래그마·마니아·아가페)을 틀로 쓰고,
   스타일마다 8문장(정방향 4 + 역방향 4) = 48문항. 문항은 전부 직접 썼다(공개된 사랑 태도 척도 문항을 옮기지 않음).
   연애 경험이 없어도 답할 수 있게 "연애할 때/한다면" 꼴로 쓰고, 성별을 가정하지 않는다(연인·상대). */
(function () {
  const U = BL.util;

  const STYLES = [
    { key: 'eros', name: '열정형', orig: '에로스', tag: '첫눈에 끌리는 사랑',
      what: '처음부터 강하게 끌리고, 설렘과 깊은 교감을 연애의 중심에 두는 정도예요.',
      where: '첫인상에 얼마나 끌리는지, 연애 초반에 얼마나 빨리 마음을 여는지, 설렘이 연애에서 얼마나 큰 자리를 차지하는지가 여기서 갈려요.',
      desc: '끌리는 사람을 만나면 마음이 빠르게 움직여요. 설렘과 "잘 통한다"는 느낌이 연애에서 가장 중요해요.',
      example: '예를 들어 처음 만난 자리에서 "이 사람이다" 싶은 느낌이 오면 그날부터 다음 만남이 기다려지고, 만난 지 얼마 안 돼도 속 깊은 이야기까지 나누게 돼요.',
      good: '좋아하는 마음을 숨기지 않고 표현해서, 상대가 사랑받고 있다고 느끼기 쉬워요. 감정 표현을 반기는 상대와 특히 잘 맞아요.',
      care: '처음의 설렘이 잦아드는 건 자연스러운 일인데, 이걸 "마음이 식었다"로 읽기 쉬워요. 첫인상만 보고 사람을 빨리 판단하지 않는 것도 도움이 돼요.',
      lo: '첫눈에 반하기보다 천천히 마음이 가는 편이에요.' },
    { key: 'ludus', name: '놀이형', orig: '루두스', tag: '즐겁고 자유로운 사랑',
      what: '연애를 무겁지 않게, 즐거운 놀이처럼 대하고 서로의 자유를 중요하게 여기는 정도예요.',
      where: '밀고 당기기를 즐기는지, 한 사람에게 일찍 정착하는지, 이별 뒤에 얼마나 빨리 털고 일어나는지가 여기서 갈려요.',
      desc: '연애는 즐거워야 한다고 생각해요. 너무 빨리 무거워지는 관계보다 서로 자유로운 관계를 좋아해요.',
      example: '예를 들어 연애 초반에 주고받는 밀고 당기기를 게임처럼 즐기고, 한 사람에게 일찍 정하기보다 여러 사람을 만나 보며 나와 맞는 사람을 찾는 편이에요.',
      good: '상대를 구속하지 않고, 함께 있는 시간을 즐겁게 만들어요. 서로의 자유를 존중하는 상대와 잘 맞고, 이별을 해도 비교적 빨리 회복해요.',
      care: '상대는 내 마음이 어디까지 진지한지 헷갈릴 수 있어요. 관계에서 바라는 것과 바라지 않는 것을 솔직하게 말해 주면 오해가 줄어요.',
      lo: '연애를 가볍게 즐기기보다 진지하게 대하는 편이에요.' },
    { key: 'storge', name: '친구형', orig: '스토르게', tag: '친구처럼 스며드는 사랑',
      what: '우정처럼 천천히 쌓이는 편안함과 믿음을 사랑의 바탕으로 여기는 정도예요.',
      where: '친구가 연인이 되는 게 자연스러운지, 설렘보다 편안함을 얼마나 중요하게 여기는지, 사랑이 천천히 자라는 걸 좋아하는지가 여기서 갈려요.',
      desc: '함께한 시간이 쌓이며 자라는 사랑을 좋아해요. 연인이 가장 편한 친구이기도 하길 바라요.',
      example: '예를 들어 오래 알고 지낸 사람에게 어느 날 문득 마음이 가 있는 걸 알아차리고, 데이트도 특별한 이벤트보다 같이 밥 먹고 산책하는 평범한 날이 더 좋아요.',
      good: '믿음과 편안함이 단단해서 관계가 오래가고, 다툼도 차분하게 풀어 가요. 천천히 알아 가는 걸 좋아하는 상대와 특히 잘 맞아요.',
      care: '마음이 생기는 속도가 느려서 고백할 때를 놓치기 쉽고, 설렘을 중요하게 여기는 상대는 밋밋하다고 느낄 수 있어요. 가끔은 좋아하는 마음을 말로 꺼내 주세요.',
      lo: '오래 쌓인 우정보다 처음부터 연인으로 끌리는 만남을 더 좋아하는 편이에요.' },
    { key: 'pragma', name: '실용형', orig: '프래그마', tag: '현실을 살피는 사랑',
      what: '가치관, 생활 방식, 앞날의 계획처럼 현실적인 궁합을 따져 보며 사랑하는 정도예요.',
      where: '연애를 시작하기 전에 무엇을 확인하는지, 미래를 얼마나 함께 그려 보는지, 마음과 머리 중 어느 쪽을 더 따르는지가 여기서 갈려요.',
      desc: '좋아하는 마음과 함께 "우리가 오래 잘 지낼 수 있을까"도 꼼꼼히 살펴요. 현실의 궁합도 사랑의 일부라고 생각해요.',
      example: '예를 들어 끌리는 사람이 생겨도 돈 쓰는 습관이나 쉬는 날을 보내는 방식이 나와 맞는지 먼저 살피고, 사귀게 되면 앞으로의 계획을 일찍 이야기해 보고 싶어요.',
      good: '맞춰 갈 부분을 미리 알고 시작해서 큰 충돌이 적고, 함께 미래를 계획하는 데 강해요. 목표를 같이 세우는 걸 좋아하는 상대와 잘 맞아요.',
      care: '조건을 먼저 살피는 모습이 상대에게 계산적으로 보일 수 있어요. 따져 보는 것만큼 좋아하는 마음도 자주 말로 전해 주세요.',
      lo: '조건이나 앞날보다 지금의 마음을 따라가는 편이에요.' },
    { key: 'mania', name: '몰입형', orig: '마니아', tag: '온 마음을 쏟는 사랑',
      what: '연애에 온 마음을 쏟고, 연인의 반응에 따라 감정이 크게 오르내리는 정도예요.',
      where: '연애가 생활에서 차지하는 크기, 연인의 작은 반응에 흔들리는 정도, 질투를 느끼는 정도가 여기서 갈려요.',
      desc: '사랑에 빠지면 그 사람이 생활의 중심이 되고, 기쁨도 서운함도 크게 느껴요.',
      example: '예를 들어 연인의 다정한 한마디에 하루 종일 들뜨다가도, 답장이 평소보다 짧으면 무슨 일이 있는지 계속 마음이 쓰여요.',
      good: '누구보다 깊이 사랑하고, 연인의 작은 변화도 금방 알아차려요. 마음을 자주 표현해 주는 다정한 상대와 잘 맞아요.',
      care: '감정이 크게 오르내리면 나도 상대도 쉽게 지쳐요. 친구, 취미, 일처럼 연애 밖의 생활을 지켜 두면 마음이 한결 안정돼요.',
      lo: '연애 중에도 감정의 오르내림이 크지 않고, 내 생활의 리듬을 지키는 편이에요.' },
    { key: 'agape', name: '헌신형', orig: '아가페', tag: '내어 주는 사랑',
      what: '대가를 바라지 않고 연인의 행복을 먼저 챙기는 정도예요.',
      where: '연인을 위해 내 시간과 계획을 얼마나 양보하는지, 서운한 일을 얼마나 너그럽게 넘기는지가 여기서 갈려요.',
      desc: '연인이 행복한 모습을 보는 게 큰 기쁨이에요. 계산하지 않고 먼저 챙겨요.',
      example: '예를 들어 연인이 시험이나 큰일을 앞두고 있으면 내 약속을 미루고 응원하러 가고, 연인이 실수해도 탓하기보다 괜찮다고 먼저 말해 줘요.',
      good: '따뜻하고 너그러워서 연인이 기댈 수 있는 든든한 사람이 돼요. 고마움을 알고 같이 챙겨 주는 상대와 특히 잘 맞아요.',
      care: '내가 원하는 것을 계속 미루다 보면 어느 순간 지치거나 서운함이 쌓여요. 받는 것도 사랑의 일부예요. 내가 원하는 것도 말로 전해 주세요.',
      lo: '연인을 아끼면서도 내 몫과 내 계획을 분명히 챙기는 편이에요.' }
  ];
  /* [스타일, 문항, 역채점] — 스타일마다 정방향 4문항 + 역방향 4문항. "그렇다"만 고르는 응답 경향을 상쇄한다. */
  const ITEMS = [
    ['eros', '좋아하게 되는 사람은 대개 처음 만났을 때부터 끌린 사람이다.', false],
    ['eros', '연애할 때 서로 강하게 끌리는 설렘이 무엇보다 중요하다.', false],
    ['eros', '마음이 통하는 사람을 만나면 처음부터 깊은 이야기까지 나누고 싶어진다.', false],
    ['eros', '연애를 한다면 "바로 이 사람이다" 싶은 강한 느낌이 드는 상대를 만나고 싶다.', false],
    ['eros', '첫눈에 반하는 일은 나와 거리가 멀다.', true],
    ['eros', '연애할 때 설렘이나 강하게 끌리는 느낌은 그리 중요하지 않다.', true],
    ['eros', '외모나 첫인상만으로 누군가에게 마음이 가는 일은 드물다.', true],
    ['eros', '연애 상대에게 운명 같은 느낌까지 바라지는 않는다.', true],
    ['ludus', '연애는 너무 무겁지 않고 즐거운 게 제일이라고 생각한다.', false],
    ['ludus', '연애 초반에 밀고 당기는 과정이 재미있다.', false],
    ['ludus', '연애를 한다면 한 사람에게 일찍 정하기보다 여러 사람을 만나 보고 싶다.', false],
    ['ludus', '연애가 끝나도 오래 붙잡고 있기보다 금방 털고 일어나는 편이다.', false],
    ['ludus', '연애는 가볍게 즐기기보다 진지하게 하고 싶다.', true],
    ['ludus', '밀고 당기기 같은 연애 기술은 피곤하게 느껴진다.', true],
    ['ludus', '좋아하는 사람에게는 내 마음을 헷갈리지 않게 분명히 보여 주는 편이다.', true],
    ['ludus', '여러 사람을 가볍게 만나기보다 한 사람과 깊게 만나는 연애가 나와 맞다.', true],
    ['storge', '오래 알고 지낸 친구 같은 사람과 연애하는 것이 가장 자연스럽다.', false],
    ['storge', '사랑은 함께한 시간이 쌓이면서 천천히 자라는 거라고 생각한다.', false],
    ['storge', '연인은 무엇보다 편하게 같이 놀 수 있는 친구 같은 사람이면 좋겠다.', false],
    ['storge', '언제부터 좋아했는지 모르게 서서히 스며드는 연애가 좋다.', false],
    ['storge', '친구로 지내던 사람이 연인이 되는 건 잘 상상이 안 된다.', true],
    ['storge', '편하기만 한 관계는 연애라기보다 우정에 가깝다고 느낀다.', true],
    ['storge', '오래 알아 가기보다 처음부터 연인이 될 사람으로 만나는 편이 좋다.', true],
    ['storge', '잘 아는 사이보다 아직 모르는 게 많은 사람에게 더 끌린다.', true],
    ['pragma', '연애를 시작하기 전에 생활 방식이나 가치관이 나와 맞는지 따져 본다.', false],
    ['pragma', '연애할 때 좋아하는 마음만큼 함께할 미래가 그려지는지도 중요하다.', false],
    ['pragma', '연애 상대를 볼 때 돈 쓰는 습관이나 생활 습관 같은 현실적인 부분도 살핀다.', false],
    ['pragma', '오래 함께하기 어려워 보이는 사람이라면 끌려도 연애를 시작하지 않는 편이다.', false],
    ['pragma', '사랑에 빠지면 조건이나 앞날은 별로 따지지 않는다.', true],
    ['pragma', '연인의 조건을 따지는 건 사랑답지 않다고 느낀다.', true],
    ['pragma', '앞으로의 계획이 서로 달라도 지금 좋으면 연애를 시작한다.', true],
    ['pragma', '연애는 머리보다 마음이 이끄는 대로 하는 편이다.', true],
    ['mania', '연애를 시작하면 하루 종일 그 사람 생각이 머리를 떠나지 않는다.', false],
    ['mania', '연인의 작은 반응 하나에 하루 기분이 크게 오르내린다.', false],
    ['mania', '연인이 다른 사람과 가깝게 지내면 질투가 크게 난다.', false],
    ['mania', '연애에 빠지면 공부나 일이 손에 잘 안 잡힌다.', false],
    ['mania', '연애 중에도 내 생활의 리듬은 크게 흔들리지 않는다.', true],
    ['mania', '연인이 다른 사람과 친하게 지내도 질투가 별로 나지 않는다.', true],
    ['mania', '연인의 반응 때문에 기분이 크게 오르내리는 일은 드물다.', true],
    ['mania', '연애를 해도 친구나 취미에 쓰는 시간은 그대로 지키는 편이다.', true],
    ['agape', '연인이 행복하다면 내가 조금 손해를 봐도 괜찮다.', false],
    ['agape', '연인에게 힘든 일이 생기면 내 일정부터 비우게 된다.', false],
    ['agape', '연애할 때 바라는 것보다 해 주고 싶은 것이 더 많다.', false],
    ['agape', '연인이 실수해도 탓하기보다 감싸 주는 편이다.', false],
    ['agape', '연애에서도 내가 손해 보는 일은 되도록 피하고 싶다.', true],
    ['agape', '연인을 위해 내 계획을 바꾸는 일은 거의 없다.', true],
    ['agape', '내가 해 준 만큼 연인도 돌려줘야 공평하다고 느낀다.', true],
    ['agape', '연인이 원하는 것보다 내가 원하는 것을 먼저 챙기는 편이다.', true]
  ];
  const NOTE = '사람마다 여러 스타일이 섞여 있고, 누구를 만나는지와 어떤 시기를 보내는지에 따라 달라져요. 가장 높은 스타일도 "지금의 나와 가까운 모습" 정도로 봐 주세요. 어느 스타일이 더 좋거나 나쁜 것도 아니에요. 연인과 스타일이 다르다면 서로 무엇을 중요하게 여기는지 이야기해 보는 게 도움이 돼요.';

  /* 기본 검사: 스타일마다 8문항(정 4·역 4) 중 정 2·역 2를 무작위로 골라 24문항. 정밀 검사: 48문항 전부.
     정·역이 항상 반반이라 "그렇다"만 고르거나 "보통이다"만 골라도 여섯 스타일이 모두 50점이 되어 한쪽으로 기울지 않는다. */
  function build(mode) {
    const r = U.rng();
    const full = mode === 'full';
    const by = {};
    ITEMS.forEach(function (it) { const g = by[it[0]] = by[it[0]] || { f: [], r: [] }; g[it[2] ? 'r' : 'f'].push({ type: 'likert', scored: true, facet: it[0], reverse: it[2], text: it[1] }); });
    const chosen = {};
    STYLES.forEach(function (s) { const g = by[s.key]; chosen[s.key] = r.shuffle(full ? g.f.concat(g.r) : r.sample(g.f, 2).concat(r.sample(g.r, 2))); });
    const per = full ? 8 : 4;
    const items = [];
    for (let i = 0; i < per; i++) STYLES.forEach(function (s) { items.push(chosen[s.key][i]); });
    // 같은 스타일이 뭉치지 않도록 스타일 수(6개) 단위 블록 안에서만 섞는다
    const out = [];
    for (let i = 0; i < items.length; i += STYLES.length) out.push.apply(out, r.shuffle(items.slice(i, i + STYLES.length)));
    out.unshift({ type: 'section', num: 1, title: '연애할 때의 나', desc: '문장을 읽고 연애할 때의 나와 얼마나 가까운지 골라요. 지금 연애 중이 아니거나 연애를 해 본 적이 없다면 "연애를 한다면 나는 어떨까"를 떠올려 주세요. 정답은 없으니 처음 떠오르는 대로 고르면 돼요.', count: items.length + '문항 · 약 ' + Math.round(items.length / 6) + '분' });
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
    const v = {};
    STYLES.forEach(function (s) { const m = counts[s.key] ? sums[s.key] / counts[s.key] : 3; v[s.key] = Math.round((m - 1) / 4 * 100); });
    // 점수가 같으면 순서를 무작위로 정한다 (늘 앞 순서인 열정형이 뽑히는 쏠림을 막는다). 결과는 채점할 때 한 번 저장된다.
    const r = U.rng();
    const tie = {};
    STYLES.forEach(function (s) { tie[s.key] = r.next(); });
    const sorted = STYLES.slice().sort(function (a, b) { return v[b.key] - v[a.key] || tie[a.key] - tie[b.key]; });
    const top = sorted[0], second = sorted[1], low = sorted[sorted.length - 1];
    const pts = function (s) { return s.name + '(' + v[s.key] + '점)'; };
    // 같은 점수의 스타일은 모두 이어 쓴다: "열정형과 친구형", "열정형, 놀이형, 친구형"
    const tied = function (val) { return STYLES.filter(function (s) { return v[s.key] === val; }); };
    const list = function (arr) { const xs = arr.map(function (s) { return s.name; }); return xs.length === 2 ? U.josa(xs[0], '과', '와') + ' ' + xs[1] : xs.join(', '); };
    // 60점을 넘는 스타일이 없거나 여섯 점수가 10점 안에 모여 있으면 한쪽으로 기울지 않은 것으로 본다
    const flat = v[top.key] < 60 || v[top.key] - v[low.key] < 10;
    // 둘째가 60점 이상이고 첫째와 8점 안이면 두 스타일을 함께 보여 준다 (기본 검사에서 한 칸 차이가 6~7점)
    const pair = !flat && v[second.key] >= 60 && v[top.key] - v[second.key] < 8;
    const sections = [];
    const describe = function (s, withDesc) {
      sections.push({ title: U.josa(s.name, '은', '는') + ' 이런 모습이에요', body: (withDesc ? s.desc + ' ' : '') + s.example });
      sections.push({ title: s.name + ' · 잘 맞는 점', body: s.good });
      sections.push({ title: s.name + ' · 조심할 점', body: s.care });
    };
    let headline, label, summary;
    if (flat) {
      const same = v[top.key] === v[low.key];
      headline = '균형형';
      label = '여러 스타일이 고루 섞임';
      summary = '뚜렷하게 높은 스타일 없이 여러 스타일이 고루 섞여 있어요. ' + (same ? '여섯 스타일이 모두 ' + v[top.key] + '점이에요.' : '그중에서는 ' + U.josa(list(tied(v[top.key])), '이', '가') + ' ' + v[top.key] + '점으로 가장 높아요.');
      sections.push({ title: '고루 섞인 스타일', body: '상대와 상황에 따라 설렘을 따르기도, 천천히 친해지기도, 현실을 따져 보기도 하는 유연한 모습일 수 있어요. 답을 "보통이다"로 많이 골랐다면 조금 더 마음이 가는 쪽으로 골라 다시 해 보면 차이가 더 잘 보여요.' });
      if (!same && v[top.key] > v[second.key]) sections.push({ title: '그중 가장 가까운 스타일 · ' + top.name, body: top.desc + ' ' + top.example });
    } else if (pair) {
      headline = top.name + ' · ' + second.name;
      label = top.orig + ' · ' + second.orig;
      summary = U.josa(pts(top), '과', '와') + ' ' + U.josa(pts(second), '이', '가') + ' 함께 높아요. ' + U.josa(top.tag, '과', '와') + ' ' + U.josa(second.tag, '을', '를') + ' 둘 다 닮았어요.';
      describe(top, true);
      describe(second, true);
    } else {
      headline = top.name;
      label = top.orig + ' · ' + top.tag;
      summary = '가장 높은 스타일은 ' + top.name + '(' + top.orig + ') ' + v[top.key] + '점이에요. ' + top.desc;
      describe(top, false);
    }
    if (!flat && v[low.key] <= 40) {
      const lows = tied(v[low.key]);
      sections.push({ title: '가장 낮은 스타일', body: U.josa(list(lows), '이', '가') + ' ' + v[low.key] + '점으로 가장 낮아요.' + (lows.length <= 2 ? ' ' + lows.map(function (s) { return s.lo; }).join(' ') : '') });
    }
    sections.push({ title: '참고로 알아 두세요', body: NOTE });
    return {
      modeLabel: meta && meta.mode === 'full' ? '정밀 검사' : '기본 검사',
      headline: headline,
      value: v[top.key],
      label: label,
      summary: summary,
      scales: STYLES.map(function (s) { return { key: s.key, label: s.name + ' (' + s.orig + ')', value: v[s.key] }; }),
      sections: sections
    };
  }

  BL.tests.love = {
    id: 'love',
    num: 6,
    kind: 'trait',
    kindLabel: '성향',
    title: '연애 스타일 검사',
    subtitle: '첫눈에 반하는 편인지, 친구처럼 천천히 스며드는 편인지. 사랑의 여섯 가지 스타일 중 나는 어디에 가까운지 알아봐요.',
    duration: '약 4~8분',
    length: '24·48문항 · 6스타일',
    modes: [
      { id: 'standard', label: '기본 검사', desc: '스타일마다 4문항씩 24문항이에요. 48개 문장 중에서 골라 나와서 다시 해도 문항이 조금씩 바뀌어요.', duration: '약 4분', length: '24문항' },
      { id: 'full', label: '정밀 검사', desc: '48개 문장을 모두 풀어요. 스타일마다 8문항이라 결과가 더 안정적이에요.', duration: '약 8분', length: '48문항' }
    ],
    explain: STYLES.map(function (s) { return { label: s.name + ' (' + s.orig + ')', what: s.what, where: s.where }; }),
    intro: [
      '캐나다의 사회학자 존 리(John Alan Lee)가 나눈 "사랑의 여섯 가지 스타일"을 틀로 써요. 열정형(에로스), 놀이형(루두스), 친구형(스토르게), 실용형(프래그마), 몰입형(마니아), 헌신형(아가페)이에요.',
      '문항은 이 사이트를 위해 직접 썼어요. 연애를 해 본 적이 없어도 "연애를 한다면 나는 어떨까"를 떠올리며 답하면 돼요.',
      '사람마다 여러 스타일이 섞여 있고, 누구를 만나는지와 어떤 시기인지에 따라 달라져요. 어느 스타일이 더 좋거나 나쁜 것도 아니에요.',
      '결과에는 여섯 스타일 점수와 가장 높은 스타일의 일상 모습, 잘 맞는 점과 조심할 점이 나와요.'
    ],
    related: [{ id: 'attachment', why: '연애할 때 불안해지는 편인지, 거리를 두는 편인지도 알아봐요. 연애 스타일과 함께 보면 내 연애 패턴이 더 잘 보여요.' }],
    build: build,
    score: score
  };
})();
