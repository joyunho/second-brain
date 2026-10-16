---
type: hub
tags: [hub]
aliases: [Daily, 데일리, 일간, 시간축]
up: "[[🧠 Brain]]"
cssclasses: [hub]
---
# 📅 Daily — 시간축

> 일간 노트는 **시냅스**다. 그날 읽은 책, 쓴 일기, 떠오른 아이디어가 전부 `daily` 속성으로 이 날짜에 연결된다.
> 그래서 그래프에서 날짜 노드를 잡으면 "그날의 내 뇌"가 통째로 딸려 나온다.

## 오늘 · 이번 주
```dataviewjs
const today = dv.date("today").toFormat("yyyy-MM-dd");
const week  = moment().format("GGGG-[W]WW");
dv.paragraph(`📅 [[${today}]] · 🗓️ [[${week}]]`);
```

## 최근 14일
```dataview
TABLE WITHOUT ID file.link AS "날짜", length(filter(file.inlinks, (l) => !contains(string(l), "Daily"))) AS "연결된 뉴런"
FROM "10_Daily"
WHERE type = "daily"
SORT file.name DESC
LIMIT 14
```

## 주간 리뷰
```dataview
LIST
FROM "10_Daily/Weekly"
WHERE type = "weekly"
SORT file.name DESC
LIMIT 8
```

## 구조
- `10_Daily/YYYY/MM/YYYY-MM-DD.md` — 일간 (Calendar 플러그인에서 날짜 클릭 또는 `오늘의 노트 열기`)
- `10_Daily/Weekly/GGGG-Www.md` — 주간 (Calendar에서 주차 숫자 클릭)
