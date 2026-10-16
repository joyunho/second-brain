/**
 * capture.test.js — _System/Scripts/capture.js 테스트 (프레임워크 없음).
 *   node _System/Scripts/tests/capture.test.js   → 모두 통과하면 종료 코드 0, 아니면 1
 *
 * 두 층으로 검증한다.
 *  1) 명시 기대값: 설계서 §6-1 검증 문장(today = 2026-10-16, 금요일) + 날짜/시간/우선순위 개별 사례.
 *  2) 오라클 비교: capture.oracle.js(YouKnow 번들 page.pretty.js에서 그대로 떼어 낸 원본 파서)와
 *     같은 입력에 대해 내부 형식 결과가 완전히 같은지(JSON 동일) 비교한다. 250+ 문장, 기준일 여러 개.
 *  3) 계약 검증: Item 의 kind 별 키, 경고 형식, Templater 로더(window 있음) 시뮬레이션.
 *
 * 번들 확인 결과(기대값에 반영):
 *  - '9/10' 처럼 연도 없는 날짜는 오늘 이후 첫 해로 넘긴다 → 2026-10-16 기준 2027-09-10.
 *  - '썸네일 만들기 그리고 자막 넣기'는 분리되지 않는다. 쉼표/그리고/슬래시 분리는 조각 2개 이상이
 *    날짜·시간·#프로젝트 신호를 가질 때만 일어난다(앱 규칙 그대로). 신호가 있는 경우는 따로 검증.
 *  - #프로젝트 마커는 2글자 이상이어야 분리 신호로 센다(#집 은 아님).
 *  - 헤더 줄이 연달아 오면 뒤 헤더가 앞 헤더의 날짜/우선순위를 덮어쓴다(지우기 포함).
 */
"use strict";
// Templater 는 _System/Scripts 아래 .js 를 하위 폴더까지 전부 사용자 스크립트로 읽는다.
// Obsidian(브라우저 환경, window 존재) 안에서는 아무 일도 하지 않는 함수를 내보내고 끝낸다(테스트는 node 로만 실행).
if (typeof window !== "undefined" || typeof process === "undefined") { module.exports = function captureTest() { return "node _System/Scripts/tests/capture.test.js 로 실행하세요."; }; return; }

const path = require("path");
const capture = require(path.join(__dirname, "..", "capture.js"));
let oracle = null;
try { oracle = require(path.join(__dirname, "capture.oracle.js")); } catch (e) { oracle = null; }

const TODAY = "2026-10-16"; // 금요일
let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) { passed += 1; return; }
  failed += 1;
  failures.push(`✗ ${name}${detail !== undefined ? "\n    " + detail : ""}`);
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  check(name, a === b, `expected ${b}\n    actual   ${a}`);
}
function run(text, projectNames) {
  return capture({ text, today: TODAY, projectNames: projectNames || [], habitNames: [] });
}
function pick(item, keys) {
  const o = {};
  for (const k of keys) o[k] = item[k];
  return o;
}

// ───────── 1. 설계서 §6-1 검증 문장 ─────────
{
  const r = run("내일 오후 3시 치과");
  eq("내일 오후 3시 치과 → 계획 1개", r.items.length, 1);
  eq("내일 오후 3시 치과 → plan 2026-10-17 15:00–16:00", pick(r.items[0], ["kind", "title", "date", "start_time", "end_time", "explicitDate"]),
    { kind: "plan", title: "치과", date: "2026-10-17", start_time: "15:00", end_time: "16:00", explicitDate: true });
}
{
  const r = run("매주 월수금 저녁 7시 헬스");
  eq("매주 월수금 저녁 7시 헬스 → 일과 3개", r.items.length, 3);
  eq("매주 월수금 → weekdays [1,3,5]", r.items.map((i) => i.weekdays[0]), [1, 3, 5]);
  check("매주 월수금 → 모두 routine 19:00–20:00 헬스", r.items.every((i) => i.kind === "routine" && i.title === "헬스" && i.start_time === "19:00" && i.end_time === "20:00"), JSON.stringify(r.items));
  eq("매주 월수금 → 경고 없음", r.warnings, []);
}
{
  const r = run("매일 영어 단어 20개");
  eq("매일 영어 단어 20개 → habit", pick(r.items[0], ["kind", "title", "note"]), { kind: "habit", title: "영어 단어 20개", note: null });
  eq("매일 … → 1개", r.items.length, 1);
}
{
  const r = run(["프로젝트: 유튜브 채널 개편", "- 9/10까지 영상 편집!!", "- 썸네일 만들기 그리고 자막 넣기"].join("\n"));
  eq("프로젝트 블록 → 3개 (project + task + task)", r.items.map((i) => i.kind), ["project", "task", "task"]);
  eq("프로젝트: 유튜브 채널 개편 → project", pick(r.items[0], ["kind", "title", "due"]), { kind: "project", title: "유튜브 채널 개편", due: null });
  eq("- 9/10까지 영상 편집!! → task due 2027-09-10(지난 날짜는 내년) 우선순위 4 프로젝트 상속",
    pick(r.items[1], ["kind", "title", "due", "start", "priority", "project", "explicitDate"]),
    { kind: "task", title: "영상 편집", due: "2027-09-10", start: TODAY, priority: 4, project: "유튜브 채널 개편", explicitDate: true });
  // 앱 규칙: 날짜/시간 신호가 없는 '그리고'는 분리하지 않는다(오라클로도 확인).
  eq("- 썸네일 만들기 그리고 자막 넣기 → 신호 없음 → 1개 task(앱 규칙), 우선순위 3, 프로젝트 상속",
    pick(r.items[2], ["kind", "title", "priority", "project", "due"]),
    { kind: "task", title: "썸네일 만들기 그리고 자막 넣기", priority: 3, project: "유튜브 채널 개편", due: null });
}
{
  // 신호가 양쪽에 있으면 '그리고'로 2개로 나뉜다.
  const r = run(["프로젝트: 유튜브 채널 개편", "- 내일 썸네일 만들기 그리고 모레 자막 넣기"].join("\n"));
  eq("그리고 분리(양쪽 날짜) → project + task 2개", r.items.map((i) => i.kind), ["project", "task", "task"]);
  eq("그리고 분리 → 제목/마감", r.items.slice(1).map((i) => [i.title, i.due, i.priority, i.project]),
    [["썸네일 만들기", "2026-10-17", 3, "유튜브 채널 개편"], ["자막 넣기", "2026-10-18", 3, "유튜브 채널 개편"]]);
}
{
  const r = run("언젠가 책 정리 #집");
  eq("언젠가 책 정리 #집 → task 우선순위 1, 프로젝트 집", pick(r.items[0], ["kind", "title", "priority", "project", "due"]),
    { kind: "task", title: "책 정리", priority: 1, project: "집", due: null });
}
{
  const r = run("주말마다 러닝");
  eq("주말마다 러닝 → 일과 2개 [6,0]", r.items.map((i) => [i.kind, i.weekdays[0], i.start_time, i.end_time]), [["routine", 6, "09:00", "10:00"], ["routine", 0, "09:00", "10:00"]]);
  check("주말마다 러닝 → 경고 '시간을 안 적어서 09:00으로 넣었어요.'", r.warnings.some((w) => w.includes("시간을 안 적어서 09:00으로 넣었어요.")), JSON.stringify(r.warnings));
  eq("주말마다 러닝 → 힌트는 note 가 아니라 warnings 로", r.items.map((i) => i.note), [null, null]);
}
{
  // 전체 문장을 한 번에 — 순서/개수
  const r = run(["내일 오후 3시 치과", "매주 월수금 저녁 7시 헬스", "매일 영어 단어 20개", "프로젝트: 유튜브 채널 개편", "- 9/10까지 영상 편집!!", "- 썸네일 만들기 그리고 자막 넣기", "언젠가 책 정리 #집", "주말마다 러닝"].join("\n"));
  eq("§6-1 전체 → kinds", r.items.map((i) => i.kind), ["plan", "routine", "routine", "routine", "habit", "project", "task", "task", "task", "routine", "routine"]);
}

