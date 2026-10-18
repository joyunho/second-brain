---
title: 설계서 — YouKnow 거울 볼트 (Second Brain v2)
date: 2026-10-16
source: YouKnow V17.2 라이브 앱 번들(page.pretty.js) 분석 + 읽기 전용 API 탐침
---
> [!info] 이 문서는 무엇인가
> 이 볼트(`second-brain`)를 **YouKnow 앱의 거울**로 재구성한 최종 설계서다. 2026-10-16에 확정했고, 근거는 배포 중인 YouKnow(V17.2) Next.js 번들을 beautify해서 읽은 코드(12개 Supabase 테이블, 빠른 입력 규칙 파서 t0/t1, 내보내기 형식, 열거값 라벨)와 `/api/*` 읽기 전용 탐침이다.
> 폴더명 · 속성 키 · 마커 문자열 · 스크립트 옵션은 이 문서의 표기가 **그대로 구현 식별자**다. 템플릿(`_System/Templates/*`), `capture.js`, `import_youknow.py`, `🩺 Health`, `README.md`가 전부 이 문서를 기준으로 만들어졌으므로, 동작을 바꾸고 싶으면 이 문서를 먼저 고친다.
> 짧게 보려면 저장소 루트 `README.md`(요약) · `_System/Docs/빠른-입력-문법.md`(⚡ 문법) · `_System/Docs/운영-루틴.md`(일/주/월 체크리스트)를 본다. 아래부터는 설계서 원문을 한 글자도 바꾸지 않고 옮긴 것이다.

> [!note] 구현하면서 원문과 달라진 점 (2026-10-16 통합 검수)
> - §7-10 내보내기 형식: `---\n\n# {title}`이 아니라 `---\n# {title}`(빈 줄 없음)로 쓴다. 앱의 .md 가져오기 파서가 본문 첫 줄의 `# `만 제목으로 읽기 때문(빈 줄이 있으면 제목이 사라짐).
> - §6-1 `pushToYouKnow`: `capture.js`는 입출력이 없는 순수 파서라서, 앱으로 보내는 스위치는 `_System/Templates/tpl-inbox.md` 맨 위의 `PUSH_TO_YOUKNOW` / `YK_CAPTURE_KEY` 상수다.
> - §4-5 그래프 프리셋 스크립트는 `_System/Scripts/graph_preset.sh`가 아니라 `_System/Graph/graph_preset.sh`에 있다(Templater가 `_System/Scripts` 아래 .js만 읽지만 폴더를 분리해 두었다).
> - §3-10 요일 일과표는 헤더 줄 아래에 `| --- | --- | --- | --- | --- |` 구분 줄이 한 줄 더 있다(없으면 표로 렌더링되지 않음). importer와 tpl-routine이 같은 표를 쓴다.
> - §3-5 종류 facet의 `## 템플릿`은 코드 펜스가 아니라 `%% yk:template:start/end %%` 관리 블록이다(importer가 앱 설정으로 갱신).
> - `30_할일/Task Inbox.md`는 `type: inbox`, `_System/Dashboards/Health.md`는 `type: dashboard`로 둔다(둘 다 13개 허브가 아니며 모든 질의에서 제외되는 위치).
> - 볼트에서 Untitled로 만든 노트의 이름이 겹치면 템플릿이 ` (2)`, ` (3)`을 붙인다(원문은 importer 충돌 규칙만 정의).

---

# 🧠 Second Brain v2 — YouKnow 거울 볼트 설계서 (최종)

> 대상 저장소: `/home/user/second-brain` (커밋 e6bc302). 이 문서만 보고 구현할 수 있도록 폴더·속성·파일명·그래프 값·매핑·스크립트 동작을 전부 적었다.
> 식별자(폴더명, 속성 키, 마커 문자열)는 그대로 쓴다. 날짜는 전부 `YYYY-MM-DD`(로컬), 시각은 `HH:MM`.

---

## 1. 설계 요지

1. **앱의 화면이 곧 폴더다.** YouKnow(V17.2)의 내비게이션 순서 오늘·일정·할 일·프로젝트·일기·습관이 `10_오늘 · 20_일정 · 30_할일 · 40_프로젝트 · 50_일기 · 60_습관`이 되고, 그 뒤에 Zettelkasten 확장층 `70_분야 · 80_문헌 · 90_영구 · 95_사람 · 98_연동`이 붙는다. 앱의 어휘(상태 4값, 우선순위 5라벨, 기분 5값, 종류, 태그, 묶음, 다음 행동, 분야)가 속성 값과 폴더명이 된다. 폴더명은 **띄어쓰기 없는 한글**로 통일한다 — 그래프 색 그룹의 `path:` 질의와 셸·cron 경로를 따옴표 없이 쓰기 위해서다(기존 README 8장 "허브·폴더는 영문" 규약을 이 점에서 바꾼다).
2. **앱의 행(row)은 노트 또는 줄이 된다.** 12개 테이블 중 `daily_logs · tasks · projects · project_resources · habits`는 행 1개 = 노트 1개(앱의 상세 화면이 있는 것들). `daily_photos · project_sections · project_checklist · day_plans · habit_checks · routine_blocks`는 부모 노트(일기·프로젝트·일간·요일 노트) 안의 **관리 블록 줄**이다. 잎사귀 노드(링크 1개짜리)를 만들지 않아 그래프가 흐려지지 않는다.
3. **뉴런 밀도는 facet 링크에서 나온다.** 행-노트는 허브에 `up`을 걸지 않는다. 대신 일기는 날짜·종류·기분·태그 2~3개에, 할 일은 시작일·마감일·프로젝트에, 프로젝트는 상태 대신 분야·시작일·마감일에, 일간 노트는 전날·다음날·주차·요일·습관들에 선을 긋는다. 이 이질적인 3~6개의 짧은 선이 그물을 만든다. **상태·우선순위는 facet 노트로 만들지 않는다**(모든 할 일이 `[[진행 전]]`·`[[보통]]`에 매달려 거대한 별이 되는 것을 막기 위해; Dataview·Tasks 플러그인은 평문 값으로 충분하다).
4. **그래프 색은 4가지뿐이다.** 빨강 = `tag:#hub`(🧠 Brain, 12개 화면 허브, 70_분야 노트, 60_습관 노트 — 모두 들어오는 선이 많은 구조 노드), 파랑 = 문헌(80_문헌 + 프로젝트의 자료), 주황 = 중간 연결자(프로젝트 노트, 종류/기분/태그/요일 facet), 나머지 전부 흰색(일간 365, 일기 ~300, 할 일 ~400, 영구, 사람). `showTags:false`로 유형 태그 별을 없애고, 반발 7·링크 거리 80으로 촘촘한 그물을 만든다.
5. **입력은 세 길, 출구는 하나.** ① Obsidian `Ctrl/Cmd+N` 라우터 — 13개 선택지, 그중 "⚡ 빠른 입력"은 YouKnow 규칙 파서(t0/t1)를 포팅한 `capture.js`가 여러 줄을 kind별로 분배한다. ② 폰은 **YouKnow 앱을 그대로** 쓴다(Siri `/api/capture`, Scriptable 위젯, 사진 업로드). ③ 매일 밤 `import_youknow.py --supabase`가 12개 테이블을 볼트로 끌어온다(멱등, 사용자 편집 보존). 역방향은 일기만 `--export-diaries-for-youknow` 쉼으로 앱의 ".md 일기 가져오기" 형식을 정확히 만들어 넘기고, 할 일은 Obsidian에서 적을 때 선택적으로 앱의 `POST /api/capture`에도 보내 앱이 단일 할 일 저장소로 남게 한다.
6. **`type`은 한 가지 뜻만 가진다.** 50_일기 안에서도 `type: 일기`이고 앱의 종류명은 `diary_type`(평문)+`종류`(링크)에 둔다. 앱과의 왕복은 쉼이 담당한다(Obsidian 속성 편집기가 `tags: [..]`를 블록 리스트로 다시 쓰면 앱의 한 줄 정규식이 못 읽기 때문에 "볼트 파일을 그대로 드래그하면 100% 된다"고 약속하지 않는다).

---

## 2. 폴더 구조 (변경 표시: KEEP / RENAME / MOVE / ADD / REMOVE)

