<%*
/* 🏷️ 일기 facet 노트 (spec §3-5) — 50_일기/종류|기분|태그/<값>.md
   부모 폴더 이름으로 종류/기분/태그를 판별합니다. importer가 앱 설정(settings)에서 같은 노트를 만들 때는 yk_id 등을 더 채웁니다. */
const folder = tp.file.folder(true);
const facet = ["종류", "기분", "태그"].find(f => folder.endsWith("/" + f)) || (await tp.system.suggester(["종류", "기분", "태그"], ["종류", "기분", "태그"], false, "어떤 facet 인가요?")) || "태그";
const E = (s) => { const t = String(s ?? "").replace(/[\\/:*?"<>|#^\[\]]/g, " ").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, "").replace(/\s+/g, " ").trim().replace(/^[. ]+|[. ]+$/g, ""); return (["Brain","Inbox","오늘","일정","할 일","Task Inbox","프로젝트","일기","습관","분야","문헌","영구 노트","사람","연동","Health"].includes(t) ? t + " (노트)" : t) || "이름 없음"; };   // 앞뒤 점 제거: 점으로 시작하는 파일은 Obsidian 이 숨긴다
const q = (s) => `"${String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
const safeRename = async (base) => {   // 같은 폴더에 같은 이름이 있으면 " (2)", " (3)" — rename 실패로 템플릿이 멈추지 않게
  let dir = tp.file.folder(true); if (dir === "/") dir = "";
  let n = 1, t = base;
  while (app.vault.getAbstractFileByPath(`${dir ? dir + "/" : ""}${t}.md`)) { n += 1; t = `${base} (${n})`; }
  await tp.file.rename(t); return t;
};
let value = tp.file.title;
if (/^(Untitled|제목 없음)/.test(value)) {
  const asked = await tp.system.prompt(`${facet} 값 (예: ${facet === "종류" ? "운동" : facet === "기분" ? "좋음" : "친구"})`);
  if (asked && asked.trim()) { value = E(asked); value = await safeRename(value); }
}
const PALETTE = [["#38bdf8", "하늘"], ["#34d399", "초록"], ["#f59e0b", "호박"], ["#fb923c", "주황"], ["#2dd4bf", "청록"], ["#f472b6", "분홍"], ["#a3e635", "연두"], ["#94a3b8", "회색"]];
const MOOD = { "최고": ["🤩", 5, "#f59e0b"], "좋음": ["🙂", 4, "#34d399"], "보통": ["😐", 3, "#94a3b8"], "별로": ["😕", 2, "#fb923c"], "힘듦": ["😞", 1, "#f87171"] };
const F = "```";
let fm = "", extra = "", where = "";
if (facet === "종류") {
  const kind = (await tp.system.suggester(["일반 (general) — 자유 기록", "운동 (workout) — 부위·시간·강도 기록"], ["general", "workout"], false, "종류의 성격")) || "general";
  const icon = (await tp.system.suggester(["book-open", "dumbbell", "utensils", "plane", "gamepad-2", "graduation-cap", "heart", "banknote", "palette", "code", "music", "sparkles", "file"], ["book-open", "dumbbell", "utensils", "plane", "gamepad-2", "graduation-cap", "heart", "banknote", "palette", "code", "music", "sparkles", "file"], false, "아이콘 (앱 아이콘 이름)")) || (kind === "workout" ? "dumbbell" : "book-open");
  const pal = (await tp.system.suggester(PALETTE.map(p => `${p[1]} ${p[0]}`), PALETTE, false, "색")) || (kind === "workout" ? PALETTE[1] : ["#a78bfa", "보라"]);
  const defTpl = kind === "workout" ? "오늘 운동\n- \n\n느낀 점\n- " : "";
  const template = (await tp.system.prompt("일기 본문 템플릿 (새 일기에 미리 채워져요 · 여러 줄 가능)", defTpl, false, true)) ?? defTpl;
  const parts = kind === "workout" ? ((await tp.system.prompt("운동 부위 목록 (쉼표 구분)", "가슴, 등, 어깨, 팔, 하체, 코어, 유산소")) || "").split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];
  fm = `yk_id: ${value === "일반" ? "general" : value === "운동" ? "workout" : "type-" + Math.random().toString(16).slice(2, 10)}
icon: ${icon}
color: "${pal[0]}"
kind: ${kind}
template: ${q(template)}
${parts.length ? `parts: [${parts.join(", ")}]\n` : ""}`;
  extra = `## 템플릿
%% yk:template:start %%
${template ? template + "\n" : ""}%% yk:template:end %%

`;
  where = `diary_type = "${value}"`;
} else if (facet === "기분") {
  const known = MOOD[value];
  const emoji = known ? known[0] : ((await tp.system.prompt("이모지 (선택)")) || "");
  const score = known ? known[1] : (await tp.system.suggester(["5 최고", "4 좋음", "3 보통", "2 별로", "1 힘듦", "점수 없음"], [5, 4, 3, 2, 1, null], false, "점수 (평균 계산용)"));
  const color = known ? known[2] : ((await tp.system.suggester(PALETTE.map(p => `${p[1]} ${p[0]}`), PALETTE, false, "색")) || PALETTE[7])[0];
  fm = `${emoji ? `emoji: ${emoji}\n` : ""}color: "${color}"
${score != null ? `score: ${score}\n` : ""}`;
  where = `mood = "${value}"`;
} else {
  fm = `source: used\n`;
  where = `econtains(tags, "#${value}")`;   // Dataview 의 tags 는 #접두 — 부분 일치(contains) 대신 정확 일치
}
tR += `---
type: ${facet}
up: "[[일기]]"
${fm}---
# ${value}

${extra}## 이 값의 일기
${F}dataview
TABLE WITHOUT ID file.link AS "일기", date AS "날짜", mood AS "기분", tags AS "태그"
FROM "50_일기" AND -"50_일기/종류" AND -"50_일기/기분" AND -"50_일기/태그"
WHERE type = "일기" AND ${where}
SORT date DESC
${F}

## 월별 카운트
${F}dataviewjs
const value = dv.current().file.name;
const facet = "${facet}";
const pages = dv.pages('"50_일기"').where(p => p.type === "일기" && p.date && (
  facet === "종류" ? String(p.diary_type ?? "") === value :
  facet === "기분" ? String(p.mood ?? "") === value :
  (Array.isArray(p.tags) ? p.tags : [p.tags]).map(String).includes(value)));
const byMonth = new Map();
for (const p of pages) { const k = p.date.toFormat("yyyy-MM"); byMonth.set(k, (byMonth.get(k) || 0) + 1); }
const rows = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([k, n]) => [k, "█".repeat(Math.min(n, 30)) + " " + n]);
if (rows.length) dv.table(["월", "일기 수"], rows); else dv.paragraph("_아직 이 값의 일기가 없어요._");
${F}
`;
-%>
