/**
 * capture.js — YouKnow 「빠른 입력」 한국어 규칙 파서의 Templater 사용자 스크립트 포팅.
 *
 * 사용(Templater):  const r = tp.user.capture({ text, today, projectNames, habitNames });
 * 사용(Node):       const capture = require("./capture.js"); capture({...});
 *
 * 입력  { text: string(여러 줄), today: 'YYYY-MM-DD', projectNames: string[], habitNames: string[] }
 * 출력  { items: Item[], warnings: string[] }   — 동기, 파일 입출력 없음, Obsidian API 없음.
 *
 * Item = {
 *   kind: 'task' | 'plan' | 'habit' | 'routine' | 'project',
 *   title: string, note: string|null, raw: string(원문 줄),
 *   priority: 1..5          (task; 기본 3)
 *   due: 'YYYY-MM-DD'|null  (task/project 마감)
 *   start: 'YYYY-MM-DD'     (task; 기본 today)
 *   project: string|null    (task/plan 프로젝트 이름)
 *   date: 'YYYY-MM-DD'      (plan)
 *   start_time: 'HH:MM', end_time: 'HH:MM'|''   (plan/routine)
 *   weekdays: number[]      (routine; 0=일 … 6=토. 앱과 같이 요일마다 Item 1개 → 길이 1)
 *   weekday: number         (routine; weekdays[0] 편의 필드)
 *   explicitDate: boolean   (줄 또는 헤더 줄에 날짜가 적혀 있었는가)
 * }
 *
 * 규칙은 YouKnow 앱 번들(page.pretty.js L2133–L2789, L2871–L2898)의 t0/t1 파서를
 * 정규식까지 그대로 옮긴 것이다. 식별자만 읽기 쉽게 바꿨다. 동작을 바꾸면
 * 앱과 결과가 달라져 tpl-inbox의 `PUSH_TO_YOUKNOW` 전송분을 importer가 채택하지 못하므로 함부로 고치지 말 것.
 * 검증: node _System/Scripts/tests/capture.test.js (원본 코드를 오라클로 비교).
 */
"use strict";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const PRIORITY_LABELS = { 5: "긴급", 4: "중요", 3: "보통", 2: "낮음", 1: "언젠가" };

// ───────────────────────── 날짜 산술 (UTC 기준, 'YYYY-MM-DD' 문자열) ─────────────────────────

function toUTC(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function addDays(iso, n) {
  const t = toUTC(iso) + 864e5 * n;
  if (!Number.isFinite(t) || Math.abs(t) > 864e13) return null;
  return new Date(t).toISOString().slice(0, 10);
}

function weekdayOf(iso) {
  return new Date(toUTC(iso)).getUTCDay();
}

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** y-m-d 를 만들되 일(day)은 그 달 길이로 자른다. 월/일이 범위 밖이면 null. */
function makeDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1) return null;
  const dd = Math.min(d, daysInMonth(y, m));
  return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** 'M월 D일' 처럼 연도가 없는 날짜 → today 이후 첫 해(최대 8년) — 지난 날짜는 내년으로 넘어간다. */
function nextOccurrence(today, m, d) {
  const y0 = Number(today.slice(0, 4));
  for (let y = y0; y <= y0 + 8; y += 1) {
    if (d > daysInMonth(y, m)) continue;
    const iso = makeDate(y, m, d);
    if (iso && iso >= today) return iso;
  }
  return null;
}

/** today 기준 k 달 뒤 달의 말일. */
function endOfMonthFrom(today, k) {
  const y = Number(today.slice(0, 4));
  const mm = Number(today.slice(5, 7)) + k;
  const yy = y + Math.floor((mm - 1) / 12);
  const m = ((mm - 1) % 12 + 12) % 12 + 1;
  return makeDate(yy, m, daysInMonth(yy, m));
}

const DATE_TAIL = "(?:(?![가-힣])|(?=까지|에(?!서)|부터|안에|내로|이내|마감|날))";
const WEEKDAY_SUFFIX = "(요일|욜)?" + DATE_TAIL;
const DEADLINE_WORDS = "(까지|마감|이내|안에|내로|내에)";

/**
 * 요일 → 날짜. weeksAhead 0 = 이번 주(지났으면 rollForward 일 때 +7), 1 = 다음 주(월요일 시작), 2 = 다다음 주.
 */
function weekdayDate(today, wdChar, weeksAhead, rollForward) {
  if (rollForward === undefined) rollForward = true;
  const target = WEEKDAYS.indexOf(wdChar);
  if (target < 0) return null;
  const cur = weekdayOf(today);
  if (weeksAhead === 0) {
    let diff = target - cur;
    if (diff < 0) diff = rollForward ? diff + 7 : diff;
    return addDays(today, diff);
  }
  const monday = addDays(today, -((cur + 6) % 7));
  return addDays(monday, 7 * weeksAhead + (target + 6) % 7);
}

/** 'M월 N째 주 X요일' (nth 0 = 마지막). */
function nthWeekdayOfMonth(y, m, nth, wdChar) {
  const target = WEEKDAYS.indexOf(wdChar);
  if (target < 0) return null;
  const first = makeDate(y, m, 1);
  if (!first) return null;
  if (nth === 0) {
    const last = makeDate(y, m, daysInMonth(y, m));
    const back = (weekdayOf(last) - target + 7) % 7;
    return addDays(last, -back);
  }
  const fwd = (target - weekdayOf(first) + 7) % 7;
  return addDays(first, fwd + (nth - 1) * 7);
}

// ───────────────────────── 어휘 정규화 ─────────────────────────

/** 한글 수사 시각(한 시·두 시…열두 시, 정오/자정) → 숫자 시. */
const KOREAN_HOUR_WORDS = [
  ["열두", 12], ["열한", 11], ["열", 10], ["아홉", 9], ["여덟", 8], ["일곱", 7],
  ["여섯", 6], ["다섯", 5], ["네", 4], ["세", 3], ["두", 2], ["한", 1],
].map(([word, n]) => [
  new RegExp(`(?<![가-힣])${word}\\s*시(?=\\s|$|반|까지|에|부터|쯤|경|정각|[^가-힣])`, "g"),
  `${n}시`,
]);
KOREAN_HOUR_WORDS.push([/정오/g, "낮 12시"], [/자정/g, "밤 12시"]);

