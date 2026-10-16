---
type: dashboard
up: "[[🧠 Brain]]"
---
# 🩺 Health — 뇌 건강검진

> 뉴런은 혼자 있으면 죽는다. 주간 리뷰 때 이 페이지를 열고 끊어진 곳을 잇는다.
> 규칙: 행 노트(오늘 · 일기 · 할일 · 자료)는 `up` 없이 facet · 날짜 · 프로젝트 선으로, 구조 노트(허브 · 종류/기분/태그 · 분야 · 습관 · 일과 · 주간 · 프로젝트 · 책/글/굿노트 · 영구 · 사람)는 `up`으로 연결된다.

## 🧍 고아 뉴런 (들어오는 링크도 나가는 링크도 없음)
```dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형", file.folder AS "폴더", file.cday AS "생성"
FROM -"_System" AND -"_Attachments"
WHERE length(file.inlinks) = 0 AND length(file.outlinks) = 0
SORT file.cday ASC
```

## 🪢 `up`이 없는 구조 노트
```dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형", file.folder AS "폴더"
FROM -"_System" AND -"_Attachments"
WHERE !up AND file.name != "🧠 Brain"
  AND contains(list("허브", "종류", "기분", "태그", "분야", "습관", "일과", "주간", "프로젝트", "책", "글", "굿노트", "영구", "사람"), type)
SORT file.folder ASC
```

## 🧵 facet · 날짜 링크가 하나도 없는 행 노트
```dataviewjs
const KEYS = { 오늘: ["prev", "next", "week", "weekday"], 일기: ["daily", "종류", "기분", "태그"], 할일: ["daily", "마감", "project"], 자료: ["project", "daily"] };
const rows = [];
for (const p of dv.pages('-"_System" AND -"_Attachments"')) {
  const keys = KEYS[p.type]; if (!keys) continue;
  const has = keys.some(k => { const v = p[k]; return Array.isArray(v) ? v.length > 0 : !!v; });
  if (!has) rows.push([p.file.link, p.type, keys.join(" · ")]);
}
rows.length ? dv.table(["노트", "유형", "기대하는 링크 키"], rows) : dv.paragraph("✅ 모든 행 노트가 facet 또는 날짜에 연결돼 있어요");
```

## 📍 폴더와 `type`이 안 맞는 노트 (Inbox에서 태그로 옮겨진 뒤 템플릿을 안 입힌 것)
```dataviewjs
const expect = {
  "10_오늘": ["오늘", "주간"], "20_일정/일과": ["일과"], "30_할일/목록": ["할일"], "40_프로젝트": ["프로젝트", "자료"],
  "50_일기": ["일기", "종류", "기분", "태그"], "60_습관": ["습관"], "70_분야": ["분야"],
  "80_문헌/책": ["책"], "80_문헌/글": ["글"], "80_문헌/굿노트": ["굿노트"], "90_영구": ["영구"], "95_사람": ["사람"],
};
const rows = [];
for (const [folder, types] of Object.entries(expect)) {
  for (const p of dv.pages(`"${folder}"`)) {
    if (p.type === "허브" || types.includes(p.type)) continue;
    rows.push([p.file.link, p.type ?? "(없음)", types.join(" | ")]);
  }
}
rows.length ? dv.table(["노트", "현재 type", "폴더 기준 type"], rows) : dv.paragraph("✅ 전부 일치");
```

## 🏷️ frontmatter에 유형 태그가 남은 노트 (`tags`는 주제 태그 전용, 구조 태그는 `hub`뿐)
```dataviewjs
const LEGACY = new Set(["journal", "book", "article", "idea", "project", "person", "area", "goodnotes", "daily", "weekly", "tasks", "dashboard"]);  // 옛 유형 태그 (한글 주제 태그는 정상)
const rows = [];
for (const p of dv.pages('-"_System" AND -"_Attachments"')) {
  const fm = app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(p.file.path))?.frontmatter;
  const tags = fm?.tags; if (!tags) continue;
  const list = (Array.isArray(tags) ? tags : String(tags).split(",")).map(t => String(t).trim().replace(/^#/, ""));
  const bad = list.filter(t => LEGACY.has(t));
  if (bad.length) rows.push([p.file.link, bad.join(", ")]);
  const hubOk = p.type === "허브" || p.type === "분야" || p.type === "습관";
  if (list.includes("hub") && !hubOk) rows.push([p.file.link, "hub (허브 · 분야 · 습관 노트에만)"]);
}
rows.length ? dv.table(["노트", "지워야 할 태그"], rows) : dv.paragraph("✅ 없음");
```

## ⏳ 7일 넘게 Inbox에 있는 노트
```dataview
TABLE WITHOUT ID file.link AS "노트", (date(today) - file.cday).days AS "경과(일)"
FROM "00_Inbox"
WHERE type != "허브" AND (date(today) - file.cday).days > 7
SORT file.cday ASC
```

