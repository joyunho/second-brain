# 🧠 Second Brain — 나의 두 번째 뇌

> **"어디에든 쓰면, 알아서 제자리로 간다. 궁금하면 그래프에서 뉴런을 따라간다."**

옵시디언(Obsidian) 볼트입니다. 이 저장소를 그대로 옵시디언에서 "폴더를 볼트로 열기" 하면 됩니다.
GoodNotes 5, Google Calendar, MetaData 등 흩어진 입력을 한곳에 모으고, 옵시디언 **그래프 뷰**를 뇌 구조처럼 보이게 설계했습니다.

---

## 1. 설계 원칙 (왜 이렇게 생겼나)

| 원칙 | 구현 |
| --- | --- |
| **입구는 하나** | `Ctrl/Cmd+N` → "이 노트는 무엇인가요?" 메뉴 → 폴더 이동 + 템플릿 적용이 한 번에 (Templater 라우터) |
| **모든 노트는 선이 두 개** | `up`(어느 허브 소속) + `daily`(언제 생겼나). 고아 노드가 생기지 않아 그래프가 항상 이어져 있음 |
| **폴더 = 진실** | 노트의 위치가 곧 종류. `type` 속성은 Dataview용 보조. 태그는 **주제**에만 씀 |
| **허브 = 뇌 영역** | 9개 허브(📥📅📓✅📚💡🧭👤🔌)가 큰 덩어리, 영역(🧭) 노트가 중간 가지, 일간 노트가 시냅스 |
| **입력은 자동, 정리는 주 1회** | 평소엔 아무 생각 없이 쓰고, 일요일 주간 노트에서 Inbox 비우기 + [🩺 Health] 점검 |

---

## 2. 폴더 구조

```
second-brain/
├── 🧠 Brain.md                 ← 홈. 모든 허브로 가는 중심 뉴런
├── 00_Inbox/                   ← 입구. 아직 자리를 못 찾은 것 (📥 Inbox.md 허브)
├── 10_Daily/                   ← 시간축 (📅 Daily.md 허브)
│   ├── YYYY/MM/YYYY-MM-DD.md   ← 일간: 일정(캘린더 자동) · 할 일 · 캡처 · 그날 생긴 뉴런
│   └── Weekly/GGGG-Www.md      ← 주간 리뷰
├── 20_Journal/                 ← 일기 (📓 Journal.md 허브) · "YYYY-MM-DD 일기"
├── 30_Tasks/                   ← 실행 (✅ Tasks.md 허브)
│   ├── 📋 Task Inbox.md        ← 할 일을 던지는 곳 (체크박스 + 📅 날짜)
│   └── Projects/               ← 프로젝트 노트
├── 40_Library/                 ← 인풋 (📚 Library.md 허브)
│   ├── Books/                  ← 독후감
│   └── Articles/               ← 아티클 · 영상 · 강의 · 논문
├── 50_Ideas/                   ← 내 생각 = 영구 노트 (💡 Ideas.md 허브)
├── 60_Areas/                   ← 삶의 영역: 건강 · 커리어 · 돈 · 관계 · 배움 (🧭 Areas.md 허브)
├── 70_People/                  ← 사람 (👤 People.md 허브)
├── 80_Sources/                 ← 외부 연동 (🔌 Sources.md 허브)
│   ├── GoodNotes/              ← GoodNotes 노트북 1개 = 노트 1개 (PDF 임베드)
│   ├── Calendar/               ← (예비) 캘린더 관련 메모
│   └── MetaData/               ← (예비) MetaData 내보내기
├── 90_Attachments/             ← 첨부 (그래프에서 숨김)
│   ├── GoodNotes/*.pdf
│   └── Images/
├── _System/                    ← 뇌의 운영체제 (그래프에서 숨김)
│   ├── Templates/              ← Templater 템플릿 11개
│   ├── Scripts/                ← import_goodnotes.py 등
│   └── Dashboards/🩺 Health.md ← 고아 노트 · 끊긴 링크 · 폴더/type 불일치 점검
└── .obsidian/                  ← 설정 (그래프 색, 플러그인 설정 포함) — 커밋됨
```