// ───────── 2. parseDate ─────────
{
  const pd = (t) => capture.parseDate(t, TODAY);
  eq("parseDate 다음주 수요일까지 보고서", pd("다음주 수요일까지 보고서"), { date: "2026-10-21", rest: "보고서" });
  eq("parseDate 내일", pd("내일 치과").date, "2026-10-17");
  eq("parseDate 낼", pd("낼 치과").date, "2026-10-17");
  eq("parseDate 모레", pd("모레 회의").date, "2026-10-18");
  eq("parseDate 글피", pd("글피 회의").date, "2026-10-19");
  eq("parseDate 낼모레", pd("낼모레 회의").date, "2026-10-18");
  eq("parseDate 3일 뒤", pd("3일 뒤 발표").date, "2026-10-19");
  eq("parseDate 열흘 뒤", pd("열흘 뒤 발표").date, "2026-10-26");
  eq("parseDate 일주일 뒤", pd("일주일 뒤 점검").date, "2026-10-23");
  eq("parseDate 2주 뒤", pd("2주 뒤 점검").date, "2026-10-30");
  eq("parseDate 한 달 뒤", pd("한 달 뒤 점검").date, "2026-11-16");
  eq("parseDate 11월 3일", pd("11월 3일 발표").date, "2026-11-03");
  eq("parseDate 9/10 (지남→내년)", pd("9/10 마감").date, "2027-09-10");
  eq("parseDate 12.25", pd("12.25 파티").date, "2026-12-25");
  eq("parseDate 2026-12-01", pd("2026-12-01 제출"), { date: "2026-12-01", rest: "제출" });
  eq("parseDate 2027년 1월 5일", pd("2027년 1월 5일 출국").date, "2027-01-05");
  eq("parseDate 이번 주 일요일", pd("이번 주 일요일 청소").date, "2026-10-18");
  eq("parseDate 다음 주 월요일", pd("다음 주 월요일 회의").date, "2026-10-19");
  eq("parseDate 다다음 주 화요일", pd("다다음 주 화요일 회의").date, "2026-10-27");
  eq("parseDate 월요일 (지남 → +7)", pd("월요일 회의").date, "2026-10-19");
  eq("parseDate 금요일 (오늘)", pd("금요일 회식").date, "2026-10-16");
  eq("parseDate 토요일", pd("토요일 등산").date, "2026-10-17");
  eq("parseDate 주말", pd("주말 등산").date, "2026-10-17");
  eq("parseDate 월말", pd("월말 정산").date, "2026-10-31");
  eq("parseDate 이번 달 말", pd("이번 달 말 정산").date, "2026-10-31");
  eq("parseDate 다음 달 초", pd("다음 달 초 이사").date, "2026-11-05");
  eq("parseDate 다음 달 중순", pd("다음 달 중순 이사").date, "2026-11-15");
  eq("parseDate 다음 달 3일", pd("다음 달 3일 납부").date, "2026-11-03");
  eq("parseDate 연말", pd("연말 결산").date, "2026-12-31");
  eq("parseDate 내년", pd("내년 이직").date, "2027-12-31");
  eq("parseDate 내년 초", pd("내년 초 이직").date, "2027-01-15");
  eq("parseDate 20일 (단독)", pd("20일 월세").date, "2026-10-20");
  eq("parseDate 5일 (지남 → 다음 달)", pd("5일 월세").date, "2026-11-05");
  eq("parseDate 11월 둘째 주 토요일", pd("11월 둘째 주 토요일 결혼식").date, "2026-11-14");
  eq("parseDate 날짜 없음", pd("보고서 쓰기"), { date: null, rest: "보고서 쓰기" });
  eq("parseDate 영어 tomorrow", pd("tomorrow 치과").date, "2026-10-17");
  eq("parseDate 영어 next monday", pd("next monday 회의").date, "2026-10-19");
  eq("parseDate 범위 '10/20~10/22'", pd("10/20~10/22 워크숍"), { date: "2026-10-20", rest: "워크숍" });
}

