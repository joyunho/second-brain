---
type: 허브
tags: [hub]
aliases: [🧠 Brain, Home, 홈, 뇌]
cssclasses: [hub]
---
# 🧠 Brain

> 모든 것은 여기서 시작하고, 여기로 돌아온다.
> 아래 12개 허브는 각각 하나의 **뇌 영역**이다. 앞의 6개는 YouKnow 앱의 화면 순서(오늘 · 일정 · 할 일 · 프로젝트 · 일기 · 습관) 그대로, 뒤의 6개는 제텔카스텐 확장층이다. 그 안의 노트들이 뉴런, 링크가 시냅스다.

## 🗂️ 뇌 영역
| 허브 | 역할 | 들어가는 것 | YouKnow 화면 |
| --- | --- | --- | --- |
| [[오늘]] | 시간축 | 일간 노트(하루 계획 · 캘린더 · 오늘 할 일 · 습관 체크 · 메모), 주간 리뷰 | `#/today` |
| [[일정]] | 달력 | 이번 주 계획 완료율, 요일별 일과표(일~토), Google Calendar | `#/schedule` |
| [[할 일]] | 실행 | 할 일 노트(우선순위 5단계 · 상태 4값), 체크박스 Task Inbox | `#/tasks` |
| [[프로젝트]] | 묶음 | 프로젝트 folder-note(체크리스트 · 묶음 · 자료) | `#/projects` |
| [[일기]] | 감정 · 회고 | 일기(종류 · 기분 · 태그 · 사진) | `#/daily` |
| [[습관]] | 반복 | 습관 노트 — 일간 노트 수백 개가 가리키는 구조 노드 | `#/habits` |
| [[분야]] | 삶의 영역 | 개인 · 건강 · 커리어 · 돈 · 관계 · 배움 … (프로젝트의 `분야`) | 프로젝트 속성 |
| [[문헌]] | 인풋 | 책, 글 · 영상 · 강의, GoodNotes 손글씨 | — |
| [[영구 노트]] | 내 생각 | 문헌 · 일기에서 뽑아낸 영구 노트(Zettelkasten) | — |
| [[사람]] | 사람 | 만난 사람, 기억할 사람 | — |
| [[연동]] | 외부 입력 | YouKnow 가져오기 상태, GoodNotes, Google Calendar | 설정 → 데이터 |
| [[Inbox]] | 입구 | 아직 자리를 못 찾은 모든 것 | — |

## ⚡ 오늘
```dataviewjs
const t = dv.date("today");
const today = t.toFormat("yyyy-MM-dd");
const week  = moment().format("GGGG-[W]WW");
const dow   = ["일","월","화","수","목","금","토"][t.weekday % 7];
dv.paragraph(`☀️ 오늘 노트 → [[${today}]] (${dow}) · 🗓️ 이번 주 → [[${week}]] · 요일 일과 → [[${dow}요일]] · 🩺 [[Health|뇌 건강검진]]`);
```

### 오늘 마감 · 지난 마감 (할 일 노트)
```dataview
TABLE WITHOUT ID file.link AS "할 일", status AS "상태", priority_label AS "우선순위", due AS "마감", project AS "프로젝트"
FROM "30_할일/목록"
WHERE type = "할일" AND due AND due <= date(today) AND status != "완료" AND status != "달성 못함" AND !yk_deleted AND !yk_missing
SORT due ASC, priority DESC
LIMIT 15
```

### 체크박스 할 일 (📋 Task Inbox · 일간 노트)
```tasks
not done
due before tomorrow
path does not include 30_할일/목록
short mode
limit 10
```

## 📊 뇌 지도
```dataviewjs
const regions = [
  ["오늘", "10_오늘"], ["일정", "20_일정"], ["할 일", "30_할일"],
  ["프로젝트", "40_프로젝트"], ["일기", "50_일기"], ["습관", "60_습관"],
  ["분야", "70_분야"], ["문헌", "80_문헌"], ["영구 노트", "90_영구"],
  ["사람", "95_사람"], ["연동", "98_연동"], ["Inbox", "00_Inbox"],
];
dv.table(["영역", "뉴런 수", "이번 주 새로 생긴 뉴런"], regions.map(([name, path]) => {
  const pages = dv.pages(`"${path}"`).where(p => p.type !== "허브" && !p.yk_deleted && !p.yk_missing);
  const fresh = pages.where(p => p.file.cday >= dv.date("today").minus({ days: 7 })).length;
  return [dv.fileLink(name), pages.length, fresh];
}));
```

## 🕒 최근에 만진 뉴런
```dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형", file.mtime AS "수정"
FROM -"_System"
WHERE type != "허브"
SORT file.mtime DESC
LIMIT 10
```

## 🧭 이 뇌의 작동 원리
1. **입력은 한 곳** — 옵시디언에서는 `Ctrl/Cmd+N` → "이 노트는 무엇인가요?" → 13개 선택지. 그중 **⚡ 빠른 입력**은 YouKnow와 같은 문법("내일 오후 3시 치과", "매주 월수금 저녁 7시 헬스", "9/10까지 영상 편집!!")으로 여러 줄을 한 번에 할 일 · 계획 · 습관 · 일과 · 프로젝트로 나눈다. 폰에서는 **YouKnow 앱**을 그대로 쓰고, 매일 밤 `import_youknow.py`가 앱의 12개 테이블을 이 볼트로 끌어온다(→ [[연동]]).
2. **행 노트는 facet + 날짜 선으로 연결된다** — 일기는 날짜 · 종류 · 기분 · 태그에, 할 일은 시작일 · 마감 · 프로젝트에, 일간 노트는 전날 · 다음날 · 주차 · 요일 · 습관에 선을 긋는다. 이 짧은 선 3~6개가 그물을 만든다. 상태 · 우선순위는 노드가 아니라 평문 값이다(거대한 별을 막기 위해).
3. **구조 노트만 `up`을 가진다** — 허브 · 종류/기분/태그 · 분야 · 습관 · 요일 · 주간 · 프로젝트 · 문헌 · 영구 · 사람. 일간 · 일기 · 할 일 · 자료 같은 행 노트는 `up` 없이 2번의 선으로 간접 연결된다.
4. **폴더가 진실** — 노트가 어디 있는지가 곧 그 노트의 종류다. `type`은 한글 한 단어(Dataview용), `tags`는 주제 태그 전용이다. 그래프 색은 4가지뿐: 빨강 = 허브 · 분야 · 습관(`#hub`), 파랑 = 문헌 · 자료, 주황 = 프로젝트 · 종류/기분/태그/요일, 나머지는 흰색.
5. **주 1회 정리** — 주간 노트에서 [[Inbox]]를 비우고, [[Task Inbox]] 체크박스를 ⚡로 승격하고, [[Health]]로 끊어진 연결을 잇고, [[연동]]의 "YouKnow에 반영 필요" 목록을 앱에 반영한다.
