#!/usr/bin/env bash
# import_youknow.py 통합 테스트 (설계서 §7-9)
#   bash _System/Scripts/tests/run.sh
# 볼트를 임시 폴더에 복사해 fixture-backup.json 으로 가져오기를 돌리고, 멱등성·사용자 편집 보존·dry-run·역방향 쉼을 검사합니다.
# 실패 하나라도 있으면 종료 코드 1.
set -u
export LC_ALL=C.UTF-8
export YK_TODAY=2026-10-16

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT_SRC="$(cd "$HERE/../../.." && pwd)"
SCRIPT="$HERE/../import_youknow.py"
FIXTURE="$HERE/fixture-backup.json"
WORK="${YK_TEST_TMP:-$(mktemp -d "${TMPDIR:-/tmp}/yk-test.XXXXXX")}"
VAULT="$WORK/vault"
FAIL=0
PASS=0

ok()   { PASS=$((PASS + 1)); echo "  ✅ $*"; }
fail() { FAIL=$((FAIL + 1)); echo "  ❌ $*"; }
assert_file()   { if [ -f "$VAULT/$1" ]; then ok "파일 있음: $1"; else fail "파일 없음: $1"; fi; }
assert_nofile() { if [ ! -e "$VAULT/$1" ]; then ok "파일 없음(기대): $1"; else fail "없어야 할 파일: $1"; fi; }
assert_grep()   { if grep -qF -- "$2" "$VAULT/$1" 2>/dev/null; then ok "$1 ∋ $2"; else fail "$1 에 '$2' 없음"; fi; }
assert_nogrep() { if ! grep -qF -- "$2" "$VAULT/$1" 2>/dev/null; then ok "$1 ∌ $2"; else fail "$1 에 '$2' 가 있으면 안 됨"; fi; }
assert_regex()  { if grep -qE -- "$2" "$VAULT/$1" 2>/dev/null; then ok "$1 ~ /$2/"; else fail "$1 에 /$2/ 없음"; fi; }
assert_count()  { local n; n=$(grep -cF -- "$2" "$VAULT/$1" 2>/dev/null || true); if [ "${n:-0}" -eq "$3" ]; then ok "$1 에 '$2' ${3}회"; else fail "$1 에 '$2' ${n:-0}회 (기대 $3)"; fi; }
hash_md() { # 모든 .md 의 sha1 목록 (경로 정렬). $1 = 제외할 상대경로(선택)
  (cd "$VAULT" && find . -name '*.md' -not -path './.git/*' | sort | while read -r f; do
     if [ -n "${1:-}" ] && [ "$f" = "./$1" ]; then continue; fi
     python3 -I -c 'import hashlib,sys; print(hashlib.sha1(open(sys.argv[1],"rb").read()).hexdigest(), sys.argv[1])' "$f"; done)
}
hash_all() { (cd "$VAULT" && find . -type f -not -path './.git/*' | sort | while read -r f; do python3 -I -c 'import hashlib,sys; print(hashlib.sha1(open(sys.argv[1],"rb").read()).hexdigest(), sys.argv[1])' "$f"; done); }
run_import() { python3 -I "$SCRIPT" --backup "$1" --vault "$VAULT" --since 2026-10-01 "${@:2}"; }

echo "▶ 임시 볼트: $VAULT"
mkdir -p "$VAULT"
(cd "$VAULT_SRC" && tar --exclude=.git --exclude='_System/Scripts/.yk_index.json' -cf - .) | tar -xf - -C "$VAULT"
# 인덱스 캐시는 가져오는 볼트 안(_System/Scripts/.yk_index.json)에 쓰인다
IDX="$VAULT/_System/Scripts/.yk_index.json"
cleanup() { if [ -z "${YK_TEST_KEEP:-}" ]; then rm -rf "$WORK"; fi; }
trap cleanup EXIT

echo "▶ 1차 가져오기 (--backup fixture)"
if run_import "$FIXTURE" > "$WORK/run1.log" 2>&1; then ok "종료 코드 0"; else fail "1차 실행 실패"; cat "$WORK/run1.log"; fi
grep -q '확장 백업' "$WORK/run1.log" && ok "확장 백업 로그" || fail "확장 백업 로그 없음"
grep -qE '일기 새로 2 · 갱신 0 · 건너뜀 1 / 할 일 새로 4' "$WORK/run1.log" && ok "요약 줄 형식" || { fail "요약 줄 형식"; tail -3 "$WORK/run1.log"; }