// ───────── 3. 시간 / 종류 / 우선순위 개별 사례 ─────────
{
  const one = (t, p) => run(t, p).items[0];
  eq("7-10시 공부 → plan 07:00–10:00", pick(one("7-10시 공부"), ["kind", "start_time", "end_time", "date"]), { kind: "plan", start_time: "07:00", end_time: "10:00", date: TODAY });
  eq("오후 2시 반 미팅 → 14:30", pick(one("오후 2시 반 미팅"), ["kind", "start_time", "end_time", "title"]), { kind: "plan", start_time: "14:30", end_time: "15:30", title: "미팅" });
  eq("밤 11시 → 23:00", one("밤 11시 독서").start_time, "23:00");
  eq("새벽 1시 → 01:00", one("새벽 1시 기도").start_time, "01:00");
  eq("정오 점심 → 12:00", one("정오 점심").start_time, "12:00");
  eq("자정 → 00:00", one("자정 서버 점검").start_time, "00:00");
  eq("3시까지 보고서 → task + note '15:00까지'", pick(one("3시까지 보고서"), ["kind", "title", "note", "due"]), { kind: "task", title: "보고서", note: "15:00까지", due: TODAY });
  eq("내일 5시까지 제출 → due 내일, note", pick(one("내일 5시까지 제출"), ["kind", "due", "note"]), { kind: "task", due: "2026-10-17", note: "17:00까지" });
  eq("7시 치맥 → 저녁 문맥 19:00", one("7시 치맥").start_time, "19:00");
  check("7시 치맥 → 경고(저녁으로 해석)", run("7시 치맥").warnings.some((w) => w.includes("저녁으로 해석했어요")));
  eq("7시 조깅 → 아침 문맥 07:00", one("7시 조깅").start_time, "07:00");
  eq("3시 회의 → 15:00 (1~4시는 오후)", one("3시 회의").start_time, "15:00");
  eq("6시 기상 → 06:00", one("6시 기상").start_time, "06:00");
  eq("14:30 치과 → 14:30", one("14:30 치과").start_time, "14:30");
  eq("3pm dentist → plan 15:00", pick(one("3pm dentist"), ["kind", "start_time"]), { kind: "plan", start_time: "15:00" });
  eq("한 시 반 미팅 → 13:30", one("한 시 반 미팅").start_time, "13:30");
  eq("저녁 7시~9시 공부 → 19:00–21:00", pick(one("저녁 7시~9시 공부"), ["start_time", "end_time"]), { start_time: "19:00", end_time: "21:00" });

  eq("긴급 → 5", one("긴급 서류 제출").priority, 5);
  eq("!!! → 5", one("서류 제출!!!").priority, 5);
  eq("당장 → 5", one("당장 전화하기").priority, 5);
  eq("중요 → 4", one("중요 발표 준비").priority, 4);
  eq("! → 4", one("발표 준비!").priority, 4);
  eq("낮음 → 2", one("낮음 서랍 정리").priority, 2);
  eq("여유 → 2", one("여유 서랍 정리").priority, 2);
  eq("나중에 → 1", one("나중에 사진 정리").priority, 1);
  eq("기본 → 3", one("사진 정리").priority, 3);
  eq("우선순위 라벨", capture.PRIORITY_LABELS, { 5: "긴급", 4: "중요", 3: "보통", 2: "낮음", 1: "언젠가" });

  eq("@마커 → 프로젝트", pick(one("보고서 쓰기 @회사"), ["title", "project"]), { title: "보고서 쓰기", project: "회사" });
  eq("[마커] → 프로젝트", pick(one("보고서 쓰기 [회사]"), ["title", "project"]), { title: "보고서 쓰기", project: "회사" });
  eq("'유튜브 프로젝트' 접미 → project", pick(one("유튜브 프로젝트"), ["kind", "title"]), { kind: "project", title: "유튜브 프로젝트" });
  eq("PJ: 접두 → project", pick(one("PJ: 이사 준비"), ["kind", "title"]), { kind: "project", title: "이사 준비" });
  eq("#집 마커만 → project 집", pick(one("#집"), ["kind", "title"]), { kind: "project", title: "집" });
  eq("알려진 프로젝트 이름 포함 → project 연결", pick(one("유튜브 채널 개편 썸네일 만들기", ["유튜브 채널 개편"]), ["kind", "title", "project"]), { kind: "task", title: "썸네일 만들기", project: "유튜브 채널 개편" });
  eq("#마커로 알려진 프로젝트(긴 이름 우선)", pick(one("영상 편집 #유튜브", ["유튜브 프로젝트"]), ["title", "project"]), { title: "영상 편집", project: "유튜브 프로젝트" });

  eq("매일 → habit", one("매일 물 2리터").kind, "habit");
  eq("맨날 → habit", one("맨날 스트레칭").kind, "habit");
  eq("3일마다 → habit + 경고", [one("3일마다 화분 물주기").kind, run("3일마다 화분 물주기").warnings.length], ["habit", 1]);
  eq("1일 1커밋 → habit", pick(one("1일 1커밋"), ["kind", "title"]), { kind: "habit", title: "1일 1커밋" });
  eq("매주 (요일 없음) → habit + 경고", [one("매주 장보기").kind, run("매주 장보기").warnings[0]], ["habit", "「장보기」 요일을 안 적어서 습관으로 넣었어요. 요일이 있으면 일과로 바꿔주세요."]);
  eq("매일 아침 7시 조깅 → habit(시간 제거) + 경고", [one("매일 아침 7시 조깅").kind, run("매일 아침 7시 조깅").warnings.length], ["habit", 1]);
  eq("화요일마다 → routine [2]", pick(one("화요일마다 분리수거"), ["kind", "weekdays"]), { kind: "routine", weekdays: [2] });
  eq("평일 8시 출근 → routine 5개 08:00", run("평일 8시 출근").items.map((i) => [i.weekdays[0], i.start_time]), [[1, "08:00"], [2, "08:00"], [3, "08:00"], [4, "08:00"], [5, "08:00"]]);
  eq("매주 월, 수 → 요일 쉼표는 분리 아님", run("매주 월, 수 저녁 8시 요가").items.map((i) => i.weekdays[0]), [1, 3]);
  eq("월·수·금 마다 → [1,3,5]", run("월·수·금마다 헬스").items.map((i) => i.weekdays[0]), [1, 3, 5]);
}

// ───────── 4. 여러 줄: 헤더 줄, 불릿 상속, 쉼표 분리, 체크된 줄 무시 ─────────
{
  const r = run(["내일", "장보기", "빨래"].join("\n"));
  eq("헤더 줄 '내일' → 아래 줄 due 상속", r.items.map((i) => [i.title, i.due, i.explicitDate]), [["장보기", "2026-10-17", true], ["빨래", "2026-10-17", true]]);
}
{
  const r = run(["긴급", "서류 제출", "전화"].join("\n"));
  eq("헤더 줄 '긴급' → 우선순위 상속", r.items.map((i) => i.priority), [5, 5]);
}
{
  const r = run(["유튜브 프로젝트", "- 썸네일", "- 자막", "장보기"].join("\n"));
  eq("프로젝트 줄 아래 불릿만 상속", r.items.map((i) => [i.kind, i.title, i.project || null]), [["project", "유튜브 프로젝트", null], ["task", "썸네일", "유튜브 프로젝트"], ["task", "자막", "유튜브 프로젝트"], ["task", "장보기", null]]);
}
{
  const r = run("내일 치과, 모레 미용실");
  eq("쉼표 분리(양쪽 날짜) → 2개", r.items.map((i) => [i.title, i.due]), [["치과", "2026-10-17"], ["미용실", "2026-10-18"]]);
}
{
  const r = run("김치, 밥, 계란 사기");
  eq("쉼표지만 신호 없음 → 1개", r.items.map((i) => i.title), ["김치, 밥, 계란 사기"]);
}
{
  const r = run(["- [x] 끝난 일", "- [ ] 남은 일", "1. 번호 항목", "☐ 체크박스 항목"].join("\n"));
  eq("체크된 줄 무시, 불릿/번호/체크박스 제거", r.items.map((i) => i.title), ["남은 일", "번호 항목", "체크박스 항목"]);
}
{
  eq("빈 입력 → 경고", run("   \n  "), { items: [], warnings: ["입력이 비어 있어요."] });
  eq("today 없으면 오늘 날짜 사용(형식만 확인)", /^\d{4}-\d{2}-\d{2}$/.test(capture({ text: "장보기" }).items[0].start), true);
}