```
second-brain/
├── Brain.md                          KEEP    루트 허브. 뇌 영역 표를 12행으로, 뇌 지도 경로 배열 갱신
├── 00_Inbox/                            KEEP    Ctrl+N 기본 생성 폴더(app.json newFileFolderPath). 그래프 필터로 제외
│   └── Inbox.md                      KEEP    허브
├── 10_오늘/                             RENAME  ← 10_Daily      (YouKnow #/today)
│   ├── 오늘.md                        RENAME  ← 📅 Daily.md   aliases: [Daily, 데일리, 오늘]
│   ├── YYYY/MM/YYYY-MM-DD.md            KEEP    일간 노트 = 그날의 #/today 화면. 하루 계획·습관 체크가 관리 블록으로 들어감
│   └── Weekly/GGGG-Www.md               KEEP    주간 리뷰(= #/schedule/week)
├── 20_일정/                             ADD     (YouKnow #/schedule)
│   ├── 일정.md                        ADD     허브: 이번 주 하루 계획 완료율, 7개 요일 노트, Google Calendar 안내
│   └── 일과/일요일.md … 토요일.md        ADD     routine_blocks → 요일당 노트 1개(7개 고정, weekday 0~6)
├── 30_할일/                             RENAME  ← 30_Tasks      (YouKnow #/tasks) ※ 띄어쓰기 없음
│   ├── 할 일.md                       RENAME  ← ✅ Tasks.md   목록(우선순위 5→1)·칸반(상태 4열)·마감 지남/오늘 마감
│   ├── Task Inbox.md                 KEEP    노트 없는 한 줄 체크박스(Tasks 플러그인). 정리 때 ⚡로 승격
│   └── 목록/<할 일 제목>.md              ADD     tasks 행 1개 = 노트 1개 (#/tasks/:id 세부 메모 화면)
├── 40_프로젝트/                         ADD     ← 30_Tasks/Projects 이동 (YouKnow #/projects)
│   ├── 프로젝트.md                    ADD     허브: 기간·진행률·마감까지·진도·다음 행동 표
│   └── <프로젝트명>/                     ADD     프로젝트 1개 = 폴더 1개 (folder note)
│       ├── <프로젝트명>.md              ADD     projects 행 + 묶음/체크리스트 본문
│       └── 자료/<자료 제목>.md           ADD     project_resources 행 1개 = 노트 1개 (#/projects/:id/notes/:rid) → 파랑
├── 50_일기/                             RENAME  ← 20_Journal    (YouKnow #/daily)
│   ├── 일기.md                        RENAME  ← 📓 Journal.md  aliases: [Journal, 저널, 일기]
│   ├── YYYY/YYYY-MM-DD 일기.md          CHANGE  general 종류 (연도 하위폴더 추가)
│   ├── YYYY/YYYY-MM-DD <종류명>.md       ADD     그 외 종류 (예: 2026-10-16 운동.md) — 앱 zip 내보내기 파일명과 동일
│   ├── 종류/일반.md 운동.md …            ADD     settings.diary_types → facet (주황)
│   ├── 기분/최고.md 좋음.md 보통.md 별로.md 힘듦.md   ADD  settings.moods → facet (주황)
│   └── 태그/운동.md 게임.md 외출.md 친구.md 공부.md 유튜브.md 휴식.md 돈관리.md …  ADD  settings.tags ∪ 실사용 태그 → facet (주황)
├── 60_습관/                             ADD     (YouKnow #/habits)
│   ├── 습관.md                        ADD     허브
│   └── <습관명>.md                       ADD     habits 행 1개 = 노트 1개, tags: [hub] (일간 노트 수백 개가 가리키므로 빨강)
├── 70_분야/                             RENAME  ← 60_Areas (projects.area "분야")
│   ├── 분야.md                        RENAME  ← 🧭 Areas.md   aliases: [Areas, 영역, 분야]
│   └── 개인.md 건강.md 커리어.md 돈.md 관계.md 배움.md …  KEEP+ADD  projects.area 값마다 자동 생성 ("개인" = 앱 기본값, 실제 노트로 둠)
├── 80_문헌/                             RENAME  ← 40_Library (Zettelkasten 문헌 노트 → 파랑)
│   ├── 문헌.md                        RENAME  ← 📚 Library.md
│   ├── 책/                              RENAME  ← Books/
│   ├── 글/                              RENAME  ← Articles/
│   └── 굿노트/<노트북>.md                MOVE    ← 80_Sources/GoodNotes
├── 90_영구/                             RENAME  ← 50_Ideas (💎 영구 노트)
│   └── 영구 노트.md                    RENAME  ← 💡 Ideas.md   aliases: [Ideas, 아이디어]
├── 95_사람/                             RENAME  ← 70_People
│   └── 사람.md                        RENAME  ← 👤 People.md
├── 98_연동/                             RENAME  ← 80_Sources
│   ├── 연동.md                        RENAME  ← 🔌 Sources.md  GoodNotes·Google Calendar·YouKnow 상태, "YouKnow에 반영 필요" 목록
│   ├── YouKnow.md                       ADD     settings 행 + 마이그레이션 플래그 + 마지막 가져오기 로그 (importer가 재생성)
│   └── YouKnow/백업/                     ADD     youknow-backup-*.json 보관 (.gitignore)      ※ Calendar/, MetaData/ 는 REMOVE
├── _Attachments/                        RENAME  ← 90_Attachments (밑줄 접두 = 그래프·ANM 숨김 규칙 단일화)
│   ├── YouKnow/daily/<log_date>/<파일명>  ADD   daily_photos 바이너리
│   ├── YouKnow/checklist/<파일명>         ADD   project_checklist.photo_path 바이너리
│   ├── GoodNotes/*.pdf                  KEEP
│   └── Images/                          KEEP
├── _System/
│   ├── Templates/                       KEEP+ADD  tpl-inbox(라우터 개편) · tpl-daily(관리 블록) · tpl-journal→tpl-diary · tpl-project(묶음/자료/진행 + 자료 폴더 가드) · ADD tpl-task · tpl-resource · tpl-habit · tpl-routine · tpl-facet · 기존 tpl-weekly/book/article/idea/area/person/goodnotes 수정
│   ├── Scripts/import_youknow.py        ADD     7장
│   ├── Scripts/capture.js               ADD     Templater 사용자 스크립트: YouKnow 빠른 입력 규칙 파서 포팅 (+ 선택적 POST /api/capture)
│   ├── Scripts/import_goodnotes.py      KEEP    NOTE_DIR = 80_문헌/굿노트, PDF_DIR = _Attachments/GoodNotes
│   ├── Scripts/tests/fixture-backup.json ADD    각 테이블 2행 픽스처 + 두 번째 dry-run 쓰기 0건 테스트
│   ├── Scripts/.env                     ADD     YK_SUPABASE_URL / YK_SUPABASE_ANON_KEY / YK_OWNER_ID / YK_WIDGET_KEY (.gitignore)
│   ├── Graph/full.json, knowledge.json  ADD     그래프 프리셋 2개 (복사 전 그래프 뷰를 닫을 것)
│   └── Dashboards/Health.md          KEEP    expect 맵·점검 항목 갱신 (8장 9단계)
└── .obsidian/                           KEEP    graph.json 전면 교체, templater·auto-note-mover·periodic-notes·daily-notes·app.json 경로 갱신, types.json 확장, brain-graph.css 선 색 변경
```

---

## 3. 노트 유형·속성·파일명 규칙

### 3-0. 공통 규칙
- `type` 값은 한글 하나: `허브 · 오늘 · 주간 · 일기 · 할일 · 프로젝트 · 자료 · 습관 · 일과 · 종류 · 기분 · 태그 · 분야 · 책 · 글 · 굿노트 · 영구 · 사람 · 연동 · inbox`. **폴더가 진실**, `type`은 Dataview용.
- `tags`는 **주제 태그 전용**(YouKnow 일기 태그 포함). 유형 태그(`[journal]` 등)는 frontmatter에서 제거한다. 유일한 예외는 그래프 색 매칭용 `hub`(허브·분야·습관 노트). Auto Note Mover는 **본문에 사용자가 직접 친 태그**(`#책 #글 #일기 #영구 #프로젝트 #사람 #분야 #할일 #습관 #굿노트`)로만 동작한다.
- 날짜에 선을 그으려면 키를 두 개 쓴다: 평문(Dataview/Tasks용) + 링크(그래프용). 예 `due: 2026-10-17` + `마감: "[[2026-10-17]]"`.
- importer가 쓰는 노트는 `yk_id`(uuid), `yk_hash`(sha1), `yk_updated`(ISO 원문), `yk_url`(앱 딥링크)을 가진다. 상태 플래그: `yk_deleted: <날짜>`(휴지통), `yk_missing: <날짜>`(테이블에서 사라짐=완전 삭제), `yk_dirty: true`(볼트 쪽 변경이 앱에 반영 안 됨), `yk_pending: true`(볼트에서 먼저 만들어 앱 id를 기다림).
- 본문은 `%% yk:<블록>:start %%` … `%% yk:<블록>:end %%` 사이만 importer가 다시 쓴다(읽기 모드에서 보이지 않음).
- `up`은 **구조 노트에만**: 허브·facet·분야·습관·요일·주간·프로젝트·문헌·영구·사람. 행-노트(일간·일기·할 일·자료)는 `up` 없이 facet/날짜/프로젝트 링크로 간접 연결된다.
- 파일명 sanitizer `E()`는 앱과 동일: `[\\/:*?"<>|#^[\]]` → 공백, 공백 압축, trim, 빈 값은 `이름 없음`. 동일 폴더 충돌은 created_at 순으로 ` (2)`, ` (3)`.
- `.obsidian/types.json` 추가: `mood: text`(기존 number에서 변경), `mood_score: number`, `diary_type: text`, `parts: multitext`, `duration_min: number`, `intensity: text`, `title: text`, `priority: number`, `priority_label: text`, `due: date`, `start: date`, `goal: text`, `next_action: text`, `project: text`, `kind: text`, `updated: date`, `color: text`, `color_name: text`, `sort_order: number`, `weekday: number`, `week: text`, `prev: text`, `next: text`, `종류: text`, `기분: text`, `태그: multitext`, `마감: text`, `yk_id: text`, `yk_hash: text`, `yk_url: text`, `yk_deleted: date`, `yk_missing: date`, `yk_dirty: checkbox`, `yk_pending: checkbox`, `photos: number`, `cover: text`, `emoji: text`.

### 3-1. 허브 (type: 허브)
파일: 🧠 Brain, 📥 Inbox, ☀️ 오늘, 🗓️ 일정, ✅ 할 일, 🗂️ 프로젝트, 📔 일기, 🔁 습관, 🧭 분야, 📚 문헌, 💎 영구 노트, 👤 사람, 🔌 연동 (13개).
```yaml
type: 허브
tags: [hub]
aliases: [Tasks, 할일, 할 일, 태스크]
up: "[[Brain]]"
cssclasses: [hub]
```
본문: 앱 화면의 헤더 카운트를 Dataviewjs로 재현. ✅ 할 일 → `남은 N · 오늘 마감 N · 마감 지남 N` + `## 목록`(우선순위 5→1: 긴급/중요/보통/낮음/언젠가 섹션, 활성 우선 → priority desc → due asc, due 없음은 "9999-99-99"로 마지막) + `## 칸반`(진행 전/진행 중/완료/달성 못함 4열) + Tasks 쿼리(📋 Task Inbox·일간 노트 체크박스). 📔 일기 → `N월 · 일기 N · 기록 R/D일` + 월 캘린더/목록/갤러리 + 종류 칩(종류 노트 링크). 🗓️ 일정 → 이번 주 하루 계획 완료율(일간 노트 `plans_done/plans` 집계), 7개 요일 노트 링크. 🔁 습관 → 오늘 n/m, 이번 주 %, 최장 연속. 🗂️ 프로젝트 → 표(프로젝트·기간·진행률·마감까지·진도·다음 행동).

### 3-2. 일간 (type: 오늘) — `10_오늘/YYYY/MM/YYYY-MM-DD.md`
```yaml
type: 오늘
date: 2026-10-16
week: "[[2026-W42]]"
weekday: "[[금요일]]"      # 20_일정/일과 요일 노트로 선
prev: "[[2026-10-15]]"
next: "[[2026-10-17]]"
plans: 3                  # importer 요약(day_plans 수)
plans_done: 1
habits_checked: 2
```
본문(YouKnow Today 순서):
```
# ☀️ 2026-10-16 (금)
← [[2026-10-15]] · [[2026-10-17]] → · 이번 주 [[2026-W42]] · [[금요일]]

## 🗓️ 오늘 일정
### 하루 계획
%% yk:plans:start %%
- ✅ 09:00–10:00 [[헬스]] %%yk:plan 3f9a1c2e 초록%%
- ❌ 14:00–15:00 영상 편집 (달성 못함) %%yk:plan 7b21d0aa 하늘%%
- ⬜ 20:00–21:00 독서 %%yk:plan c91e44f0 호박%%
%% yk:plans:end %%
- ⬜ 22:00–22:30 스트레칭          ← 마커 없는 줄 = Obsidian에서 직접 쓴 계획(보존)
### 캘린더
(ICS 플러그인 자동 삽입 — 기존 tpl-daily 코드)
### 일과
![[금요일#일과표]]                  ← 하루 계획이 0개인 날만 임베드(앱의 ghost routine 규칙)

## ✅ 오늘 할 일
### 지난 마감
```dataview TABLE … FROM "30_할일/목록" WHERE due AND due < date(2026-10-16) AND status != "완료" AND status != "달성 못함" AND !yk_deleted AND !yk_missing```
### 오늘 마감
```dataview … WHERE due = date(2026-10-16)```   +   ```tasks not done / due on 2026-10-16 / hide backlink / short mode```
### 달성 못함
```dataview … WHERE due = date(2026-10-16) AND status = "달성 못함"```
- [ ]                                  ← 직접 쓰는 체크박스 줄(Tasks)

## 🔁 습관
%% yk:habits:start %%
- ✅ [[헬스]]
- ⬜ [[영어]]
%% yk:habits:end %%

## 📔 오늘 일기
```dataview LIST FROM "50_일기" WHERE date = date(2026-10-16)```  · [[일기|오늘 일기 쓰기 →]]

## 📝 메모
- 

## 🧠 오늘 생긴 뉴런
```dataview TABLE … FROM -"_System" AND -"10_오늘" WHERE contains(string(daily), "2026-10-16") OR file.cday = date(2026-10-16)```
```
- 하루 계획·습관 체크는 **체크박스가 아니라 이모지 불릿**(✅ 완료 / ❌ 달성 못함 / ⬜ 미완)이다. Tasks 플러그인의 `not done` 전역 쿼리가 계획·습관을 할 일로 긁어가지 않게 하기 위해서다. 체크박스는 진짜 할 일과 프로젝트 체크리스트에만 쓴다.
- 계획 제목이 60_습관 또는 20_일정/일과의 노트 제목과 정확히 같으면 `[[제목]]`으로 자동 링크(일간→습관 선 추가).
- 습관 블록에는 **그 날짜에 존재했던 습관**(created_at(KST) ≤ date)만 나열한다.
- 필수 선: prev, next, week, weekday(4) + 습관 n개 + 매칭된 계획 제목.