echo "▶ 생성 파일·frontmatter 검사"
D1="50_일기/2026/2026-10-14 일기.md"; D2="50_일기/2026/2026-10-15 운동.md"
assert_file "$D1"; assert_file "$D2"; assert_nofile "50_일기/2026/2026-10-10 일기.md"
assert_grep "$D1" 'type: 일기'; assert_grep "$D1" 'mood_score: 4'; assert_grep "$D1" '종류: "[[일반]]"'; assert_grep "$D1" '기분: "[[좋음]]"'
assert_grep "$D1" 'tags: [운동, 친구]'; assert_grep "$D1" '태그: ["[[운동]]", "[[친구]]"]'; assert_grep "$D1" '기록_수면: 7'
assert_nogrep "$D1" 'up:'
assert_grep "$D2" 'parts: [가슴, 등]'; assert_grep "$D2" 'duration_min: 45'; assert_grep "$D2" 'intensity: 보통'; assert_grep "$D2" 'photos: 2'
assert_grep "$D2" 'cover: "[[9f0e1a2b-IMG_0012.jpg]]'; assert_grep "$D2" '- 📷 9f0e1a2b-IMG_0012.jpg — 벤치 60kg (앱에서만 보임)'
assert_grep "$D2" '%% yk:body:start %%'; assert_grep "$D2" '%% yk:photos:end %%'; assert_grep "$D2" 'yk_url: "https://youknow-meta-data-weom.vercel.app/#/daily/2026-10-15?type=workout"'
T1="30_할일/목록/영상 편집.md"; T2="30_할일/목록/치과 예약.md"; T3="30_할일/목록/책 읽기 아주 작은 습관의 힘.md"; T4="30_할일/목록/영어 단어 100개.md"
assert_file "$T1"; assert_file "$T2"; assert_file "$T3"; assert_file "$T4"
assert_grep "$T1" '- [ ] 영상 편집 ⏫ 🛫 2026-10-01 📅 2026-10-17 🆔 yk-3f9a1c2e'
assert_grep "$T1" 'project: "[[유튜브 채널 개편]]"'; assert_grep "$T1" 'priority_label: 중요'; assert_grep "$T1" '마감: "[[2026-10-17]]"'
assert_grep "$T2" '- [x] 치과 예약 🔺 🛫 2026-10-10 📅 2026-10-12 ✅ 2026-10-12 🆔 yk-8e2d4f61'
assert_grep "$T3" '- [/] 책 읽기: 아주 작은 습관의 힘 ⏬ 🛫 2026-10-05 🆔 yk-c17a9b35'; assert_nogrep "$T3" '📅'
assert_grep "$T4" '- [-] 영어 단어 100개 🔽 🛫 2026-10-08 📅 2026-10-09 🆔 yk-d4e5f6a7'; assert_grep "$T4" 'status: 달성 못함'
P1="40_프로젝트/유튜브 채널 개편/유튜브 채널 개편.md"; P2="40_프로젝트/방 정리/방 정리.md"
assert_file "$P1"; assert_file "$P2"
assert_grep "$P1" 'area: "[[유튜브]]"'; assert_grep "$P1" 'emoji: "🎬"'; assert_grep "$P1" 'up: "[[프로젝트]]"'; assert_grep "$P1" '마감: "[[2026-12-31]]"'
assert_grep "$P1" '- [x] 채널 아트 교체 %%yk:chk a1b2c3d4%%'; assert_grep "$P1" '  - 세부: 1920×1080'; assert_grep "$P1" '  ![[9f0e4455-art.jpg]]'
assert_grep "$P1" '### 기획 %%yk:sec 5e5e1a2b%%'; assert_grep "$P1" '- [ ] 인트로 영상 %%yk:chk c3d4e5f6%%'
assert_grep "$P1" '%% yk:resources_legacy:start %%'; assert_grep "$P1" '- 썸네일 레퍼런스 모으기'
assert_grep "$P2" 'area: "[[개인]]"'; assert_grep "$P2" 'status: 계획'; assert_nogrep "$P2" 'due:'
assert_file "70_분야/유튜브.md"; assert_grep "70_분야/유튜브.md" 'yk_area: true'; assert_grep "70_분야/유튜브.md" 'tags: [hub]'
assert_file "70_분야/개인.md"; assert_nogrep "70_분야/개인.md" 'yk_area'   # 이미 있던 분야 노트는 불변
R1="40_프로젝트/유튜브 채널 개편/자료/유튜브 영상.md"; R2="40_프로젝트/유튜브 채널 개편/자료/메모 1.md"
assert_file "$R1"; assert_file "$R2"; assert_grep "$R1" 'kind: 링크'; assert_grep "$R1" '🔗 https://www.youtube.com/watch?v=dQw4w9WgXcQ'; assert_grep "$R2" 'kind: 메모'
assert_grep "$R1" 'project: "[[유튜브 채널 개편]]"'; assert_grep "$R1" 'updated: 2026-10-05'
H1="60_습관/헬스.md"; assert_file "$H1"; assert_file "60_습관/영어.md"
assert_grep "$H1" 'tags: [hub]'; assert_grep "$H1" 'up: "[[습관]]"'; assert_grep "$H1" 'color_name: 초록'; assert_grep "$H1" 'daily: "[[2026-09-20]]"'
W5="20_일정/일과/금요일.md"; assert_file "$W5"; assert_file "20_일정/일과/일요일.md"
assert_grep "$W5" 'type: 일과'; assert_grep "$W5" 'weekday: 5'; assert_grep "$W5" '| 07:00 | 08:00 | [[헬스]] | 초록 | %%yk:rt 3c4d5e6f%% |'
assert_grep "20_일정/일과/수요일.md" '| 19:00 | — | [[영어]] | 하늘 | %%yk:rt 2b3c4d5e%% |'
DAY15="10_오늘/2026/10/2026-10-15.md"; DAY14="10_오늘/2026/10/2026-10-14.md"; DAY01="10_오늘/2026/10/2026-10-01.md"
assert_file "$DAY15"; assert_file "$DAY14"; assert_file "$DAY01"; assert_file "10_오늘/2026/10/2026-10-16.md"
assert_grep "$DAY15" '- ✅ 09:00–10:00 [[헬스]] %%yk:plan 7b21d0aa 초록%%'
assert_grep "$DAY15" '- ❌ 14:00–15:00 영상 편집 (달성 못함) %%yk:plan 8c32e1bb 하늘%%'
assert_grep "$DAY15" '- ⬜ 20:00–21:00 독서 %%yk:plan c91e44f0 호박%%'
assert_grep "$DAY15" 'plans: 3'; assert_grep "$DAY15" 'plans_done: 1'; assert_grep "$DAY15" 'habits_checked: 2'
assert_nogrep "$DAY15" '![[목요일#일과표]]'; assert_grep "$DAY14" '![[수요일#일과표]]'
assert_grep "$DAY15" '- ✅ [[헬스]]'; assert_grep "$DAY15" '- ✅ [[영어]]'; assert_grep "$DAY14" 'weekday: "[[수요일]]"'
assert_grep "$DAY01" 'prev: "[[2026-09-30]]"'; assert_grep "$DAY01" 'next: "[[2026-10-02]]"'; assert_grep "$DAY01" 'week: "[[2026-W40]]"'
assert_grep "$DAY01" '- ⬜ [[헬스]]'; assert_nogrep "$DAY01" '[[영어]]'   # 영어 습관은 10-03 생성 → 10-01 에는 없음
assert_grep "$DAY01" '# ☀️ 2026-10-01 (목)'; assert_grep "$DAY01" '### 캘린더'; assert_grep "$DAY01" '- _(가져오기로 생성 — 일정 없음)_'
assert_grep "$DAY01" '## 🧠 오늘 생긴 뉴런'
assert_file "50_일기/종류/운동.md"; assert_grep "50_일기/종류/운동.md" 'yk_id: workout'; assert_grep "50_일기/종류/운동.md" 'kind: workout'
assert_file "50_일기/종류/일반.md"; assert_file "50_일기/기분/좋음.md"; assert_grep "50_일기/기분/좋음.md" 'score: 4'; assert_grep "50_일기/기분/최고.md" 'emoji: "🤩"'
assert_file "50_일기/태그/운동.md"; assert_grep "50_일기/태그/운동.md" 'source: settings'
YK="98_연동/YouKnow.md"; assert_file "$YK"; assert_grep "$YK" 'type: 연동'; assert_grep "$YK" 'source: backup'; assert_grep "$YK" '## ⚠️ YouKnow에 반영 필요'
assert_grep "$YK" '## 휴지통'; assert_grep "$YK" '## 사라진 행'; assert_grep "$YK" '## 채택 실패'; assert_grep "$YK" 'last_backup: "2026-10-16T02:30:00.000Z"'
# yk_id 중복 0
DUP=$(cd "$VAULT" && grep -rhoE '^yk_id: .+$' --include='*.md' --exclude-dir=_System . | sort | uniq -d | wc -l | tr -d ' ')
[ "$DUP" = "0" ] && ok "yk_id 중복 0" || fail "yk_id 중복 $DUP"

echo "▶ 2차 가져오기 — 변경 0건 (YouKnow.md 제외)"
hash_md "98_연동/YouKnow.md" > "$WORK/h1.txt"
run_import "$FIXTURE" > "$WORK/run2.log" 2>&1 || fail "2차 실행 실패"
hash_md "98_연동/YouKnow.md" > "$WORK/h2.txt"
if diff -q "$WORK/h1.txt" "$WORK/h2.txt" > /dev/null; then ok "2차: 바뀐 .md 0개 (YouKnow.md 제외)"; else fail "2차에 바뀐 파일:"; diff "$WORK/h1.txt" "$WORK/h2.txt" | head; fi
grep -qE '일기 새로 0 · 갱신 0 · 건너뜀 3' "$WORK/run2.log" && ok "2차: 일기 전부 건너뜀" || { fail "2차 요약"; tail -2 "$WORK/run2.log"; }
echo "▶ 3차 가져오기 — YouKnow.md 포함 변경 0건"
hash_md > "$WORK/h2all.txt"
run_import "$FIXTURE" > "$WORK/run3.log" 2>&1 || fail "3차 실행 실패"
hash_md > "$WORK/h3all.txt"
if diff -q "$WORK/h2all.txt" "$WORK/h3all.txt" > /dev/null; then ok "3차: 바뀐 .md 0개 (YouKnow.md 포함)"; else fail "3차에 바뀐 파일:"; diff "$WORK/h2all.txt" "$WORK/h3all.txt" | head; fi

