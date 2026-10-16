<%*
let title = tp.file.title;
if (/^(Untitled|제목 없음)/.test(title)) {
  const asked = await tp.system.prompt("영역 이름 (예: 건강, 커리어, 돈)");
  if (asked && asked.trim()) { title = asked.trim(); await tp.file.rename(title); }
}
const today = tp.date.now("YYYY-MM-DD");
-%>
---
type: area
tags: [area, hub]
up: "[[🧭 Areas]]"
created: <% today %>
---
# 🧭 <% title %>

> [!abstract] 이 영역에서 지키고 싶은 기준
> 

## 진행 중인 프로젝트
```dataview
LIST FROM "30_Tasks/Projects" WHERE contains(string(area), "<% title %>") AND status != "done"
```

## 이 영역의 뉴런들
```dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형", file.cday AS "날짜"
FROM -"_System" AND -"60_Areas"
WHERE contains(string(area), "<% title %>")
SORT file.cday DESC
LIMIT 30
```

## 메모
- 
