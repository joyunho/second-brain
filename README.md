# 🧠 Second Brain — YouKnow 거울 볼트

> **"폰에서는 YouKnow에 막 적고, 컴퓨터에서는 Ctrl+N 하나로 적는다. 밤이 되면 전부 한 뇌(볼트)로 모여 그물이 된다."**

옵시디언(Obsidian) 볼트입니다. 이 저장소를 "폴더를 볼트로 열기" 하면 됩니다.
내가 쓰는 할 일·일정·일기·습관 앱 **YouKnow**(V17.2)의 화면과 어휘를 그대로 폴더·속성으로 옮기고, 그 위에 제텔카스텐 확장층(분야·문헌·영구 노트·사람)을 얹었습니다. 설계 전문은 [[_System/Docs/설계서-YouKnow-거울-볼트|설계서]], ⚡ 문법은 [[_System/Docs/빠른-입력-문법|빠른 입력 문법]], 매일/매주 할 일은 [[_System/Docs/운영-루틴|운영 루틴]]에 있습니다.

---

## 1. 설계 원칙

| 원칙 | 구현 |
| --- | --- |
| **YouKnow = 내가 정리하는 방식 → 화면이 곧 폴더** | 앱 내비 순서 오늘·일정·할 일·프로젝트·일기·습관 = `10_오늘 · 20_일정 · 30_할일 · 40_프로젝트 · 50_일기 · 60_습관`. 앱의 상태 4값·우선순위 5라벨·기분 5값·종류·태그·묶음·분야가 그대로 속성 값과 폴더명이 된다 |
| **행 노트는 facet + 날짜 선, 구조 노트만 `up`** | 일간·일기·할 일·자료(행 노트)는 허브에 매달리지 않고 날짜·종류·기분·태그·프로젝트에 3~6개의 짧은 선을 긋는다. 허브·facet·분야·습관·요일·주간·프로젝트·문헌·영구·사람(구조 노트)만 `up`을 가진다. 그래서 허브-스포크 나무가 아니라 **그물**이 된다 |
| **폴더가 진실** | 노트 위치가 곧 종류. `type`은 Dataview용 보조(한글 한 단어). 유형 태그는 없고, `tags`는 주제 전용 |
| **4색 그래프** | 빨강 = 허브(`#hub`), 파랑 = 문헌·자료, 주황 = 중간 연결자(프로젝트·종류/기분/태그/요일), 나머지 흰색. 상태·우선순위는 노드로 만들지 않아 "진행 전 400개 별"이 생기지 않는다 |
| **입력은 세 길, 출구는 하나** | ① Obsidian `Ctrl/Cmd+N` 라우터(13선택지, ⚡ 빠른 입력) ② 폰은 YouKnow 앱 그대로(Siri·위젯·사진) ③ 매일 밤 `import_youknow.py`가 앱 데이터를 볼트로. 전부 같은 폴더·속성·마커로 수렴한다 |

---

## 2. 폴더 구조

숫자 접두 = **YouKnow 내비 순서**(10~60) + 제텔카스텐 확장(70~98). 폴더명은 띄어쓰기 없는 한글(그래프 `path:` 질의와 셸 경로를 따옴표 없이 쓰기 위해).

```
second-brain/
├── Brain.md                      루트 허브 — 12개 화면 허브로 가는 중심
├── 00_Inbox/Inbox.md             Ctrl+N 기본 생성 폴더. 라우터가 여기서 분배. 그래프 제외
├── 10_오늘/                         (#/today) 시간축
│   ├── 오늘.md                    허브
│   ├── YYYY/MM/YYYY-MM-DD.md        일간 노트 = 그날의 Today 화면 (하루 계획·습관 체크 관리 블록)
│   └── Weekly/GGGG-Www.md           주간 리뷰 (= 주 보기)
├── 20_일정/                         (#/schedule)
│   ├── 일정.md                    허브 — 이번 주 계획 완료율, 요일 노트, 캘린더 안내
│   └── 일과/일요일.md … 토요일.md    요일별 일과표 7개 (routine_blocks)
├── 30_할일/                         (#/tasks)
│   ├── 할 일.md                   허브 — 목록(우선순위 5→1)·칸반(상태 4열)·마감
│   ├── Task Inbox.md             노트 없는 한 줄 체크박스 (Tasks 플러그인)
│   └── 목록/<제목>.md                할 일 1개 = 노트 1개 (세부 메모 화면)
├── 40_프로젝트/                     (#/projects)
│   ├── 프로젝트.md                허브 — 기간·진행률·마감까지·다음 행동 표
│   └── <이름>/<이름>.md             프로젝트 folder note (묶음·체크리스트 본문)
│       └── 자료/<제목>.md            프로젝트 자료 1개 = 노트 1개 → 파랑
├── 50_일기/                         (#/daily)
│   ├── 일기.md                    허브 — 월 캘린더·목록·종류 칩
│   ├── YYYY/YYYY-MM-DD 일기.md       일반 종류 일기 / "YYYY-MM-DD 운동.md" 그 외 종류
│   └── 종류/ 기분/ 태그/             facet 노트 (앱 설정값) → 주황
├── 60_습관/                         (#/habits)
│   ├── 습관.md                    허브
│   └── <습관명>.md                  습관 1개 = 노트 1개 (일간 노트 수백 개가 가리킴 → 빨강)
├── 70_분야/분야.md + 건강 커리어 돈 관계 배움 개인.md    프로젝트·책·영구 노트가 매달리는 중간 마디 → 빨강
├── 80_문헌/                         문헌 노트 → 파랑
│   ├── 문헌.md                    허브
│   ├── 책/  글/                     독후감 · 아티클/영상/강의
│   └── 굿노트/<노트북>.md            GoodNotes PDF 노트
├── 90_영구/영구 노트.md           내 생각 = 영구 노트 (연결 2개 이상 강제)
├── 95_사람/사람.md
├── 98_연동/                         외부 입력 상태
│   ├── 연동.md                    허브 — YouKnow·GoodNotes·Calendar 상태, "YouKnow에 반영 필요" 목록
│   ├── YouKnow.md                   앱 설정 + 마지막 가져오기 로그 (importer가 재생성)
│   └── YouKnow/백업/                youknow-backup-*.json 보관 (.gitignore)
├── _Attachments/{YouKnow, GoodNotes, Images}   첨부 (그래프·Auto Note Mover 숨김)
├── _System/                         뇌의 운영체제 (그래프 숨김)
│   ├── Templates/                   Templater 템플릿 16개 (tpl-inbox 라우터, tpl-daily, tpl-task …)
│   ├── Scripts/                     capture.js · import_youknow.py · import_goodnotes.py · tests/ · .env(.gitignore)
│   ├── Graph/                       그래프 프리셋 full.json · knowledge.json · graph_preset.sh
│   ├── Dashboards/Health.md      뇌 건강검진
│   └── Docs/                        설계서 · 빠른 입력 문법 · 운영 루틴
└── .obsidian/                       설정 커밋됨 (그래프 색·플러그인 설정 포함)
```

