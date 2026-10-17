-- 두뇌실험실 익명 응시 통계 · D1 스키마
-- 적용: npx wrangler d1 execute brainlab-stats --remote --file=schema.sql  (로컬 개발은 --local)
-- 개인정보 없음: 이름·이메일·IP·User-Agent·기기 식별자·정확한 시각·문항 내용 열이 없다. 날짜는 일 단위(UTC)만.
-- sid는 결과마다 브라우저가 새로 만든 무작위 값으로, 같은 결과를 두 번 보내는 것만 막는다.

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sid TEXT NOT NULL UNIQUE,          -- 결과별 무작위 id (중복 전송 방지)
  day TEXT NOT NULL,                 -- 받은 날짜 'YYYY-MM-DD' (UTC, 시각은 저장하지 않음)
  test_id TEXT NOT NULL,             -- 'cognitive'
  mode TEXT NOT NULL,                -- adaptive | quick | full | task:<key>
  time_factor REAL,                  -- 1 표준 · 1.5 여유 · 0 무제한 (집계는 표준만 쓴다)
  device TEXT,                       -- 'touch' | 'mouse' (화면 입력 방식, 기기 식별자 아님)
  norms TEXT,                        -- 결과를 낸 기준값 버전 (cognitive.js NORMS_VERSION)
  overall_z REAL,                    -- 종합 z (사이트가 그때 기준값으로 계산한 값)
  payload TEXT NOT NULL              -- 과제별 원점수 JSON (task_rows와 같은 내용)
);
CREATE INDEX IF NOT EXISTS idx_submissions_test ON submissions (test_id, id);

CREATE TABLE IF NOT EXISTS task_rows (
  sid TEXT NOT NULL,
  task TEXT NOT NULL,                -- matrix … symbol (20개)
  kind TEXT NOT NULL,                -- prop 정답률 · span 폭 · rt 반응 시간 · count 개수
  z REAL NOT NULL,                   -- 과제 z (그때 기준값 기준)
  n INTEGER,                         -- prop: 문항 수
  c INTEGER,                         -- prop: 정답 수
  levels TEXT,                       -- prop: {"1":{"n":2,"c":2},…} 단계별 문항·정답 수
  items TEXT,                        -- prop: [[풀 번호(-1 생성 문항), 단계, 정답 1·오답 0·시간 초과 -1, 응답 시간 0.1초], …]
  adaptive INTEGER,                  -- prop: 1이면 적응형(단계가 응시자마다 다름), 0이면 정밀(단계표대로)
  value REAL,                        -- span: 폭 · rt: 반응 시간 중앙값(ms) · count: 정답−오답
  acc REAL,                          -- rt(선택 반응·색-단어)·count: 정확도 0~1
  touch INTEGER,                     -- rt: 1이면 터치 입력(기준값 +30ms 적용 대상)
  PRIMARY KEY (sid, task)
);
CREATE INDEX IF NOT EXISTS idx_task_rows_task ON task_rows (task);

-- 집계 캐시 (한 행). /stats 가 1시간(표본이 적으면 1분)마다 다시 계산해 덮어쓴다.
CREATE TABLE IF NOT EXISTS stats_cache (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  at INTEGER NOT NULL,
  n INTEGER NOT NULL,
  body TEXT NOT NULL
);