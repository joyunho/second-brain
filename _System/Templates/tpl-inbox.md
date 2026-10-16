<%*
/* 🚦 Inbox 라우터
   Ctrl/Cmd+N 으로 새 노트를 만들면 (기본 위치 = 00_Inbox) 이 템플릿이 자동 실행됩니다.
   "이 노트는 무엇인가요?" 를 물은 뒤 알맞은 폴더로 옮기고 그 유형의 템플릿을 적용합니다.
   Esc 를 누르면 그냥 Inbox 캡처 노트로 남습니다 (나중에 #book 같은 태그만 붙이면 Auto Note Mover가 이동). */
const routes = [
  { label: "📖 독후감 / 책",              folder: "40_Library/Books",    tpl: "tpl-book",    ask: "책 제목" },
  { label: "📰 아티클 / 영상 / 강의",     folder: "40_Library/Articles", tpl: "tpl-article", ask: "제목" },
  { label: "📓 일기",                     folder: "20_Journal",          tpl: "tpl-journal", ask: null },
  { label: "💡 아이디어 / 생각",          folder: "50_Ideas",            tpl: "tpl-idea",    ask: "아이디어를 한 문장으로" },
  { label: "🎯 프로젝트",                 folder: "30_Tasks/Projects",   tpl: "tpl-project", ask: "프로젝트 이름" },
  { label: "👤 사람",                     folder: "70_People",           tpl: "tpl-person",  ask: "이름" },
  { label: "🧭 삶의 영역",                folder: "60_Areas",            tpl: "tpl-area",    ask: "영역 이름" },
  { label: "📥 그냥 캡처 (Inbox에 두기)", folder: null,                  tpl: null,          ask: null },
];
const choice = await tp.system.suggester(r => r.label, routes, false, "이 노트는 무엇인가요? (Esc = 그냥 캡처)");
const today = tp.date.now("YYYY-MM-DD");
const isUntitled = /^(Untitled|제목 없음)/.test(tp.file.title);

if (choice && choice.folder) {
  let name = tp.file.title;
  if (choice.tpl === "tpl-journal") {
    name = `${today} 일기`;
  } else if (choice.ask && isUntitled) {
    const asked = await tp.system.prompt(choice.ask);
    if (asked && asked.trim()) name = asked.trim();
  }
  // 파일명에 쓸 수 없는 문자 제거
  name = name.replace(/[\\/:*?"<>|#^\[\]]/g, "").trim() || tp.file.title;
  try {
    await tp.file.move(`${choice.folder}/${name}`);
  } catch (e) {
    // 같은 이름이 이미 있으면 시간을 붙여서 이동
    await tp.file.move(`${choice.folder}/${name} ${tp.date.now("HHmm")}`);
  }
  tR += await tp.file.include(`[[${choice.tpl}]]`);
} else {
  tR += `---
type: inbox
tags: [inbox]
up: "[[📥 Inbox]]"
daily: "[[${today}]]"
created: ${today}
---
# ${tp.file.title}

> [!tip] 자리 찾아주기
> 본문 아무 데나 \`#book\` \`#article\` \`#journal\` \`#idea\` \`#project\` \`#person\` \`#area\` 중 하나를 붙이면
> Auto Note Mover가 알맞은 폴더로 옮겨 줍니다. 그 뒤 \`Templater: Insert template\`로 템플릿을 입히세요.

`;
}
-%>
