<%*
/* 🚦 Inbox 라우터 — "이 노트는 무엇인가요?"
   Ctrl/Cmd+N 으로 새 노트를 만들면 (기본 위치 = 00_Inbox) 이 템플릿이 자동 실행됩니다.
   메뉴 순서 = YouKnow 내비(할 일·프로젝트·일기·일정·습관) + 제텔카스텐 확장(책·글·영구·사람·분야·자료).
   ⚡ 빠른 입력은 _System/Scripts/capture.js (tp.user.capture) 로 YouKnow 문법을 그대로 해석해 여러 노트로 나눕니다.
   Esc 를 누르면 그냥 Inbox 캡처 노트로 남습니다 (본문에 #책 #글 #일기 … 태그를 붙이면 Auto Note Mover가 이동). */

// ── 선택적 YouKnow 동기화: true 면 ⚡ 원문을 앱 /api/capture 에도 보내 앱에 같은 항목이 생깁니다(앱 파서 = 같은 규칙).
const PUSH_TO_YOUKNOW = false;
const YK_CAPTURE_URL = "https://youknow-meta-data-weom.vercel.app/api/capture";
const YK_CAPTURE_KEY = "";   // Vercel WIDGET_KEY 와 같은 값

const today = tp.date.now("YYYY-MM-DD");
const file = tp.config.target_file;
const rawTitle = tp.file.title;
const isUntitled = /^(Untitled|제목 없음)/.test(rawTitle);
const isFlash = /^⚡/.test(rawTitle);          // Advanced URI "뇌에 추가" 단축어: 메뉴 없이 본문을 바로 파싱