---

## 3. 입력 흐름 — 세 길, 출구 하나

### 3-1. `Ctrl/Cmd+N` 라우터 — "이 노트는 무엇인가요?"
새 노트는 `00_Inbox`에 생기고 `tpl-inbox`가 즉시 메뉴를 띄웁니다. 선택하면 제목을 묻고 → 폴더로 옮기고 → 그 유형 템플릿을 입히고 → 라우터 노트는 지웁니다.

| # | 선택지 | 가는 곳 |
| --- | --- | --- |
| 1 | **⚡ 빠른 입력** (여러 줄, YouKnow 문법) | `capture.js`가 줄마다 할 일·계획·습관·일과·프로젝트로 나눠 각 폴더에 씀 |
| 2 | ✅ 할 일 (한 개) | `30_할일/목록/` — 마감(자연어)·우선순위·프로젝트 질문 |
| 3 | 🗂️ 프로젝트 | `40_프로젝트/<이름>/<이름>.md` — 상태·분야(기본 개인)·마감(자연어)·목표·다음 행동 질문 |
| 4 | 📔 일기 | `50_일기/YYYY/` — 종류·날짜·기분·태그 선택, 같은 (날짜, 종류)가 있으면 그 노트를 연다 |
| 5 | 🗓️ 하루 계획 (오늘) | 오늘 일간 노트 `### 하루 계획` 블록 뒤에 한 줄 |
| 6 | 🔁 습관 | `60_습관/` |
| 7 | 📖 독후감 / 책 | `80_문헌/책/` |
| 8 | 📰 글 / 영상 / 강의 | `80_문헌/글/` |
| 9 | 💎 영구 노트 | `90_영구/` |
| 10 | 👤 사람 | `95_사람/` |
| 11 | 🧭 분야 | `70_분야/` |
| 12 | 📎 자료 (프로젝트에) | `40_프로젝트/<이름>/자료/` — URL이면 제목을 `유튜브 영상`/`<host> 글`로 |
| 13 | 📥 그냥 캡처 (Esc) | Inbox에 남음. 나중에 본문에 `#책 #글 #일기 #영구 #프로젝트 #사람 #분야 #할일 #습관 #굿노트` 중 하나를 치면 Auto Note Mover가 옮김 |

**⚡ 빠른 입력 문법 요약** (앱의 빠른 입력과 같은 규칙 — 전체는 [[_System/Docs/빠른-입력-문법]]):

```
내일 오후 3시 치과                 → 🗓️ 계획  내일 15:00–16:00 (오늘 일간 노트가 아니라 그 날짜의 일간 노트에)
매주 월수금 저녁 7시 헬스          → 🔄 일과  월·수·금요일 19:00–20:00 (요일 노트 3개의 일과표에 한 행씩)
매일 영어 단어 20개                → 🔁 습관  60_습관/영어 단어 20개.md
프로젝트: 유튜브 채널 개편         → 🗂️ 프로젝트 (아래 "- " 줄들은 이 프로젝트의 할 일이 된다)
- 9/10까지 영상 편집!!             → ✅ 할 일  마감 2027-09-10(지난 날짜는 내년) · 우선순위 4 중요 · 프로젝트 링크
언젠가 책 정리 #집                 → ✅ 할 일  우선순위 1 언젠가 · 프로젝트 "집"(없으면 생성)
```
날짜(오늘·내일·모레·N일 뒤·M/D·다음 주 X요일·월말·연말…) · 시간(오전/오후 H시, H:MM, 반, `7-10시` 범위 → 계획, `5시까지` → 할 일 메모) · 우선순위(`!!!`/긴급→5, `!!`/중요/`!`→4, 낮음→2, 언젠가→1) · 프로젝트(`#이름 @이름 [이름]`, `프로젝트:` 접두) · 반복(매일/N일마다 → 습관, 매주 요일/X요일마다/주말마다/평일 → 일과) · 헤더 줄(날짜나 우선순위만 있는 줄은 아래 줄들의 기본값) · 불릿 상속. 미리보기 메뉴에서 "N개로 나눴어요 · 모두 추가" 또는 하나만 골라 넣습니다.

### 3-2. 폰 — YouKnow 앱을 그대로 쓴다
앱은 교체하지 않습니다. Siri 단축어("YouKnow에 추가" → `POST /api/capture`), Scriptable 위젯, 사진 업로드·다운스케일, 날짜별 일기 종류 UI는 옵시디언 모바일로 다시 만들기엔 비싸고, 데이터는 전부 Supabase에 있습니다. 폰에서 적은 것은 **매일 밤 `import_youknow.py --supabase`** 가 볼트로 가져옵니다(7장).

