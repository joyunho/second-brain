<%*
/* 📎 자료 노트 (spec §3-8) — 40_프로젝트/<프로젝트>/자료/<제목>.md
   tpl-project 의 "자료 폴더 가드"가, 라우터(📎 자료)가 window.__ykResourceDraft 를 넣어 이 템플릿을 부릅니다. */
const draft = window.__ykResourceDraft || null;
if (draft) delete window.__ykResourceDraft;
const today = tp.date.now("YYYY-MM-DD");
const E = (s) => { const t = String(s ?? "").replace(/[\\/:*?"<>|#^\[\]]/g, " ").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, "").replace(/\s+/g, " ").trim().replace(/^[. ]+|[. ]+$/g, ""); return (["Brain","Inbox","오늘","일정","할 일","Task Inbox","프로젝트","일기","습관","분야","문헌","영구 노트","사람","연동","Health"].includes(t) ? t + " (노트)" : t) || "이름 없음"; };   // 앞뒤 점 제거: 점으로 시작하는 파일은 Obsidian 이 숨긴다
const safeRename = async (base) => {   // 같은 폴더에 같은 이름이 있으면 " (2)", " (3)" — rename 실패로 템플릿이 멈추지 않게
  let dir = tp.file.folder(true); if (dir === "/") dir = "";
  let n = 1, t = base;
  while (app.vault.getAbstractFileByPath(`${dir ? dir + "/" : ""}${t}.md`)) { n += 1; t = `${base} (${n})`; }
  await tp.file.rename(t); return t;
};
const folder = tp.file.folder(true);                       // 40_프로젝트/<name>/자료
const m = folder.match(/^40_프로젝트\/([^/]+)\/자료$/);
let project = draft && draft.project ? draft.project : (m ? m[1] : "");
let url = draft ? (draft.url || "") : "";
let body = draft ? (draft.body || "") : "";
let title = draft && draft.title ? draft.title : tp.file.title;
if (!draft) {
  const text = await tp.system.prompt("URL 또는 메모 (첫 줄이 URL이면 링크 자료가 돼요)", "", false, true) || "";
  const mm = text.trim().match(/^(https?:\/\/\S+)\s*([\s\S]*)$/);
  url = mm ? mm[1] : "";
  body = (mm ? mm[2] : text).trim();
  if (/^(Untitled|제목 없음)/.test(title)) {
    const given = await tp.system.prompt("제목 (비우면 자동)");
    if (given && given.trim()) title = E(given);
    else if (url) { let host = ""; try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) { host = ""; } title = /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host) ? "유튜브 영상" : `${host || "링크"} 글`; }
    else { const first = body.split("\n").find(l => l.trim()); title = first ? E(first.slice(0, 40)) : `메모 ${moment().format("MMDD HHmm")}`; }
    title = await safeRename(title);
  }
}
// 앱 규칙: 새 자료는 맨 위 → sort_order = min(0, 가장 낮은 값) − 10
let minOrder = 0;
try {
  const dir = app.vault.getAbstractFileByPath(folder);
  for (const c of (dir && dir.children) || []) {
    if (c.extension !== "md" || c.path === tp.config.target_file.path) continue;
    const fmc = app.metadataCache.getFileCache(c);
    const so = fmc && fmc.frontmatter ? Number(fmc.frontmatter.sort_order) : NaN;
    if (!Number.isNaN(so)) minOrder = Math.min(minOrder, so);
  }
} catch (e) { /* 무시 */ }
const sortOrder = minOrder - 10;
tR += `---
type: 자료
${project ? `project: "[[${project}]]"\n` : ""}${url ? `url: ${url}\n` : ""}kind: ${url ? "링크" : "메모"}
sort_order: ${sortOrder}
daily: "[[${today}]]"
updated: ${today}
created: ${today}
---
# ${title}
${url ? `🔗 ${url}\n` : ""}%% yk:body:start %%
${body}
%% yk:body:end %%

## 내 생각
- 

## 여기서 나온 영구 노트
- 

## 연결
- ${project ? `[[${project}]]` : ""}
`;
-%>