echo "▶ 사용자 편집 + 앱 변경 → 콜아웃 1개, 사용자 텍스트 보존"
python3 -I - "$VAULT/$D2" <<'EOF'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
s = s.replace("- 어깨가 가볍다\n%% yk:body:end %%", "- 어깨가 가볍다\n- 내가 Obsidian에서 덧붙인 줄\n%% yk:body:end %%")
s = s.replace("## 생각 · 연결\n- ", "## 생각 · 연결\n- [[헬스]] 루틴을 바꿔볼까")
open(p, "w", encoding="utf-8").write(s)
EOF
python3 -I - "$FIXTURE" "$WORK/fixture2.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
for r in d["daily_logs"]:
    if r["log_date"] == "2026-10-15":
        r["body"] = r["body"] + "\n- 앱에서 추가한 줄"
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture2.json" > "$WORK/run4.log" 2>&1 || fail "4차 실행 실패"
assert_count "$D2" '> [!note] 📲 YouKnow에서 바뀐 내용 (2026-10-16)' 1
assert_grep "$D2" '- 내가 Obsidian에서 덧붙인 줄'; assert_grep "$D2" '> - 앱에서 추가한 줄'; assert_grep "$D2" '- [[헬스]] 루틴을 바꿔볼까'
grep -q '충돌 1' "$WORK/run4.log" && ok "요약: 충돌 1" || fail "요약에 충돌 1 없음"
run_import "$WORK/fixture2.json" > "$WORK/run5.log" 2>&1 || fail "5차 실행 실패"
assert_count "$D2" '> [!note] 📲 YouKnow에서 바뀐 내용 (2026-10-16)' 1
# 사용자 키·태그 보존 + 앱에서 지운 태그 전파
python3 -I - "$VAULT/$D1" <<'EOF'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
s = s.replace("tags: [운동, 친구]", "tags:\n  - 운동\n  - 친구\n  - 회고\nenergy: 4")
open(p, "w", encoding="utf-8").write(s)
EOF
python3 -I - "$WORK/fixture2.json" "$WORK/fixture3.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
for r in d["daily_logs"]:
    if r["log_date"] == "2026-10-14":
        r["tags"] = ["운동"]; r["mood"] = "보통"
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture3.json" > "$WORK/run6.log" 2>&1 || fail "6차 실행 실패"
assert_grep "$D1" 'tags: [운동, 회고]'; assert_grep "$D1" 'energy: 4'; assert_grep "$D1" 'mood: 보통'; assert_grep "$D1" 'mood_score: 3'; assert_grep "$D1" '태그: ["[[운동]]"]'

echo "▶ 역방향 변경 감지 — 볼트에서 완료한 할 일은 볼트 승 + yk_dirty"
python3 -I - "$VAULT/$T1" <<'EOF'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read().replace("- [ ] 영상 편집 ⏫", "- [x] 영상 편집 ⏫")
open(p, "w", encoding="utf-8").write(s)
EOF
run_import "$WORK/fixture3.json" > "$WORK/run7.log" 2>&1 || fail "7차 실행 실패"
assert_grep "$T1" 'status: 완료'; assert_grep "$T1" 'yk_dirty: true'; assert_grep "$T1" '- [x] 영상 편집 ⏫ 🛫 2026-10-01 📅 2026-10-17 ✅ 2026-10-17 🆔 yk-3f9a1c2e'
assert_grep "$YK" '| [[영상 편집]] | 완료 | 진행 전 |'
grep -q '반영 필요 1' "$WORK/run7.log" && ok "요약: 반영 필요 1" || fail "요약에 반영 필요 1 없음"

echo "▶ yk_pending 할 일 채택"
mkdir -p "$VAULT/30_할일/목록"
cat > "$VAULT/30_할일/목록/장보기.md" <<'EOF'
---
type: 할일
title: 장보기
status: 진행 전
priority: 3
priority_label: 보통
start: 2026-10-16
due: 2026-10-18
daily: "[[2026-10-16]]"
마감: "[[2026-10-18]]"
created: 2026-10-16
yk_pending: true
---
# ✅ 장보기
%% yk:task:start %%
- [ ] 장보기 🛫 2026-10-16 📅 2026-10-18
%% yk:task:end %%

## 세부 메모
%% yk:note:start %%
우유, 달걀
%% yk:note:end %%

## 연결
- 내 메모
EOF
python3 -I - "$WORK/fixture3.json" "$WORK/fixture4.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
d["tasks"].append({"id": "abcdef01-2345-4678-9abc-def012345678", "owner_id": d["settings"]["user_id"], "title": "장보기", "priority": 3,
                   "start_date": "2026-10-16", "due_date": "2026-10-18", "status": "진행 전", "project_id": None, "note": "우유, 달걀",
                   "deleted_at": None, "created_at": "2026-10-16T05:00:00.000Z"})
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture4.json" > "$WORK/run8.log" 2>&1 || fail "8차 실행 실패"
assert_grep "30_할일/목록/장보기.md" 'yk_id: abcdef01-2345-4678-9abc-def012345678'; assert_nogrep "30_할일/목록/장보기.md" 'yk_pending'
assert_grep "30_할일/목록/장보기.md" '🆔 yk-abcdef01'; assert_grep "30_할일/목록/장보기.md" '- 내 메모'; assert_nofile "30_할일/목록/장보기 (2).md"

echo "▶ --dry-run 은 아무것도 쓰지 않음"
hash_all > "$WORK/hd1.txt"
IDX_BEFORE=$(python3 -I -c 'import hashlib,sys,os; p=sys.argv[1]; print(hashlib.sha1(open(p,"rb").read()).hexdigest() if os.path.exists(p) else "none")' "$IDX")
python3 -I - "$WORK/fixture4.json" "$WORK/fixture5.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
d["tasks"].append({"id": "11111111-2222-4333-8444-555555555555", "owner_id": d["settings"]["user_id"], "title": "드라이런 전용", "priority": 3,
                   "start_date": "2026-10-16", "due_date": None, "status": "진행 전", "project_id": None, "note": "", "deleted_at": None,
                   "created_at": "2026-10-16T06:00:00.000Z"})
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture5.json" --dry-run > "$WORK/run9.log" 2>&1 || fail "dry-run 실행 실패"
hash_all > "$WORK/hd2.txt"
if diff -q "$WORK/hd1.txt" "$WORK/hd2.txt" > /dev/null; then ok "dry-run: 파일 변화 0"; else fail "dry-run 이 파일을 바꿈:"; diff "$WORK/hd1.txt" "$WORK/hd2.txt" | head; fi
assert_nofile "30_할일/목록/드라이런 전용.md"
grep -q 'dry-run' "$WORK/run9.log" && ok "dry-run 로그" || fail "dry-run 로그 없음"
IDX_AFTER=$(python3 -I -c 'import hashlib,sys,os; p=sys.argv[1]; print(hashlib.sha1(open(p,"rb").read()).hexdigest() if os.path.exists(p) else "none")' "$IDX")
[ "$IDX_BEFORE" = "$IDX_AFTER" ] && ok "dry-run: 인덱스 캐시 불변" || fail "dry-run 이 인덱스 캐시를 바꿈"

echo "▶ --export-diaries-for-youknow (볼트에서 쓴 일기 → 앱 .md 형식)"
mkdir -p "$VAULT/50_일기/2026"
cat > "$VAULT/50_일기/2026/2026-10-16 일기.md" <<'EOF'
---
type: 일기
title: "10/16 기록"
date: 2026-10-16
daily: "[[2026-10-16]]"
diary_type: 일반
종류: "[[일반]]"
mood: 좋음
mood_score: 4
기분: "[[좋음]]"
tags:
  - 친구
  - 휴식
태그:
  - "[[친구]]"
  - "[[휴식]]"
energy: 3
created: 2026-10-16
---
# 10/16 기록
%% yk:body:start %%
볼트에서 직접 쓴 일기.

둘째 문단.
%% yk:body:end %%

## 📷 사진
%% yk:photos:start %%
%% yk:photos:end %%