function normalizeKoreanHours(text) {
  let t = text;
  for (const [re, rep] of KOREAN_HOUR_WORDS) t = t.replace(re, rep);
  return t;
}

/** 저녁/여가 문맥 → 모호한 시각을 오후로. */
const LEISURE_RE = new RegExp(
  "(게임|맥주|소주|회식|저녁|야식|넷플|영화|드라마|퇴근|야근|발로란트|오버워치|배그|디스코드|치맥|불금|술약속|저녁약속|(?<![가-힣])(술|롤|데이트)(?![가-힣])|\\b(game|beer|movie|netflix|dinner|date|drink|party|bar)\\b)",
  "i",
);
/** 아침 문맥 → 모호한 시각을 오전으로. */
const MORNING_RE = /(기상|출근|아침|조깅|러닝|등교|모닝|스트레칭|헬스|운동|수업|출발|일어나|\b(gym|workout|run|jog|breakfast|commute|standup|class)\b)/i;
/** 줄 분리 판단용 "날짜/시간/프로젝트 신호". 쉼표·그리고·슬래시로 나눈 조각 중 2개 이상이 이것을 가져야 분리한다. */
const SIGNAL_RE = /(까지|내일|낼|모레|글피|오늘|요일|욜|주말|다음\s*주|담주|이번\s*주|다음\s*달|담달|이번\s*달|이달|월말|말일|연말|내년|\d+\s*시(?!간)|정오|자정|\d{1,2}\/\d{1,2}|\d+\s*월|\d+\s*[일주]\s*(뒤|후)|(일주일|이틀|사흘|하루)\s*(뒤|후)|\d{1,2}\s*일(?![가-힣])|매일|매주|[#@][^\s#@,]{2,})/;
/** 줄머리 불릿/번호/체크박스. */
const BULLET_RE = /^\s*(?:[-*•·▪◦□→+]\s*|\d{1,2}[.)](?:\s+|$)|\[[ \-]\]\s*|[☐☑✅✔]\s*)+/;

const EN_WEEKDAYS = [
  [/\b(mon|monday)\b/gi, "월요일"],
  [/\b(tue|tues|tuesday)\b/gi, "화요일"],
  [/\b(wed|wednesday)\b/gi, "수요일"],
  [/\b(thu|thur|thurs|thursday)\b/gi, "목요일"],
  [/\b(fri|friday)\b/gi, "금요일"],
  [/\b(sat|saturday)\b/gi, "토요일"],
  [/\b(sun|sunday)\b/gi, "일요일"],
];
const EN_MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/** 영어 섞인 줄을 한국어 표현으로 바꾼다(영문자가 없으면 그대로). */
function normalizeEnglish(text) {
  let t = text;
  if (!/[a-zA-Z]/.test(t)) return t;
  t = t.replace(/(\d{1,2})(?::(\d{2}))?\s*[-~]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/gi, (_, h1, m1, h2, m2, ap) => {
    const w = /p/i.test(ap) ? "오후" : "오전";
    return `${w} ${h1}${m1 ? ":" + m1 : "시"}~${w} ${h2}${m2 ? ":" + m2 : "시"}`;
  });
  t = t.replace(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/gi, (_, h, m, ap) => `${/p/i.test(ap) ? "오후" : "오전"} ${h}${m ? ":" + m : "시"}`);
  t = t.replace(/\bnoon\b/gi, "정오").replace(/\bmidnight\b/gi, "자정");
  t = t.replace(/\b(tmr|tmrw|tomorrow)\b/gi, "내일").replace(/\btoday\b/gi, "오늘").replace(/\b(tonight)\b/gi, "오늘 밤")
    .replace(/\bday after tomorrow\b/gi, "모레").replace(/\bnext\s+week\b/gi, "다음 주").replace(/\bthis\s+week\b/gi, "이번 주")
    .replace(/\bnext\s+month\b/gi, "다음 달").replace(/\bthis\s+month\b/gi, "이번 달").replace(/\b(this\s+)?weekend\b/gi, "주말")
    .replace(/\bnext\s+year\b/gi, "내년").replace(/\bend of (the )?year\b/gi, "연말")
    .replace(/\bnext\s+(월|화|수|목|금|토|일)요일/g, "다음 주 $1요일");
  t = t.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi, (_, mon, d) => `${EN_MONTHS[mon.toLowerCase()]}월 ${d}일`);
  for (const [re, rep] of EN_WEEKDAYS) t = t.replace(re, rep);
  t = t.replace(/\bnext\s+(월|화|수|목|금|토|일)요일/g, "다음 주 $1요일");
  return t.replace(/\b(every\s*day|everyday|daily)\b/gi, "매일")
    .replace(/\bevery\s+(월|화|수|목|금|토|일)요일/g, "매주 $1요일")
    .replace(/\b(weekly)\s+/gi, "매주 ")
    .replace(/\b(urgent|asap)\b[:：]?/gi, "긴급")
    .replace(/\b(important)\b[:：]?/gi, "중요")
    .replace(/\b(someday|later)\b/gi, "언젠가")
    .replace(/\b(by|until|due)\s+(?=내일|오늘|모레|다음|이번|\d|[월화수목금토일]요일|주말|연말)/gi, "");
}

