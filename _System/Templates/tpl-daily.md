<%*
/* 📅 일간 노트 = 시냅스. 그날 만들어진 모든 노트(책/일기/아이디어)가 daily 속성으로 이 노트에 연결됩니다. */
const title = tp.file.title;
const d = moment(title, "YYYY-MM-DD", true).isValid() ? moment(title, "YYYY-MM-DD") : moment();
const date = d.format("YYYY-MM-DD");
const prev = d.clone().subtract(1, "day").format("YYYY-MM-DD");
const next = d.clone().add(1, "day").format("YYYY-MM-DD");
const week = d.format("GGGG-[W]WW");
const dow  = ["일", "월", "화", "수", "목", "금", "토"][d.day()];

// 🗓️ Google Calendar → ICS 플러그인이 있으면 그날 일정을 자동 삽입
let events = "- _(ICS 플러그인을 설치하고 Google Calendar의 비공개 iCal 주소를 등록하면 여기에 일정이 자동으로 들어옵니다. → [[🔌 Sources]])_";
try {
  const ics = app.plugins.getPlugin("ics");
  if (ics) {
    const list = await ics.getEvents(d);
    events = list.length
      ? list.sort((a, b) => a.utime - b.utime)
            .map(e => `- ${e.time} **${e.summary}**${e.location ? " @ " + e.location : ""}`)
            .join("\n")
      : "- 일정 없음";
  }
} catch (e) {
  events = `- _(일정 불러오기 실패: ${e.message})_`;
}
-%>
---
type: daily
tags: [daily]
up: "[[📅 Daily]]"
week: "[[<% week %>]]"
date: <% date %>
---
# 📅 <% date %> (<% dow %>)
← [[<% prev %>]] · [[<% next %>]] → · 이번 주 [[<% week %>]]

## 🗓️ 오늘 일정
<% events %>

## ✅ 오늘 할 일
- [ ] 

### 📌 오늘 마감 (Task Inbox · 프로젝트에서 자동 수집)
```tasks
not done
due on <% date %>
hide backlink
short mode
```

## 📝 메모 · 캡처
- 

## 🧠 오늘 생긴 뉴런
```dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형"
FROM -"_System" AND -"10_Daily"
WHERE file.cday = date(<% date %>) OR contains(string(daily), "<% date %>")
SORT file.ctime ASC
```
