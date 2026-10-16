---
type: hub
tags: [hub]
aliases: [Tasks, 할일, 할 일, 태스크, 프로젝트]
up: "[[🧠 Brain]]"
cssclasses: [hub]
---
# ✅ Tasks — 실행

> 할 일은 **노트가 아니라 체크박스**다. 일간 노트, [[📋 Task Inbox]], 프로젝트 노트 어디에 적어도 Tasks 플러그인이 여기로 모아 온다.
> 날짜는 `📅 YYYY-MM-DD` 로 붙이면 그날 일간 노트에 자동으로 뜬다.

## 🔥 오늘 · 밀린 것
```tasks
not done
due before tomorrow
sort by due
```

## 🌅 내일
```tasks
not done
due tomorrow
```

## 📆 이번 주
```tasks
not done
due after tomorrow
due before next week
sort by due
```

## 🗓️ 날짜 없는 것 (Task Inbox 정리 대상)
```tasks
not done
no due date
path includes 30_Tasks
limit 20
```

## 🎯 프로젝트
```dataview
TABLE WITHOUT ID file.link AS "프로젝트", status AS "상태", area AS "영역", deadline AS "마감"
FROM "30_Tasks/Projects"
WHERE type = "project"
SORT status ASC, deadline ASC
```

## 쓰는 법
- 급하게: [[📋 Task Inbox]] 에 `- [ ] 할 일 📅 2026-10-17`
- 오늘 할 일: 오늘 일간 노트 `## ✅ 오늘 할 일` 아래에
- 묶음: 새 노트 → `🎯 프로젝트`