// ───────── 6. 연말·연초 경계, 윤년, 요일 기준(일요일), 잘못된 날짜 ─────────
{
  const pdT = (t, today) => capture.parseDate(t, today).date;
  eq("12-30 내일", pdT("내일 치과", "2026-12-30"), "2026-12-31");
  eq("12-30 모레 → 새해", pdT("모레 신년회", "2026-12-30"), "2027-01-01");
  eq("12-30 글피", pdT("글피 출근", "2026-12-30"), "2027-01-02");
  eq("12-30 3일 뒤", pdT("3일 뒤 점검", "2026-12-30"), "2027-01-02");
  eq("12-30 다음 달 3일 → 1월", pdT("다음 달 3일 납부", "2026-12-30"), "2027-01-03");
  eq("12-30 다음 달 초", pdT("다음 달 초 이사", "2026-12-30"), "2027-01-05");
  eq("12-30 1월 5일 → 내년", pdT("1월 5일 발표", "2026-12-30"), "2027-01-05");
  eq("12-30 1/5 → 내년", pdT("1/5 발표", "2026-12-30"), "2027-01-05");
  eq("12-30(수) 다음 주 월요일 → 1/4", pdT("다음 주 월요일 회의", "2026-12-30"), "2027-01-04");
  eq("12-30 다음 주까지 → 다음 주 일요일", pdT("다음 주까지 초안", "2026-12-30"), "2027-01-10");
  eq("12-30 이번 주 일요일 → 1/3", pdT("이번 주 일요일 청소", "2026-12-30"), "2027-01-03");
  eq("12-30 연말", pdT("연말 정산", "2026-12-30"), "2026-12-31");
  eq("12-30 월말", pdT("월말 정산", "2026-12-30"), "2026-12-31");
  eq("12-30 5일 → 1/5", pdT("5일 월세", "2026-12-30"), "2027-01-05");
  eq("12-30 한 달 뒤 → 1/30", pdT("한 달 뒤 점검", "2026-12-30"), "2027-01-30");
  eq("12-30 내년 3월 1일", pdT("내년 3월 1일 여행", "2026-12-30"), "2027-03-01");
  eq("12-31 12월 31일 = 오늘", pdT("12월 31일 송년회", "2026-12-31"), "2026-12-31");
  eq("01-01 12월 31일 → 올해 말", pdT("12월 31일 송년회", "2027-01-01"), "2027-12-31");
  eq("윤년: 2027년에 2월 29일 → 2028-02-29", pdT("2월 29일 행사", "2027-02-10"), "2028-02-29");
  eq("윤년: 2028년 2월 29일", pdT("2월 29일 행사", "2028-02-10"), "2028-02-29");
  eq("31일 (10월)", pdT("31일 월세", "2026-10-16"), "2026-10-31");
  eq("31일 (11월은 30일까지 → 12/31)", pdT("31일 월세", "2026-11-16"), "2026-12-31");
  eq("일요일에 '이번 주 일요일' = 오늘", pdT("이번 주 일요일 청소", "2026-10-18"), "2026-10-18");
  eq("일요일에 '일요일' = 오늘", pdT("일요일 청소", "2026-10-18"), "2026-10-18");
  eq("일요일에 '다음 주 월요일' = 내일(주 시작 월요일)", pdT("다음 주 월요일 회의", "2026-10-18"), "2026-10-19");
  eq("일요일에 '주말' → 다음 토요일", pdT("주말 등산", "2026-10-18"), "2026-10-24");
  eq("13월 → 날짜 없음", pdT("13월 발표", TODAY), null);
  eq("2월 30일 → 날짜 없음", pdT("2월 30일 발표", TODAY), null);
  eq("0일 뒤 → 오늘", pdT("0일 뒤 발표", TODAY), TODAY);
  eq("100일 뒤", pdT("100일 뒤 발표", TODAY), "2027-01-24");
  eq("99999일 뒤 → 날짜 없음(범위 밖)", pdT("99999일 뒤 발표", TODAY), null);
  eq("10월 마지막 주 금요일", pdT("10월 마지막 주 금요일 회식", TODAY), "2026-10-30");
  eq("10월 첫째 주 월요일(지난 날짜라도 그대로)", pdT("10월 첫째 주 월요일 회의", TODAY), "2026-10-05");
  eq("3월 (지남) → 내년 3월 말", pdT("3월 발표", TODAY), "2027-03-31");
  eq("10월 → 이달 말", pdT("10월 발표", TODAY), "2026-10-31");
  eq("3일간 → 날짜 아님", pdT("3일간 여행", TODAY), null);
  eq("금주 내", pdT("금주 내 초안", TODAY), "2026-10-18");
  eq("다담주 월요일", pdT("다담주 월요일 치과", TODAY), "2026-10-26");
  eq("by Friday → 오늘(금)", pdT("by Friday 보고서", TODAY), TODAY);
  eq("Oct 20", pdT("Oct 20 발표", TODAY), "2026-10-20");
  eq("parseDate today 가 이상하면 오늘 날짜 사용", /^\d{4}-\d{2}-\d{2}$/.test(capture.parseDate("내일", "nope").date), true);
}

// ───────── 7. 오후/저녁/아침 추론 표 (앱 tH/tW 문맥 규칙) ─────────
{
  const st = (t) => { const r = run(t); const i = r.items[0]; return [i.kind, i.start_time || null, i.end_time || null, r.warnings.length]; };
  eq("2시 회의 → 14:00 (1~4시는 오후) + 경고", st("2시 회의"), ["plan", "14:00", "15:00", 1]);
  eq("5시 회의 → 17:00 (5~6시 문맥 없음 → 오후) + 경고", st("5시 회의"), ["plan", "17:00", "18:00", 1]);
  eq("6시 저녁 → 18:00 (저녁 문맥)", st("6시 저녁"), ["plan", "18:00", "19:00", 1]);
  eq("6시 기상 → 06:00 (아침 문맥) + 경고", st("6시 기상"), ["plan", "06:00", "07:00", 1]);
  eq("8시 회의 → 08:00 (7~11시는 그대로, 경고 없음)", st("8시 회의"), ["plan", "08:00", "09:00", 0]);
  eq("11시 회의 → 11:00", st("11시 회의"), ["plan", "11:00", "12:00", 0]);
  eq("12시 회의 → 12:00", st("12시 회의"), ["plan", "12:00", "13:00", 0]);
  eq("9시 넷플 → 21:00 (여가 문맥)", st("9시 넷플"), ["plan", "21:00", "22:00", 1]);
  eq("7시 기상 → 07:00", st("7시 기상"), ["plan", "07:00", "08:00", 0]);
  eq("오후 12시 점심 → 12:00", st("오후 12시 점심"), ["plan", "12:00", "13:00", 0]);
  eq("밤 3시 게임 → 03:00 (밤 1~5시는 새벽)", st("밤 3시 게임"), ["plan", "03:00", "04:00", 0]);
  eq("낮 11시 → 11:00", st("낮 11시 회의"), ["plan", "11:00", "12:00", 0]);
  eq("새벽 12시 → 00:00", st("새벽 12시 배치"), ["plan", "00:00", "01:00", 0]);
  eq("오전 12시 마감 → task 00:00까지", pick(run("오전 12시 마감").items[0], ["kind", "note"]), { kind: "task", note: "00:00까지" });
  eq("9시-11시 회의 → 09:00–11:00", st("9시-11시 회의"), ["plan", "09:00", "11:00", 0]);
  eq("10시~2시 작업 → 10:00–14:00 (끝이 시작보다 앞이면 +12)", st("10시~2시 작업"), ["plan", "10:00", "14:00", 0]);
  eq("11시~1시 점심 약속 → 11:00–13:00", st("11시~1시 점심 약속"), ["plan", "11:00", "13:00", 0]);
  eq("밤 10시-2시 게임 → 22:00–02:00", st("밤 10시-2시 게임"), ["plan", "22:00", "02:00", 0]);
  eq("오후 1시~3시 작업 → 13:00–15:00", st("오후 1시~3시 작업"), ["plan", "13:00", "15:00", 0]);
  eq("저녁 8시부터 10시까지 공부 → 20:00–22:00", st("저녁 8시부터 10시까지 공부"), ["plan", "20:00", "22:00", 0]);
  eq("8~10시 러닝 → 08:00–10:00", st("8~10시 러닝"), ["plan", "08:00", "10:00", 0]);
  eq("9am-5pm 근무 → 09:00–17:00", st("9am-5pm 근무"), ["plan", "09:00", "17:00", 0]);
  eq("3시반 미팅 → 15:30", st("3시반 미팅"), ["plan", "15:30", "16:30", 1]);
  eq("세 시 반 미팅 → 15:30", st("세 시 반 미팅"), ["plan", "15:30", "16:30", 1]);
  eq("열한 시 회의 → 11:00", st("열한 시 회의"), ["plan", "11:00", "12:00", 0]);
  eq("9시 30분 출근 → 09:30", st("9시 30분 출근"), ["plan", "09:30", "10:30", 0]);
  eq("25시 회의 → 시간 아님 → task", st("25시 회의"), ["task", null, null, 0]);
  eq("12:75 회의 → 시간 아님 → task", st("12:75 회의"), ["task", null, null, 0]);
  eq("3시간 운동 → 시간 아님 → task", st("3시간 운동"), ["task", null, null, 0]);
  eq("오후 3시 마감 보고서 → task + 15:00까지 + due 오늘", pick(run("오후 3시 마감 보고서").items[0], ["kind", "title", "note", "due"]), { kind: "task", title: "보고서", note: "15:00까지", due: TODAY });
  eq("9시 넷플 다음주 금요일 → 날짜 있는 계획 21:00", pick(run("9시 넷플 다음주 금요일").items[0], ["kind", "date", "start_time", "explicitDate"]), { kind: "plan", date: "2026-10-23", start_time: "21:00", explicitDate: true });
  eq("매일 7시~8시 러닝 → 습관(시간 제거) + 경고", [run("매일 7시~8시 러닝").items[0].kind, run("매일 7시~8시 러닝").warnings[0]], ["habit", "「러닝」 매일 하는 일이라 습관으로 넣었어요(시간은 뺐어요)."]);
}

