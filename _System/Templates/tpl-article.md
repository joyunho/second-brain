<%*
let title = tp.file.title;
if (/^(Untitled|제목 없음)/.test(title)) {
  const asked = await tp.system.prompt("제목");
  if (asked && asked.trim()) { title = asked.trim(); await tp.file.rename(title); }
}
const today = tp.date.now("YYYY-MM-DD");
-%>
---
type: article
tags: [article]
up: "[[📚 Library]]"
url: 
author: 
kind: article
status: done
daily: "[[<% today %>]]"
created: <% today %>
area: 
---
# 📰 <% title %>

## 요약 (3줄)
- 
- 
- 

## 건질 것
- 

## 내 생각
- 

## 연결
- 

---
`kind`: article · video · podcast · lecture · paper
