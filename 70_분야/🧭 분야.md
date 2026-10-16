---
type: hub
tags: [hub]
aliases: [Areas, 영역, 삶의 영역]
up: "[[🧠 Brain]]"
cssclasses: [hub]
---
# 🧭 Areas — 삶의 영역

> 프로젝트는 끝나지만 영역은 끝나지 않는다. 책·아이디어·프로젝트 노트의 `area` 속성에 영역을 적으면 이곳으로 모인다.
> 그래프에서는 각 영역 노트가 **중간 허브**가 되어 뇌의 큰 가지를 만든다.

## 영역 목록
```dataview
TABLE WITHOUT ID file.link AS "영역", length(file.inlinks) AS "연결된 뉴런"
FROM "60_Areas"
WHERE type = "area"
SORT length(file.inlinks) DESC
```

## 시작 영역 (필요에 맞게 고치세요)
- [[건강]] · [[커리어]] · [[돈]] · [[관계]] · [[배움]]
