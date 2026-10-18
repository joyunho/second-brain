<%*
/* ✅ 할 일 노트 (spec §3-6) — 30_할일/목록/<제목>.md
   라우터(tpl-inbox ✅ 할 일 (한 개))가 window.__ykTaskDraft 에 답을 넣어 두면 질문 없이 그 값을 씁니다.
   볼트에서 먼저 만든 할 일은 🆔 가 없고 yk_pending: true 로 표시되어 야간 import_youknow.py 가 앱 행과 맞춰 yk_id 를 채웁니다. */
const draft = window.__ykTaskDraft || null;
if (draft) delete window.__ykTaskDraft;
const today = tp.date.now("YYYY-MM-DD");
const E = (s) => { const t = String(s ?? "").replace(/[\\/:*?"<>|#^\[\]]/g, " ").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, "").replace(/\s+/g, " ").trim().replace(/^[. ]+|[. ]+$/g, ""); return (["Brain","Inbox","오늘","일정","할 일","Task Inbox","프로젝트","일기","습관","분야","문헌","영구 노트","사람","연동","Health"].includes(t) ? t + " (노트)" : t) || "이름 없음"; };   // 앞뒤 점 제거: 점으로 시작하는 파일은 Obsidian 이 숨긴다
const q = (s) => `"${String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const PRIORITY_LABELS = (tp.user.capture && tp.user.capture.PRIORITY_LABELS) || { 5: "긴급", 4: "중요", 3: "보통", 2: "낮음", 1: "언젠가" };
const PRIORITY_MARK = { 5: "🔺", 4: "⏫", 3: "", 2: "🔽", 1: "⏬" };
const parseDateText = (text) => {
  const t = String(text ?? "").trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return moment(t, "YYYY-MM-DD", true).isValid() ? t : null;
  try {
    if (tp.user.capture && typeof tp.user.capture.parseDate === "function") {
      const r = tp.user.capture.parseDate(t, today);
      if (r && r.date) return r.date;
    }
  } catch (e) { /* capture.js 없음 */ }
  const m = moment(t, ["YYYY.MM.DD", "YYYY/MM/DD", "M/D", "M.D", "M월 D일"], true);
  return m.isValid() ? m.format("YYYY-MM-DD") : null;
};
const safeRename = async (base) => {   // 같은 폴더에 같은 이름이 있으면 " (2)", " (3)" — rename 실패로 템플릿이 멈추지 않게
  let dir = tp.file.folder(true); if (dir === "/") dir = "";
  let n = 1, t = base;
  while (app.vault.getAbstractFileByPath(`${dir ? dir + "/" : ""}${t}.md`)) { n += 1; t = `${base} (${n})`; }
  await tp.file.rename(t); return t;
};
const projectNames = () => {
  const root = app.vault.getAbstractFileByPath("40_프로젝트");
  if (!root || !root.children) return [];
  return root.children.filter(c => c.children && app.vault.getAbstractFileByPath(`${c.path}/${c.name}.md`)).map(c => c.name).sort((a, b) => a.localeCompare(b, "ko"));
};

let title = draft && draft.title ? draft.title : tp.file.title;
if (!draft && /^(Untitled|제목 없음)/.test(title)) {
  const asked = await tp.system.prompt("할 일 제목");
  if (asked && asked.trim()) { title = asked.trim(); await safeRename(E(title)); }
}
let due = draft ? (draft.due || null) : null;
let priority = draft ? (Number(draft.priority) || 3) : 3;
let project = draft ? (draft.project || null) : null;
let note = draft ? (draft.note || "") : "";
const start = (draft && draft.start) || today;
if (!draft) {
  const dueText = await tp.system.prompt("마감 (자연어: 내일 · 다음 주 금요일 · 9/10 · YYYY-MM-DD · 비우면 없음)");
  due = parseDateText(dueText);
  priority = await tp.system.suggester(["🔺 긴급", "⏫ 중요", "보통", "🔽 낮음", "⏬ 언젠가"], [5, 4, 3, 2, 1], false, "우선순위") || 3;
  const names = projectNames();
  project = await tp.system.suggester(["없음", ...names], ["", ...names], false, "프로젝트 (없음 가능)") || null;
}
const label = PRIORITY_LABELS[priority] || "보통";
const mark = PRIORITY_MARK[priority] || "";
let line = `- [ ] ${title}`;
if (mark) line += ` ${mark}`;
line += ` 🛫 ${start}`;
if (due) line += ` 📅 ${due}`;
const gBase = (due || start).replace(/-/g, "");
const gNext = moment(due || start, "YYYY-MM-DD").add(1, "day").format("YYYYMMDD");
const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${gBase}/${gNext}&details=YouKnow%20Meta%20data%20%ED%95%A0%20%EC%9D%BC`;
const fm = [
  "---",
  "type: 할일",
  `title: ${q(title)}`,
  "status: 진행 전",
  `priority: ${priority}`,
  `priority_label: ${label}`,
  `start: ${start}`,
  ...(due ? [`due: ${due}`] : []),
  `daily: "[[${start}]]"`,
  ...(due ? [`마감: "[[${due}]]"`] : []),
  ...(project ? [`project: "[[${E(project)}]]"`] : []),
  `created: ${today}`,
  "yk_pending: true",
  "---",
].join("\n");
tR += `${fm}
# ✅ ${title}
%% yk:task:start %%
${line}
%% yk:task:end %%
🗓️ [구글 캘린더에 추가](${gcal})

## 세부 메모
%% yk:note:start %%
${note ? note + "\n" : ""}%% yk:note:end %%

## 연결
- 

---
\`status\`: 진행 전 → 진행 중 → 완료 · 달성 못함 (평문, 체크박스 \`[ ] [/] [x] [-]\` 와 함께 바꿔 주세요) · \`priority\`: 5 긴급 🔺 · 4 중요 ⏫ · 3 보통 · 2 낮음 🔽 · 1 언젠가 ⏬
`;
-%>