// ───────── 8. 헤더 줄 기본값 (날짜/우선순위만 있는 줄) ─────────
{
  eq("헤더 '모레' + 줄 자체 날짜가 이김", run("모레\n- 치과\n- 11월 1일 미용실").items.map((i) => [i.title, i.due, i.explicitDate]), [["치과", "2026-10-18", true], ["미용실", "2026-11-01", true]]);
  eq("헤더 '중요' + 줄 자체 우선순위가 이김", run("중요\n보고서\n긴급 전화").items.map((i) => [i.title, i.priority]), [["보고서", 4], ["전화", 5]]);
  eq("헤더 '내일 긴급' → 날짜+우선순위 둘 다 상속", pick(run("내일 긴급\n장보기").items[0], ["title", "due", "priority", "explicitDate"]), { title: "장보기", due: "2026-10-17", priority: 5, explicitDate: true });
  eq("두 번째 헤더 줄이 첫 헤더의 날짜를 지움(앱 규칙)", run("내일\n긴급\n장보기").items.map((i) => [i.title, i.due, i.priority]), [["장보기", null, 5]]);
  eq("헤더 우선순위는 task 에만 (plan 은 그대로 3)", run("긴급\n장보기\n오후 3시 회의").items.map((i) => [i.kind, i.priority]), [["task", 5], ["plan", 3]]);
  eq("헤더 날짜는 plan 에도 상속", run("내일\n오후 3시 회의").items.map((i) => [i.kind, i.date, i.explicitDate]), [["plan", "2026-10-17", true]]);
  eq("'할 일' 단어만 있는 줄도 헤더", run("할 일\n세차\n청소").items.map((i) => i.title), ["세차", "청소"]);
  eq("'내일 할 일' → 날짜 헤더", run("내일 할 일\n세차").items.map((i) => [i.title, i.due]), [["세차", "2026-10-17"]]);
  eq("'## 내일' 마크다운 제목도 헤더", run("## 내일\n- 운동\n- 독서").items.map((i) => [i.title, i.due]), [["운동", "2026-10-17"], ["독서", "2026-10-17"]]);
  eq("'일정' 한 단어만 → 항목 없음 + 경고", run("일정"), { items: [], warnings: ["항목을 하나도 못 읽었어요. 한 줄에 하나씩 적어 주세요."] });
}

// ───────── 9. 불릿 상속 (프로젝트 줄 아래 불릿) ─────────
{
  const r = run("유튜브 프로젝트\n- 내일 썸네일\n- 3시 미팅\n- 매일 운동\n청소");
  eq("프로젝트 줄 아래: task·plan 은 상속, habit 은 아님, 불릿 아닌 줄은 끊김",
    r.items.map((i) => [i.kind, i.title, i.project === undefined ? "-" : i.project]),
    [["project", "유튜브 프로젝트", "-"], ["task", "썸네일", "유튜브 프로젝트"], ["plan", "미팅", "유튜브 프로젝트"], ["habit", "운동", "-"], ["task", "청소", null]]);
  eq("불릿 줄에 자체 #프로젝트가 있으면 그것이 이김", run("유튜브 프로젝트\n- 책 정리 #집").items[1].project, "집");
  eq("'PJ:' 접두 프로젝트도 상속", run("PJ: 이사\n- 짐 싸기\n- 청소").items.map((i) => i.project === undefined ? "-" : i.project), ["-", "이사", "이사"]);
  eq("불릿 프로젝트 줄('- 유튜브 프로젝트')은 상속 시작점이 아님", run("- 유튜브 프로젝트\n- 썸네일").items.map((i) => [i.kind, i.project === undefined ? "-" : i.project]), [["project", "-"], ["task", null]]);
  eq("'### 프로젝트: 이사' → 제목 기호 때문에 접두 인식 안 됨(앱 그대로: task 2개)", run("### 프로젝트: 이사\n- 짐 싸기").items.map((i) => i.kind), ["task", "task"]);
  eq("새 프로젝트 이름이 본문에 단어로 나오면 2차 파싱에서 연결", run("프로젝트: 이사 준비\n이사 준비 박스 사기").items.map((i) => [i.kind, i.title, i.project === undefined ? "-" : i.project]), [["project", "이사 준비", "-"], ["task", "박스 사기", "이사 준비"]]);
}

