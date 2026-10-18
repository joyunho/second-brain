<%*
/* 🧭 분야 노트 (spec §3-11) — 70_분야/<이름>.md. 프로젝트·문헌·영구 노트가 area 로 가리키는 구조 노드 → tags: [hub] (그래프 빨강). */
let title = tp.file.title;
if (/^(Untitled|제목 없음)/.test(title)) {
  const asked = await tp.system.prompt("분야 이름 (예: 건강, 커리어, 돈, 관계, 배움)");
  if (asked && asked.trim()) {
    title = asked.trim().replace(/[\\/:*?"<>|#^\[\]]/g, " ").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, "").replace(/\s+/g, " ").trim() || "이름 없음";
    let dir = tp.file.folder(true); if (dir === "/") dir = "";   // 같은 이름이 있으면 " (2)" — rename 실패로 템플릿이 멈추지 않게
    let n = 1, t = title; while (app.vault.getAbstractFileByPath(`${dir ? dir + "/" : ""}${t}.md`)) { n += 1; t = `${title} (${n})`; }
    title = t; await tp.file.rename(title);
  }
}
const today = tp.date.now("YYYY-MM-DD");
const aZ = (a) => /(건강|운동|헬스|몸)/.test(a) ? "💪" : /(유튜브|영상|채널)/.test(a) ? "🎬" : /(게임|에임|랭크)/.test(a) ? "🎮"
  : /(스타일|패션|미용|헤어|옷)/.test(a) ? "💇" : /(공부|학교|시험|영어|독서)/.test(a) ? "📚" : /(돈|재테크|주식|저축|소비)/.test(a) ? "💰"
  : /(생활|집|방|정리)/.test(a) ? "🏠" : "📁";
const emoji = aZ(title);
-%>
---
type: 분야
tags: [hub]
up: "[[분야]]"
emoji: <% emoji %>
created: <% today %>
---
# 🧭 <% title %>

> [!abstract] 이 분야에서 지키고 싶은 기준
> 

## 진행 중인 프로젝트
```dataview
TABLE WITHOUT ID file.link AS "프로젝트", status AS "상태", due AS "마감", next_action AS "다음 행동"
FROM "40_프로젝트"
WHERE type = "프로젝트" AND contains(area, link("<% title %>")) AND status != "완료" AND !yk_deleted AND !yk_missing
SORT due ASC
```

## 이 분야의 뉴런들
```dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형", file.cday AS "날짜"
FROM -"_System" AND -"70_분야"
WHERE contains(area, link("<% title %>")) AND !yk_deleted AND !yk_missing
SORT file.cday DESC
LIMIT 30
```

## 메모
- 
