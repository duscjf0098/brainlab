/* 사이트 설정. 카카오톡 공유 버튼을 쓰려면 developers.kakao.com 에서 앱을 만들고
   "JavaScript 키"를 아래에 넣은 뒤, 앱 설정 > 플랫폼 > Web 에 사이트 도메인을 등록한다.
   (JavaScript 키는 도메인으로 제한되는 공개 키라 저장소에 있어도 된다.) */
window.BL_CONFIG = {
  siteUrl: 'https://duscjf0098.github.io/brainlab/',
  kakaoKey: 'd1a3cd068a9a5f95af5892b34aeb75aa',
  /* 익명 응시 통계 서버(server/, Cloudflare Worker) 주소. 비어 있으면 통계를 보내지도 받지도 않고 안내·스위치도 나오지 않는다. 배포 방법은 README "익명 통계 서버". */
  statsUrl: ''
};