/** 제목 정리: 빈 괄호·접두어(할 일:/메모:)·꼬리(까지/마감)·장식 문자 제거. */
function cleanTitle(text) {
  return text
    .replace(/[(（]\s*[)）]|\[\s*\]/g, " ")
    .replace(/\s*(까지|마감|이내|안에|내로)\s*$/g, "")
    .replace(/^\s*(할\s*일|할\s*것|해야\s*할\s*일|todo|to-do|일정|계획|메모)\s*[:：]\s*/i, "")
    .replace(/^[\s:：\-–—·~]+|[\s:：\-–—·.~]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ───────────────────────── 날짜 추출 ─────────────────────────

/**
 * 문장에서 날짜 표현 하나를 찾는다(가장 앞에서 매칭된 규칙이 이긴다).
 * 반환 { date:'YYYY-MM-DD', text:매칭된 원문(꼬리 '까지' 포함), deadline:boolean } | null
 */
function extractDate(text, today) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const nextYearIfValid = (m) => (m >= 1 && m <= 12 ? year + 1 : null);
  const endOf = (y, m, kind) => (kind === "초" ? makeDate(y, m, 5) : kind === "중순" ? makeDate(y, m, 15) : makeDate(y, m, daysInMonth(y, m)));

  const rules = [
    { re: /(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})\s*일?/, to: (m) => makeDate(Number(m[1]), Number(m[2]), Number(m[3])) },
    { re: new RegExp("(?<!\\d)(\\d{2})년\\s*(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일"), to: (m) => makeDate(2000 + Number(m[1]), Number(m[2]), Number(m[3])) },
    { re: /(내년|다음\s*해|내후년)\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/, to: (m) => makeDate(year + (m[1] === "내후년" ? 2 : 1), Number(m[2]), Number(m[3])) },
    { re: new RegExp("(\\d{4})년\\s*(\\d{1,2})\\s*월\\s*(초|중순|말일|말)?" + DATE_TAIL + "(?!\\s*\\d)"), to: (m) => endOf(Number(m[1]), Number(m[2]), m[3]) },
    { re: new RegExp("(내년|다음\\s*해|내후년)\\s*(\\d{1,2})\\s*월\\s*(초|중순|말)?" + DATE_TAIL), to: (m) => endOf(year + (m[1] === "내후년" ? 2 : 1), Number(m[2]), m[3]) },
    { re: new RegExp("(내년|다음\\s*해)\\s*(초|말)?" + DATE_TAIL), to: (m) => (m[2] === "초" ? makeDate(year + 1, 1, 15) : makeDate(year + 1, 12, 31)) },
    {
      re: new RegExp("(?<![\\d:])(\\d{1,2})\\s*월\\s*(첫째|둘째|셋째|넷째|마지막)\\s*주\\s*([일월화수목금토])(요일|욜)?" + DATE_TAIL),
      to: (m) => {
        const mm = Number(m[1]);
        const nth = { 첫째: 1, 둘째: 2, 셋째: 3, 넷째: 4, 마지막: 0 }[m[2]];
        return nthWeekdayOfMonth(mm >= month ? year : year + 1, mm, nth === undefined ? 1 : nth, m[3]);
      },
    },
    { re: new RegExp("(?<![\\d:])(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일"), to: (m) => nextOccurrence(today, Number(m[1]), Number(m[2])) },
    { re: new RegExp("(?<![\\d:])(\\d{1,2})\\s*\\/\\s*(\\d{1,2})\\s*일?(?![\\d:])"), to: (m) => nextOccurrence(today, Number(m[1]), Number(m[2])) },
    { re: new RegExp("(?<![\\d:.])(\\d{1,2})\\.(\\d{1,2})\\s*일?\\.?(?![\\d:.a-zA-Z%가-힣~\\-–])"), to: (m) => nextOccurrence(today, Number(m[1]), Number(m[2])) },
    {
      re: new RegExp("(?<![\\d:])(\\d{1,2})\\s*월\\s*(초|중순|말일|말)" + DATE_TAIL),
      to: (m) => { const mm = Number(m[1]); return endOf(mm >= month ? year : year + 1, mm, m[2]); },
    },
    {
      re: new RegExp("(?<![\\d:])(\\d{1,2})\\s*월(?!\\s*\\d|\\s*(초|중순|말)|요일|욜|세|급|화|간)"),
      to: (m) => {
        const mm = Number(m[1]);
        let y = year;
        if (!(mm >= month)) { const ny = nextYearIfValid(mm); y = ny === null ? year : ny; }
        return makeDate(y, mm, daysInMonth(y, mm));
      },
    },
    { re: /(이번\s*달|이달|당월)\s*(\d{1,2})\s*일/, to: (m) => (Number(m[2]) > daysInMonth(year, month) ? null : makeDate(year, month, Number(m[2]))) },
    { re: new RegExp("(이번\\s*달|이달|당월)\\s*(말|안에|까지|내로|내에|중)?" + DATE_TAIL), to: () => endOfMonthFrom(today, 0) },
    {
      re: /(다음\s*달|담달|익월)\s*(\d{1,2})\s*일/,
      to: (m) => { const mm = month + 1; return makeDate(year + (mm > 12 ? 1 : 0), (mm - 1) % 12 + 1, Number(m[2])); },
    },
    {
      re: new RegExp("(다음\\s*달|담달|익월)\\s*(초|중순|말)?" + DATE_TAIL),
      to: (m) => {
        if (m[2] === "초") { const e = endOfMonthFrom(today, 1); return e ? e.slice(0, 8) + "05" : null; }
        if (m[2] === "중순") { const e = endOfMonthFrom(today, 1); return e ? e.slice(0, 8) + "15" : null; }
        return endOfMonthFrom(today, 1);
      },
    },
    { re: /월말|말일/, to: () => endOfMonthFrom(today, 0) },
    { re: /연말|올해\s*(안에|까지|내로|내에|말)|금년\s*(말|안에|까지)?|올해(?=\s|$)/, to: () => makeDate(year, 12, 31) },
    { re: new RegExp("(?<!\\d)(\\d{1,4})\\s*일\\s*(뒤|후|후에|뒤에|있다가)"), to: (m) => addDays(today, Number(m[1])) },
    {
      re: /(하루|이틀|사흘|나흘|닷새|열흘)\s*(뒤|후|후에|뒤에)/,
      to: (m) => { const n = { 하루: 1, 이틀: 2, 사흘: 3, 나흘: 4, 닷새: 5, 열흘: 10 }[m[1]]; return addDays(today, n === undefined ? 1 : n); },
    },
    { re: new RegExp("(?<!\\d)(\\d{1,3})\\s*주\\s*(뒤|후|후에|뒤에)"), to: (m) => addDays(today, 7 * Number(m[1])) },
    { re: /(일주일|한\s*주|1주일)\s*(뒤|후|후에|뒤에)/, to: () => addDays(today, 7) },
    {
      re: new RegExp("(?<!\\d)(\\d{1,2}|한|두|세)\\s*달\\s*(뒤|후|후에|뒤에)"),
      to: (m) => {
        const k = { 한: 1, 두: 2, 세: 3 }[m[1]];
        const idx = month - 1 + (k === undefined ? Number(m[1]) : k);
        return makeDate(year + Math.floor(idx / 12), idx % 12 + 1, Number(today.slice(8, 10)));
      },
    },
    { re: /글피/, to: () => addDays(today, 3) },
    { re: /낼모레|내일모레/, to: () => addDays(today, 2) },
    { re: /모레/, to: () => addDays(today, 2) },
    { re: /내일/, to: () => addDays(today, 1) },
    { re: new RegExp("(?<![가-힣])낼(?=$|[^가-힣]|까지|에|부터)"), to: () => addDays(today, 1) },
    { re: /오늘/, to: () => today },
    { re: new RegExp("(다다음\\s*주|다다음주|다담주)\\s*([일월화수목금토])" + WEEKDAY_SUFFIX), to: (m) => weekdayDate(today, m[2], 2) },
    { re: new RegExp("(다음\\s*주|(?<!다)담주|다음주|차주)\\s*([일월화수목금토])" + WEEKDAY_SUFFIX), to: (m) => weekdayDate(today, m[2], 1) },
    { re: new RegExp("(이번\\s*주|이번주|금주)\\s*([일월화수목금토])" + WEEKDAY_SUFFIX), to: (m) => weekdayDate(today, m[2], 0) },
    { re: new RegExp("(다다음\\s*주|다다음주|다담주)\\s*" + DEADLINE_WORDS), to: () => weekdayDate(today, "일", 2) },
    { re: new RegExp("(다음\\s*주|(?<!다)담주|다음주|차주)\\s*" + DEADLINE_WORDS), to: () => weekdayDate(today, "일", 1) },
    { re: /(다다음\s*주|다다음주|다담주)(?!\s*[일월화수목금토](?:요일|욜)?(?![가-힣]))/, to: () => weekdayDate(today, "월", 2) },
    { re: new RegExp("(다음\\s*주|(?<!다)담주|다음주|차주)(?!\\s*[일월화수목금토](?:요일|욜)?(?![가-힣]))"), to: () => weekdayDate(today, "월", 1) },
    { re: new RegExp("(이번\\s*주|이번주|금주)\\s*(" + DEADLINE_WORDS + "|중|내)" + DATE_TAIL), to: () => weekdayDate(today, "일", 0, true) },
    { re: /(이번\s*주|이번주|금주)(?!\s*[일월화수목금토](?:요일|욜)?(?![가-힣]))/, to: () => weekdayDate(today, "일", 0, true) },
    { re: /(이번\s*)?주말/, to: () => weekdayDate(today, "토", 0, true) },
    { re: new RegExp("(?<![가-힣])([월화수목금토일])(요일|욜)(?=$|[^가-힣]|까지|에|부터|마다|날)"), to: (m) => weekdayDate(today, m[1], 0, true) },
    {
      // 'N일' 단독(월 없이): 오늘 이후 첫 N일(최대 14달 탐색)
      re: new RegExp("(?<![\\d:월/.년])(?<!(?<!매)월\\s)(\\d{1,2})\\s*일(?=$|[^가-힣\\d]|까지|에(?!서)|날|부터|마감)(?!\\s*(동안|간|정도|이나|째|씩|1[가-힣a-zA-Z]))"),
      to: (m) => {
        const d = Number(m[1]);
        for (let s = 0; s < 14; s += 1) {
          const idx = month - 1 + s;
          const y = year + Math.floor(idx / 12);
          const mm = idx % 12 + 1;
          if (d > daysInMonth(y, mm)) continue;
          const iso = makeDate(y, mm, d);
          if (iso && iso >= today) return iso;
        }
        return null;
      },
    },
  ];

  let best = null;
  for (const { re, to } of rules) {
    const m = text.match(re);
    if (!m || (best && (m.index || 0) >= (best.m.index || 0))) continue;
    const date = to(m);
    if (date) best = { m, date };
  }
  if (!best) return null;

  const { m, date } = best;
  let matched = m[0];
  let after = text.slice((m.index || 0) + m[0].length);
  // 'A ~ B' 범위: 뒤쪽 날짜도 매칭 텍스트에 흡수(값은 앞 날짜)
  const range = after.match(/^\s*(~|-|–|부터)\s*/);
  if (range) {
    const tail = after.slice(range[0].length);
    const second = extractDate(tail, today);
    if (second && tail.indexOf(second.text) === 0) {
      matched += range[0] + second.text;
      after = tail.slice(second.text.length);
    }
  }
  const deadline = new RegExp("^\\s*" + DEADLINE_WORDS).test(after);
  const particle = after.match(new RegExp("^\\s*(?:(" + DEADLINE_WORDS.slice(1, -1) + "|에|날|부터|쯤|경)(?![가-힣]))?"));
  return { date, text: matched + (particle ? particle[0] : ""), deadline };
}

