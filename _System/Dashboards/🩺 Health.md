---
type: dashboard
tags: [dashboard]
up: "[[🧠 Brain]]"
---
# 🩺 Health — 뇌 건강검진

> 뉴런은 혼자 있으면 죽는다. 주간 리뷰 때 이 페이지를 열고 끊어진 곳을 잇는다.

## 🧍 고아 뉴런 (들어오는 링크도 나가는 링크도 없음)
```dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형", file.folder AS "폴더", file.cday AS "생성"
FROM -"_System" AND -"90_Attachments"
WHERE length(file.inlinks) = 0 AND length(file.outlinks) = 0
SORT file.cday ASC
```

## 🪢 `up` 이 없는 노트 (허브에 안 매달림)
```dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형", file.folder AS "폴더"
FROM -"_System" AND -"90_Attachments"
WHERE !up AND type != "hub" AND file.name != "🧠 Brain"
SORT file.folder ASC
```

## 📍 폴더와 `type` 이 안 맞는 노트 (Inbox에서 태그로 옮겨진 뒤 템플릿을 안 입힌 것)
```dataviewjs
const expect = {
  "00_Inbox": "inbox", "20_Journal": "journal", "30_Tasks/Projects": "project",
  "40_Library/Books": "book", "40_Library/Articles": "article", "50_Ideas": "idea",
  "60_Areas": "area", "70_People": "person", "80_Sources/GoodNotes": "goodnotes",
};
const rows = [];
for (const [folder, type] of Object.entries(expect)) {
  for (const p of dv.pages(`"${folder}"`)) {
    if (p.type === "hub" || p.type === type) continue;
    rows.push([p.file.link, p.type ?? "(없음)", type]);
  }
}
rows.length ? dv.table(["노트", "현재 type", "폴더 기준 type"], rows) : dv.paragraph("✅ 전부 일치");
```

## ⏳ 7일 넘게 Inbox에 있는 노트
```dataview
TABLE WITHOUT ID file.link AS "노트", (date(today) - file.cday).days AS "경과(일)"
FROM "00_Inbox"
WHERE type != "hub" AND (date(today) - file.cday).days > 7
SORT file.cday ASC
```

## 🔗 깨진 링크가 있는 노트
```dataviewjs
const broken = [];
for (const p of dv.pages('-"_System"')) {
  const unresolved = (app.metadataCache.unresolvedLinks[p.file.path]) || {};
  const names = Object.keys(unresolved).filter(n => !/^\d{4}-\d{2}-\d{2}( 일기)?$/.test(n) && !/^\d{4}-W\d{2}$/.test(n));
  if (names.length) broken.push([p.file.link, names.join(", ")]);
}
broken.length ? dv.table(["노트", "가리키는데 없는 노트"], broken) : dv.paragraph("✅ 없음 (날짜 링크는 제외)");
```
