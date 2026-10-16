<%*
let title = tp.file.title;
if (/^(Untitled|제목 없음)/.test(title)) {
  const asked = await tp.system.prompt("아이디어를 한 문장으로");
  if (asked && asked.trim()) { title = asked.trim(); await tp.file.rename(title); }
}
const today = tp.date.now("YYYY-MM-DD");
-%>
---
type: idea
tags: [idea]
up: "[[💡 Ideas]]"
source: 
daily: "[[<% today %>]]"
created: <% today %>
area: 
---
# 💡 <% title %>

## 한 문장으로
> 

## 풀어서
- 

## 어디서 왔나
- 

## 연결 (최소 2개 — 혼자 있는 뉴런은 죽는다)
- 
- 
