---
type: hub
tags: [hub]
aliases: [Home, 홈, 뇌, Brain]
cssclasses: [hub]
---
# 🧠 Brain

> 모든 것은 여기서 시작하고, 여기로 돌아온다.
> 이 노트는 뇌의 중심. 아래 9개의 허브는 각각 하나의 **뇌 영역(엽)**이고, 그 안의 노트들이 뉴런, 링크가 시냅스다.

## 🗂️ 뇌 영역
| 허브 | 역할 | 들어가는 것 |
| --- | --- | --- |
| [[📥 Inbox]] | 입구 | 아직 자리를 못 찾은 모든 것 |
| [[📅 Daily]] | 시간축 | 일간 노트(일정·할 일·캡처), 주간 리뷰 |
| [[📓 Journal]] | 감정·회고 | 일기 |
| [[✅ Tasks]] | 실행 | 할 일, 프로젝트 |
| [[📚 Library]] | 인풋 | 독후감, 아티클, 영상, 강의 |
| [[💡 Ideas]] | 내 생각 | 영구 노트 (책·일기에서 뽑아낸 아이디어) |
| [[🧭 Areas]] | 삶의 영역 | 건강, 커리어, 돈, 관계, 배움 … |
| [[👤 People]] | 사람 | 만난 사람, 기억할 사람 |
| [[🔌 Sources]] | 외부 연동 | GoodNotes, Google Calendar, MetaData … |

## ⚡ 오늘
```dataviewjs
const today = dv.date("today").toFormat("yyyy-MM-dd");
const week  = moment().format("GGGG-[W]WW");
dv.paragraph(`📅 오늘 노트 → [[${today}]] · 🗓️ 이번 주 → [[${week}]] · 🩺 [[🩺 Health|뇌 건강검진]]`);
```

```tasks
not done
due before tomorrow
short mode
limit 10
```

## 📊 뇌 지도
```dataviewjs
const regions = [
  ["📥 Inbox", "00_Inbox"], ["📅 Daily", "10_Daily"], ["📓 Journal", "20_Journal"],
  ["✅ Tasks", "30_Tasks"], ["📚 Library", "40_Library"], ["💡 Ideas", "50_Ideas"],
  ["🧭 Areas", "60_Areas"], ["👤 People", "70_People"], ["🔌 Sources", "80_Sources"],
];
dv.table(["영역", "뉴런 수"], regions.map(([name, path]) => [dv.fileLink(name), dv.pages(`"${path}"`).length]));
```

## 🕒 최근에 만진 뉴런
```dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형", file.mtime AS "수정"
FROM -"_System"
WHERE type != "hub"
SORT file.mtime DESC
LIMIT 10
```

## 🧭 이 뇌의 작동 원리
1. **입력은 한 곳** — `Ctrl/Cmd+N` → "이 노트는 무엇인가요?" → 알아서 제자리로.
2. **모든 노트는 두 개의 선을 가진다** — `up`(어느 허브 소속인가) + `daily`(언제 생겼나). 그래서 고아 뉴런이 없다.
3. **폴더가 진실** — 노트가 어디 있는지가 곧 그 노트의 종류다. 태그는 주제용.
4. **주 1회 정리** — 주간 노트에서 Inbox를 비우고 [[🩺 Health]]로 끊어진 연결을 잇는다.