// ── 공용 도우미 ─────────────────────────────────────────────────────────────
const E = (s) => { const t = String(s ?? "").replace(/[\\/:*?"<>|#^\[\]]/g, " ").replace(/\s+/g, " ").trim(); return t || "이름 없음"; };
const q = (s) => `"${String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const notice = (msg) => { try { new Notice(msg); } catch (e) { console.log(msg); } };
const PRIORITY_LABELS = (tp.user.capture && tp.user.capture.PRIORITY_LABELS) || { 5: "긴급", 4: "중요", 3: "보통", 2: "낮음", 1: "언젠가" };
const PRIORITY_MARK = { 5: "🔺", 4: "⏫", 3: "", 2: "🔽", 1: "⏬" };
const DOW = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
const COLOR_NAMES = ["하늘", "초록", "호박", "주황", "청록", "분홍", "연두", "회색"];   // 앱 팔레트 U 순서

const folderOf = (path) => app.vault.getAbstractFileByPath(path);
const isHub = (c) => { try { const fc = app.metadataCache.getFileCache(c); return !!(fc && fc.frontmatter && fc.frontmatter.type === "허브"); } catch (e) { return false; } };
const basenames = (folderPath) => {   // 폴더 안 .md 이름들 — 허브 노트(🔁 습관 등, type: 허브)는 제외
  const f = folderOf(folderPath);
  if (!f || !f.children) return [];
  return f.children.filter(c => c.extension === "md" && !isHub(c)).map(c => c.basename).sort((a, b) => a.localeCompare(b, "ko"));
};
const projectNames = () => {
  const root = folderOf("40_프로젝트");
  if (!root || !root.children) return [];
  return root.children
    .filter(c => c.children && app.vault.getAbstractFileByPath(`${c.path}/${c.name}.md`))
    .map(c => c.name).sort((a, b) => a.localeCompare(b, "ko"));
};
const habitNames = () => basenames("60_습관");
const routineNames = () => basenames("20_일정/일과");
const ensureFolder = async (path) => {
  const parts = path.split("/").filter(Boolean);
  let cur = "";
  for (const p of parts) {
    cur = cur ? `${cur}/${p}` : p;
    if (!folderOf(cur)) { try { await app.vault.createFolder(cur); } catch (e) { /* 동시 생성 */ } }
  }
  return folderOf(path);
};
const uniquePath = (folder, base) => {
  let n = 1, path = `${folder}/${base}.md`;
  while (app.vault.getAbstractFileByPath(path)) { n += 1; path = `${folder}/${base} (${n}).md`; }
  return path;
};
const modifyFile = async (tfile, fn) => {
  if (typeof app.vault.process === "function") return app.vault.process(tfile, fn);
  const cur = await app.vault.read(tfile);
  return app.vault.modify(tfile, fn(cur));
};
// `%% yk:<name>:end %%` 줄 바로 뒤에 줄을 끼워 넣는다(마커 없는 줄 = Obsidian 소유, importer 보존). 마커가 없으면 섹션 끝/파일 끝에 붙인다.
const appendAfterMarker = async (tfile, name, lines, fallbackHeading) => {
  const endMarker = `%% yk:${name}:end %%`;
  await modifyFile(tfile, (text) => {
    const arr = text.split("\n");
    let idx = arr.findIndex(l => l.trim() === endMarker);
    if (idx < 0 && fallbackHeading) {
      const h = arr.findIndex(l => l.trim() === fallbackHeading);
      if (h >= 0) {
        idx = h;
        while (idx + 1 < arr.length && !/^#{1,6}\s/.test(arr[idx + 1])) idx += 1;
        while (idx > h && arr[idx].trim() === "") idx -= 1;
      }
    }
    if (idx < 0) { return text.replace(/\s*$/, "") + "\n" + lines.join("\n") + "\n"; }
    arr.splice(idx + 1, 0, ...lines);
    return arr.join("\n");
  });
};
const linkIfKnown = (title, names) => names.includes(title) ? `[[${title}]]` : title;
const planLine = (item) => {
  const t = linkIfKnown(item.title, [...habitNames(), ...routineNames()]);
  const time = item.end_time ? `${item.start_time}–${item.end_time}` : item.start_time;
  return `- ⬜ ${time} ${t}`;
};
const dailyPathOf = (date) => `10_오늘/${date.slice(0, 4)}/${date.slice(5, 7)}/${date}.md`;
const getOrCreateDaily = async (date) => {
  const path = dailyPathOf(date);
  let tfile = app.vault.getAbstractFileByPath(path);
  if (tfile) return tfile;
  const folder = await ensureFolder(`10_오늘/${date.slice(0, 4)}/${date.slice(5, 7)}`);
  const tpl = tp.file.find_tfile("tpl-daily");
  if (tpl) {
    tfile = await tp.file.create_new(tpl, date, false, folder);
  } else {
    tfile = await app.vault.create(path, `---\ntype: 오늘\ndate: ${date}\n---\n# ☀️ ${date}\n\n## 🗓️ 오늘 일정\n### 하루 계획\n%% yk:plans:start %%\n%% yk:plans:end %%\n`);
  }
  return tfile || app.vault.getAbstractFileByPath(path);
};
const getOrCreateWeekday = async (dow) => {
  const name = DOW[dow];
  const path = `20_일정/일과/${name}.md`;
  let tfile = app.vault.getAbstractFileByPath(path);
  if (tfile) return tfile;
  const folder = await ensureFolder("20_일정/일과");
  const tpl = tp.file.find_tfile("tpl-routine");
  if (tpl) tfile = await tp.file.create_new(tpl, name, false, folder);
  else tfile = await app.vault.create(path, `---\ntype: 일과\nup: "[[🗓️ 일정]]"\nweekday: ${dow}\n---\n# ${name} 일과\n## 일과표\n%% yk:routines:start %%\n| 시작 | 끝 | 일과 | 색 | |\n| --- | --- | --- | --- | --- |\n%% yk:routines:end %%\n`);
  return tfile || app.vault.getAbstractFileByPath(path);
};
const createProject = async (name) => {
  const safe = E(name);
  const path = `40_프로젝트/${safe}/${safe}.md`;
  if (app.vault.getAbstractFileByPath(path)) return app.vault.getAbstractFileByPath(path);
  const folder = await ensureFolder(`40_프로젝트/${safe}`);
  const tpl = tp.file.find_tfile("tpl-project");
  window.__ykProjectDraft = { name: safe, quick: true };
  let tfile = null;
  try {
    if (tpl) tfile = await tp.file.create_new(tpl, safe, false, folder);
    else tfile = await app.vault.create(path, `---\ntype: 프로젝트\nup: "[[🗂️ 프로젝트]]"\nstatus: 진행 중\narea: "[[개인]]"\nstart: ${today}\ndaily: "[[${today}]]"\ncreated: ${today}\n---\n# 📁 ${safe}\n`);
  } finally { delete window.__ykProjectDraft; }
  return tfile || app.vault.getAbstractFileByPath(path);
};
const createHabit = async (name) => {
  const safe = E(name);
  const path = `60_습관/${safe}.md`;
  if (app.vault.getAbstractFileByPath(path)) return app.vault.getAbstractFileByPath(path);
  const folder = await ensureFolder("60_습관");
  const tpl = tp.file.find_tfile("tpl-habit");
  window.__ykHabitDraft = { name: safe, quick: true };
  let tfile = null;
  try {
    if (tpl) tfile = await tp.file.create_new(tpl, safe, false, folder);
    else tfile = await app.vault.create(path, `---\ntype: 습관\ntags: [hub]\nup: "[[🔁 습관]]"\ncreated: ${today}\ndaily: "[[${today}]]"\n---\n# 🔁 ${safe}\n`);
  } finally { delete window.__ykHabitDraft; }
  return tfile || app.vault.getAbstractFileByPath(path);
};
const routineRow = async (item, dow) => {
  const tfile = await getOrCreateWeekday(dow);
  const text = await app.vault.read(tfile);
  const count = (text.match(/^\|\s*\d{2}:\d{2}\s*\|/gm) || []).length;   // 현재 행 수 → 앱처럼 색 자동 배정 U[(n+4)%8]
  const color = COLOR_NAMES[(count + 4) % 8];
  const title = linkIfKnown(item.title, habitNames());
  const row = `| ${item.start_time} | ${item.end_time || "—"} | ${title} | ${color} | |`;
  await appendAfterMarker(tfile, "routines", [row], "## 일과표");
  return tfile;
};

// ── 할 일 노트 본문 (spec §3-6; 볼트에서 먼저 만든 할 일 = 🆔 없음 + yk_pending: true) ──────────
const taskLine = (item) => {
  const p = PRIORITY_MARK[item.priority] || "";
  let s = `- [ ] ${item.title}`;
  if (p) s += ` ${p}`;
  if (item.start) s += ` 🛫 ${item.start}`;
  if (item.due) s += ` 📅 ${item.due}`;
  return s;
};
const gcalLink = (item) => {
  const base = (item.due || item.start || today).replace(/-/g, "");
  const nextDay = moment(item.due || item.start || today, "YYYY-MM-DD").add(1, "day").format("YYYYMMDD");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(item.title)}&dates=${base}/${nextDay}&details=YouKnow%20Meta%20data%20%ED%95%A0%20%EC%9D%BC`;
};
const makeTaskNote = (item) => {
  const priority = Number(item.priority) || 3;
  const start = item.start || today;
  const fm = [
    "---",
    "type: 할일",
    `title: ${q(item.title)}`,
    "status: 진행 전",
    `priority: ${priority}`,
    `priority_label: ${PRIORITY_LABELS[priority] || "보통"}`,
    `start: ${start}`,
    ...(item.due ? [`due: ${item.due}`] : []),
    `daily: "[[${start}]]"`,
    ...(item.due ? [`마감: "[[${item.due}]]"`] : []),
    ...(item.project ? [`project: "[[${E(item.project)}]]"`] : []),
    `created: ${today}`,
    "yk_pending: true",
    ...(item.dirty ? ["yk_dirty: true"] : []),
    "---",
  ].join("\n");
  return `${fm}
# ✅ ${item.title}
%% yk:task:start %%
${taskLine({ ...item, priority, start })}
%% yk:task:end %%
🗓️ [구글 캘린더에 추가](${gcalLink({ ...item, start })})

## 세부 메모
%% yk:note:start %%
${item.note ? item.note + "\n" : ""}%% yk:note:end %%

## 연결
- 
`;
};
const writeTask = async (item) => {
  if (item.project && !projectNames().includes(E(item.project))) await createProject(item.project);
  const folder = await ensureFolder("30_할일/목록");
  const path = uniquePath(folder.path, E(item.title));
  return app.vault.create(path, makeTaskNote(item));
};

// ── 멀티 토글 suggester (태그 등) ───────────────────────────────────────────
const multiToggle = async (options, placeholder, allowCustom = true) => {
  const picked = new Set();
  const custom = [];
  while (true) {
    const all = [...options, ...custom];
    const labels = ["✅ 완료" + (picked.size ? ` (${picked.size}개 선택)` : ""), ...all.map(o => `${picked.has(o) ? "☑" : "☐"} ${o}`), ...(allowCustom ? ["＋ 직접 입력"] : [])];
    const values = ["__done", ...all, ...(allowCustom ? ["__custom"] : [])];
    const v = await tp.system.suggester(labels, values, false, placeholder);
    if (v == null || v === "__done") break;
    if (v === "__custom") {
      const t = await tp.system.prompt("직접 입력 (쉼표로 여러 개)");
      if (t) for (const x of t.split(/[,，]/).map(s => s.trim()).filter(Boolean)) { if (!all.includes(x)) custom.push(x); picked.add(x); }
      continue;
    }
    if (picked.has(v)) picked.delete(v); else picked.add(v);
  }
  return [...picked];
};
const parseDateText = (text) => {
  const t = String(text ?? "").trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return moment(t, "YYYY-MM-DD", true).isValid() ? t : null;
  if (t === "어제") return moment(today).subtract(1, "day").format("YYYY-MM-DD");
  if (t === "그제" || t === "그저께") return moment(today).subtract(2, "day").format("YYYY-MM-DD");
  try {
    if (tp.user.capture && typeof tp.user.capture.parseDate === "function") {
      const r = tp.user.capture.parseDate(t, today);
      if (r && r.date) return r.date;
    }
  } catch (e) { /* capture.js 없음 */ }
  const m = moment(t, ["YYYY.MM.DD", "YYYY/MM/DD", "M/D", "M.D", "M월 D일"], true);
  return m.isValid() ? m.format("YYYY-MM-DD") : null;
};
const pickProject = async (placeholder = "프로젝트 (없음 가능)") => {
  const names = projectNames();
  const v = await tp.system.suggester(["없음", ...names, "＋ 새 프로젝트"], ["", ...names, "__new"], false, placeholder);
  if (v === "__new") { const n = await tp.system.prompt("새 프로젝트 이름"); return n && n.trim() ? E(n) : null; }
  return v || null;
};
const trashLater = (f) => { if (f) window.setTimeout(() => { try { app.vault.trash(f, true); } catch (e) { console.log(e); } }, 300); };
const openLater = (f) => { if (f) window.setTimeout(() => { try { app.workspace.getLeaf(false).openFile(f); } catch (e) { console.log(e); } }, 350); };

// ── ⚡ 빠른 입력 실행 ────────────────────────────────────────────────────────
const runCapture = async (text) => {
  if (!tp.user.capture) { notice("capture.js 를 찾을 수 없어요 (_System/Scripts/capture.js). 그냥 캡처로 남깁니다."); return false; }
  let parsed;
  try {
    parsed = tp.user.capture({ text, today, projectNames: projectNames(), habitNames: habitNames() });
  } catch (e) { notice(`해석 실패: ${e.message}`); return false; }
  const items = (parsed && parsed.items) || [];
  for (const w of (parsed && parsed.warnings) || []) notice(w);
  if (!items.length) { notice("나눌 항목을 찾지 못했어요. 그냥 캡처로 남깁니다."); return false; }
  const KIND = { task: "✅ 할 일", plan: "🗓️ 계획", habit: "🔁 습관", routine: "🔄 일과", project: "🗂️ 프로젝트" };
  const describe = (it) => {
    const bits = [KIND[it.kind] || it.kind, it.title];
    if (it.kind === "task") { if (it.due) bits.push(`📅 ${it.due}`); if (it.priority && it.priority !== 3) bits.push(PRIORITY_LABELS[it.priority]); if (it.project) bits.push(`#${it.project}`); }
    if (it.kind === "plan") bits.push(`${it.date} ${it.start_time}${it.end_time ? "–" + it.end_time : ""}`);
    if (it.kind === "routine") bits.push(`${(it.weekdays || []).map(d => DOW[d].slice(0, 1)).join("")} ${it.start_time}${it.end_time ? "–" + it.end_time : ""}`);
    if (it.note) bits.push(`(${it.note})`);
    return bits.join(" · ");
  };
  const labels = [`${items.length}개로 나눴어요 · 모두 추가`, ...items.map(describe), "취소"];
  const values = ["__all", ...items.map((_, i) => i), "__cancel"];
  const pick = await tp.system.suggester(labels, values, false, "미리보기 — 모두 추가 / 하나만 고르기 / 취소");
  if (pick == null || pick === "__cancel") return false;
  const chosen = pick === "__all" ? items : [items[pick]];

  let dirty = false;
  if (PUSH_TO_YOUKNOW) {
    try {
      let req = null;
      try { req = window.require ? window.require("obsidian").requestUrl : null; } catch (e) { req = null; }
      const body = JSON.stringify({ text, key: YK_CAPTURE_KEY });
      if (req) await req({ url: YK_CAPTURE_URL, method: "POST", contentType: "application/json", body });
      else await fetch(YK_CAPTURE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    } catch (e) { dirty = true; notice("YouKnow 전송 실패 — 노트에 yk_dirty 를 표시했어요."); }
  }

  const made = [];
  for (const it of chosen) {
    try {
      if (it.kind === "task") { const f = await writeTask({ ...it, dirty }); made.push(f.basename); }
      else if (it.kind === "plan") { const d = it.date || today; const f = await getOrCreateDaily(d); await appendAfterMarker(f, "plans", [planLine(it)], "### 하루 계획"); made.push(`${d} 계획`); }
      else if (it.kind === "habit") { const f = await createHabit(it.title); made.push(`습관 ${f ? f.basename : it.title}`); }
      else if (it.kind === "routine") { for (const d of (it.weekdays && it.weekdays.length ? it.weekdays : [moment(today).day()])) { await routineRow(it, d); made.push(`${DOW[d]} 일과`); } }
      else if (it.kind === "project") { const f = await createProject(it.title); made.push(`프로젝트 ${f ? f.basename : it.title}`); }
    } catch (e) { notice(`"${it.title}" 추가 실패: ${e.message}`); }
  }
  notice(`추가됨: ${made.join(", ") || "없음"}`);
  return true;
};

