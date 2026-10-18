<%*
/* 🔁 습관 노트 (spec §3-9) — 60_습관/<이름>.md
   일간 노트 수백 개가 `- ✅ [[이름]]` 으로 가리키는 구조 노드라 tags: [hub] (그래프 빨강). */
const draft = window.__ykHabitDraft || null;      // 라우터 ⚡ 빠른 입력: 질문 없이 색 자동 배정
if (draft) delete window.__ykHabitDraft;
const today = tp.date.now("YYYY-MM-DD");
const E = (s) => { const t = String(s ?? "").replace(/[\\/:*?"<>|#^\[\]]/g, " ").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, "").replace(/\s+/g, " ").trim().replace(/^[. ]+|[. ]+$/g, ""); return (["Brain","Inbox","오늘","일정","할 일","Task Inbox","프로젝트","일기","습관","분야","문헌","영구 노트","사람","연동","Health"].includes(t) ? t + " (노트)" : t) || "이름 없음"; };   // 앞뒤 점 제거: 점으로 시작하는 파일은 Obsidian 이 숨긴다
const PALETTE = [["#38bdf8", "하늘"], ["#34d399", "초록"], ["#f59e0b", "호박"], ["#fb923c", "주황"], ["#2dd4bf", "청록"], ["#f472b6", "분홍"], ["#a3e635", "연두"], ["#94a3b8", "회색"]];
const safeRename = async (base) => {   // 같은 폴더에 같은 이름이 있으면 " (2)", " (3)" — rename 실패로 템플릿이 멈추지 않게
  let dir = tp.file.folder(true); if (dir === "/") dir = "";
  let n = 1, t = base;
  while (app.vault.getAbstractFileByPath(`${dir ? dir + "/" : ""}${t}.md`)) { n += 1; t = `${base} (${n})`; }
  await tp.file.rename(t); return t;
};
let name = draft && draft.name ? draft.name : tp.file.title;
if (!draft && /^(Untitled|제목 없음)/.test(name)) {
  const asked = await tp.system.prompt("습관 이름 (예: 헬스, 영어 단어 20개)");
  if (asked && asked.trim()) { name = E(asked); name = await safeRename(name); }
}
// 기존 습관 수 → 앱처럼 색 U[n % 8], sort_order max + 10
let count = 0, maxOrder = 0;
try {
  const dir = app.vault.getAbstractFileByPath("60_습관");
  for (const c of (dir && dir.children) || []) {
    if (c.extension !== "md" || c.path === tp.config.target_file.path) continue;
    const fmc = app.metadataCache.getFileCache(c);
    if (fmc && fmc.frontmatter && fmc.frontmatter.type === "습관") { count += 1; const so = Number(fmc.frontmatter.sort_order); if (!Number.isNaN(so)) maxOrder = Math.max(maxOrder, so); }
  }
} catch (e) { /* 무시 */ }
let pal = PALETTE[count % 8];
if (!draft) {
  const picked = await tp.system.suggester(PALETTE.map(p => `${p[1]} ${p[0]}`), PALETTE, false, `색 (기본 ${pal[1]})`);
  if (picked) pal = picked;
}
const F = "```";
tR += `---
type: 습관
tags: [hub]
up: "[[습관]]"
color: "${pal[0]}"
color_name: ${pal[1]}
sort_order: ${maxOrder + 10}
created: ${today}
daily: "[[${today}]]"
---
# 🔁 ${name}

## 기록
${F}dataviewjs
// 10_오늘 노트의 "- ✅ [[이름]]" 줄을 세어 연속일(오늘 미체크면 어제부터 역산 — 앱 알고리즘), 이번 주(일~토) %, 최근 8주 막대
const name = dv.current().file.name;
const esc = name.replace(/[.*+?^$()|[\\]\\\\{}]/g, "\\\\$&");
const re = new RegExp("^\\\\s*- (✅|⬜|❌) \\\\[\\\\[" + esc + "(\\\\|[^\\\\]]*)?\\\\]\\\\]", "m");
const pages = dv.pages('"10_오늘"').where(p => p.type === "오늘" && p.date);
const checked = new Set();
for (const p of pages) {
  const f = app.vault.getAbstractFileByPath(p.file.path);
  if (!f) continue;
  const txt = await app.vault.cachedRead(f);
  const m = txt.match(re);
  if (m && m[1] === "✅") checked.add(p.file.name);
}
const today = dv.date("today");
const fmt = d => d.toFormat("yyyy-MM-dd");
let cur = checked.has(fmt(today)) ? today : today.minus({ days: 1 });
let streak = 0;
while (checked.has(fmt(cur))) { streak += 1; cur = cur.minus({ days: 1 }); }
const dow = today.weekday % 7;                 // 0=일 … 6=토
const sun = today.minus({ days: dow });
let wk = 0;
for (let i = 0; i <= dow; i++) if (checked.has(fmt(sun.plus({ days: i })))) wk += 1;
const bars = [];
for (let w = 7; w >= 0; w--) {
  const s = sun.minus({ weeks: w });
  let c = 0, days = 0;
  for (let i = 0; i < 7; i++) { const d = s.plus({ days: i }); if (d > today) break; days += 1; if (checked.has(fmt(d))) c += 1; }
  bars.push(s.toFormat("MM/dd") + "  " + "█".repeat(c) + "░".repeat(Math.max(0, days - c)) + "  " + c + "/" + days);
}
dv.paragraph("**" + streak + "일 연속** · 이번 주 " + Math.round(wk / (dow + 1) * 100) + "% (" + wk + "/" + (dow + 1) + ") · 총 " + checked.size + "회");
dv.el("pre", bars.join("\\n"));
${F}

## 메모
- 
`;
-%>