## 생각 · 연결
- 이건 내보내면 안 됨
EOF
python3 -I "$SCRIPT" --export-diaries-for-youknow "$WORK/out" --vault "$VAULT" > "$WORK/run10.log" 2>&1 || fail "export 실행 실패"
OUT="$WORK/out/일기/2026-10-16.md"
if [ -f "$OUT" ]; then ok "내보낸 파일 있음: 일기/2026-10-16.md"; else fail "내보낸 파일 없음"; cat "$WORK/run10.log"; fi
if [ -f "$OUT" ]; then
  head -c 3 "$OUT" | grep -q -- '---' && ok "첫 바이트 ---" || fail "첫 바이트가 --- 아님"
  grep -qE '^tags: \["친구", "휴식"\]$' "$OUT" && ok 'tags 인라인 ["친구", "휴식"]' || { fail "tags 인라인 형식"; cat "$OUT"; }
  grep -qE '^mood: "좋음"$' "$OUT" && ok 'mood: "좋음"' || fail "mood 형식"
  grep -qE '^type: 일반$' "$OUT" && ok 'type: 일반' || fail "type 형식"
  grep -qE '^date: 2026-10-16$' "$OUT" && ok 'date' || fail "date 형식"
  python3 -I - "$OUT" <<'EOF' && ok "본문 = 제목 + 블록 내용만" || fail "본문 형식"
import re, sys
s = open(sys.argv[1], encoding="utf-8").read()
m = re.match(r'^---\n(?:[^\n]+\n)+---\n# 10/16 기록\n\n볼트에서 직접 쓴 일기\.\n\n둘째 문단\.\n$', s)
assert m, repr(s)
assert "yk:" not in s and "생각" not in s and "이건 내보내면" not in s
EOF
  # 앱 nw() 파서(page.pretty.js:12480-12510) 포팅: 한 줄 정규식으로 읽어 제목·본문·태그가 살아남는지
  python3 -I - "$OUT" <<'EOF' && ok "앱 .md 가져오기 파서 시뮬레이션: 제목/본문/태그/기분 일치" || fail "앱 파서 시뮬레이션 불일치"
import re, sys
t = open(sys.argv[1], encoding="utf-8").read()
n, s = "", t
l = re.match(r"^---\r?\n([\s\S]*?)\r?\n---\r?\n?", t)
if l: n, s = l.group(1), t[l.end():]
Q = "^[\"']|[\"']$"
def i(k):
    m = re.search("^" + k + r":\s*(.+)$", n, re.M); return m.group(1).strip() if m else None
def r(e): return re.sub(Q, "", e) if e else e
def c(e): return [y for y in (re.sub(Q, "", x.strip()) for x in re.sub(r"^\[|\]$", "", e).split(",")) if y] if e else []
x = s.split("\n"); m = ""
if x and x[0].startswith("# "): m = x[0][2:].strip(); s = re.sub(r"^\n+", "", "\n".join(x[1:]))
out = {"date": r(i("date")), "type": r(i("type")), "mood": r(i("mood")), "tags": c(i("tags")), "title": m, "body": s.strip()}
assert out == {"date": "2026-10-16", "type": "일반", "mood": "좋음", "tags": ["친구", "휴식"], "title": "10/16 기록", "body": "볼트에서 직접 쓴 일기.\n\n둘째 문단."}, out
EOF
  [ -e "$WORK/out/일기/2026-10-15 운동.md" ] && fail "yk_id 있는 일기가 내보내짐" || ok "yk_id 있는 일기는 제외"
fi
# 내보낸 뒤 다시 가져오기: 그 (날짜, 종류) 일기를 앱이 만들었다고 가정 → 채택되어 yk_id 채움, 사용자 섹션 보존
python3 -I - "$WORK/fixture4.json" "$WORK/fixture6.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
d["daily_logs"].append({"id": "feedface-0000-4111-8222-333344445555", "owner_id": d["settings"]["user_id"], "title": "10/16 기록", "log_date": "2026-10-16",
                        "mood": "좋음", "tags": ["친구", "휴식"], "body": "볼트에서 직접 쓴 일기.\n\n둘째 문단.", "photo_path": None, "diary_type": "general",
                        "metrics": {}, "deleted_at": None, "created_at": "2026-10-16T09:00:00.000Z"})
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture6.json" > "$WORK/run11.log" 2>&1 || fail "11차 실행 실패"
assert_grep "50_일기/2026/2026-10-16 일기.md" 'yk_id: feedface-0000-4111-8222-333344445555'; assert_grep "50_일기/2026/2026-10-16 일기.md" '- 이건 내보내면 안 됨'
assert_grep "50_일기/2026/2026-10-16 일기.md" 'energy: 3'; assert_nofile "50_일기/2026/2026-10-16 일기 (2).md"
assert_count "50_일기/2026/2026-10-16 일기.md" '📲 YouKnow에서 바뀐 내용' 0

echo "▶ 앱 쪽 상태 변경 전파 — 진행 중 → 완료 (볼트는 손대지 않음)"
python3 -I - "$WORK/fixture6.json" "$WORK/fixture7.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
for r in d["tasks"]:
    if r["title"].startswith("책 읽기"):
        r["status"] = "완료"; r["due_date"] = "2026-10-20"
for r in d["projects"]:
    if r["name"] == "방 정리":
        r["name"] = "방 대청소"
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture7.json" > "$WORK/run13.log" 2>&1 || fail "13차 실행 실패"
assert_grep "$T3" 'status: 완료'; assert_nogrep "$T3" 'yk_dirty'
assert_grep "$T3" '- [x] 책 읽기: 아주 작은 습관의 힘 ⏬ 🛫 2026-10-05 📅 2026-10-20 ✅ 2026-10-20 🆔 yk-c17a9b35'; assert_grep "$T3" '마감: "[[2026-10-20]]"'
echo "▶ 앱에서 프로젝트 이름 변경 — 파일·폴더 유지, title/별칭/제목만 갱신"
assert_file "$P2"; assert_nofile "40_프로젝트/방 대청소"
assert_grep "$P2" 'title: 방 대청소'; assert_grep "$P2" 'aliases: [방 대청소]'; assert_grep "$P2" '# 🏠 방 대청소'
grep -q "제목 '방 정리' → '방 대청소' (파일명 유지" "$WORK/run13.log" && ok "이름 변경 로그" || fail "이름 변경 로그 없음"

echo "▶ 사용자가 지운 마커는 한 번만 다시 넣는다 (해시가 같아도)"
python3 -I - "$VAULT/$DAY15" "$VAULT/$T2" <<'EOF'
import re, sys
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
s2 = re.sub(r"%% yk:plans:start %%\n[\s\S]*?%% yk:plans:end %%\n", "", s); assert s2 != s
open(p, "w", encoding="utf-8").write(s2)
p = sys.argv[2]; s = open(p, encoding="utf-8").read()
s2 = re.sub(r"%% yk:note:start %%\n[\s\S]*?%% yk:note:end %%\n", "", s); assert s2 != s
open(p, "w", encoding="utf-8").write(s2)
EOF
[ $? -eq 0 ] && ok "마커 삭제 편집 적용" || fail "마커 삭제 편집 실패"
assert_nogrep "$DAY15" '%% yk:plans:start %%'; assert_nogrep "$T2" '%% yk:note:start %%'
run_import "$WORK/fixture7.json" > "$WORK/run14.log" 2>&1 || fail "14차 실행 실패"
assert_count "$DAY15" '%% yk:plans:start %%' 1; assert_count "$DAY15" '%% yk:plans:end %%' 1; assert_grep "$DAY15" '- ⬜ 20:00–21:00 독서 %%yk:plan c91e44f0 호박%%'
assert_count "$T2" '%% yk:note:start %%' 1; assert_count "$T2" '%% yk:note:end %%' 1
grep -q '`plans` 마커가 사라져 `### 하루 계획` 아래 다시 넣음' "$WORK/run14.log" && ok "재삽입 로그(plans)" || fail "재삽입 로그 없음(plans)"
grep -q '`note` 마커가 사라져 `## 세부 메모` 아래 다시 넣음' "$WORK/run14.log" && ok "재삽입 로그(note)" || fail "재삽입 로그 없음(note)"
python3 -I - "$VAULT/$DAY15" <<'EOF' && ok "plans 블록이 '### 하루 계획' 바로 아래" || fail "plans 블록 위치"
import sys
s = open(sys.argv[1], encoding="utf-8").read()
assert "### 하루 계획\n%% yk:plans:start %%\n- ✅ 09:00" in s, s[:900]
EOF
run_import "$WORK/fixture7.json" > "$WORK/run15.log" 2>&1 || fail "15차 실행 실패"
assert_count "$DAY15" '%% yk:plans:start %%' 1; assert_count "$T2" '%% yk:note:start %%' 1