// ───────── 10. 쉼표/그리고/and/슬래시 분리 ─────────
{
  eq("'그리고' 3개 조각(모두 날짜)", run("내일 치과 그리고 모레 미용실 그리고 글피 회식").items.map((i) => [i.title, i.due]), [["치과", "2026-10-17"], ["미용실", "2026-10-18"], ["회식", "2026-10-19"]]);
  eq("' / ' 양쪽 날짜 → 분리", run("내일 치과 / 모레 미용실").items.map((i) => i.title), ["치과", "미용실"]);
  eq("' / ' 신호 없음 → 분리 안 함", run("치과 / 미용실").items.map((i) => i.title), ["치과 / 미용실"]);
  eq("'and' 양쪽 날짜 → 분리", run("내일 치과 and 모레 미용실").items.map((i) => i.title), ["치과", "미용실"]);
  eq("쉼표 + 시간 신호 → 계획 2개, 헤더 없이 그룹 날짜 공유", run("오늘 3시 회의, 5시 보고").items.map((i) => [i.kind, i.title, i.date, i.start_time]), [["plan", "회의", TODAY, "15:00"], ["plan", "보고", TODAY, "17:00"]]);
  eq("천 단위 쉼표(1,000)는 분리 기호가 아님", run("1,000원 송금, 내일 2,500원 입금").items.map((i) => i.title), ["1,000원 송금, 2,500원 입금"]);
  eq("#프로젝트 신호 둘(2글자 이상) → 분리", run("#집안 책 정리, #회사 보고서").items.map((i) => [i.title, i.project]), [["책 정리", "집안"], ["보고서", "회사"]]);
  // 앱 신호 규칙 [#@][^\s#@,]{2,} — 한 글자 마커(#집)는 분리 신호로 세지 않아 1개로 남는다(앱 그대로).
  eq("한 글자 #마커는 분리 신호가 아님(앱 규칙)", run("#집 책 정리, #회사 보고서").items.map((i) => [i.title, i.project]), [["책 정리, #회사 보고서", "집"]]);
  eq("프로젝트 아래 불릿의 쉼표(신호 없음) → 1개", run("프로젝트: 이사\n- 짐 싸기, 청소").items.map((i) => i.title), ["이사", "짐 싸기, 청소"]);
  eq("요일 나열 '토, 일 마다' → 일과 2개", run("토, 일 마다 등산").items.map((i) => i.weekdays[0]), [6, 0]);
  eq("체크된 줄만 있으면 항목 없음 + 경고", run("- [x] 끝\n- [X] 끝2\n* [x] 끝3"), { items: [], warnings: ["항목을 하나도 못 읽었어요. 한 줄에 하나씩 적어 주세요."] });
  eq("→ + 2) 불릿도 제거", run("→ 화살표 항목\n+ 플러스 항목\n2) 괄호 번호").items.map((i) => i.title), ["화살표 항목", "플러스 항목", "괄호 번호"]);
  eq("raw 는 분리된 조각(불릿 제거·trim)", run("- 내일 치과, 모레 미용실").items.map((i) => i.raw), ["내일 치과", "모레 미용실"]);
}

// ───────── 11. Item 형태 계약 (kind 별 키) ─────────
{
  const r = run("내일 오후 3시 치과\n매주 월수금 저녁 7시 헬스\n매일 영어\n프로젝트: 유튜브\n- 9/10까지 영상 편집!!");
  const keys = (i) => Object.keys(i).sort().join(",");
  const byKind = {};
  for (const i of r.items) byKind[i.kind] = keys(i);
  eq("plan 키", byKind.plan, "date,end_time,explicitDate,kind,note,priority,project,raw,start_time,title");
  eq("routine 키", byKind.routine, "end_time,explicitDate,kind,note,priority,raw,start_time,title,weekday,weekdays");
  eq("habit 키", byKind.habit, "explicitDate,kind,note,priority,raw,title");
  eq("project 키", byKind.project, "due,explicitDate,kind,note,priority,raw,title");
  eq("task 키", byKind.task, "due,explicitDate,kind,note,priority,project,raw,start,title");
  check("모든 항목 priority 1..5 정수", r.items.every((i) => Number.isInteger(i.priority) && i.priority >= 1 && i.priority <= 5));
  check("routine weekdays 는 길이 1 배열 + weekday 동일", r.items.filter((i) => i.kind === "routine").every((i) => Array.isArray(i.weekdays) && i.weekdays.length === 1 && i.weekdays[0] === i.weekday));
  check("시각은 HH:MM 형식", r.items.filter((i) => i.start_time).every((i) => /^\d{2}:\d{2}$/.test(i.start_time) && (i.end_time === "" || /^\d{2}:\d{2}$/.test(i.end_time))));
  check("날짜는 YYYY-MM-DD 또는 null", r.items.every((i) => [i.due, i.date, i.start].every((d) => d === undefined || d === null || /^\d{4}-\d{2}-\d{2}$/.test(d))));
  check("WEEKDAYS 내보냄", JSON.stringify(capture.WEEKDAYS) === JSON.stringify(["일", "월", "화", "수", "목", "금", "토"]));
  eq("입력 객체 없음 → 빈 입력 경고", capture(), { items: [], warnings: ["입력이 비어 있어요."] });
  eq("projectNames 가 배열이 아니어도 동작", run("장보기").items.length, 1);
  eq("projectNames 에 쓰레기 값이 섞여도 동작", capture({ text: "책 정리 #집", today: TODAY, projectNames: [null, 3, "  ", "집"] }).items[0].project, "집");
  check("경고는 중복 제거", (() => { const w = run("3시 회의\n3시 회의").warnings; return w.length === 1; })());
}

// ───────── 12. Templater 로더 시뮬레이션 (window 있음 → 함수 내보내기, require 없이 동작) ─────────
{
  const fs = require("fs");
  const files = [path.join(__dirname, "..", "capture.js"), __filename, path.join(__dirname, "capture.oracle.js")];
  const saved = global.window;
  global.window = { require: undefined };
  try {
    for (const f of files) {
      const code = fs.readFileSync(f, "utf8");
      check(`${path.basename(f)}: shebang 없음`, !code.startsWith("#!"));
      let exported = null;
      let err = null;
      try {
        const exp = {};
        const mod = { exports: exp };
        const fn = (0, eval)("(function anonymous(require, module, exports){" + code + "\n})");
        fn(() => { throw new Error("require 사용 금지"); }, mod, exp);
        exported = exp.default || mod.exports;
      } catch (e) { err = e; }
      check(`${path.basename(f)}: Templater 래퍼에서 오류 없이 함수 내보냄`, !err && typeof exported === "function", err ? String(err && err.message) : typeof exported);
      if (!err && f.endsWith("capture.js")) {
        const r = exported({ text: "내일 오후 3시 치과", today: TODAY, projectNames: [], habitNames: [] });
        eq("래퍼 안 capture() 결과", pick(r.items[0], ["kind", "title", "date", "start_time"]), { kind: "plan", title: "치과", date: "2026-10-17", start_time: "15:00" });
        eq("래퍼 안 parseDate", exported.parseDate("다음주 수요일까지 보고서", TODAY), { date: "2026-10-21", rest: "보고서" });
        eq("래퍼 안 PRIORITY_LABELS", exported.PRIORITY_LABELS[5], "긴급");
      }
    }
  } finally {
    if (saved === undefined) delete global.window; else global.window = saved;
  }
}