### 3-3. 📋 Task Inbox · 일간 노트 체크박스
노트까지는 필요 없는 할 일은 `30_할일/Task Inbox.md`나 일간 노트의 `## ✅ 오늘 할 일` 아래에 `- [ ] 전구 사기 📅 2026-10-17`처럼 Tasks 문법으로 적습니다. ✅ 할 일 허브와 그날 일간 노트 `### 오늘 마감`에 자동으로 뜹니다. 주간 리뷰 때 필요하면 ⚡로 승격해 노트로 만듭니다.

### 3-4. Google Calendar — ICS 플러그인 (읽기 전용)
Google Calendar(웹) › 캘린더 설정 › **비공개 주소(iCal)** 를 ICS 플러그인에 등록하면, `tpl-daily`가 일간 노트 `### 캘린더`에 그날 일정을 자동 삽입합니다. YouKnow의 Google OAuth 이벤트는 가져오지 않습니다(서버 세션 전용). 선택: 앱의 `/api/calendar.ics?type=tasks` 구독 주소를 ICS에 더하면 스크립트 없이 📌 마감이 뜨지만, importer와 같이 쓰면 중복이므로 둘 중 하나만.

### 3-5. GoodNotes 5
GoodNotes › 설정 › 자동 백업(PDF) → 클라우드 폴더 → `python3 -I _System/Scripts/import_goodnotes.py --src "~/Google Drive/GoodNotes"` → `80_문헌/굿노트/<노트북>.md`(PDF 임베드, `type: 굿노트`), PDF는 `_Attachments/GoodNotes/`. 이미 있는 .md는 건드리지 않습니다.

### 3-6. iOS 단축어 "뇌에 추가" (Advanced URI)
YouKnow를 거치지 않고 옵시디언에 바로 넣는 길. Advanced URI 플러그인을 설치하고 단축어에서 아래 URL을 엽니다:
```
obsidian://adv-uri?vault=second-brain&filepath=00_Inbox/빠른입력 {{날짜시간}}.md&mode=new&data=%3C%25*%20tR%20%2B%3D%20await%20tp.file.include(%22%5B%5Btpl-inbox%5D%5D%22)%20%25%3E%0A{{텍스트}}
```
`data`는 반드시 Templater 명령 줄 `<%* tR += await tp.file.include("[[tpl-inbox]]") %>`(위처럼 URL 인코딩)로 시작하고 그 다음 줄에 텍스트가 옵니다 — Templater의 폴더 템플릿은 **빈 파일**에만 적용되고, Advanced URI는 파일을 텍스트와 함께 만들기 때문에 이 줄이 없으면 `tpl-inbox`가 아예 실행되지 않고 ⚡ 노트가 Inbox에 날것으로 남습니다. 단축어에서 `{{텍스트}}`는 "URL 인코딩" 동작을 거쳐 넣으세요(`#프로젝트`·`9:30`·`&`가 살아남게). 파일명이 `빠른입력`으로 시작하면 `tpl-inbox`가 메뉴 없이 본문을 `capture.js`로 바로 해석·분배합니다(명령 줄은 본문에서 제외). 공유 시트의 URL은 12번(자료) 분기로 보내면 됩니다.

---

## 4. 속성(frontmatter) 규약

### 4-1. `type` — 한글 한 단어, 폴더와 1:1
| type | 폴더 | type | 폴더 |
| --- | --- | --- | --- |
| `허브` | 13개 허브 노트 | `종류` `기분` `태그` | `50_일기/종류|기분|태그/` |
| `오늘` | `10_오늘/YYYY/MM/` | `분야` | `70_분야/` |
| `주간` | `10_오늘/Weekly/` | `책` `글` `굿노트` | `80_문헌/책|글|굿노트/` |
| `일기` | `50_일기/YYYY/` (앱 종류명은 `diary_type`) | `영구` | `90_영구/` |
| `할일` | `30_할일/목록/` | `사람` | `95_사람/` |
| `프로젝트` | `40_프로젝트/<이름>/` | `연동` | `98_연동/YouKnow.md` |
| `자료` | `40_프로젝트/<이름>/자료/` | `inbox` | `00_Inbox/` |
| `습관` | `60_습관/` | `일과` | `20_일정/일과/` |

### 4-2. 평문 + 링크 이중 키 — Dataview용 값과 그래프용 선을 둘 다
| 평문 (Dataview·Tasks·앱 호환) | 링크 (그래프 선) | 어디에 |
| --- | --- | --- |
| `due: 2026-10-17` | `마감: "[[2026-10-17]]"` | 할 일 · 프로젝트 |
| `start: 2026-10-01` / `date: 2026-10-16` | `daily: "[[2026-10-01]]"` | 할 일(시작일) · 일기 · 자료 · 프로젝트 · 습관 |
| `diary_type: 운동` | `종류: "[[운동]]"` | 일기 |
| `mood: 좋음` + `mood_score: 4` (최고5 좋음4 보통3 별로2 힘듦1) | `기분: "[[좋음]]"` | 일기 |
| `tags: [운동, 친구]` | `태그: ["[[운동]]", "[[친구]]"]` | 일기 |
| `project: "[[유튜브 채널 개편]]"` | (자체가 링크) | 할 일 · 자료 |
| `status: 진행 전` · `priority: 4` · `priority_label: 중요` | **링크 없음(의도)** | 할 일 · 프로젝트 |

일간 노트는 `date` + `week: "[[2026-W42]]"` + `weekday: "[[금요일]]"` + `prev`/`next` 링크를 가집니다.