echo "▶ --zip (앱 '마크다운 볼트 내보내기' 형식 그대로)"
python3 -I - "$WORK/youknow-obsidian-2026-10-16.zip" <<'EOF'
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1], "w", zipfile.ZIP_STORED)
z.writestr("일기/2026-10-10 운동.md", '---\ndate: 2026-10-10\ntype: 운동\nmood: "좋음"\ntags: ["운동"]\nparts: ["가슴", "등"]\nduration_min: 40\nintensity: "빡세게"\n---\n\n# 10/10 운동\n\n오늘 운동\n- 스쿼트 80kg\n\n느낀 점\n- 다리가 후들')
z.writestr("일기/2026-10-09.md", '---\ndate: 2026-10-09\ntype: 일반\nmood: ""\ntags: []\n---\n\n# 10/9 기록\n\n조용한 하루.')
z.writestr("프로젝트/방 정리.md", '---\nstatus: "계획"\narea: "개인"\n---\n\n# 방 정리\n')
z.writestr("할 일.md", "# 할 일\n## 보통\n- [ ] 영상 편집 📅 2026-10-17 (유튜브 채널 개편)\n")
z.writestr("README.md", "# YouKnow Meta data 내보내기\n")
z.close()
EOF
python3 -I "$SCRIPT" --zip "$WORK/youknow-obsidian-2026-10-16.zip" --vault "$VAULT" > "$WORK/run16.log" 2>&1 && ok "zip 종료 코드 0" || { fail "zip 실행 실패"; cat "$WORK/run16.log"; }
Z1="50_일기/2026/2026-10-10 운동.md"; Z2="50_일기/2026/2026-10-09 일기.md"
assert_file "$Z1"; assert_file "$Z2"; assert_nofile "40_프로젝트/방 정리 (2)"; assert_nofile "30_할일/목록/영상 편집 (2).md"
assert_grep "$Z1" 'yk_key: "2026-10-10|운동"'; assert_grep "$Z1" 'diary_type: 운동'; assert_grep "$Z1" 'parts: [가슴, 등]'; assert_grep "$Z1" 'duration_min: 40'
assert_grep "$Z1" 'intensity: 빡세게'; assert_grep "$Z1" 'mood: 좋음'; assert_grep "$Z1" '기분: "[[좋음]]"'; assert_grep "$Z1" '# 10/10 운동'; assert_grep "$Z1" '- 스쿼트 80kg'
assert_nogrep "$Z1" 'yk_id'; assert_grep "$Z2" 'yk_key: "2026-10-09|일반"'; assert_nogrep "$Z2" 'mood:'
grep -q '일기 새로 2' "$WORK/run16.log" && ok "zip: 일기 새로 2" || fail "zip 요약"
python3 -I "$SCRIPT" --zip "$WORK/youknow-obsidian-2026-10-16.zip" --vault "$VAULT" > "$WORK/run17.log" 2>&1 || fail "zip 2차 실패"
grep -q '일기 새로 0 · 갱신 0 · 건너뜀 2' "$WORK/run17.log" && ok "zip 2차: 전부 건너뜀" || { fail "zip 2차 요약"; tail -1 "$WORK/run17.log"; }
assert_nofile "50_일기/2026/2026-10-10 운동 (2).md"
# 이후 백업에 같은 (날짜, 종류) 행이 오면 채택 → yk_id 채움, yk_key 제거
python3 -I - "$WORK/fixture7.json" "$WORK/fixture8.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
d["daily_logs"].append({"id": "0a0a0a0a-1b1b-4c2c-8d3d-4e4e4e4e4e4e", "owner_id": d["settings"]["user_id"], "title": "10/10 운동", "log_date": "2026-10-10",
                        "mood": "좋음", "tags": ["운동"], "body": "오늘 운동\n- 스쿼트 80kg\n\n느낀 점\n- 다리가 후들", "photo_path": None, "diary_type": "workout",
                        "metrics": {"parts": ["가슴", "등"], "duration_min": 40, "intensity": "빡세게"}, "deleted_at": None, "created_at": "2026-10-10T12:00:00.000Z"})
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture8.json" > "$WORK/run18.log" 2>&1 || fail "18차 실행 실패"
assert_grep "$Z1" 'yk_id: 0a0a0a0a-1b1b-4c2c-8d3d-4e4e4e4e4e4e'; assert_nogrep "$Z1" 'yk_key'; assert_count "$Z1" '📲 YouKnow에서 바뀐 내용' 0
assert_nofile "50_일기/2026/2026-10-10 운동 (2).md"

echo "▶ --csv 는 미리보기만"
printf 'title,status,priority,start_date,due_date,project,note\n테스트,진행 전,보통,2026-10-16,,,\n' > "$WORK/tasks.csv"
hash_all > "$WORK/hc1.txt"
python3 -I "$SCRIPT" --csv "$WORK/tasks.csv" --vault "$VAULT" > "$WORK/run12.log" 2>&1 && ok "csv 종료 코드 0" || fail "csv 실행 실패"
grep -q '미리보기만' "$WORK/run12.log" && ok "csv: 쓰기 거부 안내" || fail "csv 안내 없음"
hash_all > "$WORK/hc2.txt"; diff -q "$WORK/hc1.txt" "$WORK/hc2.txt" > /dev/null && ok "csv: 파일 변화 0" || fail "csv 가 파일을 바꿈"

echo "▶ 회귀: 앱에서 태그만 바꾼 일기도 갱신된다 (해시에 태그 포함)"
python3 -I - "$WORK/fixture8.json" "$WORK/fixture9.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
for r in d["daily_logs"]:
    if r["log_date"] == "2026-10-14":
        r["tags"] = ["운동", "공부"]          # 추가만 (mood 등 다른 변경 없음)
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture9.json" > "$WORK/run19.log" 2>&1 || fail "19차 실행 실패"
grep -qE '일기 새로 0 · 갱신 1' "$WORK/run19.log" && ok "태그만 추가 → 일기 갱신 1" || { fail "태그만 추가인데 갱신되지 않음"; tail -2 "$WORK/run19.log"; }
assert_grep "$D1" 'tags: [운동, 회고, 공부]'; assert_grep "$D1" '태그: ["[[운동]]", "[[공부]]"]'
python3 -I - "$WORK/fixture9.json" "$WORK/fixture10.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
for r in d["daily_logs"]:
    if r["log_date"] == "2026-10-14":
        r["tags"] = ["공부"]                 # 앱에서 '운동' 제거
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture10.json" > "$WORK/run20.log" 2>&1 || fail "20차 실행 실패"
grep -qE '일기 새로 0 · 갱신 1' "$WORK/run20.log" && ok "태그만 제거 → 일기 갱신 1" || fail "태그만 제거인데 갱신되지 않음"
assert_grep "$D1" 'tags: [회고, 공부]'; assert_grep "$D1" '태그: ["[[공부]]"]'; assert_grep "$D1" 'energy: 4'
run_import "$WORK/fixture10.json" > "$WORK/run20b.log" 2>&1 || fail "20b차 실행 실패"
grep -qE '일기 새로 0 · 갱신 0' "$WORK/run20b.log" && ok "태그 변경 뒤 재실행은 전부 건너뜀" || fail "태그 변경 뒤 멱등성 깨짐"
assert_regex "$D1" '^yk_blocks: \["body:[0-9a-f]{12}", "photos:[0-9a-f]{12}"\]$'

