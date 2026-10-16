<%*
/* 💎 영구 노트 — 90_영구/<한 문장>.md (type: 영구). source 로 문헌 노트(책/글/굿노트/자료)를 가리키고, 연결은 최소 2개. */
let title = tp.file.title;
if (/^(Untitled|제목 없음)/.test(title)) {
  const asked = await tp.system.prompt("아이디어를 한 문장으로");
  if (asked && asked.trim()) {
    title = asked.trim().replace(/[\\/:*?"<>|#^\[\]]/g, " ").replace(/\s+/g, " ").trim() || "이름 없음";
    let dir = tp.file.folder(true); if (dir === "/") dir = "";   // 같은 이름이 있으면 " (2)" — rename 실패로 템플릿이 멈추지 않게
    let n = 1, t = title; while (app.vault.getAbstractFileByPath(`${dir ? dir + "/" : ""}${t}.md`)) { n += 1; t = `${title} (${n})`; }
    title = t; await tp.file.rename(title);
  }
}
const today = tp.date.now("YYYY-MM-DD");
const mdIn = (p) => { const f = app.vault.getAbstractFileByPath(p); return f && f.children ? f.children.filter(c => c.extension === "md").map(c => c.basename) : []; };
const sources = [...mdIn("80_문헌/책"), ...mdIn("80_문헌/글"), ...mdIn("80_문헌/굿노트")].sort((a, b) => a.localeCompare(b, "ko"));
const source = sources.length ? (await tp.system.suggester(["없음 (직접 떠오른 생각)", ...sources], ["", ...sources], false, "어디서 왔나요? (문헌 노트)")) || "" : "";
const areas = mdIn("70_분야").filter(b => !/^🧭/.test(b)).sort((a, b) => a.localeCompare(b, "ko"));
const area = areas.length ? (await tp.system.suggester(["없음", ...areas], ["", ...areas], false, "분야 (선택)")) || "" : "";
-%>
---
type: 영구
up: "[[💎 영구 노트]]"
source: <% source ? `"[[${source}]]"` : "" %>
daily: "[[<% today %>]]"
created: <% today %>
area: <% area ? `"[[${area}]]"` : "" %>
---
# 💎 <% title %>

## 한 문장으로
> <% title %>

## 풀어서
- 

## 어디서 왔나
- <% source ? `[[${source}]]` : "" %>

## 연결 (최소 2개 — 혼자 있는 뉴런은 죽는다)
- 
- 