### 4-3. `hub` 태그와 `up`
- `tags`는 **주제 태그 전용**. 유형 태그(`[journal]`, `[book]` …)는 쓰지 않습니다.
- 유일한 구조 태그는 `hub`이고, **13개 허브 노트 · 70_분야 노트 · 60_습관 노트**에만 붙습니다(그래프 빨강 매칭용).
- `up: "[[허브]]"`는 **구조 노트에만**: 허브(→ 🧠 Brain) · 종류/기분/태그 facet(→ 📔 일기) · 분야(→ 🧭 분야) · 습관(→ 🔁 습관) · 요일(→ 🗓️ 일정) · 주간(→ ☀️ 오늘) · 프로젝트(→ 🗂️ 프로젝트) · 책/글/굿노트(→ 📚 문헌) · 영구(→ 💎 영구 노트) · 사람(→ 👤 사람). 행 노트(오늘·일기·할일·자료)에는 `up`이 **없습니다**. 🧠 Brain 자신도 `up`이 없습니다.

### 4-4. `yk_*` — importer가 소유하는 키
| 키 | 뜻 |
| --- | --- |
| `yk_id` | 앱 행의 uuid (멱등 키). 종류 노트는 `diary_types[].id` |
| `yk_hash` | 직전 가져온 관리 블록 텍스트의 sha1 — 사용자 수정 감지 |
| `yk_updated` | 앱 `updated_at`/`created_at` ISO 원문 |
| `yk_url` | 앱 딥링크 (`…/#/tasks/<id>` 등) |
| `yk_key` | zip 가져오기 일기의 자연키 `"{date}|{종류}"` (나중에 `yk_id`로 채택) |
| `yk_deleted: <날짜>` | 앱 휴지통에 들어감 (파일은 지우지 않음) |
| `yk_missing: <날짜>` | 앱 테이블에서 완전히 사라짐 |
| `yk_dirty: true` | 볼트 쪽 변경이 앱에 반영되지 않음 → 🔌 연동의 "YouKnow에 반영 필요" |
| `yk_pending: true` | 볼트에서 먼저 만든 노트, 앱 id를 기다리는 중 |
| `yk_pushed: <날짜>` | `--push-pending`으로 앱에 보낸 날 — 다시 보내지 않고, 채택은 title + 이 날짜 ±1일 |
| `yk_blocks: ["body:<sha1 12자>", …]` | 블록별 "직전 가져온 내용" 해시 — 캐시 없이도(새 클론) 가짜 충돌 방지 |
| `done: <날짜>` | 할 일을 옵시디언(Tasks)에서 체크해 붙은 실제 완료일(마감일과 다를 때만) |

### 4-5. 관리 블록 마커 — 그 사이만 importer가 다시 씁니다
```
%% yk:plans:start %%
- ✅ 09:00–10:00 [[헬스]] %%yk:plan 3f9a1c2e 초록%%
%% yk:plans:end %%
```
블록 이름: 일간 `plans` `habits` · 일기 `body` `photos` · 할 일 `task` `note` · 프로젝트 `checklist` `resources_legacy` · 자료 `body` · 요일 `routines`. 줄 끝 id 마커 `%%yk:plan <id8> <색>%%` `%%yk:chk <id8>%%` `%%yk:sec <id8>%%` `%%yk:rt <id8>%%`(id8 = uuid 앞 8자)는 그 줄이 앱 행이라는 표시입니다. 읽기 모드에서는 보이지 않습니다.
**규칙: 마커 사이는 고치지 마세요**(다음 가져오기에 덮입니다). 마커 **밖**(`## 📝 메모`, `## 생각 · 연결`, `## 연결`, 마커 없는 계획 줄)은 전부 내 소유라 importer가 손대지 않습니다. 자유 텍스트 블록(일기 `body` · 할 일 `note` · 자료 `body` · 예전 자료)은 꼭 고쳐야 하면 고쳐도 됩니다 — 앱 쪽도 바뀌었을 때만 `> [!note] 📲 YouKnow에서 바뀐 내용` 콜아웃이 뒤에 붙고(이미 있으면 최신 것으로 교체) 어느 쪽도 버려지지 않습니다. 직전에 가져온 블록의 해시는 frontmatter `yk_blocks`에도 남아 캐시(`.yk_index.json`)가 없어도(새 클론·다른 기기) 가짜 충돌이 생기지 않습니다. 체크리스트·하루 계획·습관 블록은 **앱이 주인**이라 앱 값으로 덮이지만, Obsidian에서만 체크한 항목은 로그 + `yk_dirty` + `98_연동/YouKnow.md` "반영 필요" 표에 남깁니다.
하루 계획·습관 체크는 체크박스가 아니라 **이모지 불릿**(✅ 완료 · ❌ 달성 못함 · ⬜ 미완)입니다 — Tasks 플러그인이 할 일로 긁어가지 않게 하기 위해서. 체크박스는 진짜 할 일(`- [ ] 제목 ⏫ 🛫 시작 📅 마감 🆔 yk-<id8>`; 진행 중 `[/]`, 완료 `[x]`, 달성 못함 `[-]`)과 프로젝트 체크리스트에만 씁니다.

---

## 5. 그래프 뷰 — 4색 그물

`.obsidian/graph.json`과 `.obsidian/snippets/brain-graph.css`에 들어 있습니다(설정 › 모양 › CSS 스니펫 › `brain-graph` 켜기).

