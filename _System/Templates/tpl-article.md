<%*
/* 📰 글 / 영상 / 강의 노트 — 80_문헌/글/<제목>.md (type: 글) */
let title = tp.file.title;
if (/^(Untitled|제목 없음)/.test(title)) {
  const asked = await tp.system.prompt("제목");
  if (asked && asked.trim()) {
    title = asked.trim().replace(/[\\/:*?"<>|#^\[\]]/g, " ").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, "").replace(/\s+/g, " ").trim() || "이름 없음";
    let dir = tp.file.folder(true); if (dir === "/") dir = "";   // 같은 이름이 있으면 " (2)" — rename 실패로 템플릿이 멈추지 않게
    let n = 1, t = title; while (app.vault.getAbstractFileByPath(`${dir ? dir + "/" : ""}${t}.md`)) { n += 1; t = `${title} (${n})`; }
    title = t; await tp.file.rename(title);
  }
}
const today = tp.date.now("YYYY-MM-DD");
const areasDir = app.vault.getAbstractFileByPath("70_분야");
const areas = areasDir && areasDir.children ? areasDir.children.filter(c => c.extension === "md" && !/^🧭/.test(c.basename)).map(c => c.basename).sort((a, b) => a.localeCompare(b, "ko")) : [];
const area = areas.length ? (await tp.system.suggester(["없음", ...areas], ["", ...areas], false, "분야 (선택)")) || "" : "";
-%>
---
type: 글
up: "[[문헌]]"
url: 
author: 
kind: article
status: done
daily: "[[<% today %>]]"
created: <% today %>
area: <% area ? `"[[${area}]]"` : "" %>
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

## 이 글에서 나온 영구 노트 (→ [[영구 노트]])
```dataview
LIST FROM "90_영구" WHERE contains(source, link(this.file.name))
```
- 

## 연결
- 분야: <% area ? `[[${area}]]` : "" %>
- 

---
`kind`: article · video · podcast · lecture · paper
