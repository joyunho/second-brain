// YouKnow 위젯 v3 — 한눈에 보기 (Scriptable)
// 설치: Scriptable 앱 → "YouKnow" 스크립트를 열어 내용을 전부 지우고 이 코드로 교체 → 완료 → ▶ 로 미리보기
//       홈 화면 위젯을 길게 눌러 "위젯 편집" → Script 가 YouKnow 인지 확인. 크기는 큰 위젯 권장(중간·작은·잠금화면도 지원)
// Parameter 칸: 서버에 WIDGET_KEY 를 정했을 때만 그 값 (안 정했으면 비워둠)
// 데이터: 앱의 /api/widget (오늘 할 일·계획·일과·습관·일정·일기). 탭하면 Safari 에서 오늘 화면이 열립니다.

const BASE = "https://youknow-meta-data-weom.vercel.app";
const KEY = (args.widgetParameter || "").trim();
const FAMILY = config.widgetFamily || "large";

const C = {
  bg: new Color("#141414"), card: new Color("#232323"), hi: new Color("#2c2c30"), track: new Color("#333333"),
  ink: new Color("#ededeb"), soft: new Color("#a8a8a5"), faint: new Color("#6f6f6b"), off: new Color("#4a4a4a"),
  accent: new Color("#a78bfa"), green: new Color("#34d399"), red: new Color("#f87171"), amber: new Color("#f59e0b"), sky: new Color("#38bdf8"),
};