### 3-3. 주간 (type: 주간) — `10_오늘/Weekly/GGGG-Www.md`
`type: 주간`, `up: "[[오늘]]"`, `start`, `end`. 본문: 7일 링크, 이번 주 하루 계획 완료율(Dataviewjs: `plans_done`/`plans` 합), 이번 주 마감(일~토, 앱 주 보기와 동일), 이번 주 기분(`mood` 문자열 + `mood_score` 평균), Inbox 비우기, 끝낸 일(Tasks `done after/before`), 회고. 캘린더 플러그인 `weekStart: monday`는 유지하되 집계는 앱처럼 일요일 시작으로 계산한다(Dataviewjs 안에서 처리).

### 3-4. 일기 (type: 일기) — `50_일기/YYYY/YYYY-MM-DD 일기.md` (general) / `YYYY-MM-DD <E(종류명)>.md`
```yaml
type: 일기
title: 10/16 운동
date: 2026-10-16
daily: "[[2026-10-16]]"
diary_type: 운동               # settings.diary_types[].name (general → 일반)
종류: "[[운동]]"                # 50_일기/종류
mood: 좋음                     # settings.moods 값, 없으면 생략
mood_score: 4                  # 최고5 좋음4 보통3 별로2 힘듦1 (사용자 정의 기분은 생략)
기분: "[[좋음]]"                # 50_일기/기분
tags: [운동, 친구]              # daily_logs.tags 그대로(주제 태그)
태그: ["[[운동]]", "[[친구]]"]   # 50_일기/태그
parts: [가슴, 등]               # kind=workout 만
duration_min: 45
intensity: 보통                # 가볍게|보통|빡세게
photos: 2
cover: "[[3f9a…-IMG_0012.jpg]]"
created: 2026-10-16
yk_id: 2e9c…
yk_hash: …
yk_url: https://youknow-meta-data-weom.vercel.app/#/daily/2026-10-16?type=workout
```
본문:
```
# 10/16 운동
%% yk:body:start %%
오늘 운동
- 벤치 …

느낀 점
- …
%% yk:body:end %%

## 📷 사진
%% yk:photos:start %%
![[3f9a…-IMG_0012.jpg]] (대표)
> 캡션
![[8c1d…-IMG_0013.jpg]]
%% yk:photos:end %%

## 생각 · 연결
- 
```
- general kind 종류의 커스텀 `metrics[label]`은 `기록_<label>: 값`으로 보존.
- 파일명 ` 일기` 접미는 10_오늘의 `YYYY-MM-DD.md`와 basename 충돌을 막기 위한 것(링크 `[[2026-10-16]]`는 항상 일간 노트).
- 필수 선: daily, 종류, (기분), 태그 n개 → 평균 4~6선.
- 기존 tpl-journal의 `energy·weather`(1~5)는 선택 키로 남긴다(앱에 없음, 사용자 전용).

### 3-5. facet (type: 종류 | 기분 | 태그) — `50_일기/종류|기분|태그/<값>.md`
```yaml
# 종류
type: 종류
up: "[[일기]]"
yk_id: workout                 # diary_types[].id
icon: dumbbell
color: "#34d399"
kind: workout                  # general|workout
template: "오늘 운동\n- \n\n느낀 점\n- "
parts: [가슴, 등, 어깨, 팔, 하체, 코어, 유산소]
# 기분
type: 기분
up: "[[일기]]"
emoji: 🙂                      # 최고🤩 좋음🙂 보통😐 별로😕 힘듦😞 (모르는 값은 생략)
color: "#34d399"
score: 4
# 태그
type: 태그
up: "[[일기]]"
source: settings               # settings | used (앱 설정에 없지만 일기에 쓰인 값)
```
본문: `# <값>` + `## 이 값의 일기`(Dataview 역링크 표) + 월별 카운트. 종류 노트는 `## 템플릿`(원문)도 가진다. 설정에서 사라진 값은 노트 유지 + `yk_deleted`.

### 3-6. 할 일 (type: 할일) — `30_할일/목록/<E(title)>.md`
```yaml
type: 할일
title: 영상 편집
status: 진행 전                # 진행 전|진행 중|완료|달성 못함 (평문, 링크 아님)
priority: 4
priority_label: 중요            # 5 긴급 4 중요 3 보통 2 낮음 1 언젠가
start: 2026-10-01
due: 2026-10-17
daily: "[[2026-10-01]]"         # start_date = 생긴 날
마감: "[[2026-10-17]]"
project: "[[유튜브 채널 개편]]"  # 없으면 생략
created: 2026-10-01
yk_id: …
yk_url: https://…/#/tasks/<id>
```
본문:
```
# ✅ 영상 편집
%% yk:task:start %%
- [ ] 영상 편집 ⏫ 🛫 2026-10-01 📅 2026-10-17 🆔 yk-3f9a1c2e
%% yk:task:end %%

## 세부 메모
%% yk:note:start %%
(tasks.note)
%% yk:note:end %%

## 연결
- 
```
- 체크박스 기호: 진행 전 `[ ]`, 진행 중 `[/]`(Tasks 코어 In-Progress), 완료 `[x]`, 달성 못함 `[-]`(Tasks 코어 Cancelled). 우선순위 이모지: 5 🔺, 4 ⏫, 3 없음, 2 🔽, 1 ⏬. `🆔 yk-<uuid 앞 8자>`가 Tasks에서 보이는 두 번째 멱등 키.
- 완료 줄에는 `✅ <due_date>`를 붙인다(**앱에 완료 시각 컬럼이 없어 마감일을 완료일로 간주**, due가 없으면 ✅ 생략 — 주간 노트 "끝낸 일" 쿼리용 근사치임을 ✅ 할 일 허브에 명시). 볼트에서 Tasks 플러그인으로 체크해 붙은 `✅ <실제 날짜>`는 importer 가 읽어 소유 키 `done`에 간직하고 그 날짜를 유지한다. 휴지통 행(`deleted_at`)의 줄은 `[-]`로 써 Tasks `not done` 질의에서 빠진다.
- Google Calendar 링크 줄(앱 "구글 캘린더에 추가"와 동일): `https://calendar.google.com/calendar/render?action=TEMPLATE&text=<title>&dates=<due||start||오늘 YYYYMMDD>/<다음날>&details=YouKnow%20Meta%20data%20%ED%95%A0%20%EC%9D%BC`.
- 필수 선: daily, (마감), (project) → 1~3선. 상태·우선순위는 선을 만들지 않는다(의도).

### 3-7. 프로젝트 (type: 프로젝트) — `40_프로젝트/<E(name)>/<E(name)>.md`
```yaml
type: 프로젝트
up: "[[프로젝트]]"
status: 진행 중                 # 진행 중|계획|보류|완료 (평문)
area: "[[개인]]"                # projects.area → 70_분야 노트(없으면 생성)
emoji: 🎬                       # aZ 규칙: 건강|운동|헬스|몸→💪 유튜브|영상|채널→🎬 게임|에임|랭크→🎮 스타일|패션|미용|헤어|옷→💇 공부|학교|시험|영어|독서→📚 돈|재테크|주식|저축|소비→💰 생활|집|방|정리→🏠 else 📁 (area+" "+name 대상)
start: 2026-09-01
due: 2026-12-31                 # V15, 보류면 비움
daily: "[[2026-09-01]]"
마감: "[[2026-12-31]]"
goal: 구독자 1만
next_action: 썸네일 템플릿 만들기
created: 2026-09-01
yk_id: …
yk_url: https://…/#/projects/<id>
```
본문:
```
# 🎬 유튜브 채널 개편
> 구독자 1만
**다음 행동**: 썸네일 템플릿 만들기

## 체크리스트
%% yk:checklist:start %%
- [x] 채널 아트 교체 %%yk:chk a1b2c3d4%%
  - 세부: 1920×1080 …
  ![[9f0e…-art.jpg]]
### 기획 %%yk:sec e5f6a7b8%%
- [ ] 콘텐츠 캘린더 %%yk:chk …%%
### 제작 %%yk:sec …%%
- [ ] 인트로 영상 %%yk:chk …%%
%% yk:checklist:end %%

## 할 일
```dataview TABLE status, priority_label, due FROM "30_할일/목록" WHERE contains(string(project), this.file.name) SORT status ASC, priority DESC```

## 자료
```dataview TABLE kind, updated FROM "40_프로젝트/유튜브 채널 개편/자료" SORT sort_order ASC, created DESC```
### 메모 (예전 자료)
%% yk:resources_legacy:start %%
(projects.resources 원문; 비면 블록 생략)
%% yk:resources_legacy:end %%

## 진행
```dataviewjs  // (체크 done + 할 일 완료) / (체크 전체 + 할 일 − 달성 못함) %, 계획 X%·실제 Y% (aL 포팅: 차이 ≥−10 순항, ≥−30 주의, 그 외 지연)```
```
- 묶음(project_sections)은 sort_order asc로 `###` 소제목, 묶음 없음 항목은 소제목 없이 먼저(앱 UI와 동일). 체크 항목 순서는 **created_at asc**(앱 UI가 checklist.sort_order를 쓰지 않음).
- 필수 선: up, area, daily, 마감.

### 3-8. 자료 (type: 자료) — `40_프로젝트/<name>/자료/<E(title) || a$(url) || '메모 N'>.md`
`a$(url)`: 호스트가 youtube.com/youtu.be면 `유튜브 영상`, 아니면 `<host> 글`.
```yaml
type: 자료
project: "[[유튜브 채널 개편]]"
url: https://…
kind: 링크                      # url 있으면 링크, 없으면 메모
sort_order: -20
daily: "[[2026-10-02]]"          # created_at KST
updated: 2026-10-05              # updated_at || created_at
yk_id: …
yk_url: https://…/#/projects/<pid>/notes/<rid>
```
본문: `# <title>` · `🔗 <url>` · `%% yk:body:start %%` body `%% yk:body:end %%` · `## 내 생각` · `## 여기서 나온 영구 노트` · `## 연결`. 선: project, daily. 색: 파랑(문헌).

### 3-9. 습관 (type: 습관) — `60_습관/<E(name)>.md`
```yaml
type: 습관
tags: [hub]                     # 일간 노트 수백 개가 가리키는 구조 노드 → 빨강
up: "[[습관]]"
color: "#38bdf8"
color_name: 하늘                # B 맵: #38bdf8 하늘 #34d399 초록 #f59e0b 호박 #fb923c 주황 #2dd4bf 청록 #f472b6 분홍 #a3e635 연두 #94a3b8 회색
sort_order: 10
created: 2026-08-01
daily: "[[2026-08-01]]"
yk_url: https://…/#/habits
```
본문: `# 🔁 <name>` · `## 기록`(Dataviewjs: 10_오늘 노트의 `- ✅ [[<name>]]` 줄을 세어 연속일(오늘 미체크면 어제부터 역산 — 앱 알고리즘), 이번 주 %, 최근 8주 막대) · `## 메모`.

