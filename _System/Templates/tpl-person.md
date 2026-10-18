<%*
/* 👤 사람 노트 — 95_사람/<이름>.md (type: 사람) */
let title = tp.file.title;
if (/^(Untitled|제목 없음)/.test(title)) {
  const asked = await tp.system.prompt("이름");
  if (asked && asked.trim()) {
    title = asked.trim().replace(/[\\/:*?"<>|#^\[\]]/g, " ").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, "").replace(/\s+/g, " ").trim() || "이름 없음";
    let dir = tp.file.folder(true); if (dir === "/") dir = "";   // 같은 이름이 있으면 " (2)" — rename 실패로 템플릿이 멈추지 않게
    let n = 1, t = title; while (app.vault.getAbstractFileByPath(`${dir ? dir + "/" : ""}${t}.md`)) { n += 1; t = `${title} (${n})`; }
    title = t; await tp.file.rename(title);
  }
}
const today = tp.date.now("YYYY-MM-DD");
-%>
---
type: 사람
up: "[[사람]]"
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