// ───────── 5. 오라클 비교 (원본 번들 코드 vs 포팅) ─────────
const CORPUS = [
  "내일 오후 3시 치과", "매주 월수금 저녁 7시 헬스", "매일 영어 단어 20개", "프로젝트: 유튜브 채널 개편\n- 9/10까지 영상 편집!!\n- 썸네일 만들기 그리고 자막 넣기",
  "언젠가 책 정리 #집", "주말마다 러닝", "다음주 수요일까지 보고서", "7-10시 공부", "오후 2시 반 미팅", "밤 11시 독서", "새벽 1시 기도", "정오 점심", "자정 서버 점검",
  "3시까지 보고서", "내일 5시까지 제출", "7시 치맥", "7시 조깅", "3시 회의", "6시 기상", "5시 퇴근", "14:30 치과", "3pm dentist", "한 시 반 미팅", "저녁 7시~9시 공부",
  "오전 10시부터 오후 2시까지 세미나", "11시~1시 점심 약속", "밤 10시-2시 게임", "22시~01시 야근", "9시 30분 출근", "오후 세 시 커피",
  "긴급 서류 제출", "서류 제출!!!", "당장 전화하기", "중요 발표 준비", "발표 준비!", "낮음 서랍 정리", "여유 서랍 정리", "나중에 사진 정리", "사진 정리",
  "보고서 쓰기 @회사", "보고서 쓰기 [회사]", "유튜브 프로젝트", "PJ: 이사 준비", "#집", "project: 포트폴리오 사이트", "매주 장보기", "매일 물 2리터", "맨날 스트레칭", "3일마다 화분 물주기",
  "1일 1커밋", "매일 아침 7시 조깅", "화요일마다 분리수거", "평일 8시 출근", "매주 월, 수 저녁 8시 요가", "월·수·금마다 헬스", "매주 토요일 10시 청소", "매주 일욜 교회",
  "내일\n장보기\n빨래", "긴급\n서류 제출\n전화", "유튜브 프로젝트\n- 썸네일\n- 자막\n장보기", "내일 치과, 모레 미용실", "김치, 밥, 계란 사기",
  "- [x] 끝난 일\n- [ ] 남은 일\n1. 번호 항목\n☐ 체크박스 항목", "20일 월세", "5일 월세", "11월 둘째 주 토요일 결혼식", "10/20~10/22 워크숍",
  "tomorrow 치과", "next monday 회의", "every day 물 마시기", "urgent: 세금 납부 by 11/3", "Nov 3rd 발표", "weekly fri 회고", "someday 책장 정리",
  "이번 주 일요일 청소", "다다음 주 화요일 회의", "다음 달 초 이사", "다음 달 15일 월급", "연말 결산", "내년 초 이직", "내후년 3월 졸업", "2027년 1월 5일 출국", "26년 12월 24일 파티",
  "12.25 파티", "일주일 뒤 점검", "2주 뒤 점검", "한 달 뒤 점검", "열흘 뒤 발표", "3일 뒤 발표", "낼 치과", "글피 회의", "낼모레 회의",
  "할 일: 세차", "메모: 아이디어 정리", "일정", "할일\n세차\n청소", "** 중요 ** 계약서 검토", "## 오늘\n- 운동\n- 독서",
  "유튜브 채널 개편 썸네일 만들기", "유튜브 채널 개편 마감일 변경", "유튜브 채널 개편", "영상 편집 #유튜브",
  "마감 10월 30일 디자인 시안", "10월 30일까지 디자인 시안", "다음 주까지 초안", "이번 주 안에 초안", "이번 주 중 초안", "주말에 등산", "월말에 정산",
  "3일간 여행", "2일 동안 출장", "10월 말 결산", "11월 발표", "오늘 밤 영화", "tonight movie", "오늘 저녁 8시 데이트", "오늘 낮 12시 점심", "밤 12시 마감",
  "4월 1일 만우절", "1/1 새해", "24:00 마감", "0시 배치 작업", "08시 출근", "12시 점심", "12시반 점심", "두 시 회의", "열두 시 점심",
];
// 기준일을 바꿔 가며 비교하는 추가 말뭉치: [today, text]
const EXTRA_CORPUS = [
  ["2026-12-30", "내일 치과"], ["2026-12-30", "모레 신년회"], ["2026-12-30", "글피 출근"], ["2026-12-30", "다음 달 3일 납부"], ["2026-12-30", "다음 달 초 이사"],
  ["2026-12-30", "1월 5일 발표"], ["2026-12-30", "1/5 발표"], ["2026-12-30", "다음 주 월요일 회의"], ["2026-12-30", "다음 주까지 초안"], ["2026-12-30", "이번 주 일요일 청소"],
  ["2026-12-30", "연말 정산"], ["2026-12-30", "월말 정산"], ["2026-12-30", "내년 3월 1일 여행"], ["2026-12-30", "5일 월세"], ["2026-12-30", "한 달 뒤 점검"], ["2026-12-30", "3일 뒤 점검"],
  ["2026-12-31", "12월 31일 송년회"], ["2026-12-31", "12/31 송년회"], ["2027-01-01", "12월 31일 송년회"], ["2027-01-01", "주말 등산"], ["2027-01-01", "이번 주 일요일 청소"],
  ["2027-02-10", "2월 29일 행사"], ["2028-02-10", "2월 29일 행사"], ["2026-10-16", "31일 월세"], ["2026-11-16", "31일 월세"], ["2026-11-30", "다음 달 31일 월세"],
  ["2026-10-18", "이번 주 일요일 청소"], ["2026-10-18", "일요일 청소"], ["2026-10-18", "다음 주 월요일 회의"], ["2026-10-18", "주말 등산"], ["2026-10-19", "주말 등산"], ["2026-10-17", "주말 등산"],
  ["2026-10-16", "2시 회의"], ["2026-10-16", "5시 회의"], ["2026-10-16", "6시 저녁"], ["2026-10-16", "8시 회의"], ["2026-10-16", "11시 회의"], ["2026-10-16", "12시 회의"], ["2026-10-16", "9시 넷플"], ["2026-10-16", "7시 기상"],
  ["2026-10-16", "오후 12시 점심"], ["2026-10-16", "오전 12시 마감"], ["2026-10-16", "밤 3시 게임"], ["2026-10-16", "낮 11시 회의"], ["2026-10-16", "새벽 12시 배치"],
  ["2026-10-16", "9시-11시 회의"], ["2026-10-16", "10시~2시 작업"], ["2026-10-16", "오후 1시~3시 작업"], ["2026-10-16", "저녁 8시부터 10시까지 공부"], ["2026-10-16", "8~10시 러닝"], ["2026-10-16", "7시부터 9시 공부"],
  ["2026-10-16", "모레\n- 치과\n- 11월 1일 미용실"], ["2026-10-16", "중요\n보고서\n긴급 전화"], ["2026-10-16", "내일 긴급\n장보기"], ["2026-10-16", "내일\n긴급\n장보기\n오후 3시 회의"], ["2026-10-16", "내일\n오후 3시 회의"],
  ["2026-10-16", "할 일\n세차\n청소"], ["2026-10-16", "내일 할 일\n세차"], ["2026-10-16", "유튜브 프로젝트\n- 내일 썸네일\n- 3시 미팅\n- 매일 운동\n청소"], ["2026-10-16", "유튜브 프로젝트\n- 책 정리 #집"],
  ["2026-10-16", "PJ: 이사\n- 짐 싸기\n- 청소"], ["2026-10-16", "- 유튜브 프로젝트\n- 썸네일"], ["2026-10-16", "### 프로젝트: 이사\n- 짐 싸기"], ["2026-10-16", "프로젝트: 이사 준비\n이사 준비 박스 사기"],
  ["2026-10-16", "프로젝트: 이사\n- 짐 싸기, 청소"], ["2026-10-16", "내일 치과 그리고 모레 미용실 그리고 글피 회식"], ["2026-10-16", "치과 / 미용실"], ["2026-10-16", "내일 치과 / 모레 미용실"],
  ["2026-10-16", "내일 치과 and 모레 미용실"], ["2026-10-16", "오늘 3시 회의, 5시 보고"], ["2026-10-16", "1,000원 송금, 내일 2,500원 입금"], ["2026-10-16", "#집 책 정리, #회사 보고서"], ["2026-10-16", "#집안 책 정리, #회사 보고서"], ["2026-10-16", "- 내일 치과, 모레 미용실"],
  ["2026-10-16", "- [x] 끝\n- [X] 끝2\n* [x] 끝3"], ["2026-10-16", "→ 화살표 항목\n+ 플러스 항목\n2) 괄호 번호"], ["2026-10-16", "3시 회의\n3시 회의"],
  ["2026-10-16", "매주 월요일 10시 회의"], ["2026-10-16", "매주 월·화 10시 회의"], ["2026-10-16", "일욜마다 교회"], ["2026-10-16", "평일에 8시 출근"], ["2026-10-16", "토, 일 마다 등산"],
  ["2026-10-16", "매일 7시~8시 러닝"], ["2026-10-16", "프로젝트: 매주 회고"], ["2026-10-16", "유튜브 프로젝트 매주 월요일 업로드"],
  ["2026-10-16", "내일 3시까지 보고서 #회사"], ["2026-10-16", "오후 3시 마감 보고서"], ["2026-10-16", "15:00 치과"], ["2026-10-16", "3시반 미팅"], ["2026-10-16", "세 시 반 미팅"], ["2026-10-16", "열한 시 회의"],
  ["2026-10-16", "유튜브 채널 개편 프로젝트 마감 연장"], ["2026-10-16", "유튜브 채널 개편의 썸네일"], ["2026-10-16", "집 청소"], ["2026-10-16", "집에서 청소"],
  ["2026-10-16", "7시 치맥 #집"], ["2026-10-16", "7시 치맥 [집]"], ["2026-10-16", "9시 넷플 다음주 금요일"],
  ["2026-10-16", "다음주 금욜까지 보고서"], ["2026-10-16", "담주 수요일 치과"], ["2026-10-16", "다담주 월요일 치과"], ["2026-10-16", "차주 화요일 회의"], ["2026-10-16", "금주 내 초안"],
  ["2026-10-16", "10월 마지막 주 금요일 회식"], ["2026-10-16", "10월 첫째 주 월요일 회의"], ["2026-10-16", "2026년 11월 말 결산"], ["2026-10-16", "2026년 11월 결산"], ["2026-10-16", "26년 11월 1일 결산"],
  ["2026-10-16", "3월 발표"], ["2026-10-16", "10월 발표"], ["2026-10-16", "13월 발표"], ["2026-10-16", "2월 30일 발표"], ["2026-10-16", "0일 뒤 발표"], ["2026-10-16", "100일 뒤 발표"], ["2026-10-16", "99999일 뒤 발표"],
  ["2026-10-16", "25시 회의"], ["2026-10-16", "12:75 회의"], ["2026-10-16", "3시간 운동"], ["2026-10-16", "1일 1독서"],
  ["2026-10-16", "** 긴급 ** 세금!!!"], ["2026-10-16", "## 내일\n- 운동\n- 독서"],
  ["2026-10-16", "by Friday 보고서"], ["2026-10-16", "Oct 20 발표"], ["2026-10-16", "9am-5pm 근무"], ["2026-10-16", "noon lunch"], ["2026-10-16", "every monday 회의"], ["2026-10-16", "next week 초안"], ["2026-10-16", "important: 계약"],
];
const ORACLE_PROJECTS = ["유튜브 채널 개편", "유튜브 프로젝트", "집"];
const EXTRA_PROJECTS = ["유튜브 채널 개편", "유튜브 프로젝트", "집", "이사"];