| 순서 | 색 그룹 질의 | 색 | 대상 |
| --- | --- | --- | --- |
| 1 | `tag:#hub` | 빨강 `#ef4444` | 🧠 Brain, 12개 화면 허브, 70_분야 노트, 60_습관 노트 — 들어오는 선이 많은 구조 노드 |
| 2 | `path:80_문헌 OR path:"/자료/"` | 파랑 `#38bdf8` | 책·글·굿노트 + 모든 프로젝트의 자료 노트 |
| 3 | `path:40_프로젝트 OR path:50_일기/종류 OR path:50_일기/기분 OR path:50_일기/태그 OR path:20_일정/일과` | 주황 `#fb923c` | 프로젝트 노트, 종류·기분·태그 facet, 요일 노트 7개 |
| — | (해당 없음) | 흰색 `#e8ecf5` (스니펫 기본) | 일간·일기·할 일·영구·사람·주간·Task Inbox |

| 설정 | 값 |
| --- | --- |
| 필터 | `-path:_System -path:_Attachments -path:00_Inbox` |
| 태그 노드 / 첨부 / 미해결 링크 / 고아 | `showTags:false` · `showAttachments:false` · `hideUnresolved:true` · `showOrphans:true` |
| 물리 | 중심력 0.5 · 반발 7 · 링크 강도 0.9 · 링크 거리 80 |
| 표시 | 화살표 끔 · 글자 페이드 −1.2(확대해야 라벨 보임) · 노드 0.85 · 선 0.55 |
| 스니펫 | 어두운 방사형 배경 · 흰 노드 · 가는 회색 선 `rgba(170,178,192,0.22)` |

**왜 그물이 되나**
- 행 노트에는 `up`이 없고 3~6개의 **이질적인** 짧은 선만 있다 — 일기 → 일간·종류·기분·태그 2개, 그 일간 노트 → 전날·다음날·주차·요일·습관들, 그날의 할 일 → 다른 프로젝트·마감일. 어느 흰 점도 한 중심에만 매달리지 않는다.
- 일간 노트의 `prev`/`next` 사슬이 그물에 긴 실을 꿰고, importer가 `--since`부터 오늘까지 **모든 날짜**의 일간 스켈레톤을 만들어 사슬에 구멍이 없다.
- 하루 계획·체크리스트 항목·습관 체크는 노트가 아니라 **줄**이라 선 1개짜리 잎 노드가 없고, 상태·우선순위는 facet이 아니라 거대 별이 없다. 빨간 점은 `#hub` 25개 안팎뿐이라 "소수의 큰 빨간 마디"로 남는다.
- 프로젝트와 기분·태그·종류·요일 facet(주황)은 여러 군집에 동시에 걸쳐 있어 힘-배치에서 군집 **사이**에 놓인다. 책·글·자료(파랑)는 분야·영구 노트·프로젝트를 공유해 작은 파란 덩어리로 뭉친다.

**프리셋**: `_System/Graph/full.json`(전체 그물) · `_System/Graph/knowledge.json`(순수 제텔카스텐 — `-path:30_할일 -path:20_일정 -path:60_습관 -path:10_오늘` 추가).
```bash
bash _System/Graph/graph_preset.sh knowledge    # 또는 full
```
**그래프 뷰를 닫고 복사하세요.** Obsidian은 그래프 설정을 메모리에 들고 있다가 graph.json에 다시 쓰므로, 열어 둔 채 복사하면 덮어써집니다. 즉석에서는 그래프 검색창에 `-path:30_할일`을 치는 것도 같은 효과입니다.

> 팁: 일간 노트에서 로컬 그래프(깊이 2~3)를 열면 "그날의 내 뇌"가 보입니다.

---

## 6. 설치 순서 (처음 한 번, 20분)

1. **볼트 열기** → 설정 › 커뮤니티 플러그인 › 제한 모드 끄기.
2. **플러그인 설치** — 설정 파일(`data.json`)은 커밋돼 있으므로 본체만 설치하면 켜집니다.
   | 순서 | 플러그인 (ID) | 역할 | 설치 후 확인 |
   | --- | --- | --- | --- |
   | 1 | **Templater** (`templater-obsidian`) | 라우터·폴더 템플릿·⚡ | `Trigger on new file creation` 켜짐, 폴더 템플릿 17개, `User scripts folder` = `_System/Scripts` |
   | 2 | **Dataview** | 허브 목록·통계 | `Enable JavaScript Queries` 켜짐 |
   | 3 | **Tasks** (`obsidian-tasks-plugin`) | 체크박스 할 일·📅·🆔 | 기본값. `[/]` `[-]` 상태는 코어 In-Progress/Cancelled |
   | 4 | **Auto Note Mover** | 본문 태그 → 폴더 | 규칙 10개(`#책 #글 #일기 #영구 #프로젝트 #사람 #분야 #할일 #습관 #굿노트`), 제외 `_System _Attachments 10_오늘 20_일정` |
   | 5 | **Periodic Notes** + **Calendar** | 일간/주간 생성 UI | 일간 폴더 `10_오늘`, 형식 `YYYY/MM/YYYY-MM-DD`; 주간 `10_오늘/Weekly`, `GGGG-[W]WW` |
   | 6 | **ICS Calendar** (`ics`, 찾아보기 이름) | Google Calendar → 일간 `### 캘린더` | 비공개 iCal URL 등록 (3-4) |
   | 7 | **Advanced URI** (`obsidian-advanced-uri`) | 단축어 "뇌에 추가" | 3-6의 URL로 보낸 ⚡ 노트가 Inbox에 남지 않고 일간 노트/할 일로 나뉘는지(그냥 열리기만 하면 `data`의 Templater 명령 줄 누락) |
   | 8 | **Git** (`obsidian-git`, 찾아보기 이름은 'Git', 작성자 Vinzent) *(데스크톱)* | 자동 커밋/푸시 | 10분 간격. 가져오기 작업 중엔 잠시 끄기 |
   | 9 | **QuickAdd** *(선택)* | 단축키 한 줄 캡처 | 📋 Task Inbox로 Capture |
   | 10 | **Remotely Save** | 기기 간 동기화 (OneDrive 무료 5GB) | `OneDrive (for personal)` Auth, `Sync config dir`·`Sync underscore items` 켜기 ([[_System/Docs/동기화-설정|동기화 설정]] B절) |