숫자 접두사는 정렬용입니다. 00 → 90 순서가 곧 "입력 → 소화 → 외부" 흐름입니다.

---

## 3. 입력 흐름 — "쓰면 알아서 제자리로"

```
          ┌──────────── Ctrl/Cmd+N (새 노트) ────────────┐
          │  "이 노트는 무엇인가요?"                        │
          │  📖 책  📰 글  📓 일기  💡 아이디어  🎯 프로젝트  │
          │  👤 사람  🧭 영역  📥 그냥 캡처(Esc)            │
          └──────┬──────────────────────────────┬────────┘
                 ▼                              ▼
   유형 선택 → 제목 질문 → 해당 폴더로 이동     Esc → 00_Inbox 에 남음
              → 그 유형 템플릿 자동 적용             │ 나중에 #book 같은 태그 하나
              → up / daily 링크 자동 생성            ▼
                                            Auto Note Mover 가 폴더로 이동
                                            → Templater: Insert template 로 마무리
```

세 가지 경로가 전부 같은 곳으로 수렴합니다.

| 경로 | 언제 | 어떻게 |
| --- | --- | --- |
| **① 라우터 (기본)** | 컴퓨터/모바일에서 글 쓸 때 | `Ctrl/Cmd+N` → 메뉴에서 유형 선택. `_System/Templates/tpl-inbox.md` 가 처리 |
| **② 폴더에 직접 생성** | 탐색기에서 폴더 우클릭 → 새 노트 | Templater **폴더 템플릿**이 자동 적용 (예: `40_Library/Books`에 만들면 독후감 템플릿) |
| **③ 태그로 사후 이동** | Inbox에 막 던져 둔 것 정리할 때 | 본문에 `#book` `#article` `#journal` `#idea` `#project` `#person` `#area` → Auto Note Mover |
| **할 일** | "내일 할 일" 같은 것 | 노트가 아니라 **체크박스**. `📋 Task Inbox`나 일간 노트에 `- [ ] 할 일 📅 2026-10-17` → 그날 일간 노트와 ✅ Tasks 허브에 자동 표시 |
| **일간 노트** | 매일 | Calendar 플러그인에서 날짜 클릭 또는 `오늘의 데일리 노트 열기`. 캘린더 일정이 자동으로 들어옴 |

### 속성(frontmatter) 규약

```yaml
type: book            # inbox · daily · weekly · journal · project · book · article · idea · area · person · goodnotes · hub
tags: [book]          # 유형 태그 1개(라우팅용) + 주제 태그 자유
up: "[[📚 Library]]"  # 소속 허브  ← 그래프에서 '뇌 영역'을 만드는 선
daily: "[[2026-10-16]]" # 생긴 날   ← 그래프에서 '시냅스'를 만드는 선
area: "[[건강]]"      # (선택) 삶의 영역 ← 중간 가지
created: 2026-10-16
```

유형별 추가 속성: 책 `author · status(want/reading/done) · rating · started · finished`, 일기 `date · mood · energy · weather`, 프로젝트 `status · deadline`, 사람 `role · last_contact`, 아티클 `url · kind`.

---

## 4. 그래프 뷰 — 뉴런처럼 보이게

`.obsidian/graph.json` 과 `.obsidian/snippets/brain-graph.css` 에 이미 설정되어 있습니다.