## 🆔 `yk_id` 중복 (가져오기가 같은 앱 행을 두 노트에 썼음 — 하나로 합치기)
```dataviewjs
const byId = {};
for (const p of dv.pages('-"_System"').where(p => p.yk_id)) (byId[String(p.yk_id)] ??= []).push(p.file.link);
const dup = Object.entries(byId).filter(([, v]) => v.length > 1);
dup.length ? dv.table(["yk_id", "노트"], dup.map(([id, links]) => [id, links.join(", ")])) : dv.paragraph("✅ 중복 없음");
```

## 📲 YouKnow 동기화 상태
### `yk_dirty` — 볼트 변경이 앱에 반영 안 됨 (→ [[🔌 연동]]에서 처리)
```dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형", status AS "볼트 상태", file.mtime AS "수정"
FROM -"_System"
WHERE yk_dirty = true
SORT file.mtime DESC
```
### `yk_missing` — 앱 테이블에서 사라진 행
```dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형", yk_missing AS "사라진 날"
FROM -"_System"
WHERE yk_missing
SORT yk_missing DESC
```
### `yk_pending` — 볼트에서 먼저 만들어 앱 id를 기다리는 노트
```dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형", file.cday AS "만든 날"
FROM -"_System"
WHERE yk_pending = true
SORT file.cday ASC
```

## 🏷️ 본문 `#태그` 중 `50_일기/태그` 노트가 없는 것
```dataviewjs
const STRUCT = new Set(["hub", "책", "글", "일기", "영구", "프로젝트", "사람", "분야", "할일", "습관", "굿노트", "자료"]);
const facets = new Set(dv.pages('"50_일기/태그"').where(p => p.type === "태그").map(p => p.file.name).array());
const where = {};
for (const p of dv.pages('-"_System" AND -"_Attachments"')) {
  const cache = app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(p.file.path));
  for (const t of (cache?.tags ?? [])) {
    const name = t.tag.replace(/^#/, "").split("/")[0];
    if (STRUCT.has(name) || facets.has(name)) continue;
    (where[name] ??= new Set()).add(p.file.link);
  }
}
const rows = Object.entries(where).sort((a, b) => b[1].size - a[1].size).map(([n, s]) => [`#${n}`, s.size, [...s].slice(0, 5).join(", ")]);
rows.length ? dv.table(["태그", "쓰인 노트 수", "예"], rows) : dv.paragraph("✅ 본문 태그는 전부 50_일기/태그 노트가 있어요 (구조 태그 제외)");
```
> 태그 노트를 만들면(`50_일기/태그/<값>.md`, tpl-facet) 일기의 `태그: ["[[값]]"]` 선이 그 노드로 모인다. 자주 쓰는 태그만 만들면 된다.

## 💎 연결 2개 미만인 영구 노트
```dataview
TABLE WITHOUT ID file.link AS "영구 노트", length(file.outlinks) + length(file.inlinks) AS "연결 수", source AS "출처"
FROM "90_영구"
WHERE type = "영구" AND (length(file.outlinks) + length(file.inlinks)) < 2
SORT file.cday ASC
```

## 🌟 허브가 별이 되지 않는지
```dataviewjs
const hub = dv.page("90_영구/💎 영구 노트");
const n = hub ? hub.file.inlinks.length : 0;
dv.paragraph(n > 200
  ? `> [!warning] 💎 영구 노트 허브를 가리키는 노트가 **${n}**개 — 200개를 넘었어요. tpl-idea의 \`up\`을 빼고 \`area\` · \`source\` 링크만 남기는 것을 고려하세요.`
  : `✅ 💎 영구 노트 허브 inlink ${n}개 (경고 기준 200)`);
const habits = dv.pages('"60_습관"').where(p => p.type === "습관").length;
if (habits > 10) dv.paragraph(`> [!note] 습관 노트가 ${habits}개 — 10개를 넘으면 빨간 점이 "소수"가 아니게 돼요. 습관의 \`tags: [hub]\`를 빼고 주황으로 내리는 것을 고려하세요.`);
```

## 🔗 깨진 링크가 있는 노트
```dataviewjs
const broken = [];
const skip = n => /^\d{4}-\d{2}-\d{2}( .+)?$/.test(n) || /^\d{4}-W\d{2}$/.test(n);
for (const p of dv.pages('-"_System"')) {
  const unresolved = (app.metadataCache.unresolvedLinks[p.file.path]) || {};
  const names = Object.keys(unresolved).filter(n => !skip(n));
  if (names.length) broken.push([p.file.link, names.join(", ")]);
}
broken.length ? dv.table(["노트", "가리키는데 없는 노트"], broken) : dv.paragraph("✅ 없음 (아직 안 만든 일간 · 일기 · 주간 노트 링크는 제외)");
```