3. **CSS 스니펫** — 설정 › 모양 › CSS 스니펫 › `brain-graph` 켜기.
4. **첫 테스트** — `Ctrl/Cmd+N` → `⚡ 빠른 입력` → `내일 오후 3시 치과` 한 줄 → 미리보기에서 "1개로 나눴어요 · 모두 추가". 내일 날짜의 `10_오늘/YYYY/MM/` 일간 노트가 생기고 `### 하루 계획` 아래에 `- ⬜ 15:00–16:00 치과`가 들어가면 성공. 그래프를 열어 빨강(허브·분야)과 흰 점이 보이는지 확인.
5. **YouKnow 키** — `_System/Scripts/.env` 작성(7-2). 그 뒤 7장 1차 가져오기.

> 다른 기기: clone 하면 설정이 따라옵니다. 플러그인 본체(main.js)만 다시 설치하면 됩니다.

---

### 6-1. 여러 기기에서 같은 화면 보기 (무료)
기기가 전부 애플이면 **iCloud Drive**(git 저장소만 iCloud 밖에 두는 요령 필요), 윈도우·안드로이드가 섞여 있으면 **Remotely Save + OneDrive**. 둘 다 0원이고, 백업·자동화·Claude 채널은 맥북 한 대의 Git이 맡습니다. 기기별 순서는 [[_System/Docs/동기화-설정|동기화 설정]]에 있습니다. 볼트 폴더 안에 `.git` 폴더째로 iCloud에 두지 마세요.

---

## 7. YouKnow 연동

### 7-1. 가져오기 3가지 모드 (`_System/Scripts/import_youknow.py`, Python 3.11+, 표준 라이브러리만)
```bash
cd <볼트 경로>
# ① 권장 — Supabase REST: 12테이블 전부 + 휴지통 + 사진
python3 -I _System/Scripts/import_youknow.py --supabase --dry-run     # 먼저 미리보기
python3 -I _System/Scripts/import_youknow.py --supabase

# ② 앱 설정 → 데이터 · 백업 → "전체 백업(.json)" (8테이블)
python3 -I _System/Scripts/import_youknow.py --backup "98_연동/YouKnow/백업/youknow-backup-2026-10-16.json"

# ③ 앱 "마크다운 볼트 내보내기(.zip)" — 일기만 (fallback)
python3 -I _System/Scripts/import_youknow.py --zip ~/Downloads/youknow-obsidian-2026-10-16.zip
```
옵션: `--dry-run` · `--tz Asia/Seoul` · `--since YYYY-MM-DD`(일간 스켈레톤 하한, 기본 = 가장 오래된 행 날짜) · `--no-fill-days` · `--no-photos` · `--no-link-general-type` · `--vault <path>` · `--csv <file>`(미리보기만, 쓰기 거부) · `--push-pending` · `--rename-follow` · `--all`(역방향 내보내기에서 `yk_id` 있는 일기도 포함) · `--verbose`. `--supabase --backup` 동시 지정 시 REST 우선, 실패한 테이블만 백업으로 보충.

### 7-2. `.env` (`_System/Scripts/.env`, .gitignore)
```
YK_SUPABASE_URL=https://<project>.supabase.co
YK_SUPABASE_ANON_KEY=<앱 번들에 든 anon key>
YK_OWNER_ID=00000000-0000-0000-0000-000000000001   # 기본값. 앱 NEXT_PUBLIC_OWNER_ID와 같게
YK_WIDGET_KEY=<Vercel WIDGET_KEY>                   # 선택적 POST /api/capture 때만
```
anon key는 번들에 공개된 값이지만 저장소에는 넣지 않습니다.

### 7-3. 백업 JSON에 없는 것 vs REST
백업 JSON은 8테이블(settings, daily_logs, daily_photos 메타, tasks, projects, project_sections, project_checklist, project_resources)뿐입니다. **habits · habit_checks · routine_blocks · day_plans 4테이블과 사진 바이너리**가 없어 습관·습관 체크·요일 일과표·하루 계획·`_Attachments/YouKnow/` 사진은 `--supabase`에서만 채워집니다(백업 모드는 "건너뜀(백업에 없음)"으로 로그하고 기존 블록은 건드리지 않음). CSV(`youknow-tasks-*.csv`)는 id가 없어, `calendar.ics`는 중복이라 가져오지 않습니다.

### 7-4. 멱등성 약속 (사용자 편집 보존)
- 볼트 전체 frontmatter의 `yk_id`로 인덱스를 만들어 같은 행은 항상 같은 노트로. 두 번 실행하면 **쓰기 0건**.
- 파일을 지우거나 옮기거나 이름을 바꾸지 않음. 제목이 바뀌면 `title`·`# 제목`·`aliases`만 갱신(`--rename-follow`로 옵트인).
- importer 소유 키(`yk_*`, date/title/status/priority/due/… 등 앱 컬럼 유래)만 덮어쓰고, 내가 더한 키(`aliases`, `cssclasses`, `energy`, `weather`, 자유 키)는 보존. `up`은 없을 때만 씀. `tags`는 합집합이되 **앱에서 지운 태그만 제거**.
- 본문은 `%% yk:… %%` 블록 안만 교체. 블록 안을 내가 고쳤고 앱도 바뀌었으면 내 텍스트 유지 + `> [!note] 📲 YouKnow에서 바뀐 내용` 콜아웃 추가.
- 변경 없으면 파일을 열지도 않음(git 노이즈 방지).