// ── 메뉴 ────────────────────────────────────────────────────────────────────
const routes = [
  { id: "capture",  label: "⚡ 빠른 입력" },
  { id: "task",     label: "✅ 할 일 (한 개)" },
  { id: "project",  label: "🗂️ 프로젝트",           folder: "40_프로젝트",   tpl: "tpl-project", ask: "프로젝트 이름" },
  { id: "diary",    label: "📔 일기" },
  { id: "plan",     label: "🗓️ 하루 계획 (오늘)" },
  { id: "habit",    label: "🔁 습관",               folder: "60_습관",       tpl: "tpl-habit",   ask: "습관 이름" },
  { id: "book",     label: "📖 독후감 / 책",         folder: "80_문헌/책",     tpl: "tpl-book",    ask: "책 제목" },
  { id: "article",  label: "📰 글 / 영상 / 강의",    folder: "80_문헌/글",     tpl: "tpl-article", ask: "제목" },
  { id: "idea",     label: "💎 영구 노트",           folder: "90_영구",       tpl: "tpl-idea",    ask: "아이디어를 한 문장으로" },
  { id: "person",   label: "👤 사람",               folder: "95_사람",       tpl: "tpl-person",  ask: "이름" },
  { id: "area",     label: "🧭 분야",               folder: "70_분야",       tpl: "tpl-area",    ask: "분야 이름" },
  { id: "resource", label: "📎 자료 (프로젝트에)" },
  { id: "inbox",    label: "📥 그냥 캡처 (Esc)" },
];

