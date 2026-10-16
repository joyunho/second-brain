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
assert_grep "$P1" 'area: "[[유튜브]]"'; assert_grep "$P1" 'emoji: "🎬"'; assert_grep "$P1" 'up: "[[🗂️ 프로젝트]]"'; assert_grep "$P1" '마감: "[[2026-12-31]]"'
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
assert_grep "$H1" 'tags: [hub]'; assert_grep "$H1" 'up: "[[🔁 습관]]"'; assert_grep "$H1" 'color_name: 초록'; assert_grep "$H1" 'daily: "[[2026-09-20]]"'
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

echo
echo "결과: 통과 $PASS · 실패 $FAIL"
[ "$FAIL" -eq 0 ] || { echo "임시 볼트 보존하려면 YK_TEST_KEEP=1 로 다시 실행: $WORK"; exit 1; }
exit 0
