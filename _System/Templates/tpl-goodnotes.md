<%*
/* ✍️ 굿노트 노트 — 80_문헌/굿노트/<노트북>.md (type: 굿노트). _System/Scripts/import_goodnotes.py 가 같은 형태로 만듭니다. PDF 는 _Attachments/GoodNotes/. */
const title = tp.file.title;
const today = tp.date.now("YYYY-MM-DD");
const areasDir = app.vault.getAbstractFileByPath("70_분야");
const areas = areasDir && areasDir.children ? areasDir.children.filter(c => c.extension === "md" && !/^🧭/.test(c.basename)).map(c => c.basename).sort((a, b) => a.localeCompare(b, "ko")) : [];
const area = areas.length ? (await tp.system.suggester(["없음", ...areas], ["", ...areas], false, "분야 (선택)")) || "" : "";
-%>
---
type: 굿노트
up: "[[📚 문헌]]"
pdf: "[[<% title %>.pdf]]"
daily: "[[<% today %>]]"
created: <% today %>
area: <% area ? `"[[${area}]]"` : "" %>
---
# ✍️ <% title %>

> [!info] GoodNotes 에서 가져온 손글씨 노트 ([[🔌 연동]])
> 원본 PDF: `_Attachments/GoodNotes/<% title %>.pdf`

## 핵심 정리 (손글씨 → 텍스트)
- 

## 이 노트에서 나온 영구 노트 (→ [[💎 영구 노트]])
```dataview
LIST FROM "90_영구" WHERE contains(string(source), this.file.name)
```
- 

## 연결
- 분야: <% area ? `[[${area}]]` : "" %>

## 원본
![[<% title %>.pdf]]