### 7-5. `yk_dirty` — 수동 반영
양방향 동기화가 아닙니다. 볼트에서 할 일 체크박스/`status`를 "더 진행"(완료·달성 못함)시켰거나 습관 체크·하루 계획 줄을 고쳤으면, importer가 앱 값과 다름을 감지해 할 일은 볼트 값을 유지하며 `yk_dirty: true`를, 습관 체크·계획은 앱 값으로 되돌리며 `yk_dirty`+로그를 남깁니다. [[연동]]의 **⚠️ YouKnow에 반영 필요** 표를 보고 앱에서 같은 값으로 바꾼 뒤 속성 `yk_dirty`를 지우면 다음 가져오기에서 사라집니다.

### 7-6. 역방향 — 일기 쉼 `--export-diaries-for-youknow`
```bash
python3 -I _System/Scripts/import_youknow.py --export-diaries-for-youknow ~/Desktop/to-youknow/
```
`yk_id` 없는 50_일기 노트(옵시디언에서 쓴 일기)를 앱의 ".md 일기 가져오기" 형식(`일기/{date}[ {종류명}].md`, 첫 줄 `---`, `date:`·`type: <종류명>`·`mood: "…"`·`tags: ["a", "b"]` 한 줄 인라인, 본문 첫 줄 `# 제목`, 마커·사진·`## 생각 · 연결` 제외)으로 써 줍니다 → 앱 설정 → 데이터 → ".md 일기 가져오기". 앱은 같은 (날짜, 종류)가 있으면 건너뜁니다. 다음 날 밤 가져오기가 그 일기를 (date, 종류명)으로 **채택**해 `yk_id`를 채우면 왕복 완료. 볼트 파일을 앱에 직접 드래그하는 것은 보장하지 않습니다(`type: 일기`라 종류가 일반으로 떨어지고, 속성 편집기가 태그를 블록 리스트로 바꾸면 앱이 못 읽음).

할 일의 역방향은 ⚡ 입력 때 선택적 `POST /api/capture`(7-8). 상태 변경·습관 체크 해제는 7-5의 수동 반영뿐입니다.

### 7-7. 야간 자동화
```
30 23 * * * cd <볼트 경로> && python3 -I _System/Scripts/import_youknow.py --supabase && python3 -I _System/Scripts/import_goodnotes.py
```
(cron 또는 launchd) → Obsidian Git이 10분 안에 커밋. 종료 코드 1이면 `98_연동/YouKnow.md` 상단에 `⚠️` 줄이 남습니다.

### 7-8. Vercel `WIDGET_KEY` — 선택적 앱 동기화
`_System/Templates/tpl-inbox.md` 상단의 `PUSH_TO_YOUKNOW = true` + `YK_CAPTURE_KEY`를 켜면 ⚡ 원문 줄을 그대로 앱 `POST https://youknow-meta-data-weom.vercel.app/api/capture`로도 보내 앱이 같은 항목을 갖게 됩니다(앱 파서 = 같은 규칙). 미리보기에서 **고른 항목만** 보냅니다(하나만 골랐으면 그 항목을 혼자서도 같은 뜻이 되게 다시 적어 보냄). 볼트 노트에는 `yk_pending: true`가 남고, 야간 importer가 (title, due_date, created ±1일)로 채택해 `yk_id`를 채웁니다. 채택이 안 된 노트는 `--push-pending`으로 **한 번** 보낼 수 있고, 보낸 노트에는 `yk_pushed: <날짜>`가 남아 다시 보내지 않습니다(이후 채택은 title + yk_pushed ±1일; 다시 보내려면 `--force-push`). 전송 실패 시 노트만 남고 `yk_dirty: true`. **앱 라이브는 현재 `locked:false`(키 없이 누구나 POST 가능)이므로 공개망에서 쓰기 전에 Vercel 환경변수 `WIDGET_KEY`를 먼저 설정하세요.**

### 7-9. 열린 질문 — RLS / anon key
앱이 브라우저에서 anon key로 12테이블을 읽으므로 REST도 될 것으로 보지만, RLS 정책은 번들에서 볼 수 없습니다. 첫 `--supabase --dry-run`이 401/403이면 service role 키를 `.env`에 쓰거나 백업 JSON 모드로만 운용합니다.

---

## 8. 루틴 (자세한 체크리스트: [[_System/Docs/운영-루틴]])

| 주기 | 할 일 | 어디서 |
| --- | --- | --- |
| 매일 아침 | 오늘 일간 노트 열기 → 캘린더·하루 계획·지난 마감 확인 → 오늘 할 일 3개 | Calendar › 오늘 |
| 수시 | 컴퓨터 `Ctrl/Cmd+N` → ⚡ / 폰 YouKnow | 어디서든 |
| 매일 저녁 | 일기(라우터 4번 또는 앱) · 습관 체크는 앱에서 | 라우터 / 앱 |
| 매일 23:30 (자동) | `import_youknow.py --supabase` → Git 커밋. 아침에 `98_연동/YouKnow.md`의 `⚠️` 콜아웃 유무와 `## 가져오기 로그` 요약 한 줄 확인 | cron |
| 일요일 | 주간 노트 → 📥 Inbox·📋 Task Inbox 비우기(⚡ 승격) → 🔌 연동 "반영 필요" 처리 → 🩺 Health → 회고 3줄 | Calendar › 주차 |
| 월 1회 | 앱 "전체 백업(.json)" → `98_연동/YouKnow/백업/` · 그래프 스크린샷 · 영구 노트 2개 미만 연결 잇기 | 앱 / 터미널 |

---

## 9. 규약 · 주의

