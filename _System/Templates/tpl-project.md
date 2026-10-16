<%*
let title = tp.file.title;
if (/^(Untitled|제목 없음)/.test(title)) {
  const asked = await tp.system.prompt("프로젝트 이름");
  if (asked && asked.trim()) { title = asked.trim(); await tp.file.rename(title); }
}
const today = tp.date.now("YYYY-MM-DD");
-%>
---
type: project
tags: [project]
up: "[[✅ Tasks]]"
area: 
status: active
deadline: 
daily: "[[<% today %>]]"
created: <% today %>
---
# 🎯 <% title %>

> [!abstract] 끝난 상태를 한 문장으로
> 

## 다음 행동
- [ ] 

## 할 일
- [ ] 

## 메모
- 

## 연결
- 

---
`status`: active · paused · done · 할 일에 `📅 YYYY-MM-DD` 를 붙이면 그날의 일간 노트에 자동으로 뜹니다.
