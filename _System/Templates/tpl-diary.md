<%*
/* 📔 일기 노트 (spec §3-4) — 50_일기/YYYY/"YYYY-MM-DD 일기.md" (종류 일반) 또는 "YYYY-MM-DD <종류>.md"
   앱 규칙: (날짜, 종류)당 일기 하나. 라우터(tpl-inbox 📔 일기)가 window.__ykDiaryDraft 에 종류·날짜·기분·태그를 넣어 두면 질문을 건너뜁니다.
   본문 %% yk:body %% 블록은 importer가 다시 쓰고, 그 아래 "## 생각 · 연결"은 사용자 소유입니다. */
const draft = window.__ykDiaryDraft || null;
if (draft) delete window.__ykDiaryDraft;
const today = tp.date.now("YYYY-MM-DD");
const E = (s) => { const t = String(s ?? "").replace(/[\\/:*?"<>|#^\[\]]/g, " ").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, "").replace(/\s+/g, " ").trim().replace(/^[. ]+|[. ]+$/g, ""); return (["Brain","Inbox","오늘","일정","할 일","Task Inbox","프로젝트","일기","습관","분야","문헌","영구 노트","사람","연동","Health"].includes(t) ? t + " (노트)" : t) || "이름 없음"; };   // 앞뒤 점 제거: 점으로 시작하는 파일은 Obsidian 이 숨긴다
const q = (s) => `"${String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const basenames = (p) => { const f = app.vault.getAbstractFileByPath(p); return f && f.children ? f.children.filter(c => c.extension === "md").map(c => c.basename).sort((a, b) => a.localeCompare(b, "ko")) : []; };
const ensureFolder = async (path) => { let cur = ""; for (const p of path.split("/").filter(Boolean)) { cur = cur ? `${cur}/${p}` : p; if (!app.vault.getAbstractFileByPath(cur)) { try { await app.vault.createFolder(cur); } catch (e) {} } } };
const MOOD_SCORE = { "최고": 5, "좋음": 4, "보통": 3, "별로": 2, "힘듦": 1 };
const DEFAULT_BODY = `## 오늘 있었던 일
- 

## 감정 · 기분
- 

## 감사한 것 3가지
1. 
2. 
3. 

## 배운 것 · 내일의 나에게
- `;

// 1) 종류·날짜 — 파일명에서 읽거나(이미 옮겨진 경우) 질문
const title0 = tp.file.title;
const fromName = title0.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(.+))?$/);
let date = draft ? draft.date : (fromName && moment(fromName[1], "YYYY-MM-DD", true).isValid() ? fromName[1] : null);
let dtype = draft ? (draft.type || "일반") : (fromName ? (fromName[2] && fromName[2] !== "일기" ? fromName[2] : "일반") : null);
const typeNames = basenames("50_일기/종류");
if (!dtype) {
  const list = typeNames.includes("일반") ? typeNames : ["일반", ...typeNames];
  dtype = (await tp.system.suggester(list, list, false, "일기 종류")) || "일반";
}
if (!date) {
  const t = await tp.system.prompt("날짜 (YYYY-MM-DD · 어제 · 비우면 오늘)", today);
  const s = String(t ?? "").trim();
  date = /^\d{4}-\d{2}-\d{2}$/.test(s) && moment(s, "YYYY-MM-DD", true).isValid() ? s
       : s === "어제" ? moment(today).subtract(1, "day").format("YYYY-MM-DD")
       : s === "그제" || s === "그저께" ? moment(today).subtract(2, "day").format("YYYY-MM-DD") : today;
}
// 종류 노트(50_일기/종류/<종류>.md)의 kind/template/parts
const typeFile = app.vault.getAbstractFileByPath(`50_일기/종류/${dtype}.md`);
const typeFm = (typeFile && app.metadataCache.getFileCache(typeFile) && app.metadataCache.getFileCache(typeFile).frontmatter) || {};
const kind = typeFm.kind === "workout" || (dtype === "운동" && !typeFm.kind) ? "workout" : "general";
let bodyTpl = typeof typeFm.template === "string" && typeFm.template.trim() ? typeFm.template : (kind === "workout" ? "오늘 운동\n- \n\n느낀 점\n- " : DEFAULT_BODY);
const partsList = Array.isArray(typeFm.parts) && typeFm.parts.length ? typeFm.parts.map(String) : ["가슴", "등", "어깨", "팔", "하체", "코어", "유산소"];

// 2) 파일 위치 보정: 50_일기/YYYY/<date> 일기.md | <date> <종류>.md
const base = dtype === "일반" ? `${date} 일기` : `${date} ${E(dtype)}`;
const wantPath = `50_일기/${date.slice(0, 4)}/${base}.md`;
if (tp.config.target_file && tp.config.target_file.path !== wantPath) {
  const dup = app.vault.getAbstractFileByPath(wantPath);
  if (dup) {
    new tp.obsidian.Notice("이미 그 날짜에 같은 종류의 일기가 있어요. 날짜·종류당 일기는 하나만 — 이 노트는 ' (2)'로 둡니다.");
    await ensureFolder(`50_일기/${date.slice(0, 4)}`);
    let n = 1, alt = `50_일기/${date.slice(0, 4)}/${base} (2)`;
    while (app.vault.getAbstractFileByPath(`${alt}.md`)) { n += 1; alt = `50_일기/${date.slice(0, 4)}/${base} (${n + 1})`; }
    await tp.file.move(alt);
  } else {
    await ensureFolder(`50_일기/${date.slice(0, 4)}`);
    await tp.file.move(wantPath.replace(/\.md$/, ""));
  }
}

// 3) 기분·태그
let mood = draft ? (draft.mood || "") : "";
let tags = draft ? (draft.tags || []) : [];
if (!draft) {
  const moods = basenames("50_일기/기분");
  const moodList = moods.length ? moods : ["최고", "좋음", "보통", "별로", "힘듦"];
  mood = (await tp.system.suggester(["없음", ...moodList], ["", ...moodList], false, "기분")) || "";
  const tagOpts = basenames("50_일기/태그");
  const picked = new Set(); const custom = [];
  while (true) {
    const all = [...tagOpts, ...custom];
    const labels = ["✅ 완료" + (picked.size ? ` (${picked.size}개)` : ""), ...all.map(o => `${picked.has(o) ? "☑" : "☐"} ${o}`), "＋ 직접 입력"];
    const v = await tp.system.suggester(labels, ["__done", ...all, "__custom"], false, "태그 (여러 개 → ✅ 완료)");
    if (v == null || v === "__done") break;
    if (v === "__custom") { const t = await tp.system.prompt("태그 직접 입력 (쉼표로 여러 개)"); if (t) for (const x of t.split(/[,，]/).map(s => s.trim()).filter(Boolean)) { if (!all.includes(x)) custom.push(x); picked.add(x); } continue; }
    if (picked.has(v)) picked.delete(v); else picked.add(v);
  }
  tags = [...picked];
}
tags = tags.map(t => String(t).replace(/^#/, "").trim()).filter(Boolean);
const moodScore = MOOD_SCORE[mood];

// 4) 운동 종류 추가 항목
let parts = [], durationMin = null, intensity = "";
if (kind === "workout") {
  const picked = new Set();
  while (true) {
    const labels = ["✅ 완료" + (picked.size ? ` (${picked.size}개)` : ""), ...partsList.map(o => `${picked.has(o) ? "☑" : "☐"} ${o}`)];
    const v = await tp.system.suggester(labels, ["__done", ...partsList], false, "운동 부위 (여러 개 → ✅ 완료)");
    if (v == null || v === "__done") break;
    if (picked.has(v)) picked.delete(v); else picked.add(v);
  }
  parts = [...picked];
  const dur = await tp.system.prompt("운동 시간 (분)");
  if (dur && /^\d+$/.test(dur.trim())) durationMin = Number(dur.trim());
  intensity = (await tp.system.suggester(["가볍게", "보통", "빡세게"], ["가볍게", "보통", "빡세게"], false, "강도")) || "";
}

// 5) 제목 — 앱 규칙 td(): 올해면 M/D, 아니면 YYYY/M/D · workout 종류만 종류 이름, 나머지(general kind)는 "기록"
const d = moment(date, "YYYY-MM-DD");
const td = d.year() === moment().year() ? d.format("M/D") : d.format("YYYY/M/D");
const title = `${td} ${kind === "workout" ? dtype : "기록"}`;   // 앱: "workout" === kind ? name : "기록" 
const yamlList = (arr) => `[${arr.map(x => /[,:#\[\]"']/.test(x) ? q(x) : x).join(", ")}]`;
const fm = [
  "---",
  "type: 일기",
  `title: ${q(title)}`,
  `date: ${date}`,
  `daily: "[[${date}]]"`,
  `diary_type: ${dtype}`,
  `종류: "[[${dtype}]]"`,
  ...(mood ? [`mood: ${mood}`] : []),
  ...(moodScore ? [`mood_score: ${moodScore}`] : []),
  ...(mood ? [`기분: "[[${mood}]]"`] : []),
  `tags: ${yamlList(tags)}`,
  `태그: [${tags.map(t => `"[[${t}]]"`).join(", ")}]`,
  ...(kind === "workout" ? [`parts: ${yamlList(parts)}`, ...(durationMin != null ? [`duration_min: ${durationMin}`] : []), ...(intensity ? [`intensity: ${intensity}`] : [])] : []),
  "energy: ",
  "weather: ",
  `created: ${today}`,
  "---",
].join("\n");
tR += `${fm}
# ${title}
%% yk:body:start %%
${bodyTpl}
%% yk:body:end %%

## 📷 사진
%% yk:photos:start %%
%% yk:photos:end %%

## 생각 · 연결
- 

---
\`mood\`: 최고 · 좋음 · 보통 · 별로 · 힘듦 (앱 설정과 같은 값) · \`energy\`·\`weather\`: 선택 (앱에 없음, 1~5)
`;
-%>
