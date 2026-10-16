---
type: hub
tags: [hub]
aliases: [People, 사람, 인맥]
up: "[[🧠 Brain]]"
cssclasses: [hub]
---
# 👤 People — 사람

> 일기나 일간 노트에서 사람 이름을 `[[ ]]`로 감싸면, 그 사람 노트가 자동으로 그 날과 연결된다.

## 사람들
```dataview
TABLE WITHOUT ID file.link AS "이름", role AS "관계", last_contact AS "마지막 연락", length(file.inlinks) AS "언급"
FROM "70_People"
WHERE type = "person"
SORT last_contact DESC
```

## 오래 연락 안 한 사람 (60일+)
```dataview
LIST last_contact
FROM "70_People"
WHERE type = "person" AND last_contact AND (date(today) - last_contact).days > 60
SORT last_contact ASC
```