| 설정 | 값 | 의도 |
| --- | --- | --- |
| 색 그룹 (폴더별) | Inbox 🔴 · Daily 🩵 · Journal 💜 · Tasks 💚 · Library 🟠 · Ideas 💛 · Areas 💙 · People 🩷 · Sources ⚪ · 허브 금색 | 뇌 영역마다 다른 색. 허브는 `tag:#hub` 로 가장 먼저 매칭되어 어느 폴더에 있든 금색 |
| 필터 | `-path:_System -path:90_Attachments` | 템플릿·첨부가 그래프를 어지럽히지 않게 |
| 태그 노드 | 켬 | 주제 태그가 작은 금색 클러스터 중심이 됨 |
| 미해결 링크 | 숨김 | 아직 안 쓴 날짜 링크로 회색 점이 흩뿌려지지 않게 |
| 물리 | 반발 12 · 링크 거리 180 · 중심력 0.35 | 덩어리는 모이고 덩어리끼리는 떨어지게 |
| CSS 스니펫 | 어두운 방사형 배경 + 반투명 파란 선 + 밝은 노드 | 뉴런·시냅스 느낌. 설정 › 모양 › CSS 스니펫에서 `brain-graph` 켜기 |

구조가 만드는 모양:
- **🧠 Brain** 에서 9개 허브로 뻗는 굵은 가지 (대뇌 엽)
- 허브 아래 **🧭 영역 노트** 들이 중간 마디 (`area` 속성으로 책·아이디어·프로젝트가 매달림)
- **일간 노트** 가 날짜 순으로 사슬(`← 어제 · 내일 →`)을 이루며, 그날 생긴 노트들이 `daily` 로 붙어 시냅스처럼 가로지름
- **💡 Ideas** 는 서로 2개 이상 링크하도록 템플릿이 강제 → 가장 촘촘한 신경망

> 팁: 로컬 그래프(`Ctrl/Cmd+P → 로컬 그래프 열기`)를 깊이 2~3으로 두고 일간 노트에서 열면 "그날의 내 뇌"가 그대로 보입니다.

---

## 5. 설치 순서 (처음 한 번, 15분)

1. **옵시디언에서 이 폴더를 볼트로 열기** → 설정 › 커뮤니티 플러그인 › 제한 모드 끄기
2. **플러그인 설치** (설정 파일은 이미 들어 있으니 설치만 하면 켜집니다. ID 기준):
   | 순서 | 플러그인 | 역할 | 설치 후 확인할 것 |
   | --- | --- | --- | --- |
   | 1 | **Templater** | 라우터 · 폴더 템플릿 · 날짜 계산 | 설정에서 `Trigger Templater on new file creation` 켜짐, 폴더 템플릿 11개 보임 |
   | 2 | **Dataview** | 허브의 자동 목록 · 통계 | `Enable JavaScript Queries` 켜짐 |
   | 3 | **Tasks** | 할 일 수집 · 📅 날짜 · 반복 | 기본값 그대로 |
   | 4 | **Auto Note Mover** | 태그 → 폴더 자동 이동 | 규칙 8개 보임. 안 보이면 `#book → 40_Library/Books` 식으로 수동 입력 |
   | 5 | **Periodic Notes** + **Calendar** | 일간/주간 노트 생성 UI | Calendar 사이드바에서 날짜·주차 클릭 테스트 |
   | 6 | **ICS** | Google Calendar → 일간 노트 | 아래 6-2 참고 |
   | 7 | **QuickAdd** *(선택)* | 단축키 하나로 할 일 캡처 | 아래 6-4 참고 |
   | 8 | **Obsidian Git** *(선택)* | 이 저장소로 자동 백업 | 데스크톱만. 10분마다 자동 커밋/푸시 설정됨 |
3. **CSS 스니펫 켜기** — 설정 › 모양 › CSS 스니펫 › `brain-graph` 토글
4. **첫 테스트** — `Ctrl/Cmd+N` → `📖 독후감 / 책` 선택 → 제목 입력 → `40_Library/Books/`에 템플릿이 입혀진 노트가 생기면 성공. 그래프를 열어 📚 Library 와 오늘 날짜에 선이 그어졌는지 확인.

> 재설치/다른 기기: 이 저장소를 clone 하면 설정이 전부 따라옵니다. 플러그인 본체(main.js)만 다시 설치하면 됩니다.

---

## 6. 외부 소스 연동