let bodyText = "";
try { bodyText = file ? await app.vault.read(file) : ""; } catch (e) { bodyText = ""; }
bodyText = bodyText.replace(new RegExp("<" + "%[\\s\\S]*?%" + ">", "g"), "").trim();   // Advanced URI 로 들어온 Templater 명령 줄은 제외

let choice;
if (isFlash) choice = routes[0];
else choice = await tp.system.suggester(r => r.label, routes, false, "이 노트는 무엇인가요? (Esc = 그냥 캡처)");
const id = choice ? choice.id : "inbox";
let routed = false;

if (id === "capture") {
  let text = bodyText;
  if (isFlash && !text) text = rawTitle.replace(/^⚡\s*/, "").replace(/^\d{4}-\d{2}-\d{2}[ T]?\d{2}[:.]?\d{2}(?:[:.]?\d{2})?\s*/, "");
  if (!isFlash || !text) {
    const seed = [isUntitled ? "" : rawTitle, bodyText].filter(Boolean).join("\n");
    text = await tp.system.prompt("할 일·계획·습관을 막 적어보세요 (여러 줄도 돼요 · 예: 내일 오후 3시 치과 / 매주 월수금 저녁 7시 헬스 / - 9/10까지 영상 편집!!)", seed, false, true);
  }
  if (text && text.trim()) routed = await runCapture(text.trim());
  if (routed) { tR += ""; trashLater(file); }
}
else if (id === "task") {
  const title = isUntitled ? await tp.system.prompt("할 일 제목") : rawTitle;
  if (title && title.trim()) {
    const dueText = await tp.system.prompt("마감 (자연어: 내일 · 다음 주 금요일 · 9/10 · YYYY-MM-DD · 비우면 없음)");
    let due = parseDateText(dueText);
    if (dueText && dueText.trim() && !due) notice(`"${dueText}" 를 날짜로 읽지 못해 마감 없이 만들어요.`);
    const priority = await tp.system.suggester(["🔺 긴급", "⏫ 중요", "보통", "🔽 낮음", "⏬ 언젠가"], [5, 4, 3, 2, 1], false, "우선순위") || 3;
    const project = await pickProject();
    if (project && !projectNames().includes(project)) await createProject(project);
    const note = await tp.system.prompt("세부 메모 (선택)", "", false, true);
    window.__ykTaskDraft = { title: title.trim(), due, priority, project, note: note || "", start: today };
    await ensureFolder("30_할일/목록");
    const path = uniquePath("30_할일/목록", E(title)).replace(/\.md$/, "");
    await tp.file.move(path);
    tR += await tp.file.include("[[tpl-task]]");
    routed = true;
  }
}
else if (id === "project") {
  const name = isUntitled ? await tp.system.prompt("프로젝트 이름") : rawTitle;
  if (name && name.trim()) {
    const safe = E(name);
    await ensureFolder(`40_프로젝트/${safe}`);
    const path = uniquePath(`40_프로젝트/${safe}`, safe).replace(/\.md$/, "");
    await tp.file.move(path);
    tR += await tp.file.include("[[tpl-project]]");
    routed = true;
  }
}
else if (id === "diary") {
  const types = basenames("50_일기/종류");
  const typeList = types.length ? types : ["일반"];
  if (!typeList.includes("일반")) typeList.unshift("일반");
  const dtype = await tp.system.suggester(typeList, typeList, false, "일기 종류") || "일반";
  const dateText = await tp.system.prompt("날짜 (YYYY-MM-DD · 어제 · 비우면 오늘)", today);
  const date = parseDateText(dateText) || today;
  const moods = basenames("50_일기/기분");
  const moodList = moods.length ? moods : ["최고", "좋음", "보통", "별로", "힘듦"];
  const mood = await tp.system.suggester(["없음", ...moodList], ["", ...moodList], false, "기분") || "";
  const tags = await multiToggle(basenames("50_일기/태그"), "태그 (여러 개 선택 → ✅ 완료)");
  const base = dtype === "일반" ? `${date} 일기` : `${date} ${E(dtype)}`;
  const target = `50_일기/${date.slice(0, 4)}/${base}.md`;
  const existing = app.vault.getAbstractFileByPath(target);
  if (existing) {
    notice("이미 그 날짜에 같은 종류의 일기가 있어요 — 그 노트를 엽니다.");
    tR += "";
    trashLater(file);
    openLater(existing);
  } else {
    window.__ykDiaryDraft = { date, type: dtype, mood, tags };
    await ensureFolder(`50_일기/${date.slice(0, 4)}`);
    await tp.file.move(target.replace(/\.md$/, ""));
    tR += await tp.file.include("[[tpl-diary]]");
  }
  routed = true;
}
else if (id === "plan") {
  const title = await tp.system.prompt("계획 제목");
  if (title && title.trim()) {
    const st = await tp.system.prompt("시작 (HH:MM)", moment().add(1, "hour").format("HH:00"));
    const start_time = /^\d{1,2}:\d{2}$/.test(st || "") ? st.padStart(5, "0") : moment().add(1, "hour").format("HH:00");
    const defEnd = moment(start_time, "HH:mm").add(1, "hour").format("HH:mm");
    const en = await tp.system.prompt("끝 (HH:MM · 비우면 없음)", defEnd);
    const end_time = /^\d{1,2}:\d{2}$/.test(en || "") ? en.padStart(5, "0") : "";
    const f = await getOrCreateDaily(today);
    await appendAfterMarker(f, "plans", [planLine({ title: title.trim(), start_time, end_time })], "### 하루 계획");
    notice(`${today} 하루 계획에 추가했어요.`);
    tR += "";
    trashLater(file);
    routed = true;
  }
}
else if (id === "resource") {
  const names = projectNames();
  if (!names.length) {
    notice("프로젝트가 아직 없어요. 먼저 🗂️ 프로젝트를 만들어 주세요.");
  } else {
    const project = await tp.system.suggester(names, names, false, "어느 프로젝트의 자료인가요?");
    if (project) {
      const text = await tp.system.prompt("URL 또는 메모 (첫 줄이 URL이면 링크 자료가 돼요)", bodyText, false, true) || "";
      const m = text.trim().match(/^(https?:\/\/\S+)\s*([\s\S]*)$/);
      const url = m ? m[1] : "";
      const body = (m ? m[2] : text).trim();
      const given = isUntitled ? await tp.system.prompt("제목 (비우면 자동)") : rawTitle;
      let title = given && given.trim() ? E(given) : "";
      if (!title) {
        if (url) { let host = ""; try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) { host = ""; } title = /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host) ? "유튜브 영상" : `${host || "링크"} 글`; }
        else { const first = body.split("\n").find(l => l.trim()); title = first ? E(first.slice(0, 40)) : `메모 ${moment().format("MMDD HHmm")}`; }
      }
      window.__ykResourceDraft = { project, url, body, title };
      const folder = `40_프로젝트/${project}/자료`;
      await ensureFolder(folder);
      await tp.file.move(uniquePath(folder, title).replace(/\.md$/, ""));
      tR += await tp.file.include("[[tpl-resource]]");
      routed = true;
    }
  }
}
else if (choice && choice.folder) {
  // 단순 유형: 폴더로 옮기고 그 유형의 템플릿을 입힌다
  let name = rawTitle;
  if (choice.ask && isUntitled) {
    const asked = await tp.system.prompt(choice.ask);
    if (asked && asked.trim()) name = asked.trim();
  }
  if (!/^(Untitled|제목 없음)/.test(name)) {
    await ensureFolder(choice.folder);
    await tp.file.move(uniquePath(choice.folder, E(name)).replace(/\.md$/, ""));
    tR += await tp.file.include(`[[${choice.tpl}]]`);
    routed = true;
  }
}

if (!routed) {
  tR += `---
type: inbox
daily: "[[${today}]]"
created: ${today}
---
# ${rawTitle}

> [!tip] 자리 찾아주기
> 본문 아무 데나 \`#책\` \`#글\` \`#일기\` \`#영구\` \`#프로젝트\` \`#사람\` \`#분야\` \`#할일\` \`#습관\` \`#굿노트\` 중 하나를 붙이면
> Auto Note Mover가 알맞은 폴더로 옮겨 줍니다. 그 뒤 \`Templater: Insert template\` 로 템플릿을 입히세요.
> 여러 줄을 한 번에 나누려면 Ctrl/Cmd+N → ⚡ 빠른 입력.

${bodyText}
`;
}
-%>