- **폴더명은 띄어쓰기 없는 한글**(`30_할일`, `40_프로젝트`). 그래프 `path:` 질의와 셸·cron 경로를 따옴표 없이 쓰기 위해서입니다(이전 README의 "허브·폴더는 영문" 규약을 바꿉니다). 노트 파일명은 한글·공백 자유. 날짜 `YYYY-MM-DD`, 주차 `2026-W42`.
- **macOS + Git + 한글**: 자소 분리 방지 `git config core.precomposeunicode true`, 한글이 `\355…`로 보이면 `git config core.quotepath false`.
- **커밋 제외**(.gitignore): `.obsidian/workspace*.json`, 플러그인 본체, `_System/Scripts/.env`, `_System/Scripts/.yk_index.json`, `98_연동/YouKnow/백업/*.json|zip`, `_Attachments/YouKnow/**`. 플러그인 **설정**(data.json)은 커밋됩니다.
- **예약 태그**: 본문의 `#책 #글 #일기 #영구 #프로젝트 #사람 #분야 #할일 #습관 #굿노트`는 Auto Note Mover가 옮기는 신호, frontmatter의 `hub`는 그래프 색 신호입니다. 주제 태그로 쓰지 마세요. 일기의 주제 태그(`운동`, `친구` …)는 `50_일기/태그/` facet 노트가 그래프 노드를 대신합니다(`showTags:false`).
- **마커 사이는 importer 소유**(4-5). 하루 계획·습관 체크는 이모지 불릿이라 클릭 토글이 안 됩니다 — 앱에서 토글하면 밤에 반영됩니다.
- **앱에서 끝낸 할 일의 `✅` 날짜는 마감일 근사치**(앱에 완료 시각 컬럼이 없음). 옵시디언에서 Tasks로 체크해 붙은 `✅ 날짜`는 실제 완료일로 `done` 속성에 간직됩니다. 주간 "끝낸 일"은 앱 주(일~토)로 셉니다.
- **파일명 동결**: 앱에서 제목을 바꿔도 파일명은 첫 생성 때 그대로(alias 추가). 링크 안정성 > 파일명 최신성.
- **플러그인 설정 파일은 출발점**: 버전에 따라 필드명이 다를 수 있으니 설치 후 설정 화면에서 값이 들어왔는지 한 번 확인하세요(특히 Auto Note Mover 태그 표기, Templater 사용자 스크립트 폴더).
- **일간 스켈레톤**은 1년 365파일(빈 날 포함). 동기화 비용이 걸리면 `--no-fill-days`.

---

## 10. 확인이 필요한 것

1. **Supabase anon key로 REST 읽기가 되나?** RLS가 막으면 service role 키 또는 백업 JSON 모드만.
2. **Vercel `WIDGET_KEY`를 설정할 의향** — 선택적 `POST /api/capture`를 공개망에서 쓰려면 필수.
3. **폰은 당분간 YouKnow 앱만?** Obsidian 직행 단축어 "뇌에 추가"(Advanced URI)도 같이 쓸지.
4. **모바일 볼트 동기화 방식** — Obsidian Sync / iCloud / Git. 일간 스켈레톤 365개가 비용에 영향.
5. **앱 기본 분야 "개인"**을 70_분야 노트로 둘지(설계는 둠), 기존 분야 이름(배움 vs 앱의 공부 등)을 `AREA_ALIASES`로 합칠지.
6. **`--since` 하한** — 모든 과거 데이터부터 일간 스켈레톤을 만들지, 최근 1년만.
7. **옛 일기의 mood/energy 1~5 숫자** — `mood_score`로 환산해 유지하면 충분한지, `energy`·`weather`를 계속 쓸지.
8. **일반 종류 일기의 `종류: [[일반]]` 링크** — 둘지(큰 주황 노드 하나) 뺄지(`--no-link-general-type`).
9. **날짜 기준** — 앱은 기기 로컬, Siri 경로는 KST. 볼트 `--tz Asia/Seoul`로 두어도 되는지(해외 체류 시 하루 어긋남).
10. **GoodNotes 백업 클라우드** — Google Drive / Dropbox / OneDrive 중 무엇인지 → `import_goodnotes.py --src` 기본값.
11. **더 모을 소스** — Kindle·밀리의서재 하이라이트, 유튜브, 트위터/X 북마크 등. 지금은 80_문헌/글에 Web Clipper로 넣는 것만 가정.

---

## 11. 다음 단계

- [ ] 플러그인 설치 → ⚡로 할 일 3개·계획 1개·습관 1개 넣고 그래프 확인
- [ ] 앱 "전체 백업(.json)" 1회 → `--backup --dry-run` → 실행 → `--supabase --dry-run` → 실행(습관·일과·하루 계획·사진·일간 스켈레톤) → git diff 확인 → 커밋
- [ ] `.env` 작성, cron 23:30 등록, Obsidian Git 자동 커밋 확인
- [ ] 🩺 Health 전 항목 ✅ 만들기(폴더/type 불일치 · `up` 없는 구조 노트 · `yk_id` 중복)
- [ ] Google Calendar iCal → ICS 등록 · GoodNotes 자동 백업 켜고 `import_goodnotes.py` 1회
- [ ] 첫 주간 리뷰에서 옵시디언 일기 1편을 `--export-diaries-for-youknow` → 앱 가져오기 → 다음 밤 채택(`yk_id` 채워짐)으로 왕복 확인
- [ ] (선택) Vercel `WIDGET_KEY` 설정 후 `PUSH_TO_YOUKNOW` 켜기 · iOS 단축어 "뇌에 추가"
- [ ] (3개월 뒤) 모바일 입력이 Obsidian으로 충분해지면 앱을 읽기 전용으로 내릴지 재검토
