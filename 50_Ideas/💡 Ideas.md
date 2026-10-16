---
type: hub
tags: [hub]
aliases: [Ideas, 아이디어, 생각, 영구노트, Zettelkasten]
up: "[[🧠 Brain]]"
cssclasses: [hub]
---
# 💡 Ideas — 내 생각

> 책에서 밑줄 친 문장은 아직 남의 것. 내 말로 다시 쓰고, 다른 생각과 **두 번 이상 연결**되어야 내 뉴런이 된다.
> 그래프에서 가장 촘촘하게 얽혀야 하는 영역.

## 최근 아이디어
```dataview
TABLE WITHOUT ID file.link AS "아이디어", source AS "출처", length(file.outlinks) AS "연결", file.cday AS "날짜"
FROM "50_Ideas"
WHERE type = "idea"
SORT file.cday DESC
LIMIT 20
```

## 🔗 연결이 약한 뉴런 (링크 3개 이하 — 이어 주세요)
```dataview
TABLE WITHOUT ID file.link AS "아이디어", length(file.outlinks) + length(file.inlinks) AS "연결 수"
FROM "50_Ideas"
WHERE type = "idea" AND (length(file.outlinks) + length(file.inlinks)) <= 3
SORT file.cday ASC
```

## 🌟 가장 많이 연결된 뉴런
```dataview
TABLE WITHOUT ID file.link AS "아이디어", length(file.inlinks) AS "들어오는 링크"
FROM "50_Ideas"
WHERE type = "idea"
SORT length(file.inlinks) DESC
LIMIT 10
```

## 쓰는 법
- 한 노트 = 한 생각. 제목은 **문장**으로 ("습관은 보상이 아니라 신호로 시작된다").
- `source`에 출처 책/글을 `[[ ]]`로. 그러면 책 → 아이디어 선이 그어진다.