// ── 그리기 도구 ─────────────────────────────────────────────
function font(kind, size) {
  try {
    if (kind === "bold") return Font.boldSystemFont(size);
    if (kind === "semi") return Font.semiboldSystemFont(size);
    if (kind === "round") return Font.boldRoundedSystemFont(size);
    if (kind === "mono") return Font.semiboldMonospacedSystemFont(size);
    if (kind === "monoR") return Font.regularMonospacedSystemFont(size);
  } catch (e) {}
  return kind === "reg" || kind === "monoR" ? Font.systemFont(size) : Font.semiboldSystemFont(size);
}
function text(parent, str, size, color, kind) {
  const t = parent.addText(String(str));
  t.font = font(kind || "reg", size);
  t.textColor = color;
  t.lineLimit = 1;
  return t;
}
function hstack(parent, spacing) { const s = parent.addStack(); s.layoutHorizontally(); s.centerAlignContent(); s.spacing = spacing || 0; return s; }
function vstack(parent, spacing) { const s = parent.addStack(); s.layoutVertically(); s.topAlignContent(); s.spacing = spacing || 0; return s; }
function fixed(parent, width) { const s = parent.addStack(); s.layoutVertically(); s.bottomAlignContent(); s.size = new Size(width, 0); return s; }  // 오른쪽 끝 고정 폭 칸(줄어들지 않게)
function dot(parent, color, size) { const s = parent.addStack(); s.size = new Size(size, size); s.cornerRadius = size / 2; s.backgroundColor = color; return s; }
function bar(parent, ratio, color, width, height) {
  const track = parent.addStack();
  track.size = new Size(width, height); track.cornerRadius = height / 2; track.backgroundColor = C.track;
  const fill = Math.round(width * Math.max(0, Math.min(1, ratio || 0)));
  if (fill > 0) { const f = track.addStack(); f.size = new Size(fill, height); f.cornerRadius = height / 2; f.backgroundColor = color; }
  track.addSpacer();
}
function safeColor(hex, fallback) { try { if (typeof hex === "string" && /^#[0-9a-fA-F]{6}$/.test(hex)) return new Color(hex); } catch (e) {} return fallback; }

// 위젯 실제 폭(pt) — 막대·칸 너비 계산용 (아이폰 화면 크기별 표준 위젯 크기)
function widgetWidth(fam) {
  let w = 390, h = 844;
  try { const s = Device.screenSize(); w = Math.min(s.width, s.height); h = Math.max(s.width, s.height); } catch (e) {}
  const big = w >= 428 ? 364 : w >= 414 ? (h >= 890 ? 360 : 348) : w >= 390 ? 338 : w >= 375 ? (h >= 800 ? 329 : 321) : w >= 360 ? 329 : 292;
  if (fam === "small") return Math.round(big * 0.47);
  return big;
}

// ── 시간 계산 ────────────────────────────────────────────────
const now = new Date();
const nowMin = now.getHours() * 60 + now.getMinutes();
const pad2 = (n) => (n < 10 ? "0" : "") + n;
const nowHM = pad2(now.getHours()) + ":" + pad2(now.getMinutes());
function toMin(hm) { const m = /^(\d{1,2}):(\d{2})/.exec(String(hm || "")); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
function atMin(min) { const d = new Date(now.getTime()); d.setHours(Math.floor(min / 60), min % 60, 0, 0); return d; }

// ── 데이터 ───────────────────────────────────────────────────
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

if (loadError) {
  w.setPadding(14, 14, 14, 14);
  text(w, "YouKnow", 14, C.accent, "bold");
  w.addSpacer(4);
  text(w, "위젯 데이터를 못 불러왔어요", 12, C.soft, "semi");
  const e = text(w, loadError, 10, C.faint); e.lineLimit = 3;
  w.addSpacer();
  text(w, "탭하면 앱이 열립니다", 10, C.faint);
  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
} else {
  render(data);
}
Script.setWidget(w);
if (!config.runsInWidget) {
  if (FAMILY === "small") await w.presentSmall(); else if (FAMILY === "medium") await w.presentMedium(); else await w.presentLarge();
}
Script.complete();

function render(d) {
  const tasks = d.tasks || { overdue: 0, dueToday: 0, doneToday: 0, items: [] };
  const plans = d.plans || [], routines = d.routines || [];
  const habits = d.habits || { total: 0, checked: 0, items: [] };
  const events = d.events || [];
  const diary = d.diary || { written: false, streak: 0 };
  const isPlan = plans.length > 0;

  // 블록(계획 또는 일과) 정리: 지난 것 / 진행 중 / 다음
  const blocks = (isPlan ? plans : routines).map(function (p) {
    const s = toMin(p.start); let e = toMin(p.end);
    if (s !== null && (e === null || e <= s)) e = s + 60;
    return { start: p.start, end: p.end, title: p.title || "", color: p.color, done: !!p.done, failed: !!p.failed, s: s, e: e };
  }).filter(function (b) { return b.s !== null; }).sort(function (a, b) { return a.s - b.s; });
  // 캘린더 일정도 같은 타임라인에 시간순으로 (진행률 계산에서는 제외)
  events.forEach(function (e) {
    const s = toMin(e.time);
    const m = /(\d{1,2}:\d{2})\s*[-–~]\s*(\d{1,2}:\d{2})/.exec(String(e.time || ""));
    const end = m ? toMin(m[2]) : null;
    blocks.push({ start: s === null ? "종일" : pad2(Math.floor(s / 60)) + ":" + pad2(s % 60), end: m ? m[2] : "", title: e.title || "", color: "#38bdf8",
      event: true, calendar: e.calendar || "", allDay: s === null, done: false, failed: false, s: s === null ? -1 : s, e: s === null ? -1 : (end !== null && end > s ? end : s + 60) });
  });
  blocks.sort(function (a, b) { return a.s - b.s; });
  blocks.forEach(function (b) { b.past = !b.allDay && b.e <= nowMin; b.live = !b.allDay && b.s <= nowMin && nowMin < b.e; });
  const open = function (b) { return !b.done && !b.failed && !b.allDay; };
  const next = blocks.filter(function (b) { return b.live && open(b); })[0] || blocks.filter(function (b) { return b.s > nowMin && open(b); })[0] || null;
  const own = blocks.filter(function (b) { return !b.event; });   // 진행률은 계획·일과만
  const passed = own.filter(function (b) { return isPlan ? b.done : b.past; }).length;
  const failed = own.filter(function (b) { return b.failed; }).length;

  const totalToday = (tasks.dueToday || 0) + (tasks.doneToday || 0);
  const overdue = tasks.overdue || 0;

  // 다음 블록 경계에서 다시 그리도록 요청 (iOS 가 허용하는 범위 안에서)
  let refreshMin = 15;
  if (next) { const edge = next.live ? next.e : next.s; if (edge - nowMin > 0) refreshMin = Math.min(refreshMin, edge - nowMin); }
  w.refreshAfterDate = new Date(Date.now() + Math.max(1, refreshMin) * 60 * 1000);

  // 공통 요약값
  const sum = {
    task: overdue > 0 ? { v: "지남 " + overdue, c: C.red, sub: totalToday ? "오늘 " + (tasks.doneToday || 0) + "/" + totalToday : "오늘 마감 없음", r: totalToday ? (tasks.doneToday || 0) / totalToday : 0, bc: C.red }
        : totalToday ? { v: (tasks.doneToday || 0) + "/" + totalToday, c: C.ink, sub: "오늘 마감", r: (tasks.doneToday || 0) / totalToday, bc: C.accent }
        : { v: "없음", c: C.faint, sub: "오늘 마감", r: 0, bc: C.accent },
    block: own.length ? { v: passed + "/" + (own.length - failed), c: C.ink, sub: isPlan ? "완료" + (failed ? " · ✗" + failed : "") : "지나감", r: passed / Math.max(1, own.length - failed), bc: C.green }
        : { v: "없음", c: C.faint, sub: "계획", r: 0, bc: C.green },
    third: habits.total > 0 ? { label: "🔁 습관", v: habits.checked + "/" + habits.total, c: C.ink, sub: "체크", r: habits.checked / habits.total, bc: C.sky }
        : { label: "📔 일기", v: diary.written ? "씀" : "아직", c: diary.written ? C.green : C.amber, sub: diary.streak >= 1 ? "🔥 " + diary.streak + "일 연속" : "오늘 기록", r: diary.written ? 1 : 0, bc: C.amber },
  };

  if (String(FAMILY).indexOf("accessory") === 0) return renderAccessory(next, sum);
  if (FAMILY === "small") return renderSmall(d, next, sum);
  if (FAMILY === "medium") return renderMedium(d, blocks, next, tasks, sum, isPlan);
  return renderLarge(d, blocks, next, tasks, events, sum, isPlan, diary);
}

// ── 공통 조각 ────────────────────────────────────────────────
function header(parent, d, size, diary) {
  const h = hstack(parent, 6);
  const t = text(h, d.label || d.date || "", size, C.ink, "bold"); t.minimumScaleFactor = 0.8;
  h.addSpacer();
  if (diary) {
    if (diary.streak >= 2) text(h, "🔥 " + diary.streak + "일", size - 6, C.amber, "semi");
    else if (diary.written) text(h, "📔 ✓", size - 6, C.green, "semi");
  }
  text(h, nowHM, size - 7, C.faint, "monoR");
  return h;
}
function sectionTitle(parent, title, right, rightColor) {
  const r = hstack(parent, 4);
  text(r, title, 11, C.soft, "semi");
  r.addSpacer();
  if (right) text(r, right, 10, rightColor || C.faint, "semi");
}
function chip(parent, width, label, s) {
  const c = vstack(parent, 1);
  c.centerAlignContent();
  c.size = new Size(width, 0);
  c.setPadding(7, 8, 8, 8);
  c.cornerRadius = 12;
  c.backgroundColor = C.card;
  text(c, label, 10, C.soft, "semi");
  const v = text(c, s.v, 19, s.c, "round"); v.minimumScaleFactor = 0.6;
  const sub = text(c, s.sub, 9, C.faint); sub.minimumScaleFactor = 0.75;
  c.addSpacer(4);
  bar(c, s.r, s.bc, width - 16, 4);
}
function blockRow(parent, b, size, isNext, rightDate) {
  const r = hstack(parent, 7);
  r.setPadding(3, 7, 3, 7);
  if (isNext) { r.backgroundColor = C.hi; r.cornerRadius = 8; }
  const tint = safeColor(b.color, C.accent);
  const dim = (b.past && !isNext) || b.done || b.failed;
  if (b.event) text(r, "📅", size - 3, C.ink); else dot(r, dim ? C.off : tint, 7);
  text(r, b.start, size - 1, dim ? C.faint : tint, "mono");
  const t = text(r, b.title, size, dim ? C.faint : C.ink, isNext ? "semi" : "reg");
  t.minimumScaleFactor = 0.85;
  r.addSpacer();
  const right = fixed(r, rightDate ? 78 : 44);
  if (b.done) text(right, "✓", size, C.green, "bold").rightAlignText();
  else if (b.failed) text(right, "✗", size, C.red, "bold").rightAlignText();
  else if (rightDate) { const dt = right.addDate(rightDate); dt.font = font("semi", size - 2); dt.textColor = tint; dt.applyRelativeStyle(); dt.rightAlignText(); dt.lineLimit = 1; dt.minimumScaleFactor = 0.7; }
  else if (b.event && b.calendar) text(right, b.calendar, size - 3, C.faint).rightAlignText();
  else if (b.end) text(right, "~" + b.end, size - 3, C.faint, "monoR").rightAlignText();
  return r;
}
function taskRow(parent, t, size) {
  const r = hstack(parent, 6);
  r.setPadding(2, 7, 2, 7);
  text(r, t.overdue ? "!" : "○", size, t.overdue ? C.red : C.faint, "bold");
  const title = text(r, t.title, size, C.ink); title.minimumScaleFactor = 0.85;
  r.addSpacer();
  const right = fixed(r, 44);
  text(right, t.dday || "", size - 2, t.overdue ? C.red : t.dday === "D-DAY" ? C.amber : C.faint, "semi").rightAlignText();
}
// 블록이 많으면 지난 것은 하나만 남기고 다가오는 것부터 보여준다
function windowed(all, next, max, context) {
  // 종일 일정은 항상 맨 위에 고정, 나머지(시간 있는 것)만 창으로 자른다
  const pinned = all.filter(function (b) { return b.allDay; });
  const blocks = all.filter(function (b) { return !b.allDay; });
  max = Math.max(1, max - pinned.length);
  const r = windowTimed(blocks, next, max, context);
  return { list: pinned.concat(r.list), before: r.before, after: r.after };
}
function windowTimed(blocks, next, max, context) {
  if (blocks.length <= max) return { list: blocks, before: 0, after: 0 };
  let i = next ? blocks.indexOf(next) : blocks.length - max;
  let start = Math.max(0, Math.min(i - (context === undefined ? 1 : context), blocks.length - max));
  return { list: blocks.slice(start, start + max), before: start, after: Math.max(0, blocks.length - start - max) };
}
function nextCard(parent, next, blocks, isPlan) {
  const card = hstack(parent, 10);
  card.setPadding(9, 12, 9, 12);
  card.cornerRadius = 14;
  card.backgroundColor = C.card;
  if (!next) {
    text(card, blocks.length ? "🎉" : "🗓", 16, C.ink);
    text(card, blocks.length ? (isPlan ? "오늘 계획을 다 끝냈어요" : "오늘 일과가 다 지났어요") : "오늘 계획 없음 · 탭해서 짜기", 13, C.soft, "semi");
    card.addSpacer();
    return;
  }
  const tint = safeColor(next.color, C.accent);
  const strip = card.addStack(); strip.size = new Size(4, 36); strip.cornerRadius = 2; strip.backgroundColor = tint;
  const left = vstack(card, 2);
  const l1 = hstack(left, 5);
  text(l1, next.live ? "지금" : "다음", 11, tint, "bold");
  text(l1, next.start + (next.end ? "–" + next.end : ""), 11, C.soft, "mono");
  const t = text(left, next.title, 16, C.ink, "bold"); t.minimumScaleFactor = 0.7;
  card.addSpacer();
  const right = vstack(card, 1);
  right.size = new Size(70, 0);
  right.bottomAlignContent();
  const dt = right.addDate(atMin(next.live ? next.e : next.s));
  dt.font = font("semi", 13); dt.textColor = C.ink; dt.applyRelativeStyle(); dt.rightAlignText(); dt.minimumScaleFactor = 0.7;
  const cap = text(right, next.live ? "종료" : "시작", 10, C.faint, "semi"); cap.rightAlignText();
}

// ── 큰 위젯 ─────────────────────────────────────────────────
function renderLarge(d, blocks, next, tasks, events, sum, isPlan, diary) {
  const W = widgetWidth("large");
  const compact = W < 330;
  const tall = W >= 360;   // Pro Max·Plus 는 세로 여유가 더 있음
  const P = compact ? 13 : 15, GAP = compact ? 6 : tall ? 10 : 8;
  w.setPadding(P, P, P - 3, P);
  header(w, d, compact ? 16 : 17, sum.third.label.indexOf("일기") >= 0 ? null : diary);   // 일기 칸이 있으면 머리엔 중복 표시하지 않음
  w.addSpacer(GAP);

  const chips = hstack(w, 8);
  const cw = Math.floor((W - 2 * P - 16) / 3);
  chip(chips, cw, "✅ 할 일", sum.task);
  chip(chips, cw, isPlan ? "🕐 플래너" : "🕐 일과", sum.block);
  chip(chips, cw, sum.third.label, sum.third);
  w.addSpacer(GAP);

  nextCard(w, next, blocks, isPlan);
  w.addSpacer(GAP);

  const items = tasks.items || [];
  // 남은 세로 공간(pt)을 줄 수로 나눈다 — 넘치지 않게
  const estH = { 364: 382, 360: 379, 348: 357, 338: 354, 329: 345, 321: 324, 292: 311 }[W] || 354;
  const HEAD = 16, ROW_B = 22, ROW_T = 20, MORE = 12;
  const room = estH - (2 * P - 3) - 20 - 66 - 52 - 3 * GAP;
  const tasksCost = function (n) { return HEAD + Math.max(1, n) * ROW_T + (items.length > n ? MORE : 0); };
  const blocksCost = function (n) { return n ? HEAD + n * ROW_B + (blocks.length > n ? MORE : 0) + GAP : 0; };
  let nt = Math.min(items.length, 1), nb = 0;
  while (nb < blocks.length && blocksCost(nb + 1) + tasksCost(nt) <= room) nb++;
  while (nt < Math.min(items.length, 3) && blocksCost(nb) + tasksCost(nt + 1) <= room) nt++;
  if (blocks.length) {
    const win = windowed(blocks, next, Math.max(1, nb));
    sectionTitle(w, isPlan ? "오늘 플래너" : "오늘 일과", blocks.length + "개" + (win.before ? " · 앞 " + win.before + "개 생략" : ""));
    w.addSpacer(3);
    const list = vstack(w, 1);
    win.list.forEach(function (b) { blockRow(list, b, 13, b === next, null); });
    if (win.after) text(list, "  +" + win.after + "개 더", 10, C.faint);
    w.addSpacer(GAP);
  }
  sectionTitle(w, "할 일", tasks.overdue ? "지난 마감 " + tasks.overdue : (tasks.dueToday ? "오늘 " + tasks.dueToday : ""), tasks.overdue ? C.red : C.faint);
  w.addSpacer(3);
  if (!items.length) text(w, "  오늘 마감 없음 ✨", 13, C.faint);
  items.slice(0, nt).forEach(function (t) { taskRow(w, t, 13); });
  if (items.length > nt) text(w, "  +" + (items.length - nt) + "개 더", 10, C.faint);
  w.addSpacer();
}

// ── 중간 위젯 ───────────────────────────────────────────────
function renderMedium(d, blocks, next, tasks, sum, isPlan) {
  w.setPadding(13, 14, 12, 14);
  const h = hstack(w, 6);
  const t = text(h, d.label || d.date || "", 14, C.ink, "bold"); t.minimumScaleFactor = 0.8;
  h.addSpacer();
  text(h, "할 일 ", 10, C.faint, "semi"); text(h, sum.task.v, 10, sum.task.c, "semi");
  text(h, "  ·  " + (isPlan ? "플래너 " : "일과 ") + sum.block.v, 10, C.faint, "semi");
  w.addSpacer(7);
  const items = tasks.items || [];
  const taskRows = items.length ? 1 : 0;
  const win = windowed(blocks, next, 4 - taskRows, 0);
  if (!blocks.length) text(w, "  오늘 계획 없음 · 탭해서 짜기", 12, C.faint);
  const list = vstack(w, 0);
  win.list.forEach(function (b) {
    const isNext = b === next;
    blockRow(list, b, 12, isNext, isNext ? atMin(b.live ? b.e : b.s) : null);
  });
  if (taskRows) { w.addSpacer(2); taskRow(w, items[0], 12); }
  w.addSpacer();
}

// ── 작은 위젯 ───────────────────────────────────────────────
function renderSmall(d, next, sum) {
  w.setPadding(12, 13, 12, 13);
  const parts = String(d.date || "").split("-");
  const h = hstack(w, 4);
  text(h, parts.length === 3 ? Number(parts[1]) + "/" + Number(parts[2]) + (d.weekday ? " (" + d.weekday + ")" : "") : String(d.label || ""), 12, C.ink, "bold");
  h.addSpacer();
  text(h, nowHM, 9, C.faint, "monoR");
  w.addSpacer(8);
  if (next) {
    const tint = safeColor(next.color, C.accent);
    const l = hstack(w, 4);
    text(l, next.live ? "지금" : "다음", 11, tint, "bold");
    text(l, next.start, 11, C.soft, "mono");
    w.addSpacer(2);
    const t = text(w, next.title, 14, C.ink, "bold"); t.lineLimit = 2; t.minimumScaleFactor = 0.8;
    w.addSpacer(2);
    const dt = w.addDate(atMin(next.live ? next.e : next.s)); dt.font = font("semi", 11); dt.textColor = C.faint; dt.applyRelativeStyle();
  } else {
    text(w, "오늘 일정 끝 🎉", 13, C.ink, "semi");
  }
  w.addSpacer();
  const s1 = hstack(w, 4); text(s1, "할 일", 10, C.faint, "semi"); s1.addSpacer(); text(s1, sum.task.v, 11, sum.task.c, "bold");
  const s2 = hstack(w, 4); text(s2, "일과", 10, C.faint, "semi"); s2.addSpacer(); text(s2, sum.block.v, 11, sum.block.c, "bold");
}

// ── 잠금화면 위젯 ───────────────────────────────────────────
function renderAccessory(next, sum) {
  if (FAMILY === "accessoryInline") { text(w, next ? (next.live ? "지금 " : "") + next.start + " " + next.title : "할 일 " + sum.task.v, 12, C.ink); return; }
  if (FAMILY === "accessoryCircular") { const s = vstack(w, 0); s.centerAlignContent(); text(s, sum.block.v, 13, C.ink, "bold"); text(s, "일과", 9, C.soft); return; }
  if (next) {
    text(w, (next.live ? "지금 " : "▶ ") + next.start + "  " + next.title, 13, C.ink, "semi");
    const dt = w.addDate(atMin(next.live ? next.e : next.s)); dt.font = font("reg", 12); dt.applyRelativeStyle();
  } else text(w, "오늘 일과 끝", 13, C.ink, "semi");
  text(w, "할 일 " + sum.task.v + " · 일과 " + sum.block.v, 11, C.soft);
}
