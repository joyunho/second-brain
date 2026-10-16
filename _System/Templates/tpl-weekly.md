<%*
/* 🗓️ 주간 노트 = 리뷰 데스크. 일간 노트들을 묶고, Inbox를 비우고, 회고합니다. */
const title = tp.file.title; // 예: 2026-W42
const w = moment(title, "GGGG-[W]WW", true).isValid() ? moment(title, "GGGG-[W]WW") : moment();
const start = w.clone().startOf("isoWeek");
const end   = w.clone().endOf("isoWeek");
const prev  = w.clone().subtract(1, "week").format("GGGG-[W]WW");
const next  = w.clone().add(1, "week").format("GGGG-[W]WW");
const days  = Array.from({ length: 7 }, (_, i) => start.clone().add(i, "day").format("YYYY-MM-DD"));
const s = start.format("YYYY-MM-DD"), e = end.format("YYYY-MM-DD");
-%>
---
type: weekly
tags: [weekly]
up: "[[📅 Daily]]"
start: <% s %>
end: <% e %>
---
# 🗓️ <% title %> (<% start.format("M/D") %> ~ <% end.format("M/D") %>)
← [[<% prev %>]] · [[<% next %>]] →

## 이번 주 하루들
<% days.map(d => `- [[${d}]]`).join("\n") %>

## 📥 Inbox 비우기 (0이 목표)
```dataview
TABLE WITHOUT ID file.link AS "노트", file.tags AS "태그", file.cday AS "생성"
FROM "00_Inbox"
SORT file.cday ASC
```

## 🧠 이번 주 생긴 뉴런
```dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형", file.cday AS "날짜"
FROM -"_System" AND -"10_Daily"
WHERE file.cday >= date(<% s %>) AND file.cday <= date(<% e %>)
SORT type ASC, file.cday ASC
```

## 📓 이번 주 기분
```dataview
TABLE WITHOUT ID file.link AS "일기", mood AS "기분", energy AS "에너지"
FROM "20_Journal"
WHERE date >= date(<% s %>) AND date <= date(<% e %>)
SORT date ASC
```

## ✅ 이번 주 끝낸 일
```tasks
done after <% start.clone().subtract(1, "day").format("YYYY-MM-DD") %>
done before <% end.clone().add(1, "day").format("YYYY-MM-DD") %>
short mode
```

## 회고
### 잘한 것
- 

### 아쉬운 것
- 

### 다음 주, 딱 하나만 바꾼다면
- 

### 연결 안 된 뉴런 이어주기
> [[🩺 Health]] 대시보드에서 고아 노트를 확인하고 최소 하나씩 링크를 걸어 주세요.
