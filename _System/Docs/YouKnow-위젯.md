---
type: 문서
tags: []
---
# 📱 YouKnow 홈 화면 위젯 (Scriptable) — 한눈에 보이는 배치

> 앱이 주는 위젯 스크립트는 큰 위젯에서도 중간 배치를 그대로 써서 항목이 적은 날엔 아래가 텅 빕니다.
> 아래 스크립트는 **큰 위젯 전용 배치**입니다: 날짜·연속일 → 진행 막대 2개(할 일·계획) → "지금/다음" 카드 → 할 일 | 타임라인 → 습관 칩 + 기준 시각.
> 같은 스크립트가 중간·작은 크기에서도 알맞게 줄어듭니다.

## 설치 (휴대폰에서 2분)
1. 아래 코드 블록 오른쪽 위 **복사** 버튼 (읽기 모드에서 보입니다)
2. **Scriptable** 앱 → 기존 `YouKnow` 스크립트를 열어 내용을 전부 지우고 **붙여넣기** (없으면 `+` 로 새로 만들고 이름 `YouKnow`)
3. 홈 화면 위젯을 길게 눌러 **위젯 편집** → Script = `YouKnow` 확인. 크기는 **큰 위젯**을 권장
4. 15분 안에 새로 그려집니다. 바로 보고 싶으면 Scriptable 에서 ▶ 실행하면 미리보기가 뜹니다

- 서버에 `WIDGET_KEY`를 정했다면 위젯 편집의 **Parameter** 칸에 같은 값을 넣습니다. 안 정했으면 비워 둡니다.
- 위젯은 **읽기 전용**입니다(탭하면 Safari에서 오늘 화면). 입력은 YouKnow 앱·Siri 단축어·옵시디언 ⚡로.
- 데이터 출처: `{앱}/api/widget` (할 일·계획·일과·습관·일정·일기 연속일). 볼트가 아니라 앱을 봅니다.