### 6-1. GoodNotes 5 (손글씨 노트)
GoodNotes 5에는 공개 API가 없어 **자동 백업 → PDF → 스크립트** 경로가 가장 안정적입니다.
1. GoodNotes 5 › 설정 › **자동 백업** 켜기 › 클라우드(Google Drive / Dropbox / OneDrive) 선택 › 형식 **PDF** › 폴더 지정
2. 컴퓨터에서 그 클라우드 폴더가 동기화되는지 확인
3. 하루 한 번 실행 (또는 cron / 작업 스케줄러에 등록):
   ```bash
   python3 _System/Scripts/import_goodnotes.py --src "~/Google Drive/GoodNotes"
   ```
   - 새/변경된 PDF만 `90_Attachments/GoodNotes/` 로 복사
   - 노트북마다 `80_Sources/GoodNotes/<노트북>.md` 생성 (PDF 임베드 + `up`/`daily` 링크). **이미 있는 .md 는 건드리지 않음**
4. 생성된 노트의 `## 핵심 정리` 에 손글씨 요점만 텍스트로 옮기고 관련 책·아이디어와 링크 → 손글씨도 뉴런이 됩니다
   - 손글씨 검색이 필요하면: GoodNotes 6 업그레이드(필기 인식 내보내기) 또는 `ocrmypdf` 로 텍스트 레이어 추가

### 6-2. Google Calendar (일정)
읽기 전용이면 **ICS 플러그인**이 5분이면 끝납니다.
1. Google Calendar(웹) › 캘린더 설정 › **비공개 주소(iCal 형식)** URL 복사
2. 옵시디언 › ICS 설정 › 캘린더 추가 › URL 붙여넣기 (캘린더 여러 개면 각각 추가)
3. 끝. 일간 노트 템플릿(`tpl-daily.md`)에 이미 코드가 있어 **그날 일정이 `## 🗓️ 오늘 일정` 에 자동으로 들어옵니다**. 플러그인이 없으면 안내 문구만 뜹니다.
- 옵시디언에서 일정을 **만들고 싶어지면** `Google Calendar` 플러그인(OAuth, 양방향)으로 교체. 달력 UI가 필요하면 `Full Calendar` 플러그인에 같은 iCal URL을 넣으면 됩니다.

### 6-3. MetaData
"meta-data"가 어떤 앱/서비스인지에 따라 방법이 달라집니다 (아래 **9. 확인이 필요한 것** 참고). 내보내기 파일을 `80_Sources/MetaData/` 에 두면 변환 스크립트를 붙일 자리입니다.

### 6-4. QuickAdd (선택 — 할 일 캡처 단축키)
라우터가 노트 유형은 처리하지만, **할 일 한 줄**은 QuickAdd Capture 가 가장 빠릅니다.
1. QuickAdd 설정 › `✅ 할 일` 이름으로 **Capture** 추가
2. Capture To: `30_Tasks/📋 Task Inbox.md` · Insert after: `## 📥 Inbox` 체크
3. Capture format: `- [ ] {{VALUE}} 📅 {{VDATE:마감일 (예: tomorrow),YYYY-MM-DD}}`
   - 날짜 자연어 입력은 `Natural Language Dates` 플러그인 필요. 없으면 `📅 {{DATE+1:YYYY-MM-DD}}` 로 "항상 내일"
4. 단축키(⚡ 아이콘) 지정 → 설정 › 단축키에서 `Ctrl/Cmd+Shift+T` 같은 키 배정
- 같은 방식으로 `📝 오늘 메모` Capture (Capture To: `10_Daily/{{DATE:YYYY/MM/YYYY-MM-DD}}.md`, Insert after `## 📝 메모 · 캡처`) 를 만들면 일간 노트에 한 줄 메모도 단축키로 들어갑니다.

