/* 실험 03 · 성격 검사 (빅파이브, 30개 세부 특성)
   문항은 공개 도메인인 IPIP(International Personality Item Pool)의 다섯 요인·서른 세부 척도 구조(IPIP-NEO)를 바탕으로
   한국어로 번역·각색하거나 새로 쓴 것이다. 요인 5 × 세부 6 × 문항 4(정 2·역 2) = 120문항, 5점 척도. true는 역채점.
   2026-10-18: 세부 15개(6문항씩)를 30개(4문항씩)로 나누고, 결과에 요인별 해석(읽는 법·잘하는 점·해 보면 좋은 점),
   세부 특성 해석, 두 요인 조합 해석, 읽을 때 주의할 점을 붙였다. 예전 15세부 문항으로 진행 중이던 세션도 그대로 채점된다. */
(function () {
  const U = BL.util;

  /* 요인: 무엇을 재나(what)·어디에 쓰이나(where)와 수준별 해석 lv(read 읽는 법, strength 잘하는 점, tip 해 보면 좋은 점) */
  const F = {
    E: { label: '외향성', nick: '에너자이저형',
      what: '사람들과 어울리면서 에너지를 얻는지, 혼자 있을 때 충전되는지를 봐요.',
      where: '사람 만나는 일(영업, 발표, 모임 이끌기)에서는 높은 쪽이 편하고, 혼자 오래 집중하는 일에서는 낮은 쪽이 편해요. 어느 쪽이 좋고 나쁜 게 아니라 에너지가 어디서 채워지는지의 차이예요.',
      lv: {
        high: { read: '사람들과 어울리면서 에너지를 얻고, 먼저 말을 걸거나 모임을 이끄는 일이 자연스러워요. 조용한 시간이 길어지면 오히려 기운이 빠지는 편이에요.',
          strength: '처음 만난 사람과도 금방 분위기를 만들고, 팀에 활기를 불어넣어요.',
          tip: '말할 차례를 남에게 넘겨 주고 끝까지 들어 주면, 조용한 사람들의 좋은 생각까지 얻을 수 있어요.' },
        mid: { read: '사람들과 어울리는 시간과 혼자 쉬는 시간이 둘 다 필요해요. 상황에 따라 앞에 나서기도 하고 한발 물러서기도 해요.',
          strength: '분위기를 읽고 나설 때와 빠질 때를 고를 줄 알아요.',
          tip: '약속이 몰린 주에는 혼자 쉬는 시간도 일정에 넣어 두면 컨디션이 오래가요.' },
        low: { read: '혼자 있거나 가까운 몇 사람과 있을 때 힘이 채워져요. 넓게 아는 사람보다 깊게 아는 사람 몇 명이 더 소중해요.',
          strength: '한 가지에 오래 집중하고, 말하기 전에 깊이 생각해서 신중한 의견을 내요.',
          tip: '큰 모임 뒤에는 쉬는 시간을 미리 잡아 두고, 중요한 자리에서는 할 말을 한두 개 준비해 가면 편해요.' } } },
    A: { label: '친화성', nick: '조력자형',
      what: '남의 기분을 얼마나 헤아리고, 부딪히기보다 맞춰 주는 편인지를 봐요.',
      where: '팀으로 일하기, 돌보는 일, 서비스 일에서는 높은 쪽이 빛나요. 협상하거나 비판해야 하거나 어려운 결정을 내리는 자리에서는 낮은 쪽이 유리할 때가 있어요.',
      lv: {
        high: { read: '다른 사람의 마음을 잘 헤아리고, 부딪히기보다 맞춰 가는 쪽을 택해요. 함께 있는 사람이 편안해하는 걸 중요하게 여겨요.',
          strength: '갈등을 부드럽게 풀고, 서로 돕는 분위기를 만들어요.',
          tip: '거절해야 할 때는 미안해하지 말고 짧고 분명하게 말해도 괜찮아요. 내 몫을 챙겨야 남도 오래 도울 수 있어요.' },
        mid: { read: '필요할 땐 양보하지만 내 입장도 분명히 해요. 사람과 일 사이에서 균형을 잡는 편이에요.',
          strength: '상대를 배려하면서도 할 말은 해서 믿음을 줘요.',
          tip: '양보할 일과 꼭 지킬 일을 미리 정해 두면 결정이 쉬워져요.' },
        low: { read: '솔직하고 직설적이며, 분위기보다 사실과 결과를 먼저 봐요. 경쟁이나 협상 자리에서 쉽게 물러서지 않아요.',
          strength: '불편한 말도 할 수 있어서 어려운 결정과 협상에 강해요.',
          tip: '같은 말도 "이 부분이 좋았고, 이건 바꾸면 좋겠어요"처럼 좋은 점부터 말하면 훨씬 잘 받아들여져요.' } } },
    C: { label: '성실성', nick: '설계자형',
      what: '계획을 세우고 꾸준히 끝까지 해내는 정도예요.',
      where: '성적, 업무 성과, 건강 습관, 저축처럼 꾸준함이 필요한 거의 모든 일과 가장 관계가 깊은 성격이에요. 너무 높으면 융통성이 떨어질 수 있고, 낮으면 즉흥적인 대응과 변화 적응이 빨라요.',
      lv: {
        high: { read: '계획을 세우고 해야 할 일을 끝까지 해내요. 정리된 환경과 지켜지는 약속을 좋아해요.',
          strength: '믿고 맡길 수 있는 사람이라는 평을 들어요. 공부, 일, 건강 습관처럼 꾸준함이 필요한 일에서 성과가 잘 나와요.',
          tip: '모든 걸 완벽하게 하려다 지칠 수 있어요. 대충 해도 되는 일을 정해 두면 힘을 아낄 수 있어요.' },
        mid: { read: '중요한 일은 꼼꼼히 챙기고 나머지는 유연하게 넘겨요.',
          strength: '계획과 융통성을 상황에 맞게 섞어 써요.',
          tip: '자꾸 미뤄지는 일 한 가지만 골라 시간을 정해 두면 빈틈이 줄어요.' },
        low: { read: '즉흥적이고 그때그때 상황에 맞춰 움직여요. 틀에 맞춘 계획보다 자유로운 방식이 편해요.',
          strength: '변화에 빨리 적응하고 갑작스러운 상황에도 유연하게 대처해요.',
          tip: '마감이 있는 일은 알림을 두세 번 걸어 두거나, 누군가와 함께 확인하는 약속을 만들면 마무리가 쉬워져요.' } } },
    N: { label: '정서 민감성', nick: '감지기형',
      what: '걱정이나 기분 변화를 얼마나 쉽게, 크게 느끼는지를 봐요.',
      where: '높으면 스트레스와 걱정을 더 크게 느끼지만, 위험이나 문제를 남들보다 먼저 알아채요. 낮으면 위기에서 침착하지만 가끔 신호를 놓치기도 해요. 높은 쪽은 자기만의 스트레스 푸는 방법을 갖추는 게 중요해요.',
      lv: {
        high: { read: '걱정, 짜증, 속상함 같은 감정을 남들보다 크고 오래 느끼는 편이에요. 그만큼 위험이나 문제의 신호를 빨리 알아채요.',
          strength: '미리 대비하고 섬세하게 살펴서 실수를 줄여요. 다른 사람의 불편함도 잘 알아봐요.',
          tip: '나만의 마음 가라앉히는 방법(산책, 잠, 글로 적기, 믿는 사람과 이야기하기)을 정해 두세요. 걱정이 오래 이어져 생활이 힘들면 전문가와 이야기해 보는 것도 좋아요.' },
        mid: { read: '대체로 안정적이지만 압박이 겹치면 흔들릴 때가 있어요.',
          strength: '위험은 알아채되 지나치게 휩쓸리지는 않아요.',
          tip: '바쁜 시기를 미리 알면 그 주에는 일을 조금 덜어 두세요.' },
        low: { read: '웬만한 일에 크게 흔들리지 않고 침착함을 유지해요. 스트레스를 받아도 금방 털어 내는 편이에요.',
          strength: '위기 상황에서 주변을 진정시키고 차분하게 판단해요.',
          tip: '나는 괜찮아도 주변 사람은 같은 일로 크게 걱정할 수 있어요. 그 마음을 가볍게 넘기지 말고 들어 주면 좋아요.' } } },
    O: { label: '개방성', nick: '탐험가형',
      what: '새로운 생각이나 경험을 얼마나 반기는지, 상상과 예술을 즐기는지를 봐요.',
      where: '새로운 것 배우기, 창작, 낯선 환경에 적응하기, 다른 생각 받아들이기에서 높은 쪽이 편해요. 낮은 쪽은 검증된 방법을 꾸준히 지키는 일과 눈앞의 실무적인 문제 해결에 강해요.',
      lv: {
        high: { read: '새로운 생각과 경험을 반기고, 상상하거나 예술을 즐기는 걸 좋아해요. "왜 그럴까"를 자주 묻는 편이에요.',
          strength: '새 아이디어를 내고, 낯선 환경과 다른 생각을 잘 받아들여요.',
          tip: '관심이 여기저기로 흩어질 수 있어요. 지금 끝낼 한 가지를 정해 두면 아이디어가 결과로 이어져요.' },
        mid: { read: '검증된 방식과 새로운 시도를 상황에 따라 골라 써요.',
          strength: '새로움과 현실 감각 사이에서 균형을 잡아요.',
          tip: '한 달에 한 번쯤 안 해 본 일을 작게 시도해 보면 생각의 폭이 넓어져요.' },
        low: { read: '현실적이고 실용적이며, 익숙하고 검증된 방식을 믿어요. 손에 잡히는 구체적인 일을 좋아해요.',
          strength: '눈앞의 문제를 현실적으로 풀고, 정해진 방식을 정확하게 지켜요.',
          tip: '상황이 바뀔 때는 새 방법을 작게 시험해 보고 고르면 부담 없이 적응할 수 있어요.' } } }
  };
  const ORDER = ['E', 'A', 'C', 'N', 'O'];

  /* 세부 30개 (요인마다 6개, IPIP-NEO 구조). 예전 15개 key(greg·assert·active·symp·coop·trust·order·disc·achv·anx·mood·vuln·imag·art·intel)는 그대로 둔다. */
  const FACETS = [
    { key: 'friend', f: 'E', label: '친근함', hi: '처음 보는 사람에게도 따뜻하게 다가가요.', lo: '마음을 열기까지 시간이 걸리는 편이에요.' },
    { key: 'greg', f: 'E', label: '사교성', hi: '사람 많은 자리에서 힘을 얻어요.', lo: '여럿보다 소수와 깊게 어울리는 쪽을 택해요.' },
    { key: 'assert', f: 'E', label: '주도성', hi: '의견을 분명히 말하고 앞장서요.', lo: '이끌기보다 지켜보다가 함께하는 편이에요.' },
    { key: 'active', f: 'E', label: '활력', hi: '늘 바쁘게 움직이고 여러 일을 동시에 해요.', lo: '느긋한 속도로 한 번에 하나씩 해요.' },
    { key: 'excite', f: 'E', label: '자극 추구', hi: '신나고 짜릿한 일을 찾아다녀요.', lo: '조용하고 안전한 쪽이 편해요.' },
    { key: 'cheer', f: 'E', label: '명랑함', hi: '잘 웃고 즐거운 기분을 자주 느껴요.', lo: '기쁨을 겉으로 크게 드러내지 않는 편이에요.' },
    { key: 'trust', f: 'A', label: '신뢰', hi: '사람의 선의를 먼저 믿어요.', lo: '확인되기 전엔 쉽게 믿지 않아요.' },
    { key: 'moral', f: 'A', label: '솔직함', hi: '손해를 보더라도 정직하게 행동해요.', lo: '상황에 따라 말을 내게 유리하게 바꾸기도 해요.' },
    { key: 'altru', f: 'A', label: '이타심', hi: '남을 돕는 일에서 기쁨을 느껴요.', lo: '내 일이 아니면 굳이 나서지 않아요.' },
    { key: 'coop', f: 'A', label: '협조', hi: '부딪히기보다 양보하고 맞춰 가요.', lo: '필요하면 부딪히는 걸 두려워하지 않아요.' },
    { key: 'modest', f: 'A', label: '겸손', hi: '내 자랑보다 남의 공을 먼저 말해요.', lo: '내가 잘한 일은 분명히 알리는 편이에요.' },
    { key: 'symp', f: 'A', label: '공감', hi: '다른 사람의 아픔이 내 일처럼 느껴져요.', lo: '감정보다 사실에 집중하는 편이에요.' },
    { key: 'effic', f: 'C', label: '유능감', hi: '맡은 일을 해낼 수 있다는 자신감이 있어요.', lo: '내 능력을 자주 의심하는 편이에요.' },
    { key: 'order', f: 'C', label: '체계성', hi: '정돈과 계획이 편해요.', lo: '어수선해도 크게 신경 쓰지 않아요.' },
    { key: 'duty', f: 'C', label: '책임감', hi: '약속과 맡은 일을 꼭 지켜요.', lo: '의무보다 그때의 사정을 먼저 따지는 편이에요.' },
    { key: 'achv', f: 'C', label: '성취 지향', hi: '높은 목표를 세우고 밀어붙여요.', lo: '적당한 선에서 만족할 줄 알아요.' },
    { key: 'disc', f: 'C', label: '끈기', hi: '하기 싫은 일도 바로 시작해서 끝내요.', lo: '미루다가 마감에 몰아서 하는 편이에요.' },
    { key: 'caut', f: 'C', label: '신중함', hi: '결정하기 전에 충분히 따져 봐요.', lo: '생각보다 행동이 먼저 나가는 편이에요.' },
    { key: 'anx', f: 'N', label: '불안', hi: '걱정이 많고 최악의 상황을 자주 떠올려요.', lo: '웬만한 일은 걱정하지 않아요.' },
    { key: 'anger', f: 'N', label: '짜증', hi: '짜증과 화가 쉽게 올라와요.', lo: '화가 나도 차분하게 넘기는 편이에요.' },
    { key: 'mood', f: 'N', label: '기분 가라앉음', hi: '별일 아닌 일에도 기분이 쉽게 가라앉아요.', lo: '속상한 일이 있어도 금방 털어 내요.' },
    { key: 'selfc', f: 'N', label: '남의 시선 의식', hi: '남이 나를 어떻게 볼지 신경이 많이 쓰여요.', lo: '낯선 사람 앞에서도 편하게 행동해요.' },
    { key: 'impul', f: 'N', label: '유혹에 약함', hi: '먹고 싶고 사고 싶은 마음을 참기 어려워요.', lo: '유혹이 있어도 적당히 조절해요.' },
    { key: 'vuln', f: 'N', label: '스트레스 취약성', hi: '압박이 겹치면 감당하기 어려워요.', lo: '급한 상황에서도 침착함을 지켜요.' },
    { key: 'imag', f: 'O', label: '상상력', hi: '공상과 상상을 즐겨요.', lo: '현실적인 것에 집중해요.' },
    { key: 'art', f: 'O', label: '예술 감수성', hi: '음악, 그림, 글에 깊이 빠져들어요.', lo: '예술보다 실용을 먼저 봐요.' },
    { key: 'emot', f: 'O', label: '감정 인식', hi: '내 감정을 잘 알아채고 진하게 느껴요.', lo: '감정이 잘 움직이지 않는 무덤덤한 편이에요.' },
    { key: 'advent', f: 'O', label: '새로운 경험', hi: '안 해 본 일, 안 가 본 곳에 끌려요.', lo: '익숙한 방식과 장소가 편해요.' },
    { key: 'intel', f: 'O', label: '지적 호기심', hi: '복잡한 문제와 추상적인 생각을 즐겨요.', lo: '구체적이고 손에 잡히는 걸 좋아해요.' },
    { key: 'values', f: 'O', label: '가치 개방성', hi: '당연한 규칙도 왜 그런지 다시 따져 봐요.', lo: '오래 지켜 온 원칙과 전통을 소중히 여겨요.' }
  ];

  /* [세부, 문항, 역채점] 세부마다 정 2·역 2 */
  const ITEMS = [
    ['friend', '처음 보는 사람과도 금방 친해진다.', false],
    ['friend', '사람들을 따뜻하게 맞이한다.', false],
    ['friend', '친해지기까지 시간이 오래 걸린다.', true],
    ['friend', '다른 사람에게 먼저 말을 거는 일이 드물다.', true],
    ['greg', '사람이 많은 곳을 좋아한다.', false],
    ['greg', '모임에 어울리는 것을 즐긴다.', false],
    ['greg', '혼자 조용히 있는 시간이 더 좋다.', true],
    ['greg', '사람이 붐비는 곳은 될 수 있으면 피한다.', true],
    ['assert', '내 의견을 분명하게 말한다.', false],
    ['assert', '모임에서 주도적으로 나선다.', false],
    ['assert', '다른 사람이 이끌어 주기를 기다린다.', true],
    ['assert', '하고 싶은 말이 있어도 속으로 삼킬 때가 많다.', true],
    ['active', '늘 바쁘게 움직인다.', false],
    ['active', '쉬는 날에도 이것저것 많이 한다.', false],
    ['active', '여유롭고 느긋하게 지내는 것을 좋아한다.', true],
    ['active', '일을 내 속도대로 천천히 하는 편이다.', true],
    ['excite', '짜릿하고 신나는 일을 찾아다닌다.', false],
    ['excite', '스릴 있는 놀이를 즐긴다.', false],
    ['excite', '모험보다 안전하고 조용한 쪽이 좋다.', true],
    ['excite', '시끄럽고 들뜬 분위기에서는 금방 지친다.', true],
    ['cheer', '즐거운 일이 많다고 느낀다.', false],
    ['cheer', '잘 웃고 기분이 밝은 편이다.', false],
    ['cheer', '마음껏 즐거워하는 일이 드물다.', true],
    ['cheer', '웃을 일이 별로 없다.', true],

    ['trust', '사람들을 쉽게 믿는 편이다.', false],
    ['trust', '대부분의 사람은 기본적으로 착하다고 생각한다.', false],
    ['trust', '사람들의 숨은 의도를 의심한다.', true],
    ['trust', '사람들의 친절에는 대개 다른 속셈이 있다고 본다.', true],
    ['moral', '손해를 보더라도 정직하게 행동한다.', false],
    ['moral', '규칙을 어기면서까지 이득을 챙기지 않는다.', false],
    ['moral', '내게 유리하면 사실을 살짝 바꿔 말한다.', true],
    ['moral', '원하는 것을 얻으려고 사람을 이용할 때가 있다.', true],
    ['altru', '남을 돕는 일에서 기쁨을 느낀다.', false],
    ['altru', '도움이 필요한 사람에게 먼저 손을 내민다.', false],
    ['altru', '남의 일에 시간을 쓰는 것이 아깝다.', true],
    ['altru', '내 일이 아니면 굳이 나서지 않는다.', true],
    ['coop', '갈등을 피하기 위해 양보하는 편이다.', false],
    ['coop', '의견이 부딪히면 먼저 서로 맞출 방법을 찾는다.', false],
    ['coop', '말로 사람을 깎아내릴 때가 있다.', true],
    ['coop', '말다툼에서 지는 것을 참기 어렵다.', true],
    ['modest', '내 자랑은 잘 하지 않는다.', false],
    ['modest', '나를 남들보다 특별하다고 여기지 않는다.', false],
    ['modest', '내가 남들보다 낫다고 생각할 때가 많다.', true],
    ['modest', '내가 잘한 일은 사람들이 꼭 알아주기를 바란다.', true],
    ['symp', '다른 사람의 감정에 공감한다.', false],
    ['symp', '힘든 처지의 사람을 보면 마음이 쓰인다.', false],
    ['symp', '다른 사람의 문제에는 별 관심이 없다.', true],
    ['symp', '마음이 여린 사람을 보면 답답하다.', true],

    ['effic', '맡은 일을 잘 해낼 자신이 있다.', false],
    ['effic', '어려운 일도 방법을 찾아 해결한다.', false],
    ['effic', '일을 제대로 해낼 수 있을지 자주 의심한다.', true],
    ['effic', '새로운 일 앞에서 막막할 때가 많다.', true],
    ['order', '정돈된 상태를 좋아한다.', false],
    ['order', '일을 시작하기 전에 순서부터 정한다.', false],
    ['order', '물건을 제자리에 두는 것을 자주 잊는다.', true],
    ['order', '책상 위가 늘 어수선하다.', true],
    ['duty', '약속은 꼭 지킨다.', false],
    ['duty', '맡은 일은 끝까지 책임진다.', false],
    ['duty', '해야 할 일을 슬쩍 피할 때가 있다.', true],
    ['duty', '약속 시간에 늦는 일이 잦다.', true],
    ['achv', '기대 이상의 성과를 내려고 한다.', false],
    ['achv', '높은 목표를 세우고 밀어붙인다.', false],
    ['achv', '적당히 해도 된다고 생각한다.', true],
    ['achv', '일에는 딱 필요한 만큼만 힘을 쓴다.', true],
    ['disc', '해야 할 일을 바로 처리한다.', false],
    ['disc', '지루한 일도 끝까지 마무리한다.', false],
    ['disc', '일을 미루다가 시간에 쫓긴다.', true],
    ['disc', '누가 재촉해야 겨우 일을 시작한다.', true],
    ['caut', '결정하기 전에 여러 가지를 따져 본다.', false],
    ['caut', '말하기 전에 한 번 더 생각한다.', false],
    ['caut', '깊이 생각하지 않고 바로 행동할 때가 많다.', true],
    ['caut', '충동적으로 결정했다가 후회한 적이 많다.', true],

    ['anx', '이런저런 걱정을 많이 한다.', false],
    ['anx', '사소한 일에도 쉽게 긴장한다.', false],
    ['anx', '대부분의 시간 동안 느긋하다.', true],
    ['anx', '이미 지난 일은 크게 걱정하지 않는다.', true],
    ['anger', '쉽게 짜증이 난다.', false],
    ['anger', '화가 나면 금방 얼굴에 드러난다.', false],
    ['anger', '화를 내는 일이 거의 없다.', true],
    ['anger', '기분 나쁜 일이 있어도 차분하게 넘긴다.', true],
    ['mood', '쉽게 속상해진다.', false],
    ['mood', '별일 아닌 일로 기분이 확 가라앉을 때가 있다.', false],
    ['mood', '우울해지는 일이 거의 없다.', true],
    ['mood', '속상한 일이 있어도 금방 털어 낸다.', true],
    ['selfc', '사람들 앞에 서면 쉽게 쑥스러워진다.', false],
    ['selfc', '남이 나를 어떻게 볼지 신경이 많이 쓰인다.', false],
    ['selfc', '낯선 사람 앞에서도 편하게 행동한다.', true],
    ['selfc', '남의 시선은 별로 신경 쓰지 않는다.', true],
    ['impul', '먹고 싶거나 사고 싶은 것이 생기면 참기 어렵다.', false],
    ['impul', '나중에 후회할 만큼 지나치게 할 때가 있다.', false],
    ['impul', '유혹이 있어도 쉽게 참는다.', true],
    ['impul', '먹거나 쓰는 것을 적당히 조절한다.', true],
    ['vuln', '압박을 받으면 쉽게 무너진다.', false],
    ['vuln', '예상하지 못한 일이 생기면 쉽게 당황한다.', false],
    ['vuln', '급한 상황에서 침착함을 유지한다.', true],
    ['vuln', '실패해도 금방 다시 일어선다.', true],

    ['imag', '상상력이 풍부하다.', false],
    ['imag', '공상에 잠기는 것을 좋아한다.', false],
    ['imag', '공상에 잠기는 일은 거의 없다.', true],
    ['imag', '머릿속으로 무언가를 그려 보는 게 어렵다.', true],
    ['art', '예술 작품을 보면 감동을 받는다.', false],
    ['art', '음악이나 그림에 깊이 빠져든다.', false],
    ['art', '시를 읽는 것은 시간 낭비라고 느낀다.', true],
    ['art', '미술관이나 공연장에 가는 것은 지루하다.', true],
    ['emot', '내 감정이 어떤지 잘 알아챈다.', false],
    ['emot', '기쁨이나 슬픔을 진하게 느낀다.', false],
    ['emot', '내가 지금 어떤 기분인지 잘 모를 때가 많다.', true],
    ['emot', '웬만한 일에는 감정이 잘 움직이지 않는다.', true],
    ['advent', '안 가 본 곳, 안 해 본 일을 해 보고 싶다.', false],
    ['advent', '늘 다니던 길보다 새로운 길로 가 보는 편이다.', false],
    ['advent', '익숙한 방식이 바뀌는 것이 싫다.', true],
    ['advent', '새로운 음식보다 늘 먹던 것을 고른다.', true],
    ['intel', '복잡한 문제를 푸는 것을 즐긴다.', false],
    ['intel', '어려운 책도 끝까지 읽어 보려고 한다.', false],
    ['intel', '추상적인 개념에는 관심이 없다.', true],
    ['intel', '철학적인 이야기는 피하는 편이다.', true],
    ['values', '당연하게 여기는 규칙도 왜 그런지 따져 본다.', false],
    ['values', '나와 생각이 아주 다른 사람의 이야기도 흥미롭다.', false],
    ['values', '오래된 전통과 관습은 그대로 지키는 것이 맞다고 본다.', true],
    ['values', '옳고 그름은 분명히 정해져 있다고 생각한다.', true]
  ];

  /* 두 요인 조합 해석: 둘 다 뚜렷할 때(60 이상 또는 40 이하)만, 가장 뚜렷한 조합 두 개까지 */
  const COMBOS = [
    { a: 'E', b: 'A', hh: ['다정한 분위기 메이커', '사람을 좋아하고 배려도 깊어서 어느 모임에서나 편한 사람이에요. 부탁을 거절하기 어려울 수 있으니 내 시간도 챙겨 두세요.'],
      hl: ['추진력 있는 리더', '앞에 나서서 이끄는 힘이 있고 필요한 말은 분명히 해요. 말투를 한 번 다듬으면 더 많은 사람이 따라와요.'],
      lh: ['조용한 배려형', '나서지는 않지만 곁에 있는 사람을 세심하게 챙겨요. 내 의견도 작게라도 말해 두면 오해가 줄어요.'],
      ll: ['독립적인 관찰자', '혼자 판단하고 혼자 움직이는 게 편해요. 함께 일할 때는 기대하는 바를 먼저 분명히 밝혀 두면 좋아요.'] },
    { a: 'C', b: 'N', hh: ['꼼꼼한 걱정형', '책임감이 강해서 일을 잘 해내지만 실수를 크게 걱정해요. 완벽하지 않아도 되는 일을 정해 두면 지치지 않아요.'],
      hl: ['침착한 실행가', '계획대로 꾸준히 해내고 압박에도 잘 흔들리지 않아요. 주변 사람의 걱정도 가볍게 넘기지 말고 들어 주세요.'],
      lh: ['마음이 바쁜 즉흥형', '하고 싶은 건 많은데 스트레스가 쌓이면 손을 놓기 쉬워요. 하루 한 가지만 끝내는 작은 습관이 큰 도움이 돼요.'],
      ll: ['느긋한 낙천가', '걱정이 적고 그때그때 유연하게 움직여요. 마감이 있는 일은 알림이나 동료와의 약속으로 챙기면 좋아요.'] },
    { a: 'O', b: 'C', hh: ['창의적인 실행가', '새로운 아이디어를 실제로 만들어 내는 힘이 있어요. 모든 걸 다 하려 하기보다 고르는 연습이 필요해요.'],
      hl: ['아이디어 탐험가', '생각이 넘치고 새로운 데 끌리지만 마무리가 약해질 수 있어요. 끝내는 데 강한 사람과 짝을 이루면 좋아요.'],
      lh: ['검증된 방식의 장인', '익숙한 방법을 정확하고 꾸준하게 해내요. 변화가 필요할 땐 작게 시험해 보는 방식이 잘 맞아요.'],
      ll: ['그때그때 실용형', '눈앞의 일을 현실적으로 처리해요. 긴 계획은 짧게 쪼개 두면 부담이 줄어요.'] }
  ];

  /* 기본 검사: 세부마다 4문항(정 2·역 2) 중 정 1·역 1을 무작위로 골라 60문항. 정밀 검사: 120문항 전부.
     세부마다 정·역 개수가 같아야 "매우 그렇다"만 고르는 응답 경향이 가짜 성격 유형을 만들지 않는다. */
  function build(mode) {
    const r = U.rng();
    const full = mode === 'full';
    const by = {};
    ITEMS.forEach(function (it) { const g = by[it[0]] = by[it[0]] || { f: [], r: [] }; g[it[2] ? 'r' : 'f'].push(it); });
    const chosen = {};
    FACETS.forEach(function (fc) {
      const g = by[fc.key];
      chosen[fc.key] = r.shuffle(full ? g.f.concat(g.r) : r.sample(g.f, 1).concat(r.sample(g.r, 1)));
    });
    const per = full ? 4 : 2;
    const n = FACETS.length * per;
    const items = [{ type: 'section', num: 1, title: '나에 대한 문장들', desc: '짧은 문장을 읽고 평소의 나와 얼마나 가까운지 골라요. 오래 고민하지 말고 처음 떠오르는 답을 고르면 돼요.', count: n + '문항 · 약 ' + Math.round(n / 7.5) + '분' }];
    for (let i = 0; i < per; i++) FACETS.forEach(function (fc) {
      const it = chosen[fc.key][i];
      items.push({ type: 'likert', scored: true, facet: fc.key, factor: fc.f, reverse: it[2], text: it[1] });
    });
    return items;
  }

  const LV_WORD = { high: '높은 편', mid: '보통', low: '낮은 편' };
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
    // 답이 있는 세부만 점수를 낸다. 예전 15세부 문항으로 진행 중이던 세션은 그 15개로 요인 점수를 낸다.
    const facetVal = {};
    FACETS.forEach(function (fc) { if (counts[fc.key]) facetVal[fc.key] = Math.round((sums[fc.key] / counts[fc.key] - 1) / 4 * 100); });
    const shown = FACETS.filter(function (fc) { return facetVal[fc.key] != null; });
    const scales = ORDER.map(function (f) {
      const fs = shown.filter(function (fc) { return fc.f === f; });
      const v = fs.length ? Math.round(U.mean(fs.map(function (fc) { return facetVal[fc.key]; }))) : 50;
      return { key: f, label: F[f].label, value: v, children: fs.map(function (fc) { return { key: fc.key, label: fc.label, value: facetVal[fc.key] }; }) };
    });
    const val = {}; scales.forEach(function (s) { val[s.key] = s.value; });
    const sorted = scales.slice().sort(function (a, b) { return b.value - a.value; });
    const top = sorted[0];
    // 균형형: 60 넘는 요인이 없거나 다섯 요인이 고르게 붙어 있을 때. 위의 둘이 함께 높으면(5점 안쪽) 둘을 합친 별명을 쓴다.
    const balanced = top.value < 60 || top.value - sorted[sorted.length - 1].value < 12;
    const pair = !balanced && sorted[1].value >= 60 && top.value - sorted[1].value < 5 ? sorted[1] : null;
    const facetLine = function (fc) {
      const v = facetVal[fc.key], lv = U.level(v);
      return fc.label + ' ' + v + '(' + LV_WORD[lv] + '): ' + (lv === 'high' ? fc.hi : lv === 'low' ? fc.lo : '상황에 따라 달라지는 보통 수준이에요.');
    };
    // 요인마다: 읽는 법 + 잘하는 점 + 해 보면 좋은 점 + 세부 특성
    const sections = scales.map(function (s) {
      const lv = U.level(s.value), t = F[s.key].lv[lv];
      const fs = shown.filter(function (fc) { return fc.f === s.key; });
      return { title: s.label + ' ' + s.value + ' · ' + LV_WORD[lv], body: t.read,
        items: ['잘하는 점: ' + t.strength, '해 보면 좋은 점: ' + t.tip].concat(fs.map(facetLine)) };
    });
    // 두 요인 조합
    const combos = COMBOS.map(function (c) {
      const x = val[c.a], y = val[c.b];
      const dx = x >= 60 ? 'h' : x <= 40 ? 'l' : '', dy = y >= 60 ? 'h' : y <= 40 ? 'l' : '';
      return dx && dy ? { c: c, k: dx + dy, w: Math.abs(x - 50) + Math.abs(y - 50) } : null;
    }).filter(Boolean).sort(function (a, b) { return b.w - a.w; }).slice(0, 2);
    combos.forEach(function (m) {
      const d = m.c[m.k];
      sections.push({ title: '두 성격이 만나면 · ' + d[0], body: F[m.c.a].label + ' ' + val[m.c.a] + '점과 ' + F[m.c.b].label + ' ' + val[m.c.b] + '점의 조합이에요. ' + d[1] });
    });
    const fsSorted = shown.slice().sort(function (a, b) { return facetVal[b.key] - facetVal[a.key]; });
    const hi = fsSorted.slice(0, 3), lo = fsSorted.slice(-3).reverse();
    sections.push({ title: '가장 높은 세부 특성', body: '세부 특성 중 점수가 가장 높은 셋이에요.', items: hi.map(facetLine) });
    sections.push({ title: '가장 낮은 세부 특성', body: '점수가 가장 낮은 셋이에요. 낮다고 나쁜 게 아니라 그쪽 성향이 덜 드러난다는 뜻이에요.', items: lo.map(facetLine) });
    sections.push({ title: '결과를 읽을 때', body: '점수는 0~100이고 50 근처가 보통이에요. 높고 낮음에 좋고 나쁨은 없고, 상황마다 쓸모가 달라요. 성격은 나이와 환경에 따라 조금씩 바뀌고, 그날의 기분에 따라 답이 달라질 수도 있어요. ' +
      (meta && meta.mode === 'full' ? '' : '기본 검사는 세부 특성마다 2문항이라 세부 점수는 대략적으로 봐 주세요. 정밀 검사(120문항)를 하면 더 안정적이에요. ') +
      '이 결과는 참고용 자기평가이고 전문가의 심리검사를 대신하지 않아요.' });
    const summary = (balanced
      ? '다섯 갈래가 고르게 나와서 특별히 두드러진 성격이 없는 균형형이에요. 가장 높은 건 ' + top.label + ' ' + top.value + '점이에요.'
      : '가장 두드러진 성격은 ' + top.label + ' ' + top.value + '점' + (pair ? '과 ' + pair.label + ' ' + pair.value + '점' : '') + '이에요. ' + F[top.key].lv[U.level(top.value)].read) +
      ' 세부 특성 중에서는 ' + hi[0].label + ' ' + facetVal[hi[0].key] + '점이 가장 높고 ' + lo[0].label + ' ' + facetVal[lo[0].key] + '점이 가장 낮아요.';
    return {
      modeLabel: meta && meta.mode === 'full' ? '정밀 검사' : '기본 검사',
      headline: balanced ? '균형형' : pair ? F[top.key].nick.replace(/형$/, '') + '·' + F[pair.key].nick : F[top.key].nick,
      value: top.value,
      label: balanced ? '두드러진 특성 없음' : '두드러진 특성 · ' + top.label + (pair ? '·' + pair.label : ''),
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
    subtitle: '사람을 좋아하는지, 꼼꼼한지, 걱정이 많은지, 새로운 걸 즐기는지. 성격을 다섯 갈래, 서른 가지로 나눠서 봐요.',
    duration: '약 8~16분',
    length: '60·120문항 · 30세부',
    modes: [
      { id: 'standard', label: '기본 검사', desc: '세부 특성마다 2문항씩 60문항이에요. 120개 문장 중에서 골라 나와서 다시 해도 문항이 조금씩 바뀌어요. 세부 점수는 대략적인 참고예요.', duration: '약 8분', length: '60문항' },
      { id: 'full', label: '정밀 검사', desc: '120개 문장을 모두 풀어요. 세부 특성마다 4문항이라 세부 점수까지 더 믿을 만해요.', duration: '약 16분', length: '120문항' }
    ],
    explain: ORDER.map(function (f) { return { label: F[f].label, what: F[f].what, where: F[f].where, tasks: FACETS.filter(function (fc) { return fc.f === f; }).map(function (fc) { return fc.label; }).join(', ') }; }),
    intro: [
      '심리학에서 가장 널리 쓰는 성격 모델인 "빅파이브"를 기준으로 해요. 성격을 다섯 갈래로 보고, 갈래마다 여섯 가지를 더 자세히 봐요.',
      '문항은 누구나 쓸 수 있게 공개된 국제 성격 문항(IPIP)의 구조를 바탕으로 우리말로 옮기거나 새로 쓴 거예요.',
      '정답은 없어요. 솔직하게, 처음 떠오르는 대로 고르면 가장 정확해요.',
      '결과에는 다섯 갈래와 서른 가지 세부 점수, 갈래마다 읽는 법·잘하는 점·해 보면 좋은 점, 두 성격이 만났을 때의 특징이 나와요.'
    ],
    build: build,
    score: score
  };
})();