// ───────── 회귀: weekdayMada 정규식 역추적(ReDoS) — "월 월 월 … 운동"(마다 없음)이 길어도 즉시 끝나야 한다 ─────────
{
  const t0 = Date.now();
  const r = run("월 ".repeat(40) + "운동");
  const ms = Date.now() - t0;
  check("weekdayMada: 요일 40개 나열이 200ms 안에 끝남", ms < 200, `${ms}ms`);
  check("weekdayMada: 결과는 여전히 항목 ≥ 1", r.items.length >= 1, JSON.stringify(r.items.length));
  const t1 = Date.now();
  run("월요일 ".repeat(60) + "헬스");
  check("weekdayMada: 요일 60개(요일 접미) 나열이 500ms 안에 끝남", Date.now() - t1 < 500, `${Date.now() - t1}ms`);
  // 정상 입력은 그대로 — 월수금마다 / 토일 마다 / 월·수·금마다
  eq("월수금마다 → routine 월·수·금 (요일마다 항목 하나)", run("월수금마다 저녁 7시 헬스").items.map(i => `${i.kind}:${i.weekdays.join("")}`), ["routine:1", "routine:3", "routine:5"]);
  eq("토일 마다 → routine 토·일", run("토일 마다 아침 9시 러닝").items.map(i => `${i.kind}:${i.weekdays.join("")}`), ["routine:6", "routine:0"]);
}

if (oracle) {
  let compared = 0;
  const strip = (items) => items.map((i) => { const o = { ...i }; delete o.dateExplicit; return o; });
  const compare = (text, today, projectNames) => {
    const mine = strip(capture._internal.parseAll(text, { today, projectNames }));
    const theirs = oracle.parseAll(text, { today, projectNames });
    compared += 1;
    eq(`oracle ${today} ${JSON.stringify(text)} projects=${projectNames.length}`, mine, theirs);
  };
  for (const text of CORPUS) for (const projectNames of [[], ORACLE_PROJECTS]) compare(text, TODAY, projectNames);
  for (const [today, text] of EXTRA_CORPUS) for (const projectNames of [[], EXTRA_PROJECTS]) compare(text, today, projectNames);
  check("oracle: 비교 건수", compared === (CORPUS.length + EXTRA_CORPUS.length) * 2, String(compared));
} else {
  check("oracle 모듈 로드", false, "tests/capture.oracle.js 를 불러오지 못했어요.");
}

// ───────── 결과 ─────────
for (const f of failures) console.error(f);
console.log(`\ncapture.test.js: ${passed} passed, ${failed} failed${oracle ? ` (oracle corpus: ${CORPUS.length} + ${EXTRA_CORPUS.length} texts × 2)` : " (oracle 없음)"}`);
process.exit(failed === 0 ? 0 : 1);
