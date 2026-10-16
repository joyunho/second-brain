---
type: hub
tags: [hub]
aliases: [Library, 라이브러리, 독서, 책, 서재]
up: "[[🧠 Brain]]"
cssclasses: [hub]
---
# 📚 Library — 인풋

> 바깥에서 들어온 것. 책, 글, 영상, 강의. 여기서 소화된 것은 [[💡 Ideas]]로 넘어가 "내 것"이 된다.

## 📖 읽는 중
```dataview
TABLE WITHOUT ID file.link AS "책", author AS "저자", started AS "시작", area AS "영역"
FROM "40_Library/Books"
WHERE type = "book" AND status = "reading"
SORT started DESC
```

## ✅ 완독
```dataview
TABLE WITHOUT ID file.link AS "책", author AS "저자", rating AS "⭐", finished AS "완독"
FROM "40_Library/Books"
WHERE type = "book" AND status = "done"
SORT finished DESC
```

## 🛒 읽고 싶은
```dataview
LIST author
FROM "40_Library/Books"
WHERE type = "book" AND status = "want"
SORT file.ctime DESC
```

## 📰 아티클 · 영상 · 강의
```dataview
TABLE WITHOUT ID file.link AS "제목", kind AS "종류", author AS "출처", file.cday AS "날짜"
FROM "40_Library/Articles"
WHERE type = "article"
SORT file.cday DESC
LIMIT 20
```

## 📈 올해
```dataviewjs
const year = dv.date("today").year;
const done = dv.pages('"40_Library/Books"').where(p => p.type === "book" && p.status === "done" && p.finished && p.finished.year === year);
const rated = done.where(p => p.rating);
const avg = rated.length ? (rated.array().reduce((s, p) => s + Number(p.rating), 0) / rated.length).toFixed(1) : "–";
dv.paragraph(`${year}년 완독 **${done.length}권** · 평균 별점 **${avg}**`);
```
