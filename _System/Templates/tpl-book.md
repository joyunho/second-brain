<%*
/* 📖 책 노트 — 80_문헌/책/<제목>.md (type: 책). 문헌 → 90_영구 흐름의 출발점. */
let title = tp.file.title;
if (/^(Untitled|제목 없음)/.test(title)) {
  const asked = await tp.system.prompt("책 제목");
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
type: 책
up: "[[문헌]]"
author: 
status: reading
rating: 
started: <% today %>
finished: 
daily: "[[<% today %>]]"
created: <% today %>
area: <% area ? `"[[${area}]]"` : "" %>
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

## 이 책에서 나온 영구 노트 (→ [[영구 노트]] 로 독립시키기 · 영구 노트의 `source` 가 이 노트를 가리킵니다)
```dataview
LIST FROM "90_영구" WHERE contains(source, link(this.file.name))
```
- 

## 연결
- 분야: <% area ? `[[${area}]]` : "" %>
- 관련 책·글: 
- 사람: 

---
`status`: want → reading → done · `rating`: 1~5
