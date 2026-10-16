<%*
/* 🗓️ 주간 노트 (spec §3-3) = 리뷰 데스크. 일간 노트들을 묶고, Inbox를 비우고, 회고합니다.
   파일명은 ISO 주(GGGG-Www, 월~일) — 캘린더 플러그인 weekStart: monday 유지. 집계는 앱처럼 일~토로 계산합니다(아래 dataviewjs). */
const title = tp.file.title; // 예: 2026-W42
const w = moment(title, "GGGG-[W]WW", true).isValid() ? moment(title, "GGGG-[W]WW") : moment();
const start = w.clone().startOf("isoWeek");
const end   = w.clone().endOf("isoWeek");
const prev  = w.clone().subtract(1, "week").format("GGGG-[W]WW");
const next  = w.clone().add(1, "week").format("GGGG-[W]WW");
const days  = Array.from({ length: 7 }, (_, i) => start.clone().add(i, "day"));
const s = start.format("YYYY-MM-DD"), e = end.format("YYYY-MM-DD");
// 앱 주(일~토): ISO 주 시작(월)의 전날 일요일 ~ 토요일
const appS = start.clone().subtract(1, "day").format("YYYY-MM-DD");
const appE = end.clone().subtract(1, "day").format("YYYY-MM-DD");
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
-%>
---
type: 주간
up: "[[☀️ 오늘]]"
start: <% s %>
end: <% e %>
---
# 🗓️ <% title %> (<% start.format("M/D") %> ~ <% end.format("M/D") %>)
← [[<% prev %>]] · [[<% next %>]] → · [[☀️ 오늘]]

## 이번 주 하루들
<% days.map(d => `- [[${d.format("YYYY-MM-DD")}]] (${DOW[d.day()]})`).join("\n") %>

## 🗓️ 하루 계획 완료율 (앱 주: <% appS %> 일 ~ <% appE %> 토)
```dataviewjs
const from = dv.date("<% appS %>"), to = dv.date("<% appE %>");
const pages = dv.pages('"10_오늘"').where(p => p.type === "오늘" && p.date && p.date >= from && p.date <= to);
let plans = 0, done = 0, habits = 0;
const rows = [];
for (const p of pages.sort(p => p.date)) {
  const a = Number(p.plans || 0), b = Number(p.plans_done || 0);
  plans += a; done += b; habits += Number(p.habits_checked || 0);
  rows.push([p.file.link, b + "/" + a, Number(p.habits_checked || 0)]);
}
dv.paragraph("**" + (plans ? Math.round(done / plans * 100) : 0) + "%** — 계획 " + done + "/" + plans + " 완료 · 습관 체크 " + habits + "회 · 일간 노트 " + pages.length + "/7");
if (rows.length) dv.table(["날", "계획", "습관"], rows);
```

## ✅ 이번 주 마감
```dataview
TABLE WITHOUT ID file.link AS "할 일", status AS "상태", priority_label AS "우선순위", due AS "마감", project AS "프로젝트"
FROM "30_할일/목록"
WHERE due >= date(<% appS %>) AND due <= date(<% appE %>) AND !yk_deleted AND !yk_missing
SORT due ASC, priority DESC
```

## 📔 이번 주 기분
```dataviewjs
const from = dv.date("<% appS %>"), to = dv.date("<% appE %>");
const logs = dv.pages('"50_일기"').where(p => p.type === "일기" && p.date && !p.yk_deleted && p.date >= from && p.date <= to).sort(p => p.date);
const scored = logs.where(p => typeof p.mood_score === "number");
const avg = scored.length ? (scored.array().reduce((a, p) => a + p.mood_score, 0) / scored.length).toFixed(1) : "–";
dv.paragraph("일기 " + logs.length + "개 · 평균 기분 **" + avg + "**/5 (최고5 좋음4 보통3 별로2 힘듦1)");
if (logs.length) dv.table(["일기", "날짜", "기분", "점수", "태그"], logs.map(p => [p.file.link, p.date.toFormat("MM-dd (ccc)"), p.mood ?? "", p.mood_score ?? "", p.tags ?? ""]));
```

## 📥 Inbox 비우기 (0이 목표)
```dataview
TABLE WITHOUT ID file.link AS "노트", file.tags AS "태그", file.cday AS "생성"
FROM "00_Inbox"
WHERE type != "허브"
SORT file.cday ASC
```

## ✅ 이번 주 끝낸 일 (앱 주: <% appS %> 일 ~ <% appE %> 토)
```tasks
done after <% moment(appS).subtract(1, "day").format("YYYY-MM-DD") %>
done before <% moment(appE).add(1, "day").format("YYYY-MM-DD") %>
short mode
```
> 할 일 노트의 ✅ 완료일은 앱에 완료 시각이 없어 **마감일로 간주**한 근사치입니다 ([[✅ 할 일]] 참고).

## 🧠 이번 주 생긴 뉴런
```dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형", file.cday AS "날짜"
FROM -"_System" AND -"10_오늘"
WHERE file.cday >= date(<% s %>) AND file.cday <= date(<% e %>)
SORT type ASC, file.cday ASC
```

## 회고
### 잘한 것
- 

### 아쉬운 것
- 

### 다음 주, 딱 하나만 바꾼다면
- 

### 연결 안 된 뉴런 이어주기
> [[🩺 Health]] 대시보드에서 고아 노트를 확인하고 최소 하나씩 링크를 걸어 주세요.