echo "▶ 회귀: 인덱스 캐시가 사라져도 앱만 바꾼 본문은 충돌이 아니다 (yk_blocks)"
rm -f "$IDX"
python3 -I - "$WORK/fixture10.json" "$WORK/fixture11.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
for r in d["daily_logs"]:
    if r["log_date"] == "2026-10-14":
        r["body"] = r["body"] + "\n- 캐시 없이 앱에서 더한 줄"
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture11.json" > "$WORK/run21.log" 2>&1 || fail "21차 실행 실패"
grep -q '충돌 0' "$WORK/run21.log" && ok "캐시 없음 + 앱 변경 → 충돌 0" || { fail "캐시 없음에서 가짜 충돌"; grep '⚡' "$WORK/run21.log"; }
assert_grep "$D1" '- 캐시 없이 앱에서 더한 줄'; assert_count "$D1" '📲 YouKnow에서 바뀐 내용' 0
[ -f "$IDX" ] && ok "인덱스 캐시 재생성" || fail "인덱스 캐시 미생성"

echo "▶ 회귀: 끝 마커만 지워진 블록은 시작 마커 자리에서 다시 닫는다 (중복 없음)"
python3 -I - "$VAULT/$DAY15" <<'EOF'
import sys
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
s2 = s.replace("%% yk:plans:end %%\n", "", 1); assert s2 != s
open(p, "w", encoding="utf-8").write(s2)
EOF
python3 -I - "$WORK/fixture11.json" "$WORK/fixture12.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
for r in d["day_plans"]:
    if str(r["id"]).startswith("c91e44f0"):
        r["done"] = True
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture12.json" > "$WORK/run22.log" 2>&1 || fail "22차 실행 실패"
assert_count "$DAY15" '%% yk:plans:start %%' 1; assert_count "$DAY15" '%% yk:plans:end %%' 1; assert_count "$DAY15" '%%yk:plan c91e44f0' 1
assert_grep "$DAY15" '- ✅ 20:00–21:00 독서 %%yk:plan c91e44f0 호박%%'
grep -q '`plans` 끝 마커가 사라져 시작 마커 자리에서 블록을 다시 닫음' "$WORK/run22.log" && ok "끝 마커 복구 로그" || fail "끝 마커 복구 로그 없음"

echo "▶ 회귀: 블록 스칼라·중첩 맵·빈 값·주석 frontmatter 는 그대로 살아남는다"
python3 -I - "$VAULT/$D1" <<'EOF'
import sys
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
s2 = s.replace("type: 일기\n", "type: 일기\nsummary: |\n  오늘은 가슴\n  내일은 등\nmeta:\n  nested: 1\nenergy2:\n# 내 주석\n", 1); assert s2 != s
open(p, "w", encoding="utf-8").write(s2)
EOF
python3 -I - "$WORK/fixture12.json" "$WORK/fixture13.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
for r in d["daily_logs"]:
    if r["log_date"] == "2026-10-14":
        r["body"] = r["body"] + "\n- 앱 줄 2"
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture13.json" > "$WORK/run23.log" 2>&1 || fail "23차 실행 실패"
python3 -I - "$VAULT/$D1" <<'EOF' && ok "사용자 YAML 원문 보존 + yk_hash 뒤에 들여쓴 줄 없음" || fail "사용자 YAML 손상"
import re, sys
s = open(sys.argv[1], encoding="utf-8").read()
fm = s.split("---\n")[1]
assert "summary: |\n  오늘은 가슴\n  내일은 등\n" in fm, fm
assert "meta:\n  nested: 1\n" in fm, fm
assert "\nenergy2:\n" in fm and "\n# 내 주석\n" in fm, fm
assert 'summary: "|"' not in fm
assert not re.search(r"^yk_hash: \S+\n[ \t]+\S", fm, re.M), fm
EOF
assert_grep "$D1" '- 앱 줄 2'

