<%*
let title = tp.file.title;
if (/^(Untitled|제목 없음)/.test(title)) {
  const asked = await tp.system.prompt("이름");
  if (asked && asked.trim()) { title = asked.trim(); await tp.file.rename(title); }
}
const today = tp.date.now("YYYY-MM-DD");
-%>
---
type: person
tags: [person]
up: "[[👤 People]]"
role: 
last_contact: <% today %>
daily: "[[<% today %>]]"
created: <% today %>
---
# 👤 <% title %>

## 누구인가
- 

## 기억할 것
- 

## 만남 기록
- <% today %> — 

## 연결
- 
