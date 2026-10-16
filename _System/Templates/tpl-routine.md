<%*
/* 🗓️ 요일 일과 노트 (spec §3-10) — 20_일정/일과/<요일>요일.md (7개 고정)
   일과표 행은 importer가 %% yk:routines %% 블록 안에, 라우터가 블록 뒤에(마커 없음 = Obsidian 소유) 씁니다. */
const DOW = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
let name = tp.file.title;
let label = name;
if (!DOW.includes(name)) {
  const picked = await tp.system.suggester(DOW, DOW, false, "어느 요일의 일과인가요?");
  if (picked) {
    name = picked; label = picked;
    let dir = tp.file.folder(true); if (dir === "/") dir = "";
    if (app.vault.getAbstractFileByPath(`${dir ? dir + "/" : ""}${picked}.md`)) {   // 요일 노트는 7개 고정 — 이미 있으면 " (2)"로 두고 알림
      let n = 2; while (app.vault.getAbstractFileByPath(`${dir ? dir + "/" : ""}${picked} (${n}).md`)) n += 1;
      label = `${picked} (${n})`; new Notice(`${picked} 일과 노트가 이미 있어요. 이 노트는 "${label}"로 둡니다 — 기존 노트에 합쳐 주세요.`);
    }
    await tp.file.rename(label);
  }
}
const weekday = Math.max(0, DOW.indexOf(name));
const F = "```";
tR += `---
type: 일과
up: "[[🗓️ 일정]]"
weekday: ${weekday}
---
# ${name} 일과

## 일과표
%% yk:routines:start %%
| 시작 | 끝 | 일과 | 색 | |
| --- | --- | --- | --- | --- |
%% yk:routines:end %%

## 이 요일의 하루들
${F}dataview
LIST FROM "10_오늘" WHERE contains(string(weekday), "${name}") SORT date DESC LIMIT 12
${F}

## 메모
- 
`;
-%>
