// capture.oracle.js — GOLD STANDARD oracle for capture.test.js
// 아래 코드는 YouKnow 앱 Next.js 번들(page.pretty.js, 2026-10 스냅샷)에서
// 빠른 입력 규칙 파서(tM…t1, 그리고 t6 안의 줄 분리/프로젝트 재귀 함수)를
// 그대로(verbatim) 잘라 붙인 것입니다. 식별자 이름도 번들 그대로입니다.
// 테스트에서 _System/Scripts/capture.js 결과와 비교하는 용도로만 쓰이며
// 볼트 동작에는 관여하지 않습니다. 수정하지 마세요(원본 보존이 목적).
// 추출 범위: page.pretty.js L2133–L2789 (tM, tZ, tR, tI, tF, tL, tA, tP, tO, tq, tU,
//   tB, tY, tK, tH, tW, t$, tV, tJ, tX, tG, tQ, t0, t1), L2871–L2898 (분리 함수).
"use strict";
// Templater 는 _System/Scripts 아래 .js 를 하위 폴더까지 전부 사용자 스크립트로 읽는다.
// Obsidian(브라우저 환경, window 존재) 안에서는 아무 일도 하지 않는 함수를 내보내고 끝낸다.
if (typeof window !== "undefined") { module.exports = function captureOracle() { return "node 전용 테스트 오라클입니다."; }; return; }
      let tM = ["일", "월", "화", "수", "목", "금", "토"];

      function tZ(e) {
        let [t, a, n] = e.split("-").map(Number);
        return Date.UTC(t, a - 1, n)
      }

      function tR(e, t) {
        var a;
        return !Number.isFinite(a = tZ(e) + 864e5 * t) || Math.abs(a) > 864e13 ? null : new Date(a).toISOString().slice(0, 10)
      }

      function tI(e) {
        return new Date(tZ(e)).getUTCDay()
      }

      function tF(e, t) {
        return new Date(Date.UTC(e, t, 0)).getUTCDate()
      }

      function tL(e, t, a) {
        if (t < 1 || t > 12 || a < 1) return null;
        let n = Math.min(a, tF(e, t));
        return "".concat(e, "-").concat(String(t).padStart(2, "0"), "-").concat(String(n).padStart(2, "0"))
      }

      function tA(e, t, a) {
        let n = Number(e.slice(0, 4));
        for (let s = n; s <= n + 8; s += 1) {
          if (a > tF(s, t)) continue;
          let n = tL(s, t, a);
          if (n && n >= e) return n
        }
        return null
      }

      function tP(e, t) {
        let a = Number(e.slice(0, 4)),
          n = Number(e.slice(5, 7)) + t,
          s = a + Math.floor((n - 1) / 12),
          l = ((n - 1) % 12 + 12) % 12 + 1;
        return tL(s, l, tF(s, l))
      }
      let tO = "(?:(?![가-힣])|(?=까지|에(?!서)|부터|안에|내로|이내|마감|날))",
        tq = "(요일|욜)?".concat(tO),
        tU = "(까지|마감|이내|안에|내로|내에)";

      function tB(e, t, a) {
        let n = !(arguments.length > 3) || void 0 === arguments[3] || arguments[3],
          s = tM.indexOf(t);
        if (s < 0) return null;
        let l = tI(e);
        if (0 === a) {
          let t = s - l;
          return t < 0 && (t = n ? t + 7 : t), tR(e, t)
        }
        let i = tR(e, -((l + 6) % 7));
        return tR(i, 7 * a + (s + 6) % 7)
      }
      let tY = [
        ["열두", 12],
        ["열한", 11],
        ["열", 10],
        ["아홉", 9],
        ["여덟", 8],
        ["일곱", 7],
        ["여섯", 6],
        ["다섯", 5],
        ["네", 4],
        ["세", 3],
        ["두", 2],
        ["한", 1]
      ].map(e => {
        let [t, a] = e;
        return [RegExp("(?<![가-힣])".concat(t, "\\s*시").concat("(?=\\s|$|반|까지|에|부터|쯤|경|정각|[^가-힣])"), "g"), "".concat(a, "시")]
      });

      function tK(e, t) {
        return "".concat(String(e).padStart(2, "0"), ":").concat(String(t).padStart(2, "0"))
      }
      tY.push([/정오/g, "낮 12시"], [/자정/g, "밤 12시"]);
      let tH = RegExp("(게임|맥주|소주|회식|저녁|야식|넷플|영화|드라마|퇴근|야근|발로란트|오버워치|배그|디스코드|치맥|불금|술약속|저녁약속|(?<![가-힣])(술|롤|데이트)(?![가-힣])|\\b(game|beer|movie|netflix|dinner|date|drink|party|bar)\\b)", "i"),
        tW = /(기상|출근|아침|조깅|러닝|등교|모닝|스트레칭|헬스|운동|수업|출발|일어나|\b(gym|workout|run|jog|breakfast|commute|standup|class)\b)/i,
        t$ = /(까지|내일|낼|모레|글피|오늘|요일|욜|주말|다음\s*주|담주|이번\s*주|다음\s*달|담달|이번\s*달|이달|월말|말일|연말|내년|\d+\s*시(?!간)|정오|자정|\d{1,2}\/\d{1,2}|\d+\s*월|\d+\s*[일주]\s*(뒤|후)|(일주일|이틀|사흘|하루)\s*(뒤|후)|\d{1,2}\s*일(?![가-힣])|매일|매주|[#@][^\s#@,]{2,})/,
        tV = /^\s*(?:[-*•·▪◦□→+]\s*|\d{1,2}[.)](?:\s+|$)|\[[ \-]\]\s*|[☐☑✅✔]\s*)+/,
        tJ = [
          [/\b(mon|monday)\b/gi, "월요일"],
          [/\b(tue|tues|tuesday)\b/gi, "화요일"],
          [/\b(wed|wednesday)\b/gi, "수요일"],
          [/\b(thu|thur|thurs|thursday)\b/gi, "목요일"],
          [/\b(fri|friday)\b/gi, "금요일"],
          [/\b(sat|saturday)\b/gi, "토요일"],
          [/\b(sun|sunday)\b/gi, "일요일"]
        ],
        tX = {
          jan: 1,
          feb: 2,
          mar: 3,
          apr: 4,
          may: 5,
          jun: 6,
          jul: 7,
          aug: 8,
          sep: 9,
          sept: 9,
          oct: 10,
          nov: 11,
          dec: 12
        };

      function tG(e) {
        return e.replace(/[(（]\s*[)）]|\[\s*\]/g, " ").replace(/\s*(까지|마감|이내|안에|내로)\s*$/g, "").replace(/^\s*(할\s*일|할\s*것|해야\s*할\s*일|todo|to-do|일정|계획|메모)\s*[:：]\s*/i, "").replace(/^[\s:：\-–—·~]+|[\s:：\-–—·.~]+$/g, "").replace(/\s{2,}/g, " ").trim()
      }

      function tQ(e, t) {
        return t0(e, t).item
      }

      function t0(e, t) {
        let a = e.trim(),
          n = (function(e) {
            let t = e;
            if (!/[a-zA-Z]/.test(t)) return t;
            for (let [e, a] of(t = (t = (t = (t = (t = t.replace(/(\d{1,2})(?::(\d{2}))?\s*[-~]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/gi, (e, t, a, n, s, l) => {
                let i = /p/i.test(l) ? "오후" : "오전";
                return "".concat(i, " ").concat(t).concat(a ? ":".concat(a) : "시", "~").concat(i, " ").concat(n).concat(s ? ":".concat(s) : "시")
              })).replace(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/gi, (e, t, a, n) => "".concat(/p/i.test(n) ? "오후" : "오전", " ").concat(t).concat(a ? ":".concat(a) : "시"))).replace(/\bnoon\b/gi, "정오").replace(/\bmidnight\b/gi, "자정")).replace(/\b(tmr|tmrw|tomorrow)\b/gi, "내일").replace(/\btoday\b/gi, "오늘").replace(/\b(tonight)\b/gi, "오늘 밤").replace(/\bday after tomorrow\b/gi, "모레").replace(/\bnext\s+week\b/gi, "다음 주").replace(/\bthis\s+week\b/gi, "이번 주").replace(/\bnext\s+month\b/gi, "다음 달").replace(/\bthis\s+month\b/gi, "이번 달").replace(/\b(this\s+)?weekend\b/gi, "주말").replace(/\bnext\s+year\b/gi, "내년").replace(/\bend of (the )?year\b/gi, "연말").replace(/\bnext\s+(월|화|수|목|금|토|일)요일/g, "다음 주 $1요일")).replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi, (e, t, a) => "".concat(tX[t.toLowerCase()], "월 ").concat(a, "일")), tJ)) t = t.replace(e, a);
            return (t = t.replace(/\bnext\s+(월|화|수|목|금|토|일)요일/g, "다음 주 $1요일")).replace(/\b(every\s*day|everyday|daily)\b/gi, "매일").replace(/\bevery\s+(월|화|수|목|금|토|일)요일/g, "매주 $1요일").replace(/\b(weekly)\s+/gi, "매주 ").replace(/\b(urgent|asap)\b[:：]?/gi, "긴급").replace(/\b(important)\b[:：]?/gi, "중요").replace(/\b(someday|later)\b/gi, "언젠가").replace(/\b(by|until|due)\s+(?=내일|오늘|모레|다음|이번|\d|[월화수목금토일]요일|주말|연말)/gi, "")
          })(a).replace(/\*+/g, " ").replace(/^#{1,6}\s+/, ""),
          s = null,
          l = 3,
          i = !0;
        /!!!|긴급|급함|급해|급한|당장/.test(n) ? l = 5 : /!!|중요|높음/.test(n) ? l = 4 : /!(?!!)/.test(n) ? l = 4 : i = !1, /언젠가|언젠간|나중에/.test(n) ? (l = 1, i = !0) : /낮음|여유/.test(n) && (l = 2, i = !0), n = n.replace(/!+/g, " ").replace(/(^|\s)(지금\s*당장|급한\s*(거|것|일)|긴급|급함|급해|급한|당장|우선순위\s*(높음|낮음)|중요도\s*(높음|낮음)|중요|높음|낮음|여유\s*있을\s*때|여유|언젠가|언젠간|나중에)(?=\s|$|[:：])[:：]?/g, "$1 ");
        let r = null;
        for (let e of [...t.projectNames || []].sort((e, t) => t.length - e.length)) {
          let t = e.replace(/\s*프로젝트\s*$/, "").trim(),
            a = [e, t].filter(e => e.length >= 2).map(e => ["#".concat(e), "@".concat(e), "[".concat(e, "]")]).flat().find(e => n.includes(e));
          if (a) {
            r = e, n = n.replace(a, " ");
            break
          }
        }
        if (!r) {
          let e = n.match(/(?:#|@)([^\s#@,]+)|\[([^\]]{2,})\]/);
          e && (r = (e[1] || e[2] || "").trim() || null, n = n.replace(e[0], " "))
        }
        let c = /^(프로젝트|PJ|project)\s*[:：]/i.test(a),
          o = !c && /매일|맨날|날마다/.test(n),
          d = [],
          u = n.match(/매주\s*((?:[일월화수목금토](?:요일|욜)?)(?:\s*[·/및과와,]?\s*[일월화수목금토](?:요일|욜)?)*)(?![가-힣])/),
          m = n.match(RegExp("(?<![가-힣\\d])((?:[일월화수목금토](?:요일|욜)?)(?:\\s*[\xb7/및과와,]?\\s*[일월화수목금토](?:요일|욜)?)*)\\s*마다")),
          x = null,
          p = n.match(RegExp("(?<!\\d)(\\d{1,2})\\s*일\\s*마다")),
          h = n.match(/(^|\s)1일\s*1(?=[가-힣a-zA-Z])/),
          f = !1;
        if (p ? (f = !0, x = "".concat(p[1], "일마다 — 습관으로 넣었어요."), n = n.replace(p[0], " ")) : h && (f = !0), u) d = Array.from(u[1].replace(/요일|욜/g, "")).filter(e => tM.includes(e)).map(e => tM.indexOf(e)), n = n.replace(u[0], " ");
        else if (m) d = Array.from(m[1].replace(/요일|욜/g, "")).filter(e => tM.includes(e)).map(e => tM.indexOf(e)), n = n.replace(m[0], " ");
        else if (/주말마다/.test(n)) d = [6, 0], n = n.replace(/주말마다/, " ");
        else if (/(^|\s)평일(만|마다|에)?(?=\s|$)/.test(n)) d = [1, 2, 3, 4, 5], n = n.replace(/(^|\s)평일(만|마다|에)?(?=\s|$)/, "$1 ");
        else if (/매주/.test(n)) {
          let e = n.match(RegExp("(?<![가-힣])([일월화수목금토])(요일|욜)(?![가-힣])"));
          e ? (d = [tM.indexOf(e[1])], n = n.replace(/매주/, " ").replace(e[0], " ")) : c || (f = !0, x = "요일을 안 적어서 습관으로 넣었어요. 요일이 있으면 일과로 바꿔주세요.", n = n.replace(/매주/, " "))
        }
        let g = d.length > 0,
          j = o || f;
        o && (n = n.replace(/매일|맨날|날마다/g, " "));
        let b = function e(t, a) {
          let n = Number(a.slice(0, 4)),
            s = Number(a.slice(5, 7)),
            l = e => e >= 1 && e <= 12 ? n + 1 : null,
            i = [{
              re: /(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})\s*일?/,
              to: e => tL(Number(e[1]), Number(e[2]), Number(e[3]))
            }, {
              re: RegExp("(?<!\\d)(\\d{2})년\\s*(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일"),
              to: e => tL(2e3 + Number(e[1]), Number(e[2]), Number(e[3]))
            }, {
              re: /(내년|다음\s*해|내후년)\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/,
              to: e => tL(n + ("내후년" === e[1] ? 2 : 1), Number(e[2]), Number(e[3]))
            }, {
              re: new RegExp("(\\d{4})년\\s*(\\d{1,2})\\s*월\\s*(초|중순|말일|말)?".concat(tO, "(?!\\s*\\d)")),
              to: e => {
                let t = Number(e[1]),
                  a = Number(e[2]);
                return "초" === e[3] ? tL(t, a, 5) : "중순" === e[3] ? tL(t, a, 15) : tL(t, a, tF(t, a))
              }
            }, {
              re: new RegExp("(내년|다음\\s*해|내후년)\\s*(\\d{1,2})\\s*월\\s*(초|중순|말)?".concat(tO)),
              to: e => {
                let t = n + ("내후년" === e[1] ? 2 : 1),
                  a = Number(e[2]);
                return "초" === e[3] ? tL(t, a, 5) : "중순" === e[3] ? tL(t, a, 15) : tL(t, a, tF(t, a))
              }
            }, {
              re: new RegExp("(내년|다음\\s*해)\\s*(초|말)?".concat(tO)),
              to: e => "초" === e[2] ? tL(n + 1, 1, 15) : tL(n + 1, 12, 31)
            }, {
              re: new RegExp("(?<![\\d:])(\\d{1,2})\\s*월\\s*(첫째|둘째|셋째|넷째|마지막)\\s*주\\s*([일월화수목금토])(요일|욜)?".concat(tO)),
              to: e => {
                var t;
                let a = Number(e[1]);
                return function(e, t, a, n) {
                  let s = tM.indexOf(n);
                  if (s < 0) return null;
                  let l = tL(e, t, 1);
                  if (!l) return null;
                  if (0 === a) {
                    let a = tL(e, t, tF(e, t)),
                      n = (tI(a) - s + 7) % 7;
                    return tR(a, -n)
                  }
                  let i = (s - tI(l) + 7) % 7;
                  return tR(l, i + (a - 1) * 7)
                }(a >= s ? n : n + 1, a, null !== (t = ({
                  첫째: 1,
                  둘째: 2,
                  셋째: 3,
                  넷째: 4,
                  마지막: 0
                })[e[2]]) && void 0 !== t ? t : 1, e[3])
              }
            }, {
              re: RegExp("(?<![\\d:])(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일"),
              to: e => tA(a, Number(e[1]), Number(e[2]))
            }, {
              re: RegExp("(?<![\\d:])(\\d{1,2})\\s*\\/\\s*(\\d{1,2})\\s*일?(?![\\d:])"),
              to: e => tA(a, Number(e[1]), Number(e[2]))
            }, {
              re: RegExp("(?<![\\d:.])(\\d{1,2})\\.(\\d{1,2})\\s*일?\\.?(?![\\d:.a-zA-Z%가-힣~\\-–])"),
              to: e => tA(a, Number(e[1]), Number(e[2]))
            }, {
              re: new RegExp("(?<![\\d:])(\\d{1,2})\\s*월\\s*(초|중순|말일|말)".concat(tO)),
              to: e => {
                let t = Number(e[1]),
                  a = t >= s ? n : n + 1;
                return "초" === e[2] ? tL(a, t, 5) : "중순" === e[2] ? tL(a, t, 15) : tL(a, t, tF(a, t))
              }
            }, {
              re: RegExp("(?<![\\d:])(\\d{1,2})\\s*월(?!\\s*\\d|\\s*(초|중순|말)|요일|욜|세|급|화|간)"),
              to: e => {
                var t;
                let a = Number(e[1]),
                  i = a >= s ? n : null !== (t = l(a)) && void 0 !== t ? t : n;
                return tL(i, a, tF(i, a))
              }
            }, {
              re: /(이번\s*달|이달|당월)\s*(\d{1,2})\s*일/,
              to: e => Number(e[2]) > tF(n, s) ? null : tL(n, s, Number(e[2]))
            }, {
              re: new RegExp("(이번\\s*달|이달|당월)\\s*(말|안에|까지|내로|내에|중)?".concat(tO)),
              to: () => tP(a, 0)
            }, {
              re: /(다음\s*달|담달|익월)\s*(\d{1,2})\s*일/,
              to: e => {
                let t = s + 1;
                return tL(n + (t > 12 ? 1 : 0), (t - 1) % 12 + 1, Number(e[2]))
              }
            }, {
              re: new RegExp("(다음\\s*달|담달|익월)\\s*(초|중순|말)?".concat(tO)),
              to: e => {
                if ("초" === e[2]) {
                  let e = tP(a, 1);
                  return e ? e.slice(0, 8) + "05" : null
                }
                if ("중순" === e[2]) {
                  let e = tP(a, 1);
                  return e ? e.slice(0, 8) + "15" : null
                }
                return tP(a, 1)
              }
            }, {
              re: /월말|말일/,
              to: () => tP(a, 0)
            }, {
              re: /연말|올해\s*(안에|까지|내로|내에|말)|금년\s*(말|안에|까지)?|올해(?=\s|$)/,
              to: () => tL(n, 12, 31)
            }, {
              re: RegExp("(?<!\\d)(\\d{1,4})\\s*일\\s*(뒤|후|후에|뒤에|있다가)"),
              to: e => tR(a, Number(e[1]))
            }, {
              re: /(하루|이틀|사흘|나흘|닷새|열흘)\s*(뒤|후|후에|뒤에)/,
              to: e => {
                var t;
                return tR(a, null !== (t = ({
                  하루: 1,
                  이틀: 2,
                  사흘: 3,
                  나흘: 4,
                  닷새: 5,
                  열흘: 10
                })[e[1]]) && void 0 !== t ? t : 1)
              }
            }, {
              re: RegExp("(?<!\\d)(\\d{1,3})\\s*주\\s*(뒤|후|후에|뒤에)"),
              to: e => tR(a, 7 * Number(e[1]))
            }, {
              re: /(일주일|한\s*주|1주일)\s*(뒤|후|후에|뒤에)/,
              to: () => tR(a, 7)
            }, {
              re: RegExp("(?<!\\d)(\\d{1,2}|한|두|세)\\s*달\\s*(뒤|후|후에|뒤에)"),
              to: e => {
                var t;
                let l = s - 1 + (null !== (t = ({
                  한: 1,
                  두: 2,
                  세: 3
                })[e[1]]) && void 0 !== t ? t : Number(e[1]));
                return tL(n + Math.floor(l / 12), l % 12 + 1, Number(a.slice(8, 10)))
              }
            }, {
              re: /글피/,
              to: () => tR(a, 3)
            }, {
              re: /낼모레|내일모레/,
              to: () => tR(a, 2)
            }, {
              re: /모레/,
              to: () => tR(a, 2)
            }, {
              re: /내일/,
              to: () => tR(a, 1)
            }, {
              re: RegExp("(?<![가-힣])낼(?=$|[^가-힣]|까지|에|부터)"),
              to: () => tR(a, 1)
            }, {
              re: /오늘/,
              to: () => a
            }, {
              re: new RegExp("(다다음\\s*주|다다음주|다담주)\\s*([일월화수목금토])".concat(tq)),
              to: e => tB(a, e[2], 2)
            }, {
              re: new RegExp("(다음\\s*주|(?<!다)담주|다음주|차주)\\s*([일월화수목금토])".concat(tq)),
              to: e => tB(a, e[2], 1)
            }, {
              re: new RegExp("(이번\\s*주|이번주|금주)\\s*([일월화수목금토])".concat(tq)),
              to: e => tB(a, e[2], 0)
            }, {
              re: new RegExp("(다다음\\s*주|다다음주|다담주)\\s*".concat(tU)),
              to: () => tB(a, "일", 2)
            }, {
              re: new RegExp("(다음\\s*주|(?<!다)담주|다음주|차주)\\s*".concat(tU)),
              to: () => tB(a, "일", 1)
            }, {
              re: /(다다음\s*주|다다음주|다담주)(?!\s*[일월화수목금토](?:요일|욜)?(?![가-힣]))/,
              to: () => tB(a, "월", 2)
            }, {
              re: RegExp("(다음\\s*주|(?<!다)담주|다음주|차주)(?!\\s*[일월화수목금토](?:요일|욜)?(?![가-힣]))"),
              to: () => tB(a, "월", 1)
            }, {
              re: new RegExp("(이번\\s*주|이번주|금주)\\s*(".concat(tU, "|중|내)").concat(tO)),
              to: () => tB(a, "일", 0, !0)
            }, {
              re: /(이번\s*주|이번주|금주)(?!\s*[일월화수목금토](?:요일|욜)?(?![가-힣]))/,
              to: () => tB(a, "일", 0, !0)
            }, {
              re: /(이번\s*)?주말/,
              to: () => tB(a, "토", 0, !0)
            }, {
              re: RegExp("(?<![가-힣])([월화수목금토일])(요일|욜)(?=$|[^가-힣]|까지|에|부터|마다|날)"),
              to: e => tB(a, e[1], 0, !0)
            }, {
              re: RegExp("(?<![\\d:월/.년])(?<!(?<!매)월\\s)(\\d{1,2})\\s*일(?=$|[^가-힣\\d]|까지|에(?!서)|날|부터|마감)(?!\\s*(동안|간|정도|이나|째|씩|1[가-힣a-zA-Z]))"),
              to: e => (function(e, t) {
                let a = Number(e.slice(0, 4)),
                  n = Number(e.slice(5, 7));
                for (let s = 0; s < 14; s += 1) {
                  let l = n - 1 + s,
                    i = a + Math.floor(l / 12),
                    r = l % 12 + 1;
                  if (t > tF(i, r)) continue;
                  let c = tL(i, r, t);
                  if (c && c >= e) return c
                }
                return null
              })(a, Number(e[1]))
            }],
            r = null;
          for (let {
              re: e,
              to: a
            }
            of i) {
            let n = t.match(e);
            if (!n || r && (n.index || 0) >= (r.m.index || 0)) continue;
            let s = a(n);
            s && (r = {
              m: n,
              date: s
            })
          }
          if (!r) return null;
          let {
            m: c,
            date: o
          } = r, d = c[0], u = t.slice((c.index || 0) + c[0].length), m = u.match(/^\s*(~|-|–|부터)\s*/);
          if (m) {
            let t = u.slice(m[0].length),
              n = e(t, a);
            n && 0 === t.indexOf(n.text) && (d += m[0] + n.text, u = t.slice(n.text.length))
          }
          let x = new RegExp("^\\s*".concat(tU)).test(u),
            p = u.match(new RegExp("^\\s*(?:(".concat(tU.slice(1, -1), "|에|날|부터|쯤|경)(?![가-힣]))?")));
          return {
            date: o,
            text: d + (p ? p[0] : ""),
            deadline: x
          }
        }(n = function(e) {
          let t = e;
          for (let [e, a] of tY) t = t.replace(e, a);
          return t
        }(n), t.today);
        b && (n = n.replace(b.text, " "));
        let v = e => ({
            item: e,
            explicitDate: b ? b.date : null,
            emptyTitle: !1,
            explicitPriority: i
          }),
          y = function(e) {
            let t = e => /(오후|저녁|밤|낮)/.test(e) ? "pm" : /(오전|아침|새벽)/.test(e) ? "am" : null,
              a = tH.test(e) ? "pm" : tW.test(e) ? "am" : null,
              n = (e, n) => {
                let s = t(e.word),
                  l = e.hour;
                return 24 === l ? 0 : (e.explicit24 || l >= 13 || "pm" === s && /밤/.test(e.word) && l >= 1 && l <= 5 || "pm" === s && /낮/.test(e.word) && l >= 10 && l <= 11 || ("pm" === s && l < 12 ? l += 12 : "pm" === s && 12 === l && /밤|새벽/.test(e.word) ? l = 0 : "am" === s && 12 === l ? l = 0 : null === s && "pm" === a && l >= 1 && l < 12 ? (l += 12, n.text = "저녁으로 해석했어요. 아침이면 시간을 고쳐주세요.") : null === s && l >= 1 && l <= 4 ? (l += 12, n.text = "오후로 해석했어요. 새벽이면 시간을 고쳐주세요.") : null === s && l >= 5 && l <= 6 && ("am" === a ? n.text = "아침으로 해석했어요. 오후면 시간을 고쳐주세요." : (l += 12, n.text = "오후로 해석했어요. 새벽이면 시간을 고쳐주세요."))), Math.min(23, l))
              },
              s = "(?:(오전|오후|아침|저녁|밤|낮|새벽)\\s*)?(\\d{1,2})(?:\\s*:\\s*(\\d{2})\\s*분?|\\s*시(?=$|[^가-힣]|반|까지|에|부터|쯤|경|정각|마다)(?:\\s*(\\d{1,2})\\s*분|\\s*(\\d{2})(?![\\d]|\\s*시|\\s*분))?)\\s*(반)?",
              l = (e, t) => {
                let a = e[t + 2];
                if (void 0 === a) return null;
                let n = Number(a);
                if (n > 24) return null;
                let s = void 0 !== e[t + 3] ? Number(e[t + 3]) : void 0 !== e[t + 4] ? Number(e[t + 4]) : void 0 !== e[t + 5] ? Number(e[t + 5]) : e[t + 6] ? 30 : 0;
                if (s > 59) return null;
                let l = e[t + 1] || "",
                  i = !l && void 0 !== e[t + 3] || 2 === a.length && a.startsWith("0") || n >= 13;
                return {
                  hour: n,
                  minute: s,
                  word: l,
                  explicit24: i
                }
              },
              i = e => {
                let t = e.match(/^\s*(?:(까지|마감|에|부터|쯤|경|정각|정도)(?![가-힣]))?/);
                return {
                  text: t ? t[0] : "",
                  deadline: /^\s*(까지|마감)(?![가-힣])/.test(e)
                }
              },
              r = e.match(new RegExp("".concat("(?:(오전|오후|아침|저녁|밤|낮|새벽)\\s*)?(\\d{1,2})(?:\\s*:\\s*(\\d{2})\\s*분?|\\s*시(?=$|[^가-힣]|반|까지|에|부터|쯤|경|정각|마다)(?:\\s*(\\d{1,2})\\s*분|\\s*(\\d{2})(?![\\d]|\\s*시|\\s*분))?)?\\s*(반)?", "\\s*(?:~|-|–|부터)\\s*").concat(s, "\\s*(까지)?")));
            if (r && /시|:/.test(r[0])) {
              let a = l(r, 0),
                s = l(r, 6);
              if (a && s) {
                let l;
                let c = {
                    text: null
                  },
                  o = t(a.word),
                  d = t(s.word),
                  u = n(a, c);
                if (d) l = n(s, c);
                else if (s.explicit24) l = 24 === s.hour ? 0 : s.hour;
                else if (o && 12 === s.hour) l = "pm" === o ? 0 : 12;
                else {
                  let e = o ? n({
                    ...s,
                    word: a.word
                  }, c) : n({
                    ...s,
                    word: ""
                  }, {
                    text: null
                  });
                  l = s.hour % 24, o && e > u ? l = e : !o && u < 12 && e > u ? l = e : l > u || (l + 12 < 24 && l + 12 > u ? l += 12 : l <= 6 || (l = (l + 12) % 24)), 24 === l && (l = 0)
                }
                let m = i(e.slice((r.index || 0) + r[0].length));
                return {
                  start: tK(u, a.minute),
                  end: tK(l % 24, s.minute),
                  text: r[0] + m.text,
                  note: c.text
                }
              }
            }
            let c = e.match(new RegExp(s));
            if (c) {
              let t = l(c, 0);
              if (!t) return null;
              let a = {
                  text: null
                },
                s = n(t, a),
                r = i(e.slice((c.index || 0) + c[0].length));
              return {
                start: tK(s, t.minute),
                end: tK((s + 1) % 24, t.minute),
                text: c[0] + r.text,
                note: a.text,
                deadline: r.deadline
              }
            }
            return null
          }(n);
        y && (n = n.replace(y.text, " "), y.note && (s = y.note));
        let k = !1;
        if (!r && !c && t.projectNames)
          for (let e of [...t.projectNames].sort((e, t) => t.length - e.length)) {
            let t = e.replace(/\s*프로젝트\s*$/, "").trim(),
              a = [e, t].filter(e => e.length >= 2).find(e => {
                let t = n.indexOf(e);
                if (t < 0) return !1;
                let a = n[t - 1] || " ",
                  s = n.slice(t + e.length);
                return !/[가-힣a-zA-Z0-9]/.test(a) && /^(\s|$|의|에서|에\s|를|을|은|는|관련|[^가-힣a-zA-Z0-9])/.test(s)
              });
            if (!a) continue;
            let s = tG(n.replace(a, " ").trim().replace(/^(관련해서|관련|에서|의|를|을|은|는)\s*/, "")),
              l = /^(마감일?|기한|데드라인|일정)?\s*(을|를|은|는|이|가)?\s*(로|으로)?\s*(변경|수정|바꾸기|바꿈|연장|변경하기|미루기)?$/.test(s);
            !(s.length >= 2) || l || /^(프로젝트|PJ|project)$/i.test(s) ? (r = null, n = e, k = !0) : (r = e, n = s);
            break
          }
        let w = tG(n.replace(/^(프로젝트|PJ|project)\s*[:：]\s*/i, ""));
        r && "" === w && !y && (w = r, r = null, k = !0);
        let N = k || c || !r && /(프로젝트|PJ|project)\s*$/i.test(w),
          _ = /^(할\s*일|할\s*것|해야\s*할\s*일|todo|to-do|일정|계획|스케줄|메모|일과)$/i.test(w);
        if (!y && !g && !j && !k && (b && "" === w || i && "" === w || _)) return {
          item: {
            kind: "task",
            title: w || a,
            date: b ? b.date : null,
            start_time: null,
            end_time: null,
            priority: l,
            project_name: null,
            weekday: null,
            note: s,
            raw: a
          },
          explicitDate: b ? b.date : null,
          emptyTitle: !0,
          explicitPriority: i
        };
        if (N && (c || k || !g) && (!j || c)) return v({
          kind: "project",
          title: w || a,
          date: b ? b.date : null,
          start_time: null,
          end_time: null,
          priority: l,
          project_name: null,
          weekday: null,
          note: s,
          raw: a
        });
        if (g) {
          let [e, ...t] = d;
          return {
            ...v({
              kind: "routine",
              title: w || a,
              date: null,
              start_time: y ? y.start : "09:00",
              end_time: y ? y.end : "10:00",
              priority: l,
              project_name: null,
              weekday: e,
              note: y ? s : "시간을 안 적어서 09:00으로 넣었어요.",
              raw: a
            }),
            extraWeekdays: t
          }
        }
        return v(j ? {
          kind: "habit",
          title: w || a,
          date: null,
          start_time: null,
          end_time: null,
          priority: l,
          project_name: null,
          weekday: null,
          note: x || (y ? "매일 하는 일이라 습관으로 넣었어요(시간은 뺐어요)." : null),
          raw: a
        } : y && y.deadline ? {
          kind: "task",
          title: w || a,
          date: b ? b.date : t.today,
          start_time: null,
          end_time: null,
          priority: l,
          project_name: r,
          weekday: null,
          note: "".concat(y.start, "까지"),
          raw: a
        } : y ? {
          kind: "plan",
          title: w || a,
          date: b ? b.date : t.today,
          start_time: y.start,
          end_time: y.end,
          priority: l,
          project_name: r,
          weekday: null,
          note: s,
          raw: a
        } : {
          kind: "task",
          title: w || a,
          date: b ? b.date : null,
          start_time: null,
          end_time: null,
          priority: l,
          project_name: r,
          weekday: null,
          note: s,
          raw: a
        })
      }

      function t1(e, t) {
        let a = [],
          n = null,
          s = null,
          l = null;
        for (let o of e) {
          var i, r, c;
          let e = o.map(e => t0(e.text, t)),
            d = null !== (c = null === (i = o[0]) || void 0 === i ? void 0 : i.bullet) && void 0 !== c && c;
          if (1 === e.length && e[0].emptyTitle) {
            n = e[0].explicitDate, s = e[0].explicitPriority ? e[0].item.priority : null, l = null;
            continue
          }
          d || (l = null);
          let u = (null === (r = e.find(e => e.explicitDate)) || void 0 === r ? void 0 : r.explicitDate) || n;
          for (let t of e) {
            let e = t.item;
            for (let n of (u && !t.explicitDate && ("task" === e.kind || "plan" === e.kind || "project" === e.kind) && (e = {
                ...e,
                date: u
              }), null === s || t.explicitPriority || "task" !== e.kind || (e = {
                ...e,
                priority: s
              }), l && d && !e.project_name && ("task" === e.kind || "plan" === e.kind) && (e = {
                ...e,
                project_name: l
              }), a.push(e), t.extraWeekdays || [])) a.push({
              ...e,
              weekday: n
            })
          }
          1 !== e.length || "project" !== e[0].item.kind || d || (l = e[0].item.title)
        }
        return a
      }
      let ykParseAll = 
              function(e, t) {
                let a = function(e) {
                    let t = e.split(/\r?\n/).map(e => e.replace(/[\u200B\uFEFF\uFE0F]/g, "")).filter(e => !/^\s*(?:[-*•·▪◦]\s*)?\[[xX]\]/.test(e)).map(e => ({
                        text: e.replace(tV, "").trim(),
                        bullet: tV.test(e) && e.trim().length > 0
                      })).filter(e => e.text.length > 0).map(e => ({
                        ...e,
                        text: e.text.replace(RegExp("(?<![가-힣])([일월화수목금토](?:요일|욜)?)\\s*[,，、/]\\s*(?=[일월화수목금토](?:요일|욜)?(?![가-힣]))", "g"), "$1\xb7")
                      })),
                      a = [];
                    for (let e of t) {
                      let t = e.text.split(RegExp("(?<!\\d)\\s*[,，、;；]\\s*|(?<=\\d)\\s*[,，、;；]\\s*(?!\\d{3}(?!\\d))|\\s+\\/\\s+|\\s+(?:그리고|and)\\s+")).map(e => e.trim()).filter(Boolean),
                        n = t.filter(e => t$.test(e)).length;
                      t.length >= 2 && n >= 2 ? a.push(t.map(t => ({
                        text: t,
                        bullet: e.bullet
                      }))) : a.push([e])
                    }
                    return a
                  }(e),
                  n = t1(a, t),
                  s = new Set((t.projectNames || []).map(e => e.trim().toLowerCase())),
                  l = Array.from(new Set(n.filter(e => "project" === e.kind).map(e => e.title.trim()).filter(e => e.length >= 2 && !s.has(e.toLowerCase())))),
                  i = l.filter(e => !l.some(t => t !== e && e.includes(t)));
                return 0 === i.length ? n : t1(a, {
                  ...t,
                  projectNames: [...t.projectNames || [], ...Array.from(new Set(i))]
                })
              };
// Node 전용 내보내기(함수에 속성을 붙인 형태 — Templater 호환 모양 유지)
module.exports = Object.assign(function parseAll(e, t) { return ykParseAll(e, t); }, { tQ, t0, t1, parseAll: ykParseAll, tM });
