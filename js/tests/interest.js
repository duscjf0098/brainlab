/* 실험 05 · 진로 흥미 유형 검사
   심리학자 존 홀랜드의 여섯 흥미 유형(현실·탐구·예술·사회·진취·관습)을 틀로 쓰고, 유형마다 세부 2개 × 활동 6개 = 72문항.
   응답은 "해 보고 싶은 정도" 5점 척도. 문항은 전부 이 사이트를 위해 직접 썼다.
   공개 흥미 문항 모음(IIP)의 기초 흥미 척도(BIM, Liao·Armstrong·Rounds 2008)는 저자 저작권이 있고 전문가의 비상업적 사용만
   허락되어 있어 쓰지 않았고, 워크넷·O*NET 문항도 옮기지 않았다.
   모든 문항이 같은 방향이고 유형마다 문항 수가 같아서, 같은 답만 고르면 여섯 유형이 똑같이 나와 "고르게 높음·보통·낮음"이 된다. */
(function () {
  const U = BL.util;
  // 홀랜드 육각형의 둘레 순서. 이웃할수록 비슷한 흥미이고, 점수가 같으면 이 순서로 정한다.
  const ORDER = ['R', 'I', 'A', 'S', 'E', 'C'];

  const TYPES = {
    R: { label: '현실형', short: '현실', nick: '실전 해결사',
      what: '손과 몸을 써서 물건을 만들고, 고치고, 기르는 일에 끌리는 정도예요.',
      where: '기계나 도구를 다루는 일, 밖에서 몸을 쓰는 일처럼 결과가 눈에 바로 보이는 일에서 드러나요. 높으면 직접 해 봐야 이해가 되는 편이고, 오래 앉아서 말로만 하는 일은 답답하게 느낄 수 있어요.',
      high: '손과 몸을 써서 눈에 보이는 결과를 만들 때 가장 즐거워요. 설명을 듣기보다 직접 해 보면서 배우는 편이에요.',
      low: '기계를 만지거나 몸을 많이 쓰는 일은 덜 끌리는 편이에요.' },
    I: { label: '탐구형', short: '탐구', nick: '파고드는 탐구자',
      what: '궁금한 것을 관찰하고, 실험하고, 분석해서 원리를 알아내는 일에 끌리는 정도예요.',
      where: '공부, 연구, 문제 풀이, 자료 분석처럼 "왜 그럴까"를 파고드는 일에서 드러나요. 높으면 혼자 깊이 생각할 시간이 소중하고, 이유도 모른 채 시키는 대로만 하는 일은 지루하게 느낄 수 있어요.',
      high: '궁금한 게 생기면 이유를 알아낼 때까지 파고들어요. 혼자 깊이 생각하고 분석하는 시간에서 힘을 얻어요.',
      low: '오래 분석하거나 원리를 파고드는 일은 덜 끌리는 편이에요.' },
    A: { label: '예술형', short: '예술', nick: '자유로운 창작자',
      what: '그림, 글, 음악, 디자인처럼 나만의 방식으로 표현하는 일에 끌리는 정도예요.',
      where: '꾸미기, 만들기, 글쓰기, 공연처럼 정해진 답이 없는 일에서 드러나요. 높으면 자유롭게 시도할 여지가 있을 때 힘이 나고, 틀에 박힌 반복 작업은 금방 지칠 수 있어요.',
      high: '나만의 방식으로 표현할 수 있을 때 가장 즐거워요. 정해진 답보다 새로운 시도를 좋아해요.',
      low: '정해진 틀 없이 표현해야 하는 일은 덜 끌리는 편이에요.' },
    S: { label: '사회형', short: '사회', nick: '따뜻한 조력자',
      what: '사람을 가르치고, 돕고, 돌보는 일에 끌리는 정도예요.',
      where: '친구 고민 들어 주기, 후배 가르치기, 봉사처럼 사람과 마주하는 일에서 드러나요. 높으면 누군가에게 도움이 됐다는 느낌이 큰 보람이 되고, 혼자 기계나 서류만 보는 일은 외롭게 느낄 수 있어요.',
      high: '누군가에게 도움이 됐다고 느낄 때 가장 보람을 느껴요. 사람과 마주하며 함께하는 일이 편해요.',
      low: '사람을 가르치거나 돌보는 일은 덜 끌리는 편이에요.' },
    E: { label: '진취형', short: '진취', nick: '앞장서는 도전자',
      what: '사람을 이끌고, 설득하고, 새로운 일을 벌이는 데 끌리는 정도예요.',
      where: '모임 이끌기, 발표, 장사, 협상처럼 목표를 세우고 밀고 나가는 일에서 드러나요. 높으면 경쟁과 도전이 오히려 자극이 되고, 결정권 없이 시키는 일만 하면 답답할 수 있어요.',
      high: '목표를 세우고 사람들을 움직여 해낼 때 가장 신나요. 도전과 경쟁이 오히려 자극이 돼요.',
      low: '앞에 나서서 이끌거나 설득하는 일은 덜 끌리는 편이에요.' },
    C: { label: '관습형', short: '관습', nick: '빈틈없는 기록가',
      what: '자료와 일정을 정리하고, 정해진 기준대로 정확하게 처리하는 일에 끌리는 정도예요.',
      where: '기록, 일정 관리, 돈 관리, 서류 처리처럼 차근차근 정확해야 하는 일에서 드러나요. 높으면 순서와 기준이 분명할 때 마음이 편하고, 기준 없이 자꾸 바뀌는 일은 불편하게 느낄 수 있어요.',
      high: '기준과 순서가 분명한 일을 정확하게 끝낼 때 가장 마음이 편해요. 꼼꼼함이 가장 큰 무기예요.',
      low: '서류와 숫자를 꼼꼼히 정리하는 일은 덜 끌리는 편이에요.' }
  };

  const FACETS = [
    { key: 'mech', code: 'R', label: '기계·만들기', hi: '기계와 도구를 직접 만지고 고치는 쪽에 특히 끌려요.', acts: ['목공이나 3D 프린팅 원데이 수업', '자전거·생활 가전 고치는 법 배우기', '조립 키트로 로봇이나 라디오 만들기'] },
    { key: 'outdoor', code: 'R', label: '자연·몸 쓰기', hi: '밖에서 몸을 움직이고 자연을 가꾸는 쪽에 특히 끌려요.', acts: ['텃밭이나 베란다 화분 가꾸기', '캠핑·등산·낚시', '몸을 많이 쓰는 운동 동호회'] },
    { key: 'science', code: 'I', label: '과학·실험', hi: '직접 관찰하고 실험해서 확인하는 쪽에 특히 끌려요.', acts: ['과학관 체험 프로그램', '천체 관측 행사', '집에서 하는 간단한 과학 실험'] },
    { key: 'analysis', code: 'I', label: '분석·논리', hi: '숫자와 논리로 문제를 풀어내는 쪽에 특히 끌려요.', acts: ['코딩·데이터 분석 입문 강의', '추리 게임이나 논리 퍼즐', '궁금한 주제의 통계를 찾아 그래프로 그려 보기'] },
    { key: 'visual', code: 'A', label: '그리기·디자인', hi: '눈에 보이는 것을 그리고 꾸미고 디자인하는 쪽에 특히 끌려요.', acts: ['그림이나 사진을 모아 나만의 포트폴리오 만들기', '디자인 프로그램으로 포스터 만들기', '전시회 둘러보기'] },
    { key: 'perform', code: 'A', label: '글·음악·공연', hi: '글, 음악, 몸짓으로 표현하는 쪽에 특히 끌려요.', acts: ['글쓰기 모임이나 블로그 연재', '악기·보컬 배우기', '연극·밴드·댄스 동아리'] },
    { key: 'teach', code: 'S', label: '가르치기', hi: '아는 것을 알려 주고 가르치는 쪽에 특히 끌려요.', acts: ['공부 모임에서 설명 맡기', '어린이·청소년 교육 봉사', '내가 잘 아는 걸 짧은 강의로 만들어 보기'] },
    { key: 'care', code: 'S', label: '돌보기·상담', hi: '곁에서 돌보고 마음을 들어 주는 쪽에 특히 끌려요.', acts: ['복지관이나 병원 봉사', '또래 상담·멘토링 프로그램', '심리·상담 교양 강의'] },
    { key: 'lead', code: 'E', label: '이끌기·설득', hi: '사람들을 이끌고 설득하는 쪽에 특히 끌려요.', acts: ['모임에서 대표나 회의 진행 맡기', '토론·발표 대회', '작은 행사를 처음부터 끝까지 기획하기'] },
    { key: 'biz', code: 'E', label: '사업·판매', hi: '물건을 팔고 사업을 벌여 키우는 쪽에 특히 끌려요.', acts: ['플리마켓이나 온라인 장터에서 직접 팔아 보기', '창업 동아리나 아이디어 공모전', '동네 가게 하나를 골라 손님을 늘릴 방법 궁리하기'] },
    { key: 'organize', code: 'C', label: '정리·기록', hi: '일정과 서류를 차곡차곡 정리하는 쪽에 특히 끌려요.', acts: ['일정표나 할 일 목록 꾸준히 쓰기', '모임의 기록·총무 맡기', '사진과 파일을 기준을 세워 정리하기'] },
    { key: 'data', code: 'C', label: '숫자·자료 관리', hi: '숫자와 자료를 정확하게 관리하는 쪽에 특히 끌려요.', acts: ['한 달 가계부 쓰기', '표 계산 프로그램 자격증 공부', '동아리 회비 장부 맡기'] }
  ];

  /* [세부, 활동] — 세부마다 6개. 모두 "~기"로 끝나는 활동이고, 잘하는지가 아니라 해 보고 싶은지를 묻는다. */
  const ITEMS = [
    ['mech', '고장 난 기계를 분해해서 고쳐 보기'],
    ['mech', '나무를 자르고 다듬어 작은 가구 만들기'],
    ['mech', '공구로 자전거를 직접 정비하기'],
    ['mech', '전선을 이어 조명이나 스위치 달아 보기'],
    ['mech', '새는 수도꼭지나 헐거운 문고리 고치기'],
    ['mech', '드론이나 RC카를 부품부터 조립하기'],
    ['outdoor', '텃밭에 채소를 심고 길러 보기'],
    ['outdoor', '숲에 나무를 심고 가지치기하기'],
    ['outdoor', '텐트를 치고 불을 피워 야영하기'],
    ['outdoor', '목장에서 소나 말을 키우는 일 하기'],
    ['outdoor', '작은 배를 몰아 강을 건너 보기'],
    ['outdoor', '땀 흘리며 몸으로 겨루는 운동 경기 하기'],
    ['science', '현미경으로 세포나 미생물 관찰하기'],
    ['science', '조건을 바꿔 가며 과학 실험 해 보기'],
    ['science', '망원경으로 별과 행성 관찰하기'],
    ['science', '화석이나 암석이 생긴 과정 조사하기'],
    ['science', '약이 몸속에서 어떻게 작용하는지 알아보기'],
    ['science', '동물의 행동을 관찰해 그 이유 알아내기'],
    ['analysis', '어려운 수학 문제를 끝까지 풀어 보기'],
    ['analysis', '자료를 분석해서 숨은 규칙 찾아내기'],
    ['analysis', '컴퓨터 프로그램의 작동 원리 파헤치기'],
    ['analysis', '논리 퍼즐이나 추리 문제 풀기'],
    ['analysis', '어떤 주장이 맞는지 근거를 따져 보기'],
    ['analysis', '새로운 이론을 깊이 파고들어 공부하기'],
    ['visual', '마음에 드는 풍경을 그림으로 그리기'],
    ['visual', '포스터나 로고를 직접 디자인하기'],
    ['visual', '사진을 찍고 색감을 보정해 작품 만들기'],
    ['visual', '흙으로 그릇이나 작은 조각 빚기'],
    ['visual', '방을 내 취향대로 꾸미고 배치 바꾸기'],
    ['visual', '옷이나 소품을 내 스타일로 디자인하기'],
    ['perform', '짧은 소설이나 시 쓰기'],
    ['perform', '악기로 좋아하는 곡 연주하기'],
    ['perform', '연극 무대에서 배역을 맡아 연기하기'],
    ['perform', '직접 곡을 만들고 가사 붙이기'],
    ['perform', '음악에 맞춰 춤 동작 짜기'],
    ['perform', '짧은 영상을 찍어 이야기가 있게 편집하기'],
    ['teach', '친구에게 어려운 내용을 쉽게 설명해 주기'],
    ['teach', '아이들에게 글자나 숫자 가르치기'],
    ['teach', '수업 계획을 짜서 학생들 가르치기'],
    ['teach', '처음 온 동료에게 일하는 방법 알려 주기'],
    ['teach', '외국인에게 우리말 가르쳐 주기'],
    ['teach', '어르신께 스마트폰 쓰는 법 알려 드리기'],
    ['care', '고민이 있는 사람의 이야기 들어 주기'],
    ['care', '몸이 불편한 어르신 곁에서 돕기'],
    ['care', '병원에서 환자를 보살피는 일 하기'],
    ['care', '봉사 활동으로 어려운 이웃 돕기'],
    ['care', '다툰 두 사람이 화해하도록 돕기'],
    ['care', '어린아이를 돌보고 함께 놀아 주기'],
    ['lead', '모임의 대표를 맡아 사람들 이끌기'],
    ['lead', '내 생각에 반대하는 사람 설득하기'],
    ['lead', '많은 사람 앞에서 내 계획 발표하기'],
    ['lead', '회의를 이끌며 중요한 결정 내리기'],
    ['lead', '대표 선거에 나가 표를 모아 보기'],
    ['lead', '큰 행사를 앞장서서 지휘하기'],
    ['biz', '내 가게를 열어 직접 운영하기'],
    ['biz', '손님에게 물건의 장점을 알려 팔기'],
    ['biz', '사업 아이디어로 창업해 보기'],
    ['biz', '가격을 흥정해 유리하게 계약하기'],
    ['biz', '매출을 올릴 홍보 작전 짜기'],
    ['biz', '물건을 싸게 사서 이윤을 남기고 팔기'],
    ['organize', '서류를 종류별로 나눠 정리하기'],
    ['organize', '한 주의 일정을 시간표로 짜기'],
    ['organize', '회의 내용을 빠짐없이 기록하기'],
    ['organize', '신청서가 규칙에 맞는지 하나씩 확인하기'],
    ['organize', '책이나 물건에 번호를 붙여 목록 만들기'],
    ['organize', '문서에 틀린 글자가 없는지 꼼꼼히 살피기'],
    ['data', '가계부에 수입과 지출 꼬박꼬박 적기'],
    ['data', '창고 재고를 세어 장부와 맞춰 보기'],
    ['data', '컴퓨터 표에 자료를 정확히 입력하기'],
    ['data', '영수증을 모아 비용 정산하기'],
    ['data', '통장 거래 내역을 하나씩 대조하기'],
    ['data', '설문 응답을 표로 깔끔하게 정리하기']
  ];

  /* 상위 두 유형 조합 15가지. 키는 육각형 순서로 붙인 두 글자이고, 제목은 점수 순서(예: 예술·탐구형)로 쓴다. */
  const PAIRS = {
    RI: { nick: '실험하는 기술자', desc: '직접 만지고 고쳐 보면서 원리를 알아내는 걸 좋아해요. 말보다 결과물로 보여 주는 쪽이 편하고, 기계나 자연이 어떻게 움직이는지 끝까지 파고들어요.',
      jobs: ['기계·전기 엔지니어', '자동차·항공 정비 기술자', '실험실 기술 연구원', '농업·환경 연구원', '로봇·드론 개발자'] },
    RA: { nick: '손끝의 예술가', desc: '머릿속에 그린 모양을 손으로 직접 만들어 내는 걸 좋아해요. 나무, 흙, 천 같은 재료를 다루며 쓸모와 아름다움을 함께 챙겨요.',
      jobs: ['목공예가·가구 제작자', '무대 장치·소품 제작자', '사진·영상 촬영 기사', '조경 디자이너', '요리사·제과사'] },
    RS: { nick: '현장에서 돕는 사람', desc: '몸을 움직여 직접 사람을 돕는 일에 끌려요. 손과 몸을 쓰면서 사람을 챙길 수 있는 자리에서 두 흥미를 함께 살릴 수 있어요.',
      jobs: ['소방관·구조대원', '물리치료사', '운동 지도자', '응급구조사', '직업 훈련 교사'] },
    RE: { nick: '현장 지휘관', desc: '현장에서 직접 움직이면서 일을 앞장서 끌고 가는 걸 좋아해요. 계획을 실제 결과로 바꾸는 추진력이 있어요.',
      jobs: ['건설 현장 관리자', '농장·목장 경영자', '경찰관', '공방·정비소 운영자', '스포츠 팀 매니저'] },
    RC: { nick: '꼼꼼한 장인', desc: '정해진 순서와 기준대로 정확하게 손을 쓰는 일이 편해요. 장비를 점검하고 기록을 남기면서 빈틈없이 마무리해요.',
      jobs: ['품질 검사원', '전기·설비 기사', '측량 기사', '물류 관리자', '장비 운영 기사'] },
    IA: { nick: '상상하는 연구자', desc: '궁금한 걸 깊이 파고들면서도 나만의 방식으로 풀어내고 싶어 해요. 정해진 답보다 새로운 생각을 떠올리는 데서 즐거움을 느껴요.',
      jobs: ['건축가', '게임·UX 기획자', '과학 작가', '연구 디자이너', '데이터 시각화 전문가'] },
    IS: { nick: '사람을 살피는 과학자', desc: '원리를 알아내서 사람에게 도움이 되는 데 쓰고 싶어 해요. 왜 그런지 파고드는 힘과 남을 돕고 싶은 마음이 함께 있어요.',
      jobs: ['의사·약사', '간호사', '심리 연구자', '보건·영양 전문가', '교육 연구자'] },
    IE: { nick: '앞을 내다보는 전략가', desc: '분석해서 답을 찾고, 그 답으로 일을 밀고 나가는 걸 좋아해요. 생각하는 시간과 실행하는 시간이 둘 다 있는 일이 잘 맞아요.',
      jobs: ['경영 컨설턴트', '투자 분석가', '기술 창업가', '시장 조사 분석가', '변리사'] },
    IC: { nick: '정확한 분석가', desc: '자료를 꼼꼼히 모으고 정확하게 분석하는 걸 좋아해요. 틀린 곳을 찾아내고 근거로 판단하는 일에서 힘을 발휘해요.',
      jobs: ['데이터 분석가', '회계 감사인', '소프트웨어 테스터', '통계 전문가', '임상 연구 코디네이터'] },
    AS: { nick: '마음을 잇는 표현가', desc: '표현하는 걸 좋아하고, 그 표현으로 사람들과 마음을 나누고 싶어 해요. 이야기, 그림, 음악으로 사람을 위로하거나 가르치는 일에 끌려요.',
      jobs: ['미술·음악 교사', '예술 치료사', '방송 작가', '어린이 콘텐츠 제작자', '문화 예술 교육 강사'] },
    AE: { nick: '아이디어 기획자', desc: '새로운 아이디어를 떠올리고, 그걸 사람들 앞에 내놓아 반응을 끌어내는 걸 좋아해요. 창의력과 추진력이 함께 있어요.',
      jobs: ['광고 기획자', '브랜드 디자이너', '공연·전시 기획자', '콘텐츠 크리에이터', '패션 머천다이저'] },
    AC: { nick: '정교한 디자이너', desc: '자유롭게 표현하는 것도, 꼼꼼하게 마무리하는 것도 좋아해요. 창작을 정해진 형식 안에서 정교하게 다듬는 일이 잘 맞아요.',
      jobs: ['편집 디자이너', '출판 편집자', '웹 퍼블리셔', '사진 보정 전문가', '영상 자막·번역가'] },
    SE: { nick: '함께 가는 리더', desc: '사람들과 어울려 함께 목표를 이루는 걸 좋아해요. 사람을 챙기면서 앞장서는 역할이 자연스러워요.',
      jobs: ['인사·교육 담당자', '영업 관리자', '교육 행정가', '시민 단체 활동가', '호텔·관광 서비스 관리자'] },
    SC: { nick: '든든한 살림꾼', desc: '사람을 돕는 일을 차근차근, 빈틈없이 해내는 걸 좋아해요. 정해진 절차를 지키면서 사람들을 챙겨요.',
      jobs: ['사회복지사', '보건 행정가', '학교 행정 직원', '고객 지원 담당자', '병원 코디네이터'] },
    EC: { nick: '실속 있는 관리자', desc: '목표를 세우고 숫자와 계획으로 꼼꼼히 관리하는 걸 좋아해요. 일이 체계적으로 굴러가게 만드는 데 강해요.',
      jobs: ['경영 관리자', '재무 관리자', '은행원', '부동산 중개인', '프로젝트 매니저'] }
  };

  // 육각형에서 두 유형 사이의 거리: 1 이웃, 2 한 칸 건너, 3 마주 봄
  const HEX = {
    1: '두 유형이 바로 옆에 붙어 있어서 흥미가 한 방향으로 잘 모여 있어요. 두 가지를 함께 쓰는 일을 찾기 쉬운 편이에요.',
    2: '두 유형은 한 칸 건너 있어요. 서로 다르지만 잘 어울리는 흥미라서, 둘을 함께 쓰는 일이 꽤 많아요.',
    3: '두 유형은 서로 마주 보고 있어요. 성격이 꽤 다른 두 흥미라서, 둘 다 쓰는 일을 찾거나 하나는 일로, 하나는 취미로 채우는 방법도 좋아요.'
  };
  const FLATS = {
    high: { headline: '고르게 높음', label: '여러 분야에 두루 끌려요', summary: '여러 분야에 두루 관심이 많은 편이에요.',
      tip: '관심이 넓으면 기획이나 융합 분야처럼 여러 가지를 두루 하는 일이 잘 맞을 수 있어요. 해 본 뒤 가장 즐거웠던 활동을 기준으로 조금씩 좁혀 보세요.' },
    mid: { headline: '고르게 보통', label: '어느 쪽으로도 기울지 않았어요', summary: '어느 쪽에도 크게 끌리거나 싫어하지 않는 상태예요.',
      tip: '"보통이다"를 많이 골랐다면, 실제로 해 본 활동이나 비슷한 경험을 떠올리며 다시 해 보세요. 경험이 쌓일수록 끌리는 쪽이 더 또렷해져요.' },
    low: { headline: '고르게 낮음', label: '아직 뚜렷한 끌림이 없어요', summary: '지금은 끌리는 활동이 적게 나왔어요.',
      tip: '컨디션이 좋지 않은 날이나 아직 해 보지 않은 활동이 많을 때 이렇게 나오기도 해요. 체험 활동이나 짧은 수업으로 몇 가지를 직접 해 본 뒤 다시 검사해 보세요.' }
  };
  const NOTE = { title: '흥미와 적성은 달라요', body: '이 검사는 어떤 활동을 "하고 싶은지"를 본 거예요. 무언가를 "잘할 수 있는지"를 보는 적성이나 능력과는 달라요. 끌리는 일도 배우고 연습해야 잘하게 되고, 덜 끌리는 일도 충분히 잘할 수 있어요. 진로를 고를 때는 흥미와 함께 잘하는 것, 중요하게 여기는 것, 직접 해 본 경험을 같이 살펴보세요.' };
  const LABELS = ['전혀 아니다', '별로다', '보통이다', '해 보고 싶다', '꼭 해 보고 싶다'];
  const LEAD = '이 활동, 얼마나 해 보고 싶나요?';
  const FLAT = 15;      // 가장 높은 유형과 가장 낮은 유형의 차이가 이보다 작으면 조합을 고르지 않는다
  const CLOSE = 5;      // 둘째와 셋째의 차이가 이보다 작으면 "비슷해요"를 덧붙인다 (기본 검사에서 한 칸 차이는 약 4점)
  const DOMINANT = 25;  // 첫째가 둘째보다 이만큼 높으면 첫째 하나를 중심으로 보라고 안내한다

  function facetsOf(k) { return FACETS.filter(function (fc) { return fc.code === k; }); }
  function pairKey(a, b) { return ORDER.indexOf(a) < ORDER.indexOf(b) ? a + b : b + a; }
  function hexDist(a, b) { const d = Math.abs(ORDER.indexOf(a) - ORDER.indexOf(b)); return Math.min(d, 6 - d); }
  function noRepeat(list, prev) {
    for (let i = 0; i < list.length; i++) {
      const before = i ? list[i - 1] : prev;
      if (before && before.code === list[i].code) return false;
    }
    return true;
  }

  /* 기본 검사: 세부마다 6개 중 3개를 무작위로 골라 36문항(유형마다 6). 정밀 검사: 72문항 전부(유형마다 12).
     세부 12개를 한 바퀴씩 돌며 내고, 한 바퀴 안에서 섞되 같은 유형이 연달아 나오지 않게 한다. */
  function build(mode) {
    const r = U.rng();
    const per = mode === 'full' ? 6 : 3;
    const chosen = {};
    FACETS.forEach(function (fc) { chosen[fc.key] = r.sample(ITEMS.filter(function (it) { return it[0] === fc.key; }), per); });
    const items = [];
    for (let i = 0; i < per; i++) {
      const block = FACETS.map(function (fc) { return { type: 'likert', scored: true, facet: fc.key, code: fc.code, text: chosen[fc.key][i][1], lead: LEAD, labels: LABELS }; });
      let order = r.shuffle(block);
      for (let k = 0; k < 80 && !noRepeat(order, items[items.length - 1]); k++) order = r.shuffle(block);
      items.push.apply(items, order);
    }
    items.unshift({ type: 'section', num: 1, title: '해 보고 싶은 활동', desc: '여러 가지 활동이 하나씩 나와요. 잘할 수 있는지는 생각하지 말고, 얼마나 해 보고 싶은지만 골라요. 해 본 적 없는 활동이면 해 본다고 상상하고 답하면 돼요.', count: items.length + '문항 · 약 ' + Math.round(items.length / 9) + '분' });
    return items;
  }

  function score(answers, items, meta) {
    const sums = {}, counts = {};
    items.forEach(function (it, i) {
      if (it.type !== 'likert') return;
      const a = answers[i];
      if (typeof a !== 'number') return;
      sums[it.facet] = (sums[it.facet] || 0) + a;
      counts[it.facet] = (counts[it.facet] || 0) + 1;
    });
    const fv = {};
    FACETS.forEach(function (fc) { const m = counts[fc.key] ? sums[fc.key] / counts[fc.key] : 3; fv[fc.key] = Math.round((m - 1) / 4 * 100); });
    const tv = {};
    ORDER.forEach(function (k) { tv[k] = Math.round(U.mean(facetsOf(k).map(function (fc) { return fv[fc.key]; }))); });
    // 점수 순으로 막대를 그리고, 같은 점수는 육각형 순서로 둔다
    const sorted = ORDER.slice().sort(function (a, b) { return tv[b] - tv[a] || ORDER.indexOf(a) - ORDER.indexOf(b); });
    const scales = sorted.map(function (k) {
      return { key: k, label: TYPES[k].label, value: tv[k], children: facetsOf(k).map(function (fc) { return { key: fc.key, label: fc.label, value: fv[fc.key] }; }) };
    });
    const pts = function (k) { return TYPES[k].label + '(' + tv[k] + '점)'; };
    const first = sorted[0], second = sorted[1], third = sorted[2];
    const top = tv[first], bottom = tv[sorted[5]];
    const base = { modeLabel: meta && meta.mode === 'full' ? '정밀 검사' : '기본 검사', value: top, scales: scales };

    // 여섯 유형이 거의 같으면(같은 답만 고른 경우 포함) 조합을 억지로 고르지 않는다
    if (top - bottom < FLAT) {
      const avg = U.mean(ORDER.map(function (k) { return tv[k]; }));
      const F = FLATS[avg >= 60 ? 'high' : avg <= 40 ? 'low' : 'mid'];
      const fs = FACETS.slice().sort(function (a, b) { return fv[b.key] - fv[a.key]; });
      const fTop = fs[0], fLow = fs[fs.length - 1];
      const fp = function (fc) { return fc.label + '(' + fv[fc.key] + '점)'; };
      return Object.assign(base, {
        headline: F.headline,
        label: F.label,
        summary: (top === bottom ? '여섯 유형 점수가 모두 ' + top + '점으로 같아서' : '가장 높은 ' + U.josa(pts(first), '과', '와') + ' 가장 낮은 ' + pts(sorted[5]) + '의 차이가 ' + (top - bottom) + '점뿐이라') +
          ' 두 유형 조합을 억지로 고르지 않았어요. ' + F.summary,
        sections: [
          { title: '고르게 나왔을 때', body: F.tip },
          { title: '세부 갈래', body: fv[fTop.key] - fv[fLow.key] >= FLAT
            ? '세부 갈래 중에서는 ' + U.josa(fp(fTop), '이', '가') + ' 가장 높고 ' + U.josa(fp(fLow), '이', '가') + ' 가장 낮아요. 조금이라도 더 끌리는 쪽부터 체험해 보면 좋아요.'
            : '세부 갈래 열두 개도 비슷하게 나왔어요.' },
          Object.assign({}, NOTE)
        ]
      });
    }

    const P = PAIRS[pairKey(first, second)];
    const name = TYPES[first].short + '·' + TYPES[second].label;
    const topFacet = function (k) { const fs = facetsOf(k); return fv[fs[1].key] > fv[fs[0].key] ? fs[1] : fs[0]; };
    const typeBody = function (k) {
      const fs = facetsOf(k).slice().sort(function (a, b) { return fv[b.key] - fv[a.key]; });
      const a = fs[0], b = fs[1];
      return TYPES[k].high + ' ' + (fv[a.key] - fv[b.key] < 10
        ? '세부로는 ' + a.label + ' ' + fv[a.key] + '점, ' + b.label + ' ' + fv[b.key] + '점으로 두 갈래가 비슷해요.'
        : '세부로는 ' + a.label + ' ' + fv[a.key] + '점이 ' + b.label + ' ' + fv[b.key] + '점보다 높아요. ' + a.hi);
    };
    const notes = [];
    if (top === tv[second]) notes.push(U.josa(TYPES[first].label, '과', '와') + ' ' + U.josa(TYPES[second].label, '이', '가') + ' 같은 점수라서 순서는 육각형 순서(현실·탐구·예술·사회·진취·관습)로 정했어요.');
    if (tv[second] - tv[third] < CLOSE) notes.push('둘째인 ' + U.josa(pts(second), '과', '와') + ' 셋째인 ' + pts(third) + '의 차이가 작아서 ' + U.josa("'" + TYPES[first].short + '·' + TYPES[third].label + "'", '으로', '로') + ' 봐도 돼요.');
    if (top - tv[second] >= DOMINANT) notes.push(U.josa(TYPES[first].label, '이', '가') + ' 둘째보다 ' + (top - tv[second]) + '점 높아서, 조합보다 ' + TYPES[first].label + ' 하나를 중심으로 봐도 좋아요.');
    if (top < 50) notes.push('가장 높은 유형도 50점보다 낮아서 전체적으로 끌림이 약하게 나왔어요. 아직 해 보지 않은 활동이 많으면 이렇게 나오기도 하니, 몇 가지를 직접 해 본 뒤 다시 검사해 보세요.');
    if (bottom >= 60) notes.push('가장 낮은 유형도 60점이 넘어서 관심 분야가 전반적으로 넓은 편이에요. 여러 분야를 잇는 일도 잘 맞을 수 있어요.');
    const lows = sorted.filter(function (k) { return tv[k] === bottom; });
    const sections = [
      { title: '첫째 흥미 · ' + TYPES[first].label + ' (' + TYPES[first].nick + ')', body: typeBody(first) },
      { title: '둘째 흥미 · ' + TYPES[second].label + ' (' + TYPES[second].nick + ')', body: typeBody(second) },
      { title: '어울리는 활동', body: [first, second].map(function (k) { const fc = topFacet(k); return TYPES[k].label + '의 ' + fc.label + ' 쪽으로는 ' + fc.acts.join(', ') + ' 같은 활동을 해 볼 만해요.'; }).join(' ') + ' 짧게라도 직접 해 보면 정말 즐거운지 가장 정확하게 알 수 있어요.' },
      { title: '어울리는 직업 예시', body: P.jobs.join(', ') + ' 같은 직업이 ' + U.josa(name, '과', '와') + ' 잘 어울려요. 예시일 뿐이니, 끌리는 이름이 있으면 실제로 어떤 일을 하는지 찾아보고 체험해 보세요.' },
      { title: '두 유형의 거리', body: '여섯 유형은 현실·탐구·예술·사회·진취·관습 순서로 육각형에 둘러앉아 있고, 가까울수록 비슷한 흥미예요. ' + HEX[hexDist(first, second)] }
    ];
    if (notes.length) sections.push({ title: '참고할 점', body: notes.join(' ') });
    if (lows.length <= 2) sections.push({ title: '가장 덜 끌리는 쪽 · ' + lows.map(function (k) { return TYPES[k].label; }).join('·'),
      body: lows.map(function (k) { return TYPES[k].low; }).join(' ') + ' 이런 일을 맡게 되면 짧게 나눠 하거나, 잘 맞는 사람과 나눠 맡으면 한결 수월해요. 덜 끌린다고 못하는 건 아니에요.' });
    sections.push(Object.assign({}, NOTE));
    return Object.assign(base, {
      headline: name,
      label: P.nick,
      code: first + second,
      summary: U.josa(pts(first), '과', '와') + ' ' + U.josa(pts(second), '이', '가') + ' 가장 높아요. ' + P.desc,
      sections: sections
    });
  }

  BL.tests.interest = {
    id: 'interest',
    num: 5,
    kind: 'trait',
    kindLabel: '진로',
    title: '진로 흥미 유형 검사',
    subtitle: '손으로 만들기, 원리 파고들기, 표현하기, 돕기, 이끌기, 정리하기 중에서 어떤 일을 할 때 즐거운지 여섯 가지 흥미 유형으로 알아봐요.',
    duration: '약 4~8분',
    length: '36·72문항 · 12세부',
    modes: [
      { id: 'standard', label: '기본 검사', desc: '세부 갈래마다 3문항씩 36문항이에요. 72개 활동 중에서 골라 나와서 다시 해도 문항이 조금씩 바뀌어요.', duration: '약 4분', length: '36문항' },
      { id: 'full', label: '정밀 검사', desc: '72개 활동을 모두 풀어요. 세부 갈래마다 6문항이라 결과가 더 안정적이에요.', duration: '약 8분', length: '72문항' }
    ],
    explain: ORDER.map(function (k) { return { label: TYPES[k].label, what: TYPES[k].what, where: TYPES[k].where, tasks: facetsOf(k).map(function (fc) { return fc.label; }).join(', ') }; }),
    intro: [
      '심리학자 존 홀랜드가 사람의 흥미를 여섯 가지로 나눈 틀을 써요. 진로 교육에서 널리 쓰이는 방법이에요.',
      '현실형, 탐구형, 예술형, 사회형, 진취형, 관습형을 유형마다 두 갈래로 나눠서 봐요. 활동을 하나씩 읽고 얼마나 해 보고 싶은지 고르면 돼요.',
      '결과에는 여섯 유형 점수와 가장 높은 두 유형의 조합, 어울리는 활동과 직업 예시가 나와요. 문항은 이 사이트를 위해 직접 썼어요.',
      '흥미는 "하고 싶은 마음"이지 "잘하는 힘"이 아니에요. 적성이나 능력을 재는 검사가 아니니, 진로를 고를 때 참고 자료 중 하나로 봐 주세요.'
    ],
    build: build,
    score: score
  };
})();