### 3-10. 일과 (type: 일과) — `20_일정/일과/<요일>요일.md` (7개 고정)
`type: 일과`, `up: "[[일정]]"`, `weekday: 5`(JS getDay, 0=일). 본문:
```
# 금요일 일과
## 일과표
%% yk:routines:start %%
| 시작 | 끝 | 일과 | 색 | |
| 07:00 | 08:00 | [[헬스]] | 초록 | %%yk:rt 1a2b3c4d%% |
| 19:00 | — | 영어 | 하늘 | %%yk:rt …%% |
%% yk:routines:end %%
## 이 요일의 하루들
```dataview LIST FROM "10_오늘" WHERE contains(string(weekday), "금요일") SORT date DESC LIMIT 12```
```
end_time `""`은 `—`. 일과 제목이 습관 노트와 같으면 링크.

### 3-11. 분야 (type: 분야) — `70_분야/<name>.md`
`type: 분야`, `tags: [hub]`(→ 빨강; 기존 `[area, hub]`에서 `area` 제거), `up: "[[분야]]"`, `emoji`(aZ 규칙), `yk_area: true`(앱 값에서 생성됐을 때). 본문: 기존 tpl-area + 진행 중 프로젝트 Dataview를 `status != "완료"`로.

### 3-12. 책 / 글 / 굿노트 / 영구 / 사람 (type: 책 | 글 | 굿노트 | 영구 | 사람)
기존 템플릿 유지. 변경: `tags`에서 유형 태그 제거, `up` 유지(노트 수가 적어 별이 되지 않음; 💎 영구 노트가 200개를 넘으면 Health가 경고), `area: "[[건강]]"`로 70_분야에 연결, 책/글/굿노트의 `## 이 책에서 나온 영구 노트`가 90_영구로 가는 문헌→영구 흐름. 영구 노트는 `source: "[[문헌 노트]]"` + 연결 최소 2개.

### 3-13. 연동 (type: 연동) — `98_연동/YouKnow.md`
`site_name`, `moods[]`, `tags[]`, `diary_types[]`(표: id·name·icon·color·kind), `flags`(V10 일기 종류·V10 프로젝트 단계·V11 습관·V11 일과·V14 하루 계획·V15 마감일·V16 달성 못함·V17 자료 — 추정 근거: diary_types 배열 여부, 테이블 응답 성공, projects.due_date 키, day_plans.failed 키), `last_import`, `source: supabase|backup|zip`, `counts`. 본문: 가져오기 로그(테이블별 생성/갱신/건너뜀/실패), `## ⚠️ YouKnow에 반영 필요`(`yk_dirty = true` Dataview), `## 휴지통`(`yk_deleted`), `## 사라진 행`(`yk_missing`), `## 채택 실패`(yk_pending 노트와 매칭 안 된 앱 행).

---

## 4. 그래프 설정

### 4-1. `.obsidian/graph.json` (전체 교체)
```json
{
  "collapse-filter": false,
  "search": "-path:_System -path:_Attachments -path:00_Inbox",
  "showTags": false,
  "showAttachments": false,
  "hideUnresolved": true,
  "showOrphans": true,
  "collapse-color-groups": false,
  "colorGroups": [
    { "query": "tag:#hub", "color": { "a": 1, "rgb": 15680580 } },
    { "query": "path:80_문헌 OR path:\"/자료/\"", "color": { "a": 1, "rgb": 3718648 } },
    { "query": "path:40_프로젝트 OR path:50_일기/종류 OR path:50_일기/기분 OR path:50_일기/태그 OR path:20_일정/일과", "color": { "a": 1, "rgb": 16486972 } }
  ],
  "collapse-display": false,
  "showArrow": false,
  "textFadeMultiplier": -1.2,
  "nodeSizeMultiplier": 0.85,
  "lineSizeMultiplier": 0.55,
  "collapse-forces": false,
  "centerStrength": 0.5,
  "repelStrength": 7,
  "linkStrength": 0.9,
  "linkDistance": 80,
  "scale": 0.6,
  "close": false
}
```

### 4-2. 색 그룹 순서(위에서 아래로 첫 일치가 이김)와 대상
| 순서 | 질의 | 색 | 대상 노트 | 예상 degree |
|---|---|---|---|---|
| 1 | `tag:#hub` | 빨강 #ef4444 (15680580) | 🧠 Brain, 12개 화면 허브, 70_분야 노트(5~8개), 60_습관 노트(3~6개) | Brain 13, 허브 10~60(facet·주간·프로젝트·분야에서), 분야 10~50(프로젝트·책·영구), 습관 100~365(일간 노트 체크) |
| 2 | `path:80_문헌 OR path:"/자료/"` | 파랑 #38bdf8 (3718648) | 책·글·굿노트 + 모든 프로젝트의 자료 노트 | 2~6 (프로젝트·분야·날짜·영구 노트) |
| 3 | `path:40_프로젝트 OR path:50_일기/종류 OR …기분 OR …태그 OR path:20_일정/일과` | 주황 #fb923c (16486972) | 프로젝트 노트(자료는 2번에서 이미 파랑), 종류·기분·태그 facet, 7개 요일 노트 | 프로젝트 5~30, 기분 30~80, 태그 10~60, 종류 2~300(일반), 요일 ~52 |
| — | (없음) | 흰색(스니펫 기본) | 10_오늘(365/yr), 50_일기/YYYY(~300), 30_할일/목록(~400), 90_영구, 95_사람, 98_연동, 주간, 📋 Task Inbox | 3~6 |

- 폴더명에 띄어쓰기가 없으므로 `path:` 토큰은 따옴표 없이 동작한다. `"/자료/"`만 따옴표(폴더 경계 `/자료/`를 부분 문자열로 매칭해 "자료 조사" 같은 할 일 제목이 파랑이 되지 않게).
- 🗂️ 프로젝트 허브는 40_프로젝트에 있지만 1순위에서 빨강. 📔 일기 허브는 50_일기 루트라 3순위 하위폴더 질의에 걸리지 않음(1순위에서 빨강).
- `path:50_일기/종류/일반`은 모든 일반 일기가 가리켜 degree가 크다. 허브급이지만 주황 그대로 둔다(하나뿐이라 "큰 주황 점" 하나는 스크린샷 느낌을 해치지 않음). 더 줄이고 싶으면 종류 링크를 general에서 생략하는 옵션 `--no-link-general-type`.

### 4-3. `.obsidian/snippets/brain-graph.css` 변경 (3곳)
```css
.graph-view.color-fill            { color: #e8ecf5; }                 /* 기본 노드 = 흰 뉴런 */
.graph-view.color-line            { color: rgba(170, 178, 192, 0.22); } /* 파란 선 → 가는 회색 선 */
.graph-view.color-line-highlight  { color: #cbd5e1; }
body { --graph-node: #e8ecf5; --graph-line: rgba(170,178,192,0.22); --graph-line-highlight: #cbd5e1; }
```
배경 radial-gradient와 나머지는 유지. `color-fill-tag`는 showTags:false라 무의미.

### 4-4. 왜 스크린샷처럼 보이나
- **흰 그물(대부분)**: 행-노트는 `up`이 없고 3~6개의 짧은 이질적 선을 긋는다. 일기 → 일간·종류·기분·태그 2개; 그 일간 노트 → 전날·다음날·주차·요일·습관 2~5개; 그날의 할 일 → 다른 프로젝트·마감일. 어느 흰 노드도 하나의 중심에만 매달리지 않으므로 허브-스포크 나무가 아니라 그물이 되고, 일간 노트의 prev/next 사슬이 그물에 긴 실을 꿴다(importer가 `--since`부터 오늘까지 **모든 날짜**의 일간 스켈레톤을 만들어 사슬에 구멍이 없다).
- **파란 군집**: 책·글·굿노트는 분야 노트와 거기서 나온 영구 노트를 공유하고, 한 프로젝트의 자료 3~10개는 같은 프로젝트(주황)와 생성 날짜를 공유한다. 링크 거리 80·링크 강도 0.9가 이웃을 공유하는 노드를 뭉치게 하므로 흰 그물 사이에 **작은 파란 점들의 덩어리**가 여러 개 생긴다.
- **빨간 큰 마디(소수)**: `tag:#hub` ~25개뿐. Obsidian은 degree로 반지름을 그리므로 습관(일간 노트 수백 개가 가리킴)·분야(프로젝트·책·영구가 가리킴)·📔 일기/✅ 할 일(facet·주간·프로젝트에서)·🧠 Brain이 눈에 띄게 크다. 상태·우선순위 facet을 만들지 않았으므로 "진행 전 400개 별" 같은 비-허브 거대 노드는 없다.
- **흩어진 주황**: 프로젝트(5~30선)와 기분·태그·종류·요일 facet(30~80선)은 서로 다른 군집에 걸쳐 있어(운동 태그는 일기·프로젝트·습관·책을 동시에 건드림) 힘-배치에서 군집 **사이**에 놓인다 → 중간 크기 주황 점이 그물 곳곳에 하나씩.
- **유형 태그 별 없음**: frontmatter에 유형 태그가 없고 showTags:false. 주제 태그는 50_일기/태그 facet 노트가 대신 노드가 된다.
- **밀도 수치**(1년): 일간 365 + 일기 ~300 + 할 일 ~400 + 자료 ~50 + facet ~30 + 요일 7 + 허브 13 + 분야 7 + 습관 5 ≈ 1,200 노드, 노드당 평균 4선 ≈ 2,400선. 하루 계획·체크리스트 항목·습관 체크를 줄로 둔 덕분에 1선짜리 잎 노드가 없다.
- 라벨은 `textFadeMultiplier -1.2`로 확대해야 보이고(점과 선만), 노드 0.85·선 0.55로 가늘다.

### 4-5. 프리셋 — `_System/Graph/full.json`(위 값), `_System/Graph/knowledge.json`(search에 `-path:30_할일 -path:20_일정 -path:60_습관 -path:10_오늘` 추가 = 순수 Zettelkasten 뷰). 복사 스크립트 `_System/Scripts/graph_preset.sh <full|knowledge>`. **그래프 뷰를 닫은 뒤 복사**해야 한다 — Obsidian은 그래프 설정을 메모리에 들고 있다가 graph.json에 다시 쓰므로 열려 있으면 복사본이 덮어써진다. 그래프 검색창에 `-path:30_할일`을 치는 즉석 필터도 같은 효과.

---

## 5. YouKnow → 볼트 매핑

입력 우선순위: ① Supabase REST(12테이블 전부 + 휴지통 + 사진) ② 백업 JSON(8테이블) ③ zip(일기만, fallback). CSV·calendar.ics는 입력으로 받지 않는다(아래 표). `d(ts)` = ISO UTC → `--tz`(기본 Asia/Seoul) 날짜. `E()` = 앱 sanitizer. `id8` = uuid 앞 8자(볼트 내 충돌 시 12자).

| 소스 | 대상 | 파일명 | frontmatter (컬럼 → 키) | 본문 | 링크 |
|---|---|---|---|---|---|
| **settings** (user_id, site_name, moods[], tags[], diary_types[]) | `98_연동/YouKnow.md` + facet 생성: `50_일기/기분/<mood>.md`, `50_일기/태그/<tag>.md`(settings.tags ∪ 일기 실사용), `50_일기/종류/<name>.md`(general → 일반) | 값 이름 그대로(E) | YouKnow.md: `site_name, moods, tags, diary_types, flags, last_import, source, counts`(user_id 미기록). 종류: `yk_id=id, icon, color, kind, template, parts`. 기분: `emoji, color, score`(ap 맵). 태그: `source: settings\|used` | 종류 `## 템플릿`+역링크 표, 기분/태그 역링크 표 | facet `up: [[일기]]`; 사라진 값은 `yk_deleted` |
| **daily_logs** (id, title, log_date, mood, tags, body, photo_path, diary_type, metrics, deleted_at, created_at) | `50_일기/YYYY/` | `{log_date} 일기.md`(diary_type ∈ {null,"general"}) / `{log_date} {E(종류명)}.md`; 종류 id를 못 찾으면 id 문자열 | `type: 일기, title, date, daily:[[log_date]], diary_type(name), 종류:[[name]], mood(""면 생략), mood_score, 기분:[[mood]], tags, 태그:[[t]]…, parts/duration_min/intensity(kind=workout·비어 있으면 생략), 기록_<label>(general 커스텀 metrics), photos, cover(첫 사진), created=d(created_at), yk_id, yk_hash, yk_updated, yk_url=#/daily/{log_date}?type={diary_type}, yk_deleted=d(deleted_at)` | `# {title\|\|log_date}` → `%% yk:body %%` ← body → `## 📷 사진` → `## 생각 · 연결`(사용자) | 일기→일간, →종류, →기분, →태그 n |
| **daily_photos** (id, daily_log_id, photo_path, caption, sort_order, created_at) | 바이너리 `_Attachments/YouKnow/daily/{log_date}/{basename(photo_path)}`; 메타는 부모 일기 `## 📷 사진` | basename 원문(`{uuid}-{sanitized}`, 다운스케일로 `.jpg`일 수 있음 → 확장자 추정 금지) | 부모 일기 `photos: N`, `cover` | `![[basename]]` (+첫 장 `(대표)`) + `> caption`; sort_order asc, created_at asc. 바이너리 없음(백업 모드) → `- 📷 {basename} — caption (앱에서만 보임)` | 일기→첨부(그래프에선 첨부 숨김). `photo_url`(서명 URL)은 버림 |
| **tasks** (id, title, priority, start_date, due_date, status, project_id, note, deleted_at, created_at) | `30_할일/목록/` | `{E(title)}.md`(빈 제목 `새 할 일`, 충돌 ` (2)`) | `type: 할일, title, status(4값 평문), priority, priority_label(k), start, due, daily:[[start_date]], 마감:[[due_date]], project:[[projects.name]], created, yk_*, yk_url=#/tasks/{id}, yk_deleted` | `%% yk:task %%` 한 줄 `- [S] title {P} 🛫 start 📅 due 🆔 yk-id8` (S: 진행 전 ` `, 진행 중 `/`, 완료 `x`+`✅ due`, 달성 못함 `-`) → `## 세부 메모` `%% yk:note %%` ← note | 할 일→일간(start), →일간(due), →프로젝트 |
| **projects** (id, name, goal, status, area, start_date, due_date, next_action, resources, deleted_at, created_at) | `40_프로젝트/{E(name)}/` | `{E(name)}.md`(folder note) | `type: 프로젝트, up:[[프로젝트]], status(평문), area:[[area\|\|개인]]`(70_분야 없으면 tpl-area 본문으로 생성, `yk_area: true`), `emoji=aZ(area,name), start, due(V15), daily:[[start_date]], 마감:[[due_date]], goal, next_action, created, yk_*, yk_url=#/projects/{id}` | `# {emoji} {name}` · `> {goal}` · `**다음 행동**: …` · `## 체크리스트`(아래) · `## 할 일`(Dataview) · `## 자료`(Dataview) + `### 메모 (예전 자료)` `%% yk:resources_legacy %%` ← resources · `## 진행`(Dataviewjs) | 프로젝트→분야, →일간 2개, →허브 |
| **project_sections** (id, project_id, name, sort_order) | 프로젝트 노트 `## 체크리스트` 안 `### {name} %%yk:sec id8%%` | — | — | sort_order asc; 묶음 없음 항목이 먼저 | 없음 |
| **project_checklist** (id, project_id, text, details, done, photo_path, section_id, sort_order, created_at) | 프로젝트 노트 `%% yk:checklist %%` | — | — | `- [x\| ] {text} %%yk:chk id8%%` · details → `  - 세부: …`(줄바꿈은 `  - `로 이어붙임) · photo_path → `  ![[basename]]`(바이너리 `_Attachments/YouKnow/checklist/`) · 순서 created_at asc(앱 UI가 sort_order를 쓰지 않음) | 없음(잎 방지). Tasks 집계엔 체크박스로 포함 |
| **project_resources** (id, project_id, title, url, body, sort_order, created_at, updated_at) | `40_프로젝트/{name}/자료/` | `{E(title) \|\| a$(url) \|\| '메모 N'}.md` | `type: 자료, project:[[name]], url, kind(링크\|메모), sort_order, daily:[[d(created_at)]], updated=d(updated_at\|\|created_at), yk_*, yk_url=#/projects/{pid}/notes/{rid}` | `# title` · `🔗 url` · `%% yk:body %%` ← body(마크다운) · `## 내 생각` · `## 여기서 나온 영구 노트` · `## 연결` | 자료→프로젝트, →일간 (파랑) |
| **habits** (id, name, color, sort_order, created_at) | `60_습관/` | `{E(name)}.md`(빈 값 `새 습관`) | `type: 습관, tags:[hub], up:[[습관]], color, color_name(B), sort_order, created, daily:[[d(created_at)]], yk_*, yk_url=#/habits` | `# 🔁 name` · `## 기록`(Dataviewjs 연속일/주간%/8주) · `## 메모` | 습관→허브; 일간 노트들이 `- ✅ [[name]]`로 가리킴(가장 많은 선) |
| **habit_checks** (id, habit_id, check_date) | `10_오늘/YYYY/MM/{check_date}.md` `## 🔁 습관` `%% yk:habits %%` | — | 일간 `habits_checked: N` | 그 날짜에 존재한 습관 전부를 `- ✅ [[name]]`(체크 있음) / `- ⬜ [[name]]`(없음), sort_order 순. **YouKnow 승**: 볼트에만 ✅인 줄은 ⬜로 바뀌고 `yk_dirty`+로그에 기록 | 일간→습관 |
| **routine_blocks** (id, weekday, start_time, end_time, title, color) | `20_일정/일과/{['일','월','화','수','목','금','토'][weekday]}요일.md` `%% yk:routines %%` | 7개 고정 | 요일 노트 `type: 일과, weekday, up:[[일정]]`, `yk_url=#/schedule/routines` | 표 `\| start \| end\|\|'—' \| [[title]]?(습관 노트와 같으면 링크) \| B[color]\|\|color \| %%yk:rt id8%% \|` start_time asc | 일간 노트 `weekday` 링크; 계획 0개인 날 `![[금요일#일과표]]` 임베드 |
| **day_plans** (id, plan_date, start_time, end_time, title, color, done, failed) | `10_오늘/YYYY/MM/{plan_date}.md` `### 하루 계획` `%% yk:plans %%` | — | 일간 `plans: N, plans_done: N` | `- ✅\|❌\|⬜ {start}–{end} {title\|\|[[title]]} {failed?'(달성 못함)'} %%yk:plan id8 {B[color]}%%` start_time asc(색은 마커에 보존 — 무손실). 마커 없는 줄(Obsidian 작성)은 블록 뒤에 보존 | 제목이 습관/일과 노트와 같을 때만 일간→습관/일과 |
| **youknow-backup-YYYY-MM-DD.json** | `98_연동/YouKnow/백업/`(.gitignore) → `--backup` | — | exported_at → YouKnow.md `last_backup` | 위 8테이블 규칙 그대로; 없는 4테이블(habits, habit_checks, routine_blocks, day_plans)은 "건너뜀(백업에 없음)" 로그, 기존 블록 불변 | — |
| **youknow-obsidian-YYYY-MM-DD.zip** | `--zip` fallback | `일기/*.md`만 | date/type/mood/tags/parts/duration_min/intensity를 읽어 50_일기 생성, `yk_key: "{date}\|{type}"`로 중복 방지; 나중에 REST/JSON이 (log_date, 종류명)으로 채택해 yk_id 채움 | `프로젝트/*.md`, `할 일.md`, `README.md`는 **가져오지 않음**(id 없음·due_date/자료/묶음 누락·JSON에 상위 집합) | — |
| **youknow-tasks-YYYY-MM-DD.csv** | **가져오지 않음** | — | id 없음·priority 라벨·project 이름뿐 → tasks JSON의 진부분집합. `--csv`는 미리보기 표만 출력하고 쓰기 거부 | — | — |
| **/api/calendar.ics (?type=tasks\|diary)** | 가져오지 않음 | — | 할 일·일기를 이미 노트로 가져오므로 중복. 스크립트 없이 "0단계"만 원하면 ICS 플러그인에 URL 추가 → 일간 `### 캘린더`에 📌/📔 종일 줄(importer 쓰면 끄기) | — | — |
| **Storage life-photos** | 위 사진 두 행의 바이너리 | — | `POST {url}/storage/v1/object/sign/life-photos/{path}` `{"expiresIn":600}` → `signedURL` → GET. 이미 있고 크기 같으면 재다운로드 안 함 | — | — |

의도적으로 가져오지 않는 것: `owner_id/user_id`(단일 사용자), `photo_url`(8시간 서명 URL), localStorage 값(capture_key, gcal_ics_urls, gcal_hidden_calendars, schedule_show_tasks — 기기별), Google Calendar OAuth 이벤트(서버 세션 전용 → 볼트는 ICS 플러그인으로 Google에서 직접), project_checklist.sort_order(앱 UI 미사용).

---

## 6. 입력 흐름

### 6-1. Ctrl/Cmd+N 라우터 (`tpl-inbox.md` 개편) — 메뉴 "이 노트는 무엇인가요?"
순서 = YouKnow 내비 + 확장:
1. **⚡ 빠른 입력** (여러 줄, YouKnow 문법) → 멀티라인 프롬프트 → `capture.js` → 미리보기 suggester("N개로 나눴어요 · 모두 추가 / 하나씩 확인") → 실행.
   - 포팅 범위(앱 t0/t1 그대로): 우선순위(`!!!|긴급|급함|급해|급한|당장`→5, `!!|중요|높음`·단일 `!`→4, `낮음|여유`→2, `언젠가|언젠간|나중에`→1), 프로젝트(`#이름/@이름/[이름]`, 알려진 이름 단독, `프로젝트:`/`PJ:` 접두·`…프로젝트` 접미→프로젝트, 마커만 있는 줄 `#집`→프로젝트), 반복(`매일|맨날|날마다|N일마다|1일 1X`→습관, `매주 월수금`·`X요일마다`·`주말마다`[6,0]·`평일`[1-5]→일과 요일마다 1줄, 요일 없는 `매주`→습관), 날짜(오늘·내일·낼·모레·글피·N일 뒤·M월 D일·M/D·M.D·이번/다음/다다음 주 X요일·주말·월말·연말·내년·YYYY-MM-DD; 요일은 지났으면 +7 roll-forward; 가장 앞에서 매칭된 규칙 승), 시간(오전/오후/저녁/밤/새벽 H시·H:MM·반·범위 `7-10시`; **범위→계획**, 단일 시간+`까지|마감`→할 일 메모 "HH:MM까지"; tH/tW 문맥 am/pm 추론), 헤더 줄(날짜/우선순위만 있는 줄은 다음 줄들의 기본값), 불릿 상속(프로젝트 줄 아래 `- ` 줄은 그 프로젝트).
   - 라우팅: task → `30_할일/목록/<제목>.md`(tpl-task, status 진행 전, start 오늘, due, project 링크 — 프로젝트 없으면 `40_프로젝트/<이름>/<이름>.md` 생성) · plan → 해당 날짜 일간 노트 `### 하루 계획` 블록 **뒤**에 `- ⬜ HH:MM–HH:MM 제목`(마커 없음 = Obsidian 소유) · habit → `60_습관/<이름>.md` · routine → `20_일정/일과/<요일>요일.md` 일과표에 행 추가(마커 없음) · project → 폴더+노트.
   - **선택적 앱 동기화**(`capture.js` 설정 `pushToYouKnow: true`, `.env`의 YK_WIDGET_KEY): 원문 줄을 그대로 `POST https://youknow-meta-data-weom.vercel.app/api/capture {text, key}`로 보내 앱도 같은 항목을 갖게 한다(앱 파서 = 같은 규칙이므로 결과 동일). 볼트 노트에는 `yk_pending: true`를 두고, 야간 importer가 (title, due_date, created ±1일)로 채택해 `yk_id`를 채운다. 채택 실패 시 ` (2)` 노트가 생기고 YouKnow.md "채택 실패"에 올라 사용자가 합친다. 실패/오프라인이면 노트만 남고 `yk_dirty: true`. 앱 라이브는 `locked:false`이므로 공개망에서 쓰기 전에 Vercel에 WIDGET_KEY를 설정할 것.
   - 라우터 노트(Untitled) 처리: 템플릿은 빈 문자열을 반환하고 `window.setTimeout(() => app.vault.trash(tp.config.target_file, true), 300)`으로 **지연 삭제**한다(Templater가 결과를 쓴 뒤 삭제해야 "file not found" 오류가 없음).
   - 검증 문장: `내일 오후 3시 치과 / 매주 월수금 저녁 7시 헬스 / 매일 영어 단어 20개 / 프로젝트: 유튜브 채널 개편 / - 9/10까지 영상 편집!! / - 썸네일 만들기 그리고 자막 넣기 / 언젠가 책 정리 #집 / 주말마다 러닝` → 계획1(치과 내일 15:00–16:00) · 일과3(헬스 19:00–20:00, 월수금) · 습관1 · 프로젝트1 · 할 일2(영상 편집 2027-09-10 p4, 썸네일… p3, 프로젝트=유튜브 채널 개편) · 할 일1(책 정리 p1 #집) · 일과2(러닝 09:00–10:00 토·일, 메모 "시간을 안 적어서 09:00으로 넣었어요.") — 앱 라이브 결과와 동일해야 통과.
2. **✅ 할 일 (한 개)** → 제목·마감(자연어, capture.js 날짜 파서 재사용)·우선순위 suggester(긴급/중요/보통/낮음/언젠가)·프로젝트 suggester → `30_할일/목록/`.
3. **🗂️ 프로젝트** → 이름·분야(70_분야 suggester, 기본 개인)·마감 → `40_프로젝트/<이름>/<이름>.md`.
4. **📔 일기** → 종류 suggester(50_일기/종류 노트, 기본 일반) → 날짜(기본 오늘, "어제" 허용) → 기분(50_일기/기분) → 태그(멀티 토글) → `50_일기/YYYY/YYYY-MM-DD 일기.md` 또는 `YYYY-MM-DD 운동.md`(tpl-diary: 종류 템플릿 본문 자동 삽입, 운동이면 부위/시간/강도 프롬프트). 같은 (날짜, 종류)가 있으면 **그 노트를 연다**(앱의 날짜·종류당 1개 규칙).
5. **🗓️ 하루 계획 (오늘)** → 제목·시작·끝 → 오늘 일간 노트 블록 뒤에 추가.
6. **🔁 습관** → `60_습관/`.
7. **📖 독후감 / 책** → `80_문헌/책/`(tpl-book + `area` 질문) · 8. **📰 글 / 영상 / 강의** → `80_문헌/글/` · 9. **💎 영구 노트** → `90_영구/` · 10. **👤 사람** → `95_사람/` · 11. **🧭 분야** → `70_분야/` · 12. **📎 자료 (프로젝트에)** → 프로젝트 suggester → URL/제목 → `40_프로젝트/<name>/자료/`(aV 규칙: 선두 URL→url, 나머지→body, 제목 `유튜브 영상`/`<host> 글`) · 13. **📥 그냥 캡처 (Esc)**.
- "독후감" → 7 · "내일 할 일" → 1(`내일 …`), 2(마감 "내일"), 또는 📋 Task Inbox 체크박스(`- [ ] … 📅 내일날짜` → 내일 일간 노트 `### 오늘 마감`에 뜸) · "일기" → 4. 세 경우 모두 폴더·frontmatter·링크는 템플릿이 만든다.
- Templater `folder_templates`(새 경로): `00_Inbox→tpl-inbox, 10_오늘→tpl-daily, 10_오늘/Weekly→tpl-weekly, 20_일정/일과→tpl-routine, 30_할일/목록→tpl-task, 40_프로젝트→tpl-project, 50_일기→tpl-diary, 50_일기/종류|기분|태그→tpl-facet, 60_습관→tpl-habit, 70_분야→tpl-area, 80_문헌/책→tpl-book, 80_문헌/글→tpl-article, 80_문헌/굿노트→tpl-goodnotes, 90_영구→tpl-idea, 95_사람→tpl-person`.
- **자료 폴더 가드**: Templater 폴더 템플릿은 가장 깊게 일치하는 등록 폴더를 적용하므로 `40_프로젝트/<name>/자료/`에 만든 노트는 tpl-project를 받는다. 따라서 tpl-project 첫 줄에서 `const folder = tp.file.folder(true); if (/\/자료$/.test(folder)) { tR += await tp.file.include("[[tpl-resource]]"); } else { …프로젝트 템플릿… }` 로 분기한다(이 가드가 없으면 자료 노트가 프로젝트 템플릿을 뒤집어쓴다).
- Auto Note Mover 규칙(본문 태그): `#책→80_문헌/책, #글→80_문헌/글, #일기→50_일기, #영구→90_영구, #프로젝트→40_프로젝트, #사람→95_사람, #분야→70_분야, #할일→30_할일/목록, #습관→60_습관, #굿노트→80_문헌/굿노트, #자료→(이동 안 함; 라우터 12번 사용 안내)`; 제외 폴더 `_System, _Attachments, 10_오늘, 20_일정`.

### 6-2. YouKnow 앱 — 유지, 모바일/음성/사진 캡처 프런트엔드
교체하지 않는다. Siri 단축어(`POST /api/capture`), Scriptable 위젯, 사진 업로드·다운스케일, Google 계정 연동, 날짜별 종류 UI는 옵시디언 모바일로 재현하기 비싸고 데이터는 Supabase에 전부 있다. 흐름: 폰에서 입력 → 매일 23:30 `import_youknow.py --supabase` → Obsidian Git 커밋. 역방향: ① 일기 — `--export-diaries-for-youknow <dir>`가 `yk_id` 없는 50_일기 노트를 앱 형식(`일기/{date}[ {종류명}].md`, 첫 바이트 `---`, `date:`·`type: <종류명>`·`mood: "…"`·`tags: ["a", "b"]` 한 줄 인라인, 본문 첫 줄 `# 제목`, 마커·`## 📷 사진`·`## 생각 · 연결` 제거)으로 써 주고 사용자가 앱 설정→데이터→".md 일기 가져오기"로 넣는다(이미 있는 날짜·종류는 앱이 건너뜀). ② 할 일 — 6-1의 선택적 POST. ③ 상태 변경·습관 체크 — 앱에 가져오기 경로가 없으므로 `yk_dirty` 목록(🔌 연동 허브)에서 수동 반영. 3개월 뒤 모바일 입력이 Obsidian으로 충분해지면 앱을 읽기 전용으로 내리는 것을 재검토.

### 6-3. Google Calendar
기존 그대로: ICS 플러그인(비공개 iCal) → 일간 노트 `### 캘린더`에 tpl-daily가 자동 삽입. YouKnow의 OAuth 이벤트는 import 대상이 아님. 선택: `/api/calendar.ics?type=tasks`를 ICS에 추가하면 스크립트 없이 📌 마감이 뜨지만 importer와 함께 쓰면 중복이므로 둘 중 하나.

### 6-4. GoodNotes
`import_goodnotes.py` 유지, 출력 `80_문헌/굿노트/<노트북>.md`, PDF `_Attachments/GoodNotes/`. tpl-goodnotes에서 유형 태그 제거·`type: 굿노트`·`area` 질문.

### 6-5. 단축어 / 위젯
① YouKnow "YouKnow에 추가"(Siri)·Scriptable 위젯 그대로(→ 앱 → 야간 import). ② Obsidian 직행 단축어 "뇌에 추가"(Advanced URI 플러그인 추가 설치): `obsidian://adv-uri?vault=second-brain&filepath=00_Inbox/빠른입력 {{날짜시간}}.md&mode=new&data=%3C%25*%20tR%20%2B%3D%20await%20tp.file.include(%22%5B%5Btpl-inbox%5D%5D%22)%20%25%3E%0A{{텍스트}}`(`data`는 Templater 명령 줄 `<%* tR += await tp.file.include("[[tpl-inbox]]") %>` 로 시작 — Templater 폴더 템플릿은 빈 파일에만 적용되므로 이 줄이 tpl-inbox를 실행시킨다) → tpl-inbox가 파일명이 `빠른입력`으로 시작하면 메뉴 없이 capture.js로 본문을 바로 파싱·라우팅. 공유 시트 URL은 12번 자료 분기.

### 6-6. 📋 Task Inbox · 일간 체크박스
노트 없는 할 일은 계속 허용. 주간 리뷰에서 ⚡로 승격하거나 그대로 둠. ✅ 할 일 허브와 일간 노트는 Dataview(노트형)와 Tasks 쿼리(체크박스형)를 둘 다 보여 준다.

---

## 7. `_System/Scripts/import_youknow.py` 명세

Python 3.9+, 표준 라이브러리만(json, re, pathlib, urllib, hashlib, zoneinfo, zipfile, argparse, datetime). frontmatter는 자체 직렬화기로 쓰고, 읽을 때는 `---` 블록을 **인라인 리스트와 블록 리스트(`- `) 둘 다** 파싱하는 관용 파서를 쓴다(Obsidian 속성 편집기가 블록 리스트로 다시 쓰기 때문).

### 7-1. CLI
```
python3 _System/Scripts/import_youknow.py --supabase                       # 권장. .env: YK_SUPABASE_URL, YK_SUPABASE_ANON_KEY, YK_OWNER_ID(기본 00000000-0000-0000-0000-000000000001)
python3 _System/Scripts/import_youknow.py --backup 98_연동/YouKnow/백업/youknow-backup-2026-10-16.json
python3 _System/Scripts/import_youknow.py --zip ~/Downloads/youknow-obsidian-2026-10-16.zip
python3 _System/Scripts/import_youknow.py --export-diaries-for-youknow ~/Desktop/to-youknow/
옵션: --dry-run · --tz Asia/Seoul · --since YYYY-MM-DD(일간 스켈레톤 하한; 기본 = 가장 오래된 행 날짜) · --no-fill-days · --no-photos · --no-link-general-type · --vault <path>(기본 parents[2]) · --csv <file>(미리보기만) · --push-pending(yk_pending 노트를 /api/capture로 재전송)
--supabase + --backup 동시: REST 우선, 백업은 REST 실패 테이블만 보충.
```

### 7-2. 입력과 근거
- **Supabase REST**(앱과 같은 anon key·owner 필터): `GET {url}/rest/v1/{table}?owner_id=eq.{owner}&select=*&order=id.asc`(settings는 `user_id=eq.`, order 없음 — settings에 created_at이 없다), 헤더 `apikey`, `Authorization: Bearer`, **`Range: 0-999` → `1000-1999` … 응답이 1000행 미만일 때까지 페이지네이션**(PostgREST 기본 상한 1000). daily_logs/tasks/projects는 deleted_at 포함 전부(휴지통 표시용). habit_checks는 70일 제한 없이 전부. 사진은 Storage sign 엔드포인트. 12테이블·사진을 얻는 유일한 길.
- **백업 JSON**: 8테이블 + id → 멱등 갱신 가능. 4테이블 없음을 로그에 명시.
- **zip**: 일기만, `yk_key`로 생성, 이후 채택.
- **CSV**: 거부(id 없음).
- 키는 `.env`에만(.gitignore). anon key는 번들에 공개된 값이지만 저장소에 넣지 않는다.

### 7-3. 멱등성 / 사용자 편집 보존
1. **인덱스**: 볼트 전체 `.md`의 frontmatter에서 `yk_id:`를 긁어 `{yk_id → path}` 구성(`_System/Scripts/.yk_index.json`은 캐시, 매 실행 검증·자가 복구). yk_id 중복 → 경고 + Health.
2. **노트 단위**: 없으면 전체 생성(템플릿 문자열 내장, Templater 불필요). 있으면 (a) frontmatter 병합 — **importer 소유 키만** 덮어씀(`yk_*`, date/title/diary_type/종류/mood/mood_score/기분/parts/duration_min/intensity/photos/cover/created, status/priority/priority_label/start/due/daily/마감/project, goal/next_action/area/emoji, url/kind/sort_order/updated, color/color_name/weekday, plans/plans_done/habits_checked); 사용자 키(aliases, cssclasses, energy, weather, 자유 키)는 보존; `up`은 없을 때만 씀; `tags`는 합집합이되 **인덱스에 저장된 직전 앱 태그 목록에 있던 값만 제거**(앱에서 지운 태그는 전파, 사용자가 Obsidian에서 더한 태그는 생존), `태그` 링크도 동일 규칙. (b) 본문은 `%% yk:<name>:start/end %%` 사이만 교체. 마커가 사라졌으면 해당 섹션 헤더 아래 재삽입, 헤더도 없으면 파일 끝에 1회 추가 + 로그.
3. **자유 텍스트 충돌 규칙**(body/note/resources_legacy/자료 body): `yk_hash` = 직전 가져온 블록 텍스트의 sha1. 현재 블록 == 직전 해시 → 새 앱 텍스트로 교체. 사용자가 블록 안을 고쳤고(해시 불일치) 앱 텍스트도 바뀌었으면 → **사용자 텍스트 유지 + 블록 끝에 `> [!note] 📲 YouKnow에서 바뀐 내용 (<실행일>)` 콜아웃으로 앱 텍스트 추가**. 어느 쪽도 조용히 버리지 않는다.
4. **변경 없으면 파일을 열지 않음**: 생성될 관리 내용 전체의 sha1을 frontmatter `yk_hash`와 비교(git 노이즈 방지).
5. **역방향 변경 감지**: 할 일 노트의 체크박스/`status`가 앱 값과 다르면 **앱 승**이되 볼트 값이 "더 진행"(완료/달성 못함)이면 볼트 값 유지 + `yk_dirty: true` + YouKnow.md `## ⚠️ YouKnow에 반영 필요`(제목 · Obsidian 상태 · 앱 상태). 습관 체크·하루 계획은 앱 승 + 볼트에만 있던 ✅/마커 줄 변경을 로그·`yk_dirty`.
6. **삭제 안 함**: 파일을 지우거나 옮기지 않음. deleted_at 생기면 `yk_deleted: <날짜>`, 테이블에서 사라지면 `yk_missing: <날짜>`. 휴지통 행은 새로 만들지 않음.
7. **이름 변경 안 함**: 파일명은 첫 생성 때 결정. 제목이 바뀌면 `title`·`# ` 제목·`aliases`에 옛/새 이름 추가만(링크 안정성 > 파일명 최신성). `--rename-follow`로 옵트인(Obsidian이 링크를 고치도록 안내).
8. **채택(adoption)**: `yk_id` 없는 노트 — 일기는 (date, 종류명), 할 일은 (title, due_date, created ±1일 & `yk_pending`), 프로젝트는 name, 자료는 (project, title) 자연키로 앱 행과 묶어 `yk_id`를 채우고, 앱 본문과 다르면 3번 규칙 적용.

### 7-4. id → 파일명 안정 규칙
- 일기: `{log_date} 일기.md` / `{log_date} {E(종류명)}.md`. 같은 (날짜, 종류)가 다른 yk_id로 둘(휴지통 복원 케이스) → 두 번째 ` (2)`.
- 할 일/자료/습관: `E(title)`; 빈 값 `새 할 일`/`메모 N`/`새 습관`(앱 기본값). 충돌은 created_at 순 ` (2)`, ` (3)`.
- 프로젝트: 폴더+노트 `E(name)`; 충돌 ` (2)`; 이름이 바뀌어도 폴더 유지(alias 추가).
- 요일 7개·facet은 값 이름 그대로(값이 바뀌면 새 노트, 옛 노트 `yk_deleted`).
- Tasks 줄의 `🆔 yk-<id8>`와 블록 마커 `%%yk:… <id8>%%`는 볼트 내 충돌 검사 후 12자로 확장.

### 7-5. 날짜·시간
- log_date/start_date/due_date/plan_date/check_date: 문자열 그대로(앱이 로컬 YYYY-MM-DD로 저장). 링크 `[[YYYY-MM-DD]]`도 그대로.
- created_at/updated_at/deleted_at/exported_at(ISO UTC) → `--tz` 날짜만(`created: 2026-10-16`), `yk_updated`에 ISO 원문.
- start_time/end_time `HH:MM` 그대로; end_time `""` → `—`; weekday 0~6 → 일~토.
- **일간 스켈레톤 채우기**(기본 켬): `--since`(기본 = 모든 행 날짜의 최솟값)부터 오늘까지 **매일** `10_오늘/YYYY/MM/YYYY-MM-DD.md`가 없으면 내장 스켈레톤(prev/next/week/weekday 포함, `### 캘린더`에는 "(가져오기로 생성 — 일정 없음)")으로 생성 → prev/next 사슬에 구멍 없음, 요일 facet 선 완성. `--no-fill-days`면 데이터 있는 날만. tpl-daily는 기존 파일을 다시 열어도 마커 존재를 검사해 블록을 중복 삽입하지 않는다.

### 7-6. 사진
- `--supabase`: daily_photos → `_Attachments/YouKnow/daily/{log_date}/{basename}`; checklist → `_Attachments/YouKnow/checklist/{basename}`. basename은 photo_path 마지막 세그먼트 원문(`{uuid}-{sanitized}`; 900,000바이트 이상 비-GIF는 앱이 1600px JPEG로 바꿔 `.jpg`일 수 있음 → 확장자 추정 금지). 존재+크기 동일이면 스킵. 실패 → `- 📷 {basename} (다운로드 실패)` + 다음 실행 재시도(`photos_pending: N`).
- 백업/zip 모드: 바이너리 없음 → 캡션·순서만, 로그 "사진 N장은 --supabase로 받을 수 있음".

### 7-7. 재생성 vs 추가
- 매 실행 전체 재생성(블록 내부): 일기 body/사진, 할 일 줄+세부 메모, 프로젝트 체크리스트(묶음 포함)·예전 자료, 자료 body, 요일 일과표, 일간의 하루 계획(마커 있는 줄)·습관 블록, facet 속성, `98_연동/YouKnow.md` 전체.
- 추가만: 사용자 섹션(`## 생각 · 연결`, `## 연결`, `## 메모`, 일간 `## 📝 메모`), 마커 없는 계획 줄, Templater가 만든 Dataview 섹션, 충돌 콜아웃.
- 생성 시 1회: 파일명, 폴더, 분야 노트(이미 있으면 불변), 일간 스켈레톤, `up`.

### 7-8. 처리 순서와 출력
settings → facet(종류/기분/태그) → projects(+70_분야) → project_sections+project_checklist → project_resources → tasks → daily_logs(+daily_photos) → habits → routine_blocks → 일간 스켈레톤 채우기 → day_plans + habit_checks → 채택/yk_dirty/yk_missing 계산 → `98_연동/YouKnow.md` 로그 → 종료 코드 0/1. 실패 시 YouKnow.md 상단에 `⚠️` 줄.
출력 로그 형식(앱 토스트 어휘): `일기 새로 N · 갱신 N · 건너뜀 N / 할 일 … / 프로젝트 … / 자료 … / 습관 체크 N일 / 계획 N일 / 사진 N장 / 충돌 N / 반영 필요 N`.

### 7-9. 테스트
`_System/Scripts/tests/fixture-backup.json`(각 테이블 2행, 묶음 2개, workout 일기 1편, 휴지통 1행, 사용자 정의 기분 1개) + `tests/run.sh`: `--backup fixture --dry-run` 두 번 → 두 번째 실행 쓰기 0건, `yk_id` 중복 0, 블록 밖 텍스트 바이트 동일을 assert. 추가로 사용자 편집 시나리오(블록 안 수정 + 앱 변경 → 콜아웃 1개) 1건.

### 7-10. 역방향 쉼 `--export-diaries-for-youknow <dir>`
50_일기에서 `yk_id` 없는 노트(또는 `--all`)를 읽어 `<dir>/일기/{date}.md`(diary_type 일반) / `{date} {E(종류명)}.md`로 쓴다: `---\ndate: {date}\ntype: {종류명}\nmood: "{mood}"\ntags: ["a", "b"]\n[parts: [...]\nduration_min: N\nintensity: "…"]\n---\n\n# {title}\n\n{body 블록 내용만}`. 블록 리스트 태그를 인라인으로 변환, 마커·사진·사용자 섹션 제외. 앱은 (날짜, 종류)가 있으면 건너뛰고 없으면 새 일기로 넣는다.

---

## 8. 마이그레이션 단계

0. **준비**: 현재 상태 커밋 확인(e6bc302). 앱 설정→데이터·백업에서 "전체 백업(.json)" 1회 받아 `98_연동/YouKnow/백업/`에 보관. `git config core.precomposeunicode true`, `core.quotepath false`. Obsidian Git 자동 커밋을 작업 중 잠시 끔.
1. **폴더 재배치(git mv)**: 10_Daily→10_오늘, 20_Journal→50_일기, 30_Tasks→30_할일(Projects/→40_프로젝트), 40_Library→80_문헌(Books→책, Articles→글), 50_Ideas→90_영구, 60_Areas→70_분야, 70_People→95_사람, 80_Sources→98_연동(GoodNotes/→80_문헌/굿노트, Calendar/·MetaData/ 삭제), 90_Attachments→_Attachments. 새 폴더: 20_일정/일과, 30_할일/목록, 50_일기/종류·기분·태그, 60_습관, 98_연동/YouKnow/백업, _Attachments/YouKnow, _System/Graph, _System/Scripts/tests(.gitkeep).
2. **허브 개명·추가**: ☀️ 오늘, 🗓️ 일정(신규), ✅ 할 일, 🗂️ 프로젝트(신규), 📔 일기, 🔁 습관(신규), 🧭 분야, 📚 문헌, 💎 영구 노트, 👤 사람, 🔌 연동. frontmatter `type: 허브, tags: [hub]` 통일, Dataview를 새 경로·한글 type으로. 🧠 Brain 표 12행, 뇌 지도 경로 배열 갱신. 70_분야 5개 노트 `tags: [hub]`로.
3. **템플릿**: tpl-inbox 라우터 13선택지 + `⚡` 접두 자동 라우팅 + 지연 삭제; tpl-daily에 `## 🗓️ 오늘 일정/### 하루 계획·캘린더·일과`, `## 🔁 습관`, `## 📔 오늘 일기`, weekday/prev/next 키, yk 마커(중복 삽입 방지); tpl-journal→tpl-diary(`type: 일기`, 종류/기분/태그 suggester, 종류 템플릿 본문); tpl-project(자료 폴더 가드, 체크리스트·할 일·자료·진행, status 4값, area suggester); 신규 tpl-task·tpl-resource·tpl-habit·tpl-routine·tpl-facet; 기존 book/article/idea/area/person/goodnotes/weekly에서 유형 태그 제거·type 한글화·area 질문·새 경로.
4. **capture.js** 작성(6-1 포팅 범위 + 선택적 POST) + Templater `user_scripts_folder: _System/Scripts` 확인. 검증 문장 통과.
5. **플러그인 설정**: templater folder_templates 15개, auto-note-mover 규칙 10개·제외 폴더 4개, periodic-notes·daily-notes folder=10_오늘, app.json attachmentFolderPath=_Attachments, types.json 확장(3-0), community-plugins에 `obsidian-advanced-uri` 추가(선택). .gitignore에 `_System/Scripts/.env`, `98_연동/YouKnow/백업/*.json`, `_System/Scripts/.yk_index.json`.
6. **그래프**: graph.json 전면 교체(4-1), brain-graph.css 3곳, `_System/Graph/full.json`·`knowledge.json`·`graph_preset.sh`. 그래프를 열어 빨강(허브·분야)·흰색(현재 노트들)이 보이는지 확인.
7. **import_youknow.py** 작성 + fixture 테스트 통과. `.env` 기입.
8. **1차 가져오기**: `--backup <0단계 JSON> --dry-run` → 로그 → 실행 → `--supabase --dry-run` → 실행(습관·일과·하루 계획·사진·일간 스켈레톤). 라이브 기준 기대치: 일기 31, 할 일 22, 프로젝트·자료·facet, 일간 노트 `--since`~오늘. git diff로 확인 후 커밋.
9. **🩺 Health 갱신**: expect 맵(`30_할일/목록→할일, 40_프로젝트→프로젝트|자료, 50_일기→일기|종류|기분|태그, 60_습관→습관, 20_일정/일과→일과, 70_분야→분야, 80_문헌/책→책, 80_문헌/글→글, 80_문헌/굿노트→굿노트, 90_영구→영구, 95_사람→사람`), 'up 없는 노트' 점검을 구조 노트(허브·facet·분야·습관·요일·주간·프로젝트·문헌·영구·사람)로 한정, 신규 점검: 'facet·날짜 링크가 하나도 없는 행-노트', '`yk_id` 중복', '`yk_dirty`·`yk_missing` 목록', '본문 `#태그` 중 50_일기/태그 노트가 없는 것', '90_영구 노트 중 연결 2개 미만', '💎 영구 노트 inlink > 200 경고'. 깨진 링크 예외 정규식 `^\d{4}-\d{2}-\d{2}( .+)?$`, `^\d{4}-W\d{2}$`.
10. **import_goodnotes.py** 상수(NOTE_DIR=80_문헌/굿노트, PDF_DIR=_Attachments/GoodNotes, `type: 굿노트`, 유형 태그 제거) 변경 후 1회 실행.
11. **자동화**: launchd/cron `30 23 * * * cd <vault> && python3 -I _System/Scripts/import_youknow.py --supabase && python3 -I _System/Scripts/import_goodnotes.py` → Obsidian Git 자동 커밋(10분). iOS 단축어 "뇌에 추가"(Advanced URI). Vercel에 WIDGET_KEY 설정 후 capture.js `pushToYouKnow` 켜기.
12. **README 개정**: 2·3·4·6·8·9장을 이 설계로(MetaData = YouKnow, 가져오기 모드 3종, 역방향 쉼, yk_dirty 수동 반영, 폴더명 규약 변경, 행-노트는 facet+날짜·구조 노트만 up). 첫 주간 리뷰에서 옵시디언 일기 1편을 쉼→앱 가져오기로 왕복 확인.

---

## 9. 트레이드오프와 열린 질문

### 9-1. 트레이드오프
- **상태·우선순위를 facet 노트로 만들지 않음**: 앱의 상태/우선순위 화면을 노드로 볼 수 없다. 대신 ✅ 할 일 허브의 Dataview 섹션이 그 화면이다. 만들었다면 `진행 전`·`보통`이 degree 수백의 최대 노드가 되어 "빨간 허브가 가장 크다"는 모양이 깨진다.
- **습관 노트가 빨강(허브)**: 일간 노트 365개가 가리키므로 사실상 허브다. 습관이 10개를 넘으면 빨간 점이 "소수"가 아니게 된다 → 그때 `tags: [hub]`를 빼고 주황으로 내리는 한 줄 변경.
- **일간 스켈레톤을 매일 생성**: 1년 365파일(빈 날 포함). 사슬·요일 선이 끊기지 않는 대가로 파일 수가 는다. `--no-fill-days`로 끌 수 있고, Calendar 플러그인은 기존 파일을 그대로 연다.
- **하루 계획·습관 체크는 이모지 불릿**: Tasks 플러그인이 할 일로 오인하지 않지만 체크박스 클릭으로 토글할 수 없다(앱에서 토글 → 야간 반영, 또는 텍스트 편집).
- **앱에서 끝낸 할 일의 `✅` 날짜는 마감일 근사치**: 앱에 완료 시각이 없다. 볼트에서 체크한 실제 날짜는 `done`으로 보존. 주간 "끝낸 일"은 앱 주(일~토)로 센다.
- **frontmatter 중복(mood+기분, tags+태그, due+마감)**: 평문은 Dataview/Tasks/앱 호환, 링크는 그래프 선. 키가 늘지만 무손실.
- **양방향 동기화 아님**: 앱→볼트 자동·무손실(REST 모드), 볼트→앱은 일기(쉼)·할 일(선택적 POST)만. 상태 변경·습관 체크 해제는 `yk_dirty` 목록으로 수동. 앱이 가져오기 API를 제공하지 않는 한 불가피.
- **앱 ".md 일기 가져오기"에 볼트 파일을 직접 드래그하는 것은 보장하지 않음**: `type: 일기`라 종류가 일반으로 떨어지고, 속성 편집기가 태그를 블록 리스트로 바꾸면 앱이 못 읽는다. 쉼이 정확한 형식을 만든다.
- **Supabase anon key를 로컬 .env에 두고 REST/Storage를 직접 읽음**(앱이 브라우저에서 하는 것과 동일). 백업 JSON만 쓰면 4테이블·사진이 빠져 "완전 무손실"은 REST 모드에서만 성립.
- **한글 폴더명**: 앱 어휘와 1:1이지만 README 8장의 "허브·폴더는 영문" 규약을 바꾼다. 띄어쓰기를 없애 셸 따옴표·그래프 질의 문제는 피했고, macOS 자소 분리는 `core.precomposeunicode`로 처리. 스크립트는 경로를 상수로만 다룬다.
- **showTags:false**: 주제 태그가 그래프 노드가 아니다. 50_일기/태그 facet 노트가 대신한다. 태그 패널 검색은 그대로.
- **파일명 동결**: 앱에서 제목을 바꿔도 파일명은 유지(alias 추가). 탐색기에 옛 이름이 보일 수 있다 → `--rename-follow`.
- **`type` 단일 의미를 위해 앱 종류명은 `diary_type`**: Dataview/Health/ANM이 단순해지는 대신 앱과의 왕복은 쉼 의존.
- **할 일을 노트로**(앱의 #/tasks/:id와 동일): 그래프 밀도·세부 메모·프로젝트 선을 얻지만 1년에 수백 파일, 📋 Task Inbox 체크박스와 두 표현이 공존. 허브와 일간 노트가 둘 다 보여 준다.
- **프로젝트 folder-note + 자료 하위폴더**: 앱 구조 그대로지만 Templater 가드가 필요하고(tpl-project 분기), 자료 노트 생성은 라우터 12번이 가장 안전.

### 9-2. 열린 질문
1. Supabase anon key로 REST 읽기가 실제 허용되는지(앱이 그렇게 읽으므로 그렇겠지만 RLS 정책을 번들에서 볼 수 없음). 거부되면 service role 키 또는 백업 JSON 모드만.
2. Vercel `WIDGET_KEY`를 설정할 의향(선택적 POST /api/capture를 공개망에서 쓰려면 필수).
3. 폰에서 당분간 YouKnow 앱을 계속 쓸지, Obsidian 직행 단축어("뇌에 추가")도 함께 쓸지.
4. 모바일 볼트 동기화 방식(Obsidian Sync / iCloud / Git) — 일간 스켈레톤 365개가 동기화 비용에 영향.
5. 앱 분야 기본값 "개인"을 70_분야 노트로 둘지(설계는 둠), 기존 영역 이름(배움 vs 앱의 공부 등)을 `AREA_ALIASES`로 합칠지.
6. `--since` 하한: 모든 과거 데이터 날짜부터 일간 스켈레톤을 만들지, 최근 1년만 만들지.
7. 기존 20_Journal의 mood/energy 1~5 숫자 체계 — `mood_score`로 환산해 유지하는 것으로 충분한지, `energy·weather`를 계속 쓸지.
8. 일반 종류 일기의 `종류: [[일반]]` 링크를 둘지(하나의 큰 주황 노드) 뺄지(`--no-link-general-type`).
9. 날짜 기준: 앱은 기기 로컬, Siri 경로는 KST 기본. 볼트 `--tz`를 Asia/Seoul로 두어도 되는지(해외 체류 시 하루 어긋남 가능).
10. GoodNotes 백업 클라우드(Google Drive / Dropbox / OneDrive) — import_goodnotes `--src` 기본값.