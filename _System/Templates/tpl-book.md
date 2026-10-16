<%*
let title = tp.file.title;
if (/^(Untitled|제목 없음)/.test(title)) {
  const asked = await tp.system.prompt("책 제목");
  if (asked && asked.trim()) { title = asked.trim(); await tp.file.rename(title); }
}
const today = tp.date.now("YYYY-MM-DD");
-%>
---
type: book
tags: [book]
up: "[[📚 Library]]"
author: 
status: reading
rating: 
started: <% today %>
finished: 
daily: "[[<% today %>]]"
created: <% today %>
area: 
---
# 📖 <% title %>

> [!quote] 한 줄 평
> 

## 왜 읽었나
- 

## 핵심 메시지 3가지
1. 
2. 
3. 

## 인상 깊은 문장
> 

## 내 생각
- 

## 이 책에서 나온 아이디어 (→ 💡 Ideas 로 독립시키기)
- 

## 연결
- 영역: 
- 관련 책·글: 
- 사람: 

---
`status`: want → reading → done · `rating`: 1~5
