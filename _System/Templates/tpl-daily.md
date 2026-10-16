<%*
/* ☀️ 일간 노트 = 시냅스. YouKnow Today 화면 순서(일정 → 할 일 → 습관 → 일기 → 메모)를 그대로 따릅니다.
   이 골격(헤더 순서·%% yk:* %% 블록)은 _System/Scripts/import_youknow.py 가 똑같이 만들고 그 안만 다시 씁니다.
   마커 밖(## 📝 메모, 마커 없는 계획 줄 등)은 사용자 소유라 importer가 건드리지 않습니다. */
const file = tp.config.target_file;
const M = (name, side) => `%% yk:${name}:${side} %%`;           // 마커 문자열(템플릿 원문에 그대로 안 보이게 조립)
let existing = "";
try { existing = file ? await app.vault.read(file) : ""; } catch (e) { existing = ""; }
// 이미 완성된 일간 노트에 다시 적용되면(덮어쓰기 경로) 아무것도 끼워 넣지 않는다.
if (existing.includes(M("plans", "start")) && !existing.includes("<" + "%*")) {
  tR += "";
} else {
  const title = tp.file.title;
  const d = moment(title, "YYYY-MM-DD", true).isValid() ? moment(title, "YYYY-MM-DD") : moment();
  const date = d.format("YYYY-MM-DD");
  const prev = d.clone().subtract(1, "day").format("YYYY-MM-DD");
  const next = d.clone().add(1, "day").format("YYYY-MM-DD");
  const week = d.format("GGGG-[W]WW");
  const dowShort = ["일", "월", "화", "수", "목", "금", "토"][d.day()];
  const weekday = dowShort + "요일";

  // 🗓️ Google Calendar → ICS 플러그인이 있으면 그날 일정을 자동 삽입 (기존 코드 유지)
  let events = "- _(ICS 플러그인을 설치하고 Google Calendar의 비공개 iCal 주소를 등록하면 여기에 일정이 자동으로 들어옵니다. → [[🔌 연동]])_";
  try {
    const ics = app.plugins.getPlugin("ics");
    if (ics) {
      const list = await ics.getEvents(d);
      events = list.length
        ? list.sort((a, b) => a.utime - b.utime)
              .map(e => `- ${e.time} **${e.summary}**${e.location ? " @ " + e.location : ""}`)
              .join("\n")
        : "- 일정 없음";
    }
  } catch (e) {
    events = `- _(일정 불러오기 실패: ${e.message})_`;
  }

  const F = "```";
  const out = `---
type: 오늘
date: ${date}
week: "[[${week}]]"
weekday: "[[${weekday}]]"
prev: "[[${prev}]]"
next: "[[${next}]]"
plans: 0
plans_done: 0
habits_checked: 0
---
# ☀️ ${date} (${dowShort})
← [[${prev}]] · [[${next}]] → · 이번 주 [[${week}]] · [[${weekday}]]

## 🗓️ 오늘 일정
### 하루 계획
${M("plans", "start")}
${M("plans", "end")}
### 캘린더
${events}
### 일과
![[${weekday}#일과표]]

## ✅ 오늘 할 일
### 지난 마감
${F}dataview
TABLE WITHOUT ID file.link AS "할 일", priority_label AS "우선순위", due AS "마감", project AS "프로젝트"
FROM "30_할일/목록"
WHERE due < date(${date}) AND status != "완료" AND status != "달성 못함"
SORT due ASC, priority DESC
${F}
### 오늘 마감
${F}dataview
TABLE WITHOUT ID file.link AS "할 일", status AS "상태", priority_label AS "우선순위", project AS "프로젝트"
FROM "30_할일/목록"
WHERE due = date(${date})
SORT status ASC, priority DESC
${F}
${F}tasks
not done
due on ${date}
hide backlink
short mode
${F}
### 달성 못함
${F}dataview
TABLE WITHOUT ID file.link AS "할 일", priority_label AS "우선순위", project AS "프로젝트"
FROM "30_할일/목록"
WHERE due = date(${date}) AND status = "달성 못함"
SORT priority DESC
${F}
- [ ] 

## 🔁 습관
${M("habits", "start")}
${M("habits", "end")}

## 📔 오늘 일기
${F}dataview
LIST FROM "50_일기" WHERE date = date(${date})
${F}
· [[📔 일기|오늘 일기 쓰기 →]]

## 📝 메모
- 

## 🧠 오늘 생긴 뉴런
${F}dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형"
FROM -"_System" AND -"10_오늘"
WHERE contains(string(daily), "${date}") OR file.cday = date(${date})
SORT file.ctime ASC
${F}
`;
  tR += out;
}
-%>
