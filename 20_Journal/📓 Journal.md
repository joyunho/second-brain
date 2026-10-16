---
type: hub
tags: [hub]
aliases: [Journal, 일기, 저널]
up: "[[🧠 Brain]]"
cssclasses: [hub]
---
# 📓 Journal — 감정 · 회고

> 일간 노트가 "무엇을 했나"라면, 일기는 "어땠나". 둘은 같은 날짜로 연결된다.

## 최근 일기
```dataview
TABLE WITHOUT ID file.link AS "일기", mood AS "기분", energy AS "에너지", weather AS "날씨"
FROM "20_Journal"
WHERE type = "journal"
SORT date DESC
LIMIT 30
```

## 기분 추이 (최근 30일 평균)
```dataviewjs
const pages = dv.pages('"20_Journal"').where(p => p.type === "journal" && p.mood && p.date && p.date >= dv.date("today").minus({ days: 30 }));
const avg = (k) => pages.length ? (pages.array().reduce((s, p) => s + Number(p[k] || 0), 0) / pages.length).toFixed(1) : "–";
dv.paragraph(`📝 ${pages.length}편 · 평균 기분 **${avg("mood")}** / 5 · 평균 에너지 **${avg("energy")}** / 5`);
```

## 쓰는 법
- 새 노트 → `📓 일기` 선택. 파일명은 자동으로 `YYYY-MM-DD 일기`.
- `mood`, `energy`는 1~5 숫자로. 나중에 그래프로 뽑기 위해.