// ───────────────────────── 시각 추출 ─────────────────────────

const TIME_CORE =
  "(?:(오전|오후|아침|저녁|밤|낮|새벽)\\s*)?(\\d{1,2})(?:\\s*:\\s*(\\d{2})\\s*분?|\\s*시(?=$|[^가-힣]|반|까지|에|부터|쯤|경|정각|마다)(?:\\s*(\\d{1,2})\\s*분|\\s*(\\d{2})(?![\\d]|\\s*시|\\s*분))?)\\s*(반)?";
const TIME_CORE_OPTIONAL =
  "(?:(오전|오후|아침|저녁|밤|낮|새벽)\\s*)?(\\d{1,2})(?:\\s*:\\s*(\\d{2})\\s*분?|\\s*시(?=$|[^가-힣]|반|까지|에|부터|쯤|경|정각|마다)(?:\\s*(\\d{1,2})\\s*분|\\s*(\\d{2})(?![\\d]|\\s*시|\\s*분))?)?\\s*(반)?";
const TIME_RANGE_RE = new RegExp(TIME_CORE_OPTIONAL + "\\s*(?:~|-|–|부터)\\s*" + TIME_CORE + "\\s*(까지)?");
const TIME_SINGLE_RE = new RegExp(TIME_CORE);

function hhmm(h, m) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * 문장에서 시각(단일 또는 범위)을 찾는다.
 * 반환 { start:'HH:MM', end:'HH:MM', text:매칭 원문(+조사), note:해석 힌트|null, deadline?:boolean } | null
 */