echo "▶ 회귀: 따옴표가 든 인라인 리스트 항목은 다시 읽어도 두 항목이다"
python3 -I - "$SCRIPT" <<'EOF' && ok "_split_inline_list 이스케이프" || fail "_split_inline_list 이스케이프"
import importlib.util, sys
spec = importlib.util.spec_from_file_location("imp", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
v = m.yaml_value(['12" 모니터 구매', '케이블'])
fm, _ = m.fm_load("---\naliases: " + v + "\n---\n")
assert fm["aliases"] == ['12" 모니터 구매', '케이블'], fm
assert m.yaml_scalar("1e5") == '"1e5"' and m.yaml_scalar("1_000") == '"1_000"' and m.yaml_scalar("0x1F") == '"0x1F"' and m.yaml_scalar("2026-10-16") == "2026-10-16", "YAML 숫자꼴 따옴표"
EOF

echo "▶ 회귀: 빈 frontmatter(---/---) 노트에 두 번째 frontmatter 를 덧붙이지 않는다"
printf -- '---\n---\n# 내 메모\n' > "$VAULT/10_오늘/2026/10/2026-10-05.md"
run_import "$WORK/fixture13.json" > "$WORK/run24.log" 2>&1 || fail "24차 실행 실패"
assert_count "10_오늘/2026/10/2026-10-05.md" '---' 2; assert_grep "10_오늘/2026/10/2026-10-05.md" '# 내 메모'; assert_grep "10_오늘/2026/10/2026-10-05.md" 'type: 오늘'

echo "▶ 회귀: 제목 없는 자료의 '메모 N' 은 행마다 고정"
python3 -I - "$WORK/fixture13.json" "$WORK/fixture14.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
pid = [r for r in d["projects"] if r["name"] == "유튜브 채널 개편"][0]["id"]
d["project_resources"].append({"id": "e2ff0033-4444-4555-8666-777788889999", "owner_id": d["settings"]["user_id"], "project_id": pid, "title": "", "url": "",
                               "body": "두 번째 메모", "sort_order": 5, "created_at": "2026-10-04T01:00:00.000Z", "updated_at": "2026-10-04T01:00:00.000Z"})
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture14.json" > "$WORK/run25.log" 2>&1 || fail "25차 실행 실패"
R3="40_프로젝트/유튜브 채널 개편/자료/메모 2.md"; assert_file "$R3"; assert_grep "$R3" 'title: 메모 2'
python3 -I - "$WORK/fixture14.json" "$WORK/fixture15.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
d["project_resources"] = [r for r in d["project_resources"] if not str(r["id"]).startswith("d1ff0022")]   # 첫 메모 하드 삭제
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture15.json" > "$WORK/run26.log" 2>&1 || fail "26차 실행 실패"
assert_grep "$R3" 'title: 메모 2'; assert_nogrep "$R3" 'aliases'
grep -q "'메모 2' → '메모 1'" "$WORK/run26.log" && fail "메모 번호가 밀림" || ok "앞 메모가 사라져도 뒤 메모 번호 유지"

echo "▶ 회귀: Tasks 로 체크한 실제 완료일(✅)은 마감일로 바뀌지 않는다"
python3 -I - "$VAULT/$T2" <<'EOF'
import sys
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
s2 = s.replace("📅 2026-10-12 ✅ 2026-10-12 🆔 yk-8e2d4f61", "📅 2026-10-12 🆔 yk-8e2d4f61 ✅ 2026-10-11"); assert s2 != s
open(p, "w", encoding="utf-8").write(s2)
EOF
run_import "$WORK/fixture15.json" > "$WORK/run27.log" 2>&1 || fail "27차 실행 실패"
assert_grep "$T2" '- [x] 치과 예약 🔺 🛫 2026-10-10 📅 2026-10-12 ✅ 2026-10-11 🆔 yk-8e2d4f61'; assert_grep "$T2" 'done: 2026-10-11'; assert_nogrep "$T2" '✅ 2026-10-12'
run_import "$WORK/fixture15.json" > "$WORK/run27b.log" 2>&1 || fail "27b차 실행 실패"
assert_grep "$T2" '✅ 2026-10-11'; grep -qE '할 일 새로 0 · 갱신 0' "$WORK/run27b.log" && ok "완료일 보존 뒤 멱등" || fail "완료일 보존 뒤 멱등성 깨짐"
# 볼트에서 완료 + 날짜까지 붙인 할 일(앱은 진행 전) → 볼트 승 + 날짜 유지
python3 -I - "$VAULT/$T4" <<'EOF'
import sys
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
# 사용자가 '달성 못함' 을 되돌려 진행 중으로 두었다가 Tasks 로 체크(✅ 날짜가 붙음)한 상황
s2 = s.replace("status: 달성 못함", "status: 진행 중").replace("- [-] 영어 단어 100개 🔽 🛫 2026-10-08 📅 2026-10-09 🆔 yk-d4e5f6a7", "- [x] 영어 단어 100개 🔽 🛫 2026-10-08 📅 2026-10-09 🆔 yk-d4e5f6a7 ✅ 2026-10-16"); assert s2 != s
open(p, "w", encoding="utf-8").write(s2)
EOF
python3 -I - "$WORK/fixture15.json" "$WORK/fixture16.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
for r in d["tasks"]:
    if r["title"] == "영어 단어 100개":
        r["status"] = "진행 중"
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture16.json" > "$WORK/run28.log" 2>&1 || fail "28차 실행 실패"
assert_grep "$T4" 'status: 완료'; assert_grep "$T4" 'yk_dirty: true'; assert_grep "$T4" '📅 2026-10-09 ✅ 2026-10-16 🆔 yk-d4e5f6a7'; assert_grep "$T4" 'done: 2026-10-16'

echo "▶ 회귀: Obsidian 에서만 체크한 프로젝트 체크 항목 → 앱 승이지만 로그 + yk_dirty"
python3 -I - "$VAULT/$P1" <<'EOF'
import sys
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
s2 = s.replace("- [ ] 콘텐츠 캘린더 %%yk:chk b2c3d4e5%%", "- [x] 콘텐츠 캘린더 %%yk:chk b2c3d4e5%%"); assert s2 != s
open(p, "w", encoding="utf-8").write(s2)
EOF
python3 -I - "$WORK/fixture16.json" "$WORK/fixture17.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
for r in d["project_checklist"]:
    if r["text"] == "인트로 영상":
        r["text"] = "인트로 영상 v2"
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture17.json" > "$WORK/run29.log" 2>&1 || fail "29차 실행 실패"
assert_grep "$P1" '- [ ] 콘텐츠 캘린더 %%yk:chk b2c3d4e5%%'; assert_grep "$P1" 'yk_dirty: true'; assert_grep "$P1" '- [ ] 인트로 영상 v2'
grep -q "체크리스트 '콘텐츠 캘린더' Obsidian \[x\] · 앱 \[ \] → 앱 승, yk_dirty" "$WORK/run29.log" && ok "체크리스트 역방향 로그" || fail "체크리스트 역방향 로그 없음"
assert_grep "$YK" "체크 '콘텐츠 캘린더' [x]"
run_import "$WORK/fixture17.json" > "$WORK/run29b.log" 2>&1 || fail "29b차 실행 실패"
assert_nogrep "$P1" 'yk_dirty'   # 다음 실행에서 차이가 없으면 플래그 해제

echo "▶ 회귀: daily_photos 없이 photo_path 만 있는 일기도 사진 줄이 생긴다"
python3 -I - "$WORK/fixture17.json" "$WORK/fixture18.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
d["daily_photos"] = []
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture18.json" > "$WORK/run30.log" 2>&1 || fail "30차 실행 실패"
assert_grep "$D2" 'photos: 1'; assert_grep "$D2" 'cover: "[[9f0e1a2b-IMG_0012.jpg]]"'; assert_grep "$D2" '- 📷 9f0e1a2b-IMG_0012.jpg (앱에서만 보임)'

echo "▶ 회귀: 사용자가 프로젝트 노트 이름을 바꿔도 같은 yk_id 노트가 둘 생기지 않는다"
mv "$VAULT/$P1" "$VAULT/40_프로젝트/유튜브 채널 개편/README.md"
mv "$VAULT/$P2" "$VAULT/40_프로젝트/방 정리.md" && rmdir "$VAULT/40_프로젝트/방 정리" 2>/dev/null
run_import "$WORK/fixture18.json" > "$WORK/run31.log" 2>&1 || fail "31차 실행 실패"
grep -qE '프로젝트 새로 0' "$WORK/run31.log" && ok "이름 바꾼 프로젝트 → 새로 0" || { fail "이름 바꾼 프로젝트가 새로 생김"; grep 프로젝트 "$WORK/run31.log" | tail -1; }
assert_nofile "$P1"; assert_file "40_프로젝트/유튜브 채널 개편/README.md"; assert_nofile "40_프로젝트/40_프로젝트.md"; assert_file "40_프로젝트/방 정리.md"
assert_grep "40_프로젝트/유튜브 채널 개편/README.md" 'yk_id: e5f6a7b8-2d3e-4f40-95b6-c7d8e9f0a001'
assert_grep "$R1" 'project: "[[유튜브 채널 개편]]"'; assert_grep "$T1" 'project: "[[유튜브 채널 개편]]"'
DUP=$(cd "$VAULT" && grep -rhoE '^yk_id: .+$' --include='*.md' --exclude-dir=_System . | sort | uniq -d | wc -l | tr -d ' ')
[ "$DUP" = "0" ] && ok "yk_id 중복 0 (이름 변경 뒤)" || fail "yk_id 중복 $DUP"
P1="40_프로젝트/유튜브 채널 개편/README.md"; P2="40_프로젝트/방 정리.md"

echo "▶ 회귀: 휴지통 행은 [-] 줄 + yk_deleted, 역방향 감지 없음"
python3 -I - "$WORK/fixture18.json" "$WORK/fixture19.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
for r in d["tasks"]:
    if r["title"] == "영상 편집":
        r["deleted_at"] = "2026-10-16T01:00:00.000Z"
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture19.json" > "$WORK/run32.log" 2>&1 || fail "32차 실행 실패"
assert_grep "$T1" 'yk_deleted: 2026-10-16'; assert_grep "$T1" '- [-] 영상 편집 ⏫ 🛫 2026-10-01 📅 2026-10-17 🆔 yk-3f9a1c2e'; assert_nogrep "$T1" 'yk_dirty'
run_import "$WORK/fixture19.json" > "$WORK/run32b.log" 2>&1 || fail "32b차 실행 실패"
assert_nogrep "$T1" 'yk_dirty'; grep -qE '할 일 새로 0 · 갱신 0' "$WORK/run32b.log" && ok "휴지통 행 멱등" || fail "휴지통 행 멱등성 깨짐"

echo "▶ 회귀: 위험한 제목/경로 — 점 시작 · 역슬래시 · 너무 긴 제목 · 숫자꼴 · 경로 탈출"
python3 -I - "$WORK/fixture19.json" "$WORK/fixture20.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
uid = d["settings"]["user_id"]
def task(i, title):
    return {"id": f"{i}0000000-aaaa-4bbb-8ccc-{i}{i}{i}{i}{i}{i}{i}{i}{i}{i}{i}{i}", "owner_id": uid, "title": title, "priority": 3, "start_date": "2026-10-16", "due_date": None,
            "status": "진행 전", "project_id": None, "note": "", "deleted_at": None, "created_at": f"2026-10-16T0{i}:00:00.000Z"}
d["tasks"] += [task(1, ".env 파일 정리"), task(2, "가" * 90), task(3, "1e5")]
for r in d["tasks"]:
    if r["title"] == "영어 단어 100개":
        r["title"] = "LaTeX \\alpha 공부 \\1"
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture20.json" > "$WORK/run33.log" 2>&1 && ok "위험한 제목 실행 종료 코드 0" || { fail "위험한 제목 실행 실패"; grep '❌' "$WORK/run33.log"; }
assert_file "30_할일/목록/env 파일 정리.md"; [ -e "$VAULT/30_할일/목록/.env 파일 정리.md" ] && fail "점으로 시작하는 파일 생성" || ok "점 시작 파일 없음"
LONG=$(cd "$VAULT/30_할일/목록" && ls | grep -c '^가가가')
[ "$LONG" = "1" ] && ok "긴 제목 → 잘린 파일 1개" || fail "긴 제목 파일 $LONG 개"
assert_grep "30_할일/목록/1e5.md" 'title: "1e5"'
assert_grep "$T4" 'title: "LaTeX \\alpha 공부 \\1"'; assert_grep "$T4" '# ✅ LaTeX \alpha 공부 \1'
run_import "$WORK/fixture20.json" > "$WORK/run33b.log" 2>&1 || fail "33b차 실행 실패"
grep -qE '할 일 새로 0 · 갱신 0' "$WORK/run33b.log" && ok "위험한 제목 멱등(점 시작 노트 재생성 없음)" || { fail "위험한 제목 멱등성 깨짐"; grep '할 일' "$WORK/run33b.log" | tail -1; }
python3 -I - "$WORK/fixture20.json" "$WORK/fixture21.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
uid = d["settings"]["user_id"]
d["daily_logs"].append({"id": "bad0bad0-0000-4000-8000-000000000001", "owner_id": uid, "title": "탈출", "log_date": "../../탈출", "mood": "", "tags": [], "body": "x",
                        "photo_path": None, "diary_type": "general", "metrics": {}, "deleted_at": None, "created_at": "2026-10-16T05:00:00.000Z"})
d["projects"].append({"id": "bad0bad0-0000-4000-8000-000000000002", "owner_id": uid, "name": "..", "status": "진행 중", "area": "개인", "goal": "", "next_action": "",
                      "start_date": None, "due_date": None, "resources": "", "deleted_at": None, "created_at": "2026-10-16T05:00:00.000Z", "updated_at": "2026-10-16T05:00:00.000Z"})
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
if run_import "$WORK/fixture21.json" > "$WORK/run34.log" 2>&1; then fail "경로 탈출 행이 실패로 집계되지 않음"; else ok "경로 탈출 행 → 실패(종료 코드 1)"; fi
grep -q 'log_date 형식 오류' "$WORK/run34.log" && ok "log_date 검증 로그" || fail "log_date 검증 로그 없음"
[ -e "$WORK/탈출 일기.md" ] || [ -e "$VAULT/../탈출 일기.md" ] && fail "볼트 밖에 파일이 생김" || ok "볼트 밖 파일 없음"
assert_nofile "...md"; assert_file "40_프로젝트/이름 없음/이름 없음.md"

echo "▶ 회귀: --push-pending 은 한 번만 보내고(yk_pushed) 다음 가져오기가 채택한다"
cat > "$VAULT/30_할일/목록/회의 준비.md" <<'EOF'
---
type: 할일
title: 회의 준비
status: 진행 전
priority: 4
priority_label: 중요
start: 2026-10-10
due: 2026-10-20
daily: "[[2026-10-10]]"
마감: "[[2026-10-20]]"
project: "[[유튜브 채널 개편]]"
created: 2026-10-10
yk_pending: true
---
# ✅ 회의 준비
%% yk:task:start %%
- [ ] 회의 준비 ⏫ 🛫 2026-10-10 📅 2026-10-20
%% yk:task:end %%

## 세부 메모
%% yk:note:start %%
%% yk:note:end %%
EOF
PORT=18877
python3 -I - "$PORT" "$WORK/posts.log" <<'EOF' &
import sys, json
from http.server import BaseHTTPRequestHandler, HTTPServer
port, logp = int(sys.argv[1]), sys.argv[2]
class H(BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n).decode("utf-8")
        open(logp, "a", encoding="utf-8").write(body + "\n")
        out = json.dumps({"message": "ok"}).encode("utf-8")
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(out))); self.end_headers(); self.wfile.write(out)
    def log_message(self, *a): pass