### 6-5. 웹 · 하이라이트 (추천 후보)
- **Obsidian Web Clipper**(공식 브라우저 확장): 저장 폴더 `40_Library/Articles`, 템플릿에 `type: article / up: "[[📚 Library]]"` 지정 → 클립도 바로 뉴런
- Kindle · 밀리의서재 하이라이트: 책 노트 `## 인상 깊은 문장` 에 붙여넣기

---

## 7. 루틴

| 주기 | 할 일 | 어디서 |
| --- | --- | --- |
| 매일 아침 | 일간 노트 열기 → 일정 확인 → 오늘 할 일 3개 | Calendar › 오늘 |
| 수시 | `Ctrl/Cmd+N` → 유형 선택 → 쓴다. 끝. | 어디서든 |
| 매일 저녁 | 일기 (`📓 일기`) · mood/energy 숫자 | 라우터 |
| 일요일 | 주간 노트 열기 → Inbox 0 만들기 → [🩺 Health] 끊긴 뉴런 잇기 → 회고 3줄 | Calendar › 주차 |
| 책 다 읽었을 때 | `status: done`, `finished`, `rating` → 내 생각 2~3개를 💡 Ideas 로 독립 | 책 노트 |

---

## 8. 규약 · 주의

- **파일명**: 허브·폴더·템플릿은 영문/이모지(스크립트 안정성). 내용 노트는 한글 자유. 날짜는 `YYYY-MM-DD`, 주차는 `2026-W42`.
- **macOS + Git + 한글 파일명**: 자소 분리로 git이 변경을 오인할 수 있음 → `git config core.precomposeunicode true` (최신 macOS git은 기본 켜짐), 한글이 `\355…` 로 보이면 `git config core.quotepath false`.
- **커밋 제외**: `.obsidian/workspace*.json`, 플러그인 본체(`main.js` 등)는 `.gitignore`. **설정(data.json)은 커밋**되므로 기기 간 동일하게 동작.
- **유형 태그는 예약어**: `#book #article #journal #idea #project #person #area #goodnotes` 는 Auto Note Mover가 보고 옮깁니다. 주제 태그로 쓰지 마세요 (예: 독서 주제는 `#독서` 또는 `#topic/독서`).
- **플러그인 설정 파일은 출발점**: 플러그인 버전에 따라 필드명이 다를 수 있습니다. 설치 후 설정 화면에서 값이 들어왔는지 한 번 확인하세요. 특히 Auto Note Mover의 태그 표기(`#book` vs `book`).

---

## 9. 확인이 필요한 것 (답해 주시면 바로 붙입니다)

1. **"meta-data"** 가 정확히 어떤 앱/서비스인가요? (내보내기 형식이 CSV·JSON·Markdown 중 무엇인지 알면 `80_Sources/MetaData/` 용 변환 스크립트를 만들 수 있습니다)
2. **GoodNotes 백업 클라우드**는 Google Drive / Dropbox / OneDrive 중 무엇을 쓰시나요? → 스크립트 기본 `--src` 를 그걸로 맞추고 자동 실행(launchd/cron)까지 세팅합니다.
3. **모바일 사용 비중**: iPhone/iPad에서 많이 쓰시면 Obsidian Sync 또는 iCloud 동기화 방식을 정해야 합니다 (Git 플러그인은 모바일에서 불안정).
4. **"기타등등"**: Kindle, 밀리의서재, 유튜브, 트위터/X 북마크, 사진 등 더 모으고 싶은 소스가 있으면 알려 주세요.

---

## 10. 다음 단계 (제안)

- [ ] 플러그인 설치 → 첫 독후감 1개, 일기 1개, 할 일 3개 넣고 그래프 확인
- [ ] GoodNotes 자동 백업 켜고 `import_goodnotes.py` 1회 실행
- [ ] Google Calendar iCal → ICS 등록
- [ ] MetaData 정체 확인 후 변환 스크립트
- [ ] (2단계) 일기 mood/energy 월간 차트, 독서 통계 대시보드
- [ ] (3단계) 자동 태깅/요약 — Inbox 노트를 AI가 분류해 `type`과 `area`를 제안