function extractTime(text) {
  const wordMeridiem = (w) => (/(오후|저녁|밤|낮)/.test(w) ? "pm" : /(오전|아침|새벽)/.test(w) ? "am" : null);
  const context = LEISURE_RE.test(text) ? "pm" : MORNING_RE.test(text) ? "am" : null;

  const resolveHour = (info, noteBox) => {
    const w = wordMeridiem(info.word);
    let h = info.hour;
    if (h === 24) return 0;
    if (
      info.explicit24 || h >= 13 ||
      (w === "pm" && /밤/.test(info.word) && h >= 1 && h <= 5) ||
      (w === "pm" && /낮/.test(info.word) && h >= 10 && h <= 11)
    ) {
      // 그대로
    } else if (w === "pm" && h < 12) h += 12;
    else if (w === "pm" && h === 12 && /밤|새벽/.test(info.word)) h = 0;
    else if (w === "am" && h === 12) h = 0;
    else if (w === null && context === "pm" && h >= 1 && h < 12) { h += 12; noteBox.text = "저녁으로 해석했어요. 아침이면 시간을 고쳐주세요."; }
    else if (w === null && h >= 1 && h <= 4) { h += 12; noteBox.text = "오후로 해석했어요. 새벽이면 시간을 고쳐주세요."; }
    else if (w === null && h >= 5 && h <= 6) {
      if (context === "am") noteBox.text = "아침으로 해석했어요. 오후면 시간을 고쳐주세요.";
      else { h += 12; noteBox.text = "오후로 해석했어요. 새벽이면 시간을 고쳐주세요."; }
    }
    return Math.min(23, h);
  };

  /** 매치 그룹(offset부터 6개: 단어,시,분(:),분(분),분(2자리),반) → {hour, minute, word, explicit24} */
  const readTime = (m, off) => {
    const hStr = m[off + 2];
    if (hStr === undefined) return null;
    const hour = Number(hStr);
    if (hour > 24) return null;
    const minute = m[off + 3] !== undefined ? Number(m[off + 3]) : m[off + 4] !== undefined ? Number(m[off + 4]) : m[off + 5] !== undefined ? Number(m[off + 5]) : m[off + 6] ? 30 : 0;
    if (minute > 59) return null;
    const word = m[off + 1] || "";
    const explicit24 = (!word && m[off + 3] !== undefined) || (hStr.length === 2 && hStr.startsWith("0")) || hour >= 13;
    return { hour, minute, word, explicit24 };
  };

  const trailing = (rest) => {
    const m = rest.match(/^\s*(?:(까지|마감|에|부터|쯤|경|정각|정도)(?![가-힣]))?/);
    return { text: m ? m[0] : "", deadline: /^\s*(까지|마감)(?![가-힣])/.test(rest) };
  };

  const r = text.match(TIME_RANGE_RE);
  if (r && /시|:/.test(r[0])) {
    const a = readTime(r, 0);
    const b = readTime(r, 6);
    if (a && b) {
      const noteBox = { text: null };
      const aWord = wordMeridiem(a.word);
      const bWord = wordMeridiem(b.word);
      const start = resolveHour(a, noteBox);
      let end;
      if (bWord) end = resolveHour(b, noteBox);
      else if (b.explicit24) end = b.hour === 24 ? 0 : b.hour;
      else if (aWord && b.hour === 12) end = aWord === "pm" ? 0 : 12;
      else {
        const guess = aWord ? resolveHour({ ...b, word: a.word }, noteBox) : resolveHour({ ...b, word: "" }, { text: null });
        end = b.hour % 24;
        if (aWord && guess > start) end = guess;
        else if (!aWord && start < 12 && guess > start) end = guess;
        else if (end > start) { /* 그대로 */ }
        else if (end + 12 < 24 && end + 12 > start) end += 12;
        else if (end <= 6) { /* 그대로 */ }
        else end = (end + 12) % 24;
        if (end === 24) end = 0;
      }
      const tail = trailing(text.slice((r.index || 0) + r[0].length));
      return { start: hhmm(start, a.minute), end: hhmm(end % 24, b.minute), text: r[0] + tail.text, note: noteBox.text };
    }
  }

  const s = text.match(TIME_SINGLE_RE);
  if (s) {
    const a = readTime(s, 0);
    if (!a) return null;
    const noteBox = { text: null };
    const start = resolveHour(a, noteBox);
    const tail = trailing(text.slice((s.index || 0) + s[0].length));
    return { start: hhmm(start, a.minute), end: hhmm((start + 1) % 24, a.minute), text: s[0] + tail.text, note: noteBox.text, deadline: tail.deadline };
  }
  return null;
}

// ───────────────────────── 한 줄 파싱 (앱 t0) ─────────────────────────

const PROJECT_PREFIX_RE = /^(프로젝트|PJ|project)\s*[:：]/i;

