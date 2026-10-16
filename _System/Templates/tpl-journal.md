<%*
const today = tp.date.now("YYYY-MM-DD");
let title = tp.file.title;
if (/^(Untitled|제목 없음)/.test(title)) { title = `${today} 일기`; await tp.file.rename(title); }
const parsed = moment(title.slice(0, 10), "YYYY-MM-DD", true);
const date = parsed.isValid() ? parsed.format("YYYY-MM-DD") : today;
const dow  = ["일", "월", "화", "수", "목", "금", "토"][moment(date).day()];
-%>
---
type: journal
tags: [journal]
up: "[[📓 Journal]]"
date: <% date %>
daily: "[[<% date %>]]"
mood: 
energy: 
weather: 
created: <% today %>
---
# 📓 <% date %> (<% dow %>) 일기

## 오늘 있었던 일
- 

## 감정 · 기분
- 

## 감사한 것 3가지
1. 
2. 
3. 

## 배운 것 · 내일의 나에게
- 

---
`mood` · `energy`: 1(최악) ~ 5(최고)