## 스크립트
```javascript
// YouKnow Meta data — 아이폰 홈 화면 위젯 v2 (Scriptable용, 큰 위젯 배치 개선판)
// 설치: Scriptable 앱 → + → 이 내용 붙여넣기 → 이름 "YouKnow" → 완료
//       홈 화면 길게 누르기 → 편집 → + → Scriptable → 크기 선택 → 추가 → 위젯 길게 누르기 → 위젯 편집 → Script = YouKnow
// Parameter 칸: 서버에 WIDGET_KEY 를 정했을 때만 그 값. (안 정했으면 비워둠)
// 탭하면 Safari 에서 오늘 화면이 열립니다.

const BASE = "https://youknow-meta-data-weom.vercel.app";
const KEY = (args.widgetParameter || "").trim();
const FAMILY = config.widgetFamily || "large";

const C = {
  bg: new Color("#191919"), card: new Color("#262626"), bar: new Color("#2f2f2f"),
  ink: new Color("#e9e9e7"), soft: new Color("#a8a8a5"), faint: new Color("#73736f"),
  accent: new Color("#a78bfa"), green: new Color("#34d399"), red: new Color("#f87171"),
  amber: new Color("#f59e0b"), sky: new Color("#38bdf8"), off: new Color("#3a3a3a"),
};
function safeColor(hex, fallback) { try { if (typeof hex === "string" && /^#[0-9a-fA-F]{6}$/.test(hex)) return new Color(hex); } catch (e) {} return fallback; }
function label(parent, str, size, color, weight) {
  const t = parent.addText(String(str));
  t.font = weight === "bold" ? Font.boldSystemFont(size) : weight === "semibold" ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  t.textColor = color; t.lineLimit = 1; return t;
}
function row(parent, spacing) { const s = parent.addStack(); s.layoutHorizontally(); s.centerAlignContent(); if (spacing !== undefined) s.spacing = spacing; return s; }
function dot(parent, color, size) { const s = parent.addStack(); s.size = new Size(size, size); s.cornerRadius = size / 2; s.backgroundColor = color; return s; }
function bar(parent, ratio, color, width, height) {
  // 진행 막대: 바탕 위에 채운 막대. (Scriptable 은 상대 폭이 없어 고정 폭으로 그림)
  const outer = parent.addStack(); outer.size = new Size(width, height); outer.cornerRadius = height / 2; outer.backgroundColor = C.bar;
  const fillW = Math.max(0, Math.min(width, Math.round(width * ratio)));
  if (fillW > 0) { const f = outer.addStack(); f.size = new Size(fillW, height); f.cornerRadius = height / 2; f.backgroundColor = color; }
  outer.addSpacer();
}
function hm(d) { return (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes(); }

async function load() {
  const req = new Request(BASE + "/api/widget" + (KEY ? "?key=" + encodeURIComponent(KEY) : ""));
  req.timeoutInterval = 20;
  return await req.loadJSON();
}

let data = null, loadError = "";
try { data = await load(); if (!data || data.error) loadError = data && (data.hint || data.error) ? String(data.hint || data.error) : "빈 응답"; }
catch (e) { loadError = String(e && e.message ? e.message : e); }

const w = new ListWidget();
w.backgroundColor = C.bg;
w.url = BASE + "/#/today";
w.refreshAfterDate = new Date(Date.now() + (loadError ? 5 : 15) * 60 * 1000);
const big = FAMILY === "large";
const PAD = big ? 16 : 12;
w.setPadding(PAD, PAD, PAD, PAD);
const BAR_W = 280;                       // 막대 폭(pt). 작은 아이폰에서도 넘치지 않게 여유를 둠

if (loadError) {
  label(w, "YouKnow", 14, C.accent, "bold"); w.addSpacer(4);
  label(w, "위젯 데이터를 못 불러왔어요", 12, C.soft, "semibold");
  const err = label(w, loadError, 10, C.faint); err.lineLimit = 3;
  w.addSpacer(); label(w, "탭하면 앱이 열립니다", 10, C.faint);
} else {
  const tasks = data.tasks || { overdue: 0, dueToday: 0, doneToday: 0, items: [] };
  const plans = data.plans || [];
  const routines = data.routines || [];
  const habits = data.habits || { total: 0, checked: 0, items: [] };
  const events = data.events || [];
  const diary = data.diary || { written: false, streak: 0 };
  const timeline = plans.length ? plans : routines.map(function (r) { return { start: r.start, end: r.end, title: r.title, done: false, color: r.color }; });
  const isPlan = plans.length > 0;
  const nowHM = hm(new Date());
  const current = timeline.filter(function (p) { return !p.done && !p.failed && p.start <= nowHM && (p.end || p.start) >= nowHM; })[0] || null;
  const nextPlan = current || timeline.filter(function (p) { return !p.done && !p.failed && (p.end || p.start) >= nowHM; })[0] || null;
  const totalToday = (tasks.dueToday || 0) + (tasks.doneToday || 0);
  const tlDone = timeline.filter(function (p) { return p.done; }).length;
  const tlFailed = timeline.filter(function (p) { return p.failed; }).length;
  const tlTotal = timeline.length - tlFailed;

  if (FAMILY === "small") {
    // ── 작은 위젯: 큰 숫자 + 다음 계획 + 습관 점
    const head = row(w, 4);
    const parts = String(data.date || "").split("-");
    label(head, parts.length === 3 ? Number(parts[1]) + "/" + Number(parts[2]) + (data.weekday ? " (" + data.weekday + ")" : "") : String(data.label || ""), 12, C.ink, "bold");
    head.addSpacer();
    if (diary.streak >= 2) label(head, "🔥" + diary.streak, 11, C.amber, "semibold");
    w.addSpacer(6);
    const n = row(w, 4);
    label(n, String(tasks.doneToday || 0), 30, C.accent, "bold");
    label(n, "/ " + totalToday + " 할 일", 12, C.soft, "semibold");
    if (tasks.overdue > 0) label(w, "지난 마감 " + tasks.overdue, 10, C.red, "semibold");
    w.addSpacer(6);
    if (nextPlan) { label(w, (current ? "지금 " : "다음 ") + nextPlan.start, 10, safeColor(nextPlan.color, C.accent), "semibold"); label(w, nextPlan.title, 12, C.ink, "semibold"); }
    else if (timeline.length) label(w, "오늘 계획 끝 🎉", 12, C.ink, "semibold");
    else label(w, "계획 없음", 12, C.faint);
    w.addSpacer();
    if (habits.total > 0) { const hr = row(w, 3); habits.items.slice(0, 6).forEach(function (h) { dot(hr, h.done ? safeColor(h.color, C.green) : C.off, 7); }); hr.addSpacer(); label(hr, habits.checked + "/" + habits.total, 10, C.faint, "semibold"); }
  } else {
    const fs = big ? 14 : 12;          // 본문 글자
    const fsS = big ? 11 : 10;         // 보조 글자
    // ── 머리: 날짜 · 연속 기록 · 시각
    const head = row(w, 6);
    label(head, data.label || data.date || "", big ? 17 : 14, C.ink, "bold");
    head.addSpacer();
    if (diary.streak >= 2) label(head, "🔥 " + diary.streak + "일 연속", fsS, C.amber, "semibold");
    else if (diary.written) label(head, "📔 오늘 기록됨", fsS, C.faint);
    else label(head, "📔 아직 안 씀", fsS, C.faint);
    if (data.degraded) label(w, "⚠ 일부 데이터를 못 불러왔어요", 9, C.amber);

    // ── 진행 막대 2개: 할 일 · 계획
    w.addSpacer(big ? 10 : 6);
    const pr = row(w, 10);
    const col1 = pr.addStack(); col1.layoutVertically(); col1.spacing = 3;
    const col2 = pr.addStack(); col2.layoutVertically(); col2.spacing = 3;
    const r1 = row(col1, 4); label(r1, "✅ 할 일", fsS, C.soft, "semibold"); r1.addSpacer(); label(r1, (tasks.doneToday || 0) + "/" + totalToday + (tasks.overdue ? "  ·  지남 " + tasks.overdue : ""), fsS, tasks.overdue ? C.red : C.faint, "semibold");
    bar(col1, totalToday ? (tasks.doneToday || 0) / totalToday : 0, C.accent, Math.floor((BAR_W - 10) / 2), big ? 6 : 5);
    const r2 = row(col2, 4); label(r2, "🕐 " + (isPlan ? "플래너" : "일과"), fsS, C.soft, "semibold"); r2.addSpacer(); label(r2, tlTotal ? tlDone + "/" + tlTotal + (tlFailed ? "  ✗" + tlFailed : "") : "—", fsS, C.faint, "semibold");
    bar(col2, tlTotal ? tlDone / tlTotal : 0, C.green, Math.floor((BAR_W - 10) / 2), big ? 6 : 5);

    // ── 지금/다음 계획 카드 (큰 위젯만)
    if (big) {
      w.addSpacer(10);
      const card = row(w, 10);
      card.setPadding(10, 12, 10, 12); card.cornerRadius = 12; card.backgroundColor = C.card;
      if (nextPlan) {
        dot(card, safeColor(nextPlan.color, C.accent), 10);
        const cc = card.addStack(); cc.layoutVertically(); cc.spacing = 2;
        label(cc, (current ? "지금" : "다음") + "  " + nextPlan.start + (nextPlan.end ? "~" + nextPlan.end : ""), 11, safeColor(nextPlan.color, C.accent), "semibold");
        const t = label(cc, nextPlan.title, 15, C.ink, "bold"); t.minimumScaleFactor = 0.8;
        card.addSpacer();
        const left = timeline.filter(function (p) { return !p.done && !p.failed; }).length;
        label(card, "남은 " + left, 11, C.faint, "semibold");
      } else if (timeline.length) {
        label(card, "🎉", 15, C.ink); const t = label(card, "오늘 계획을 다 끝냈어요", 14, C.ink, "bold"); card.addSpacer();
      } else {
        label(card, "🗓", 15, C.ink); const t = label(card, "오늘 계획이 없어요 · 탭해서 짜기", 13, C.soft, "semibold"); card.addSpacer();
      }
    }

    // ── 두 칸: 왼쪽 할 일, 오른쪽 타임라인
    w.addSpacer(big ? 12 : 8);
    const cols = row(w, 14); cols.topAlignContent();
    const L = cols.addStack(); L.layoutVertically(); L.spacing = big ? 5 : 3;
    const R = cols.addStack(); R.layoutVertically(); R.spacing = big ? 5 : 3;
    const maxRows = big ? 6 : 4;
    const items = (tasks.items || []).slice(0, maxRows);
    if (items.length === 0) label(L, "오늘 마감 없음 ✨", fs, C.faint);
    items.forEach(function (t) {
      const r = row(L, 5);
      label(r, t.overdue ? "!" : "○", fs, t.overdue ? C.red : C.faint, "bold");
      const title = label(r, t.title, fs, C.ink); title.minimumScaleFactor = 0.8;
      r.addSpacer();
      label(r, t.dday || "", fsS, t.overdue ? C.red : t.dday === "D-DAY" ? C.amber : C.faint, "semibold");
    });
    if ((tasks.items || []).length > maxRows) label(L, "+" + (tasks.items.length - maxRows) + "개 더", fsS, C.faint);
    L.addSpacer();
    const tl = timeline.slice(0, maxRows);
    if (tl.length === 0) label(R, "계획 없음", fs, C.faint);
    tl.forEach(function (p) {
      const r = row(R, 5);
      const tint = safeColor(p.color, C.accent);
      dot(r, tint, 7);
      label(r, p.start + (p.end ? "~" + p.end : ""), fsS, tint, "semibold");
      const title = label(r, p.title, fs, p.done || p.failed ? C.faint : C.ink); title.minimumScaleFactor = 0.8;
      if (p.done || p.failed) title.textOpacity = 0.6;
      r.addSpacer();
      if (p.done) label(r, "✓", fs, C.green, "bold"); else if (p.failed) label(r, "✗", fs, C.red, "bold");
    });
    if (timeline.length > maxRows) label(R, "+" + (timeline.length - maxRows) + "개 더", fsS, C.faint);
    R.addSpacer();

    // ── 일정 (있을 때만)
    if (big && events.length) {
      w.addSpacer(10);
      const er = row(w, 4); label(er, "📅 일정", fsS, C.soft, "semibold"); er.addSpacer(); label(er, String(events.length), fsS, C.faint, "semibold");
      events.slice(0, 3).forEach(function (e) { const r = row(w, 6); label(r, e.time || "종일", fsS, C.sky, "semibold"); const t = label(r, e.title, fs, C.ink); t.minimumScaleFactor = 0.8; r.addSpacer(); if (e.calendar) label(r, e.calendar, 10, C.faint); });
    }

    // ── 습관 칩 + 하단 시각 (남는 공간을 아래로 밀어 바닥에 붙임)
    w.addSpacer();
    const foot = row(w, 6);
    if (habits.total > 0) {
      habits.items.slice(0, 8).forEach(function (h) {
        const chip = row(foot, 3);
        dot(chip, h.done ? safeColor(h.color, C.green) : C.off, 7);
        if (big) { const nm = label(chip, h.name, 10, h.done ? C.ink : C.faint); nm.minimumScaleFactor = 0.7; }
      });
      label(foot, habits.checked + "/" + habits.total, fsS, C.faint, "semibold");
    } else {
      label(foot, "🔁 습관 없음", fsS, C.faint);
    }
    foot.addSpacer();
    label(foot, nowHM + " 기준", 9, C.faint);
  }
}

Script.setWidget(w);
if (!config.runsInWidget) { if (FAMILY === "small") await w.presentSmall(); else if (FAMILY === "large") await w.presentLarge(); else await w.presentMedium(); }
Script.complete();
```