function baseItem(kind, title, extra) {
  return Object.assign(
    { kind, title, date: null, start_time: null, end_time: null, priority: 3, project_name: null, weekday: null, note: null, raw: "" },
    extra,
  );
}

/**
 * 한 줄 → { item, explicitDate, emptyTitle, explicitPriority, extraWeekdays? }
 * item 은 앱 내부 형식 { kind, title, date, start_time, end_time, priority, project_name, weekday, note, raw }.
 */
function parseLine(rawText, opts) {
  const raw = rawText.trim();
  let text = normalizeEnglish(raw).replace(/\*+/g, " ").replace(/^#{1,6}\s+/, "");
  let note = null;

  // 우선순위
  let priority = 3;
  let explicitPriority = true;
  if (/!!!|긴급|급함|급해|급한|당장/.test(text)) priority = 5;
  else if (/!!|중요|높음/.test(text)) priority = 4;
  else if (/!(?!!)/.test(text)) priority = 4;
  else explicitPriority = false;
  if (/언젠가|언젠간|나중에/.test(text)) { priority = 1; explicitPriority = true; }
  else if (/낮음|여유/.test(text)) { priority = 2; explicitPriority = true; }
  text = text
    .replace(/!+/g, " ")
    .replace(/(^|\s)(지금\s*당장|급한\s*(거|것|일)|긴급|급함|급해|급한|당장|우선순위\s*(높음|낮음)|중요도\s*(높음|낮음)|중요|높음|낮음|여유\s*있을\s*때|여유|언젠가|언젠간|나중에)(?=\s|$|[:：])[:：]?/g, "$1 ");

  // 프로젝트 마커: 알려진 이름의 #이름/@이름/[이름] → 아무 #이름/@이름/[이름]
  let project = null;
  const knownProjects = [...(opts.projectNames || [])].sort((a, b) => b.length - a.length);
  for (const name of knownProjects) {
    const short = name.replace(/\s*프로젝트\s*$/, "").trim();
    const marker = [name, short].filter((s) => s.length >= 2).map((s) => [`#${s}`, `@${s}`, `[${s}]`]).flat().find((s) => text.includes(s));
    if (marker) { project = name; text = text.replace(marker, " "); break; }
  }
  if (!project) {
    const m = text.match(/(?:#|@)([^\s#@,]+)|\[([^\]]{2,})\]/);
    if (m) { project = (m[1] || m[2] || "").trim() || null; text = text.replace(m[0], " "); }
  }

  // 반복
  const isProjectPrefixed = PROJECT_PREFIX_RE.test(raw);
  const isDaily = !isProjectPrefixed && /매일|맨날|날마다/.test(text);
  let weekdays = [];
  const everyWeekList = text.match(/매주\s*((?:[일월화수목금토](?:요일|욜)?)(?:\s*[·/및과와,]?\s*[일월화수목금토](?:요일|욜)?)*)(?![가-힣])/);
  // 구분자를 선택 그룹 하나로 묶어 공백 자리마다 분기가 하나만 생기게 한다 — 옛 `\s*[·]?\s*` 꼴은 "월 월 월 … 운동"(마다 없음)에서 2^n 역추적
  const weekdayMada = text.match(new RegExp("(?<![가-힣\\d])((?:[일월화수목금토](?:요일|욜)?)(?:(?:\\s*[\xb7/및과와,])?\\s*[일월화수목금토](?:요일|욜)?)*)\\s*마다"));
  let habitHint = null;
  const everyNDays = text.match(new RegExp("(?<!\\d)(\\d{1,2})\\s*일\\s*마다"));
  const oneADay = text.match(/(^|\s)1일\s*1(?=[가-힣a-zA-Z])/);
  let isHabitByRule = false;
  if (everyNDays) { isHabitByRule = true; habitHint = `${everyNDays[1]}일마다 — 습관으로 넣었어요.`; text = text.replace(everyNDays[0], " "); }
  else if (oneADay) isHabitByRule = true;

  const toWeekdayList = (s) => Array.from(s.replace(/요일|욜/g, "")).filter((c) => WEEKDAYS.includes(c)).map((c) => WEEKDAYS.indexOf(c));
  if (everyWeekList) { weekdays = toWeekdayList(everyWeekList[1]); text = text.replace(everyWeekList[0], " "); }
  else if (weekdayMada) { weekdays = toWeekdayList(weekdayMada[1]); text = text.replace(weekdayMada[0], " "); }
  else if (/주말마다/.test(text)) { weekdays = [6, 0]; text = text.replace(/주말마다/, " "); }
  else if (/(^|\s)평일(만|마다|에)?(?=\s|$)/.test(text)) { weekdays = [1, 2, 3, 4, 5]; text = text.replace(/(^|\s)평일(만|마다|에)?(?=\s|$)/, "$1 "); }
  else if (/매주/.test(text)) {
    const one = text.match(new RegExp("(?<![가-힣])([일월화수목금토])(요일|욜)(?![가-힣])"));
    if (one) { weekdays = [WEEKDAYS.indexOf(one[1])]; text = text.replace(/매주/, " ").replace(one[0], " "); }
    else if (!isProjectPrefixed) {
      isHabitByRule = true;
      habitHint = "요일을 안 적어서 습관으로 넣었어요. 요일이 있으면 일과로 바꿔주세요.";
      text = text.replace(/매주/, " ");
    }
  }
  const isRoutine = weekdays.length > 0;
  const isHabit = isDaily || isHabitByRule;
  if (isDaily) text = text.replace(/매일|맨날|날마다/g, " ");

  // 날짜
  text = normalizeKoreanHours(text);
  const dateHit = extractDate(text, opts.today);
  if (dateHit) text = text.replace(dateHit.text, " ");

  // 시각
  const timeHit = extractTime(text);
  if (timeHit) { text = text.replace(timeHit.text, " "); if (timeHit.note) note = timeHit.note; }

  // 알려진 프로젝트 이름이 문장 안에 단어로 들어 있는 경우
  let isProjectLine = false;
  if (!project && !isProjectPrefixed && opts.projectNames) {
    for (const name of [...opts.projectNames].sort((a, b) => b.length - a.length)) {
      const short = name.replace(/\s*프로젝트\s*$/, "").trim();
      const hit = [name, short].filter((s) => s.length >= 2).find((s) => {
        const idx = text.indexOf(s);
        if (idx < 0) return false;
        const before = text[idx - 1] || " ";
        const after = text.slice(idx + s.length);
        return !/[가-힣a-zA-Z0-9]/.test(before) && /^(\s|$|의|에서|에\s|를|을|은|는|관련|[^가-힣a-zA-Z0-9])/.test(after);
      });
      if (!hit) continue;
      const remainder = cleanTitle(text.replace(hit, " ").trim().replace(/^(관련해서|관련|에서|의|를|을|은|는)\s*/, ""));
      const isMetaOnly = /^(마감일?|기한|데드라인|일정)?\s*(을|를|은|는|이|가)?\s*(로|으로)?\s*(변경|수정|바꾸기|바꿈|연장|변경하기|미루기)?$/.test(remainder);
      if (!(remainder.length >= 2) || isMetaOnly || /^(프로젝트|PJ|project)$/i.test(remainder)) { project = null; text = name; isProjectLine = true; }
      else { project = name; text = remainder; }
      break;
    }
  }

  let title = cleanTitle(text.replace(/^(프로젝트|PJ|project)\s*[:：]\s*/i, ""));
  if (project && title === "" && !timeHit) { title = project; project = null; isProjectLine = true; }
  const looksLikeProject = isProjectLine || isProjectPrefixed || (!project && /(프로젝트|PJ|project)\s*$/i.test(title));
  const isGenericWord = /^(할\s*일|할\s*것|해야\s*할\s*일|todo|to-do|일정|계획|스케줄|메모|일과)$/i.test(title);

  const wrap = (item) => ({ item, explicitDate: dateHit ? dateHit.date : null, emptyTitle: false, explicitPriority });
  const dateOrNull = dateHit ? dateHit.date : null;

  // 헤더 줄: 날짜/우선순위만 있고 제목이 없다 → 다음 줄들의 기본값
  if (!timeHit && !isRoutine && !isHabit && !isProjectLine && ((dateHit && title === "") || (explicitPriority && title === "") || isGenericWord)) {
    return {
      item: baseItem("task", title || raw, { date: dateOrNull, priority, note, raw }),
      explicitDate: dateOrNull,
      emptyTitle: true,
      explicitPriority,
    };
  }
  if (looksLikeProject && (isProjectPrefixed || isProjectLine || !isRoutine) && (!isHabit || isProjectPrefixed)) {
    return wrap(baseItem("project", title || raw, { date: dateOrNull, priority, note, raw }));
  }
  if (isRoutine) {
    const [first, ...rest] = weekdays;
    return {
      ...wrap(baseItem("routine", title || raw, {
        start_time: timeHit ? timeHit.start : "09:00",
        end_time: timeHit ? timeHit.end : "10:00",
        priority,
        weekday: first,
        note: timeHit ? note : "시간을 안 적어서 09:00으로 넣었어요.",
        raw,
      })),
      extraWeekdays: rest,
    };
  }
  if (isHabit) {
    return wrap(baseItem("habit", title || raw, { priority, note: habitHint || (timeHit ? "매일 하는 일이라 습관으로 넣었어요(시간은 뺐어요)." : null), raw }));
  }
  if (timeHit && timeHit.deadline) {
    return wrap(baseItem("task", title || raw, { date: dateHit ? dateHit.date : opts.today, priority, project_name: project, note: `${timeHit.start}까지`, raw }));
  }
  if (timeHit) {
    return wrap(baseItem("plan", title || raw, { date: dateHit ? dateHit.date : opts.today, start_time: timeHit.start, end_time: timeHit.end, priority, project_name: project, note, raw }));
  }
  return wrap(baseItem("task", title || raw, { date: dateOrNull, priority, project_name: project, note, raw }));
}

// ───────────────────────── 여러 줄 조립 (앱 t1) ─────────────────────────

/**
 * groups: [{text, bullet}][] (한 줄 = 한 그룹; 쉼표 분리된 줄은 조각 여러 개)
 * 헤더 줄(날짜/우선순위만) → 이후 줄 기본값, 프로젝트 줄 → 아래 불릿 줄 상속.
 * 반환 항목에는 앱 형식 필드 외에 dateExplicit(boolean)을 덧붙인다.
 */
function assemble(groups, opts) {
  const out = [];
  let headerDate = null;
  let headerPriority = null;
  let currentProject = null;
  for (const group of groups) {
    const parsed = group.map((seg) => parseLine(seg.text, opts));
    const bullet = !!(group[0] && group[0].bullet);
    if (parsed.length === 1 && parsed[0].emptyTitle) {
      headerDate = parsed[0].explicitDate;
      headerPriority = parsed[0].explicitPriority ? parsed[0].item.priority : null;
      currentProject = null;
      continue;
    }
    if (!bullet) currentProject = null;
    const found = parsed.find((p) => p.explicitDate);
    const groupDate = (found ? found.explicitDate : null) || headerDate;
    for (const p of parsed) {
      let item = p.item;
      let dateExplicit = !!p.explicitDate;
      if (groupDate && !p.explicitDate && (item.kind === "task" || item.kind === "plan" || item.kind === "project")) {
        item = { ...item, date: groupDate };
        dateExplicit = true;
      }
      if (headerPriority !== null && !p.explicitPriority && item.kind === "task") item = { ...item, priority: headerPriority };
      if (currentProject && bullet && !item.project_name && (item.kind === "task" || item.kind === "plan")) item = { ...item, project_name: currentProject };
      item = { ...item, dateExplicit };
      out.push(item);
      for (const wd of p.extraWeekdays || []) out.push({ ...item, weekday: wd });
    }
    if (parsed.length === 1 && parsed[0].item.kind === "project" && !bullet) currentProject = parsed[0].item.title;
  }
  return out;
}

/** 입력 전체 → [{text, bullet}][]  (줄 나누기 + 쉼표/그리고/슬래시 분리) */
function splitInput(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/[​﻿️]/g, ""))
    .filter((l) => !/^\s*(?:[-*•·▪◦]\s*)?\[[xX]\]/.test(l)) // 이미 끝낸 체크박스 줄은 무시
    .map((l) => ({ text: l.replace(BULLET_RE, "").trim(), bullet: BULLET_RE.test(l) && l.trim().length > 0 }))
    .filter((l) => l.text.length > 0)
    .map((l) => ({
      ...l,
      // '월, 수, 금' 같은 요일 나열의 쉼표는 분리 기호가 아니라 · 로
      text: l.text.replace(new RegExp("(?<![가-힣])([일월화수목금토](?:요일|욜)?)\\s*[,，、/]\\s*(?=[일월화수목금토](?:요일|욜)?(?![가-힣]))", "g"), "$1\xb7"),
    }));
  const groups = [];
  for (const line of lines) {
    const parts = line.text
      .split(new RegExp("(?<!\\d)\\s*[,，、;；]\\s*|(?<=\\d)\\s*[,，、;；]\\s*(?!\\d{3}(?!\\d))|\\s+\\/\\s+|\\s+(?:그리고|and)\\s+"))
      .map((s) => s.trim())
      .filter(Boolean);
    const signals = parts.filter((s) => SIGNAL_RE.test(s)).length;
    if (parts.length >= 2 && signals >= 2) groups.push(parts.map((s) => ({ text: s, bullet: line.bullet })));
    else groups.push([line]);
  }
  return groups;
}

/** 앱 내부 형식 항목 배열(앱의 규칙 파서 fallback과 동일 결과 + dateExplicit). */
function parseAll(text, opts) {
  const groups = splitInput(text);
  const first = assemble(groups, opts);
  const known = new Set((opts.projectNames || []).map((n) => n.trim().toLowerCase()));
  const newProjects = Array.from(new Set(first.filter((i) => i.kind === "project").map((i) => i.title.trim()).filter((t) => t.length >= 2 && !known.has(t.toLowerCase()))));
  const minimal = newProjects.filter((n) => !newProjects.some((o) => o !== n && n.includes(o)));
  if (minimal.length === 0) return first;
  // 새로 생긴 프로젝트 이름을 알려진 이름으로 삼아 한 번 더(본문 속 이름 인식)
  return assemble(groups, { ...opts, projectNames: [...(opts.projectNames || []), ...Array.from(new Set(minimal))] });
}

// ───────────────────────── 공개 API ─────────────────────────

/** 파서가 스스로 덧붙인 해석 힌트(사용자가 쓴 메모가 아님) → warnings 로 보낸다. */
const HINT_RE = /(해석했어요|넣었어요)/;

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function capture(input) {
  const inp = input || {};
  const text = typeof inp.text === "string" ? inp.text : "";
  const today = /^\d{4}-\d{2}-\d{2}$/.test(inp.today || "") ? inp.today : todayISO();
  const projectNames = Array.isArray(inp.projectNames) ? inp.projectNames.filter((n) => typeof n === "string" && n.trim()) : [];
  const warnings = [];
  const pushWarning = (title, msg) => { const w = `「${title}」 ${msg}`; if (!warnings.includes(w)) warnings.push(w); };

  if (!text.trim()) return { items: [], warnings: ["입력이 비어 있어요."] };

  const appItems = parseAll(text, { today, projectNames });
  const items = [];
  for (const a of appItems) {
    let note = a.note;
    if (note && HINT_RE.test(note)) { pushWarning(a.title, note); note = null; }
    const common = { kind: a.kind, title: a.title, note, raw: a.raw, explicitDate: !!a.dateExplicit };
    switch (a.kind) {
      case "task":
        items.push({ ...common, priority: a.priority, due: a.date, start: today, project: a.project_name });
        break;
      case "plan":
        items.push({ ...common, priority: a.priority, date: a.date || today, start_time: a.start_time || "09:00", end_time: a.end_time || "", project: a.project_name });
        break;
      case "habit":
        items.push({ ...common, priority: a.priority });
        break;
      case "routine":
        items.push({ ...common, priority: a.priority, start_time: a.start_time || "09:00", end_time: a.end_time || "", weekdays: [a.weekday], weekday: a.weekday });
        break;
      case "project":
      default:
        items.push({ ...common, kind: "project", priority: a.priority, due: a.date });
        break;
    }
  }
  if (items.length === 0) warnings.push("항목을 하나도 못 읽었어요. 한 줄에 하나씩 적어 주세요.");
  return { items, warnings };
}

/**
 * 문장에서 날짜만 뽑는다. 반환 { date:'YYYY-MM-DD'|null, rest:날짜 표현을 뺀 나머지 }.
 * 예) parseDate('다음주 수요일까지 보고서', '2026-10-16') → { date:'2026-10-21', rest:'보고서' }
 */
function parseDate(text, today) {
  const src = normalizeKoreanHours(normalizeEnglish(String(text || "")));
  const t = /^\d{4}-\d{2}-\d{2}$/.test(today || "") ? today : todayISO();
  const hit = extractDate(src, t);
  if (!hit) return { date: null, rest: src.replace(/\s{2,}/g, " ").trim() };
  return { date: hit.date, rest: src.replace(hit.text, " ").replace(/\s{2,}/g, " ").trim() };
}

capture.parseDate = parseDate;
capture.PRIORITY_LABELS = PRIORITY_LABELS;
capture.WEEKDAYS = WEEKDAYS;
// 테스트/디버그용 내부 함수(앱 내부 형식 그대로)
capture._internal = { parseLine, assemble, splitInput, parseAll, extractDate, extractTime, cleanTitle, normalizeEnglish, normalizeKoreanHours };

module.exports = capture;