HTTPServer(("127.0.0.1", port), H).serve_forever()
EOF
STUB=$!
sleep 1
YK_APP_URL="http://127.0.0.1:$PORT" YK_WIDGET_KEY=sekrit run_import "$WORK/fixture20.json" --push-pending > "$WORK/run35.log" 2>&1 || fail "35차 실행 실패"
YK_APP_URL="http://127.0.0.1:$PORT" YK_WIDGET_KEY=sekrit run_import "$WORK/fixture20.json" --push-pending > "$WORK/run36.log" 2>&1 || fail "36차 실행 실패"
kill "$STUB" 2>/dev/null
python3 -I - "$WORK/posts.log" <<'EOF' && ok "두 번 실행해도 POST 1회 · 본문 = 제목 M/D까지 우선순위 [프로젝트] + today + key" || { fail "POST 횟수/본문"; cat "$WORK/posts.log"; }
import json, sys
posts = [json.loads(l) for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
assert len(posts) == 1, posts
assert posts[0] == {"text": "회의 준비 10/20까지 중요 [유튜브 채널 개편]", "key": "sekrit", "today": "2026-10-16"}, posts[0]
EOF
assert_grep "30_할일/목록/회의 준비.md" 'yk_pushed: 2026-10-16'; assert_grep "30_할일/목록/회의 준비.md" 'yk_pending: true'
grep -q '이미 보냄' "$WORK/run36.log" && ok "재전송 건너뜀 로그" || fail "재전송 건너뜀 로그 없음"
python3 -I - "$WORK/fixture20.json" "$WORK/fixture22.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
pid = [r for r in d["projects"] if r["name"] == "유튜브 채널 개편"][0]["id"]
d["tasks"].append({"id": "feed0000-1111-4222-8333-444455556666", "owner_id": d["settings"]["user_id"], "title": "회의 준비", "priority": 4,
                   "start_date": "2026-10-16", "due_date": "2026-10-20", "status": "진행 전", "project_id": pid, "note": "",
                   "deleted_at": None, "created_at": "2026-10-16T05:00:00.000Z"})   # 앱이 보낸 날 만든 행 (노트 created 와는 6일 차)
json.dump(d, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
EOF
run_import "$WORK/fixture22.json" > "$WORK/run37.log" 2>&1 || fail "37차 실행 실패"
assert_grep "30_할일/목록/회의 준비.md" 'yk_id: feed0000-1111-4222-8333-444455556666'; assert_nogrep "30_할일/목록/회의 준비.md" 'yk_pending'; assert_nogrep "30_할일/목록/회의 준비.md" 'yk_pushed'
assert_nofile "30_할일/목록/회의 준비 (2).md"

echo "▶ 회귀: 일간 스켈레톤 '지난 마감' 은 마감 없는 할 일을 빼고, 템플릿과 같은 질의다"
assert_grep "$DAY01" 'WHERE due AND due < date(2026-10-01) AND status != "완료" AND status != "달성 못함" AND !yk_deleted AND !yk_missing'
diff <(grep -E '^(FROM|WHERE|SORT|TABLE|LIST|not done|due on|hide backlink|short mode)' "$VAULT_SRC/_System/Templates/tpl-daily.md" | sed 's/\${date}/D/g') \
     <(grep -E '^(FROM|WHERE|SORT|TABLE|LIST|not done|due on|hide backlink|short mode)' "$VAULT/$DAY01" | sed 's/2026-10-01/D/g') > /dev/null \
  && ok "tpl-daily ↔ importer 스켈레톤 Dataview 질의 동일" || fail "tpl-daily 와 importer 스켈레톤 질의가 다름"

echo
echo "결과: 통과 $PASS · 실패 $FAIL"
[ "$FAIL" -eq 0 ] || { echo "임시 볼트 보존하려면 YK_TEST_KEEP=1 로 다시 실행: $WORK"; exit 1; }
exit 0
