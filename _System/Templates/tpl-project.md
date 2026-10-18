<%*
/* 🗂️ 프로젝트 노트 (spec §3-7) — 40_프로젝트/<이름>/<이름>.md (폴더 노트)
   ⚠️ 자료 폴더 가드: Templater 폴더 템플릿은 가장 깊게 일치하는 폴더(40_프로젝트)를 적용하므로
   40_프로젝트/<이름>/자료/ 에 만든 노트도 이 템플릿을 받습니다. 첫 줄에서 tpl-resource 로 넘깁니다. */
const folder0 = tp.file.folder(true);
if (/\/자료$/.test(folder0)) {
  tR += await tp.file.include("[[tpl-resource]]");
} else {
  const draft = window.__ykProjectDraft || null;      // 라우터 ⚡ 빠른 입력이 만들 때: 질문 없이 기본값
  if (draft) delete window.__ykProjectDraft;
  const today = tp.date.now("YYYY-MM-DD");
  const E = (s) => { const t = String(s ?? "").replace(/[\\/:*?"<>|#^\[\]]/g, " ").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, "").replace(/\s+/g, " ").trim().replace(/^[. ]+|[. ]+$/g, ""); return (["Brain","Inbox","오늘","일정","할 일","Task Inbox","프로젝트","일기","습관","분야","문헌","영구 노트","사람","연동","Health"].includes(t) ? t + " (노트)" : t) || "이름 없음"; };   // 앞뒤 점 제거: 점으로 시작하는 파일은 Obsidian 이 숨긴다
  const q = (s) => `"${String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const aZ = (area, name) => { const a = `${area || ""} ${name}`;
    return /(건강|운동|헬스|몸)/.test(a) ? "💪" : /(유튜브|영상|채널)/.test(a) ? "🎬" : /(게임|에임|랭크)/.test(a) ? "🎮"
      : /(스타일|패션|미용|헤어|옷)/.test(a) ? "💇" : /(공부|학교|시험|영어|독서)/.test(a) ? "📚" : /(돈|재테크|주식|저축|소비)/.test(a) ? "💰"
      : /(생활|집|방|정리)/.test(a) ? "🏠" : "📁"; };
  const isHub = (c) => { try { const fc = app.metadataCache.getFileCache(c); return !!(fc && fc.frontmatter && fc.frontmatter.type === "허브"); } catch (e) { return false; } };
  const basenames = (p) => { const f = app.vault.getAbstractFileByPath(p); return f && f.children ? f.children.filter(c => c.extension === "md" && !isHub(c) && !/^🧭/.test(c.basename)).map(c => c.basename).sort((a, b) => a.localeCompare(b, "ko")) : []; };
  const ensureFolder = async (path) => { let cur = ""; for (const p of path.split("/").filter(Boolean)) { cur = cur ? `${cur}/${p}` : p; if (!app.vault.getAbstractFileByPath(cur)) { try { await app.vault.createFolder(cur); } catch (e) {} } } };

  let name = draft && draft.name ? draft.name : tp.file.title;
  if (!draft && /^(Untitled|제목 없음)/.test(name)) {
    const asked = await tp.system.prompt("프로젝트 이름");
    if (asked && asked.trim()) name = E(asked);
  }
  name = E(name);
  // 40_프로젝트 루트(또는 다른 폴더 이름)에 만들어졌으면 자기 폴더 안으로 옮긴다: 40_프로젝트/<이름>/<이름>.md
  const parentName = folder0.split("/").pop();
  if (folder0 === "40_프로젝트" || (/^40_프로젝트\//.test(folder0) && parentName !== name && tp.file.title !== name)) {
    await ensureFolder(`40_프로젝트/${name}`);
    let dest = `40_프로젝트/${name}/${name}`, n = 1;
    while (app.vault.getAbstractFileByPath(`${dest}.md`) && app.vault.getAbstractFileByPath(`${dest}.md`) !== tp.config.target_file) { n += 1; dest = `40_프로젝트/${name}/${name} (${n})`; }
    await tp.file.move(dest);
  } else if (tp.file.title !== name) {
    await tp.file.rename(name);
  }

  let status = "진행 중", area = "개인", due = null, goal = "", nextAction = "";
  if (!draft) {
    status = await tp.system.suggester(["진행 중", "계획", "보류", "완료"], ["진행 중", "계획", "보류", "완료"], false, "상태") || "진행 중";
    const areas = basenames("70_분야");
    const areaList = areas.includes("개인") ? areas : ["개인", ...areas];
    area = await tp.system.suggester(areaList, areaList, false, "분야 (기본 개인)") || "개인";
    const dueText = await tp.system.prompt("마감 (YYYY-MM-DD · 비우면 없음)");
    if (dueText && moment(dueText.trim(), "YYYY-MM-DD", true).isValid()) due = dueText.trim();
    else if (dueText && dueText.trim()) { try { const r = tp.user.capture && tp.user.capture.parseDate ? tp.user.capture.parseDate(dueText.trim(), today) : null; if (r && r.date) due = r.date; } catch (e) {} }
    goal = (await tp.system.prompt("목표 — 끝난 상태를 한 문장으로 (선택)")) || "";
    nextAction = (await tp.system.prompt("다음 행동 (선택)")) || "";
  }
  if (status === "보류") due = null;   // 앱 규칙: 보류면 마감 비움
  const emoji = aZ(area, name);
  const F = "```";
  tR += `---
type: 프로젝트
up: "[[프로젝트]]"
status: ${status}
area: "[[${area}]]"
emoji: ${emoji}
start: ${today}
${due ? `due: ${due}\n` : ""}daily: "[[${today}]]"
${due ? `마감: "[[${due}]]"\n` : ""}goal: ${q(goal)}
next_action: ${q(nextAction)}
created: ${today}
---
# ${emoji} ${name}
> ${goal}
**다음 행동**: ${nextAction}

## 체크리스트
%% yk:checklist:start %%
- [ ] 
%% yk:checklist:end %%

## 할 일
${F}dataview
TABLE WITHOUT ID file.link AS "할 일", status AS "상태", priority_label AS "우선순위", due AS "마감"
FROM "30_할일/목록"
WHERE project = link(this.file.name) AND !yk_deleted AND !yk_missing
SORT status ASC, priority DESC
${F}

## 자료
${F}dataview
TABLE WITHOUT ID file.link AS "자료", kind AS "종류", updated AS "갱신"
FROM "40_프로젝트/${name}/자료"
SORT sort_order ASC, created DESC
${F}
### 메모 (예전 자료)
%% yk:resources_legacy:start %%
%% yk:resources_legacy:end %%

## 진행
${F}dataviewjs
// (체크 완료 + 할 일 완료) / (체크 전체 + 할 일 − 달성 못함) · 계획 X% 대비 실제 Y% (앱 aL 규칙: 차이 ≥ −10 순항, ≥ −30 주의, 그 외 지연)
const cur = dv.current();
const f = app.vault.getAbstractFileByPath(cur.file.path);
const txt = await app.vault.cachedRead(f);
const m = txt.match(new RegExp("%% yk:" + "checklist:start %%([^]*?)%% yk:" + "checklist:end %%"));
const body = m ? m[1] : txt;
const chk = body.split("\\n").filter(l => /^\\s*- \\[[ xX\\/-]\\]\\s*\\S/.test(l));
const chkDone = chk.filter(l => /^\\s*- \\[[xX]\\]/.test(l)).length;
const linkName = v => !v ? "" : (v.path ? String(v.path) : String(v).replace(/^\\[\\[|\\]\\]$/g, "").split("|")[0]).split("/").pop().replace(/\\.md$/, "");
const tasks = dv.pages('"30_할일/목록"').where(p => linkName(p.project) === cur.file.name && !p.yk_deleted && !p.yk_missing);
const tAll = tasks.where(p => p.status !== "달성 못함").length;
const tDone = tasks.where(p => p.status === "완료").length;
const total = chk.length + tAll, done = chkDone + tDone;
const pct = total ? Math.round(done / total * 100) : 0;
let pace = "";
if (cur.start && cur.due) {
  const span = Math.max(1, cur.due.diff(cur.start, "days").days);
  const gone = Math.max(0, dv.date("today").diff(cur.start, "days").days);
  const expected = Math.max(0, Math.min(100, Math.round(gone / span * 100)));
  const diff = pct - expected;
  pace = " · 계획 " + expected + "% → " + (diff >= -10 ? "🟢 순항" : diff >= -30 ? "🟡 주의" : "🔴 지연");
  const left = Math.round(cur.due.diff(dv.date("today"), "days").days);
  pace += " · 마감까지 " + (left >= 0 ? "D-" + left : "D+" + (-left));
}
dv.paragraph("**" + pct + "%** (" + done + "/" + total + ") — 체크 " + chkDone + "/" + chk.length + " · 할 일 " + tDone + "/" + tAll + pace);
dv.paragraph("█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5)));
${F}

## 연결
- [[${area}]]
`;
}
-%>
