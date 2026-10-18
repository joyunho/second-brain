#!/usr/bin/env python3
"""
YouKnow(Meta data 앱) → Obsidian 볼트 가져오기 (설계서 §7)

세 가지 입력 중 하나로 12개 테이블을 읽어 볼트 노트를 만들고/갱신합니다.
  --supabase                         Supabase REST (12테이블 + 휴지통 + 사진 바이너리) — 권장
  --backup  <youknow-backup-*.json>  앱 "전체 백업(.json)" (8테이블; habits/habit_checks/routine_blocks/day_plans 가 들어 있으면 '확장 백업')
  --zip     <youknow-obsidian-*.zip> 앱 "마크다운 볼트 내보내기" (일기만, fallback)
  --export-diaries-for-youknow <dir> 역방향: 볼트에서 쓴 일기(yk_id 없음)를 앱이 읽는 .md 형식으로 내보내기
  --csv <file>                       할 일 CSV 미리보기만 (id 가 없어 쓰기 거부)

원칙 (§7-3): 파일을 지우거나 옮기지 않음 · `%% yk:<블록>:start/end %%` 사이만 다시 씀 · importer 소유 키만 덮어씀 ·
변경 없으면 파일을 열지 않음(yk_hash) · 사용자 편집 + 앱 변경이 겹치면 콜아웃으로 둘 다 보존 · 할 일은 볼트 쪽이 '더 진행'이면 볼트 승(yk_dirty).

표준 라이브러리만 사용. Python 3.9+ (macOS 기본 python3 로 동작).
    python3 -I _System/Scripts/import_youknow.py --backup 98_연동/YouKnow/백업/youknow-backup-2026-10-16.json --dry-run
환경 변수(.env: _System/Scripts/.env): YK_SUPABASE_URL, YK_SUPABASE_ANON_KEY, YK_OWNER_ID, YK_WIDGET_KEY, YK_APP_URL, YK_TODAY(테스트용 오늘 날짜 고정)
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import os
import re
import shutil
import sys
import traceback
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath
from zoneinfo import ZoneInfo

# ──────────────────────────────────────────────────────────────────────────────
# 상수 (앱 번들 page.pretty.js 와 동일한 값)
# ──────────────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_VAULT = Path(__file__).resolve().parents[2]
DEFAULT_OWNER = "00000000-0000-0000-0000-000000000001"
DEFAULT_APP_URL = "https://youknow-meta-data-weom.vercel.app"
PAGE_SIZE = 1000
TABLES_12 = [
    "settings", "daily_logs", "daily_photos", "tasks", "projects", "project_checklist",
    "project_sections", "project_resources", "habits", "habit_checks", "routine_blocks", "day_plans",
]
BACKUP_8 = ["settings", "daily_logs", "daily_photos", "tasks", "projects", "project_checklist", "project_sections", "project_resources"]
BACKUP_EXTRA = ["habits", "habit_checks", "routine_blocks", "day_plans"]

COLOR_NAMES = {  # B 맵
    "#38bdf8": "하늘", "#34d399": "초록", "#f59e0b": "호박", "#fb923c": "주황",
    "#2dd4bf": "청록", "#f472b6": "분홍", "#a3e635": "연두", "#94a3b8": "회색",
}
MOOD_MAP = {  # ap 맵: 이모지, 점수, 색
    "최고": ("🤩", 5, "#f59e0b"), "좋음": ("🙂", 4, "#34d399"), "보통": ("😐", 3, "#94a3b8"),
    "별로": ("😕", 2, "#fb923c"), "힘듦": ("😞", 1, "#f87171"),
}
PRIORITY_LABELS = {5: "긴급", 4: "중요", 3: "보통", 2: "낮음", 1: "언젠가"}
PRIORITY_MARK = {5: "🔺", 4: "⏫", 3: "", 2: "🔽", 1: "⏬"}
STATUS_BOX = {"진행 전": " ", "진행 중": "/", "완료": "x", "달성 못함": "-"}
BOX_STATUS = {" ": "진행 전", "/": "진행 중", "x": "완료", "X": "완료", "-": "달성 못함"}
STATUS_RANK = {"진행 전": 0, "진행 중": 1, "완료": 2, "달성 못함": 2}
WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]
DEFAULT_DIARY_TYPES = [
    {"id": "general", "name": "일반", "icon": "book-open", "color": "#a78bfa", "kind": "general", "template": "", "fields": []},
    {"id": "workout", "name": "운동", "icon": "dumbbell", "color": "#34d399", "kind": "workout",
     "template": "오늘 운동\n- \n\n느낀 점\n- ", "parts": ["가슴", "등", "어깨", "팔", "하체", "코어", "유산소"], "fields": []},
]
DEFAULT_MOODS = ["최고", "좋음", "보통", "별로", "힘듦"]
DEFAULT_TAGS = ["운동", "게임", "외출", "친구", "공부", "유튜브", "휴식", "돈관리"]

FORBIDDEN = re.compile(r'[\\/:*?"<>|#^\[\]]')
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MARK_START = "%% yk:{name}:start %%"
MARK_END = "%% yk:{name}:end %%"
CALLOUT_TITLE = "> [!note] 📲 YouKnow에서 바뀐 내용 ({date})"
# 일간 노트 → 📔 일기 허브 링크(초기 골격)는 날짜 노트 수백 개가 허브 하나를 가리켜 그래프에 거대한 별을 만들었다 → 안내 문구로 교체(기존 노트는 run_daily 가 1회 교체)
DAILY_HUB_LINK_OLD = "· [[일기|오늘 일기 쓰기 →]]"
DAILY_HUB_LINK_NEW = "· 일기 쓰기: Cmd+N → 📔 일기 (허브 링크 없음)"

# importer 소유 frontmatter 키(§7-3 2a) — 이 밖의 키는 사용자 소유라 보존된다
OWNED_KEYS = {
    "yk_id", "yk_hash", "yk_blocks", "yk_updated", "yk_url", "yk_key", "yk_deleted", "yk_missing", "yk_dirty", "yk_pending", "yk_pushed", "yk_area",
    "date", "title", "diary_type", "종류", "mood", "mood_score", "기분", "parts", "duration_min", "intensity", "photos", "cover", "created",
    "status", "priority", "priority_label", "start", "due", "done", "daily", "마감", "project",
    "goal", "next_action", "area", "emoji", "url", "kind", "sort_order", "updated", "color", "color_name", "weekday",
    "plans", "plans_done", "habits_checked", "icon", "template", "score", "source", "photos_pending",
}


# ──────────────────────────────────────────────────────────────────────────────
# 작은 도우미
# ──────────────────────────────────────────────────────────────────────────────
EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u2194-\u2199\u21A9\u21AA"
    "\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u24C2"
    "\u3030\u303D\u3297\u3299\u00A9\u00AE\u2122\u2139\u203C\u2049\uFE0F\u200D\u20E3\U000E0020-\U000E007F]"
)
# 허브 노트의 파일명(파일명에 이모지를 쓰지 않는다 — Dropbox 동기화(Remotely Save)가 이모지 파일명을 거부). 행 노트가 같은 이름이면 ' (노트)'를 붙여 링크 충돌을 막는다
RESERVED_BASENAMES = {"Brain", "Inbox", "오늘", "일정", "할 일", "Task Inbox", "프로젝트", "일기", "습관", "분야", "문헌", "영구 노트", "사람", "연동", "Health"}


def E(s) -> str:
    """앱과 동일한 파일명 sanitizer(+ 앞뒤 점 제거, 이모지 제거, 허브 이름 회피)."""
    t = FORBIDDEN.sub(" ", str(s if s is not None else ""))
    t = EMOJI.sub("", t)
    t = re.sub(r"\s+", " ", t).strip().strip(". ").strip()
    if t in RESERVED_BASENAMES:
        t += " (노트)"
    return t or "이름 없음"


FNAME_MAX_BYTES = 200   # 파일명 바이트 상한(ext4/APFS NAME_MAX 255 − ' (n).md' 여유). 한글 3바이트 → 약 66자


def fname(s) -> str:
    """파일명용 E(): 너무 긴 제목은 UTF-8 바이트 예산 안으로 자른다(전체 제목은 frontmatter title 에 남는다)."""
    t = E(s)
    if len(t.encode("utf-8")) <= FNAME_MAX_BYTES:
        return t
    t = t.encode("utf-8")[:FNAME_MAX_BYTES].decode("utf-8", "ignore").strip().strip(". ").strip()
    return t or "이름 없음"


def photo_base(p) -> str:
    """Storage 경로 → 안전한 파일명(마지막 조각만, `\\`·`[[`·`..` 제거). 빈 문자열이면 쓸 수 없는 이름."""
    name = PurePosixPath(str(p or "").replace("\\", "/")).name
    b = E(name)
    return "" if b in ("", "이름 없음") else b


def sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()


def block_hash(content: str) -> str:
    """관리 블록 '직전 가져온 내용' 해시(앞 12자) — 캐시와 노트 frontmatter(yk_blocks) 양쪽에 같은 모양으로 둔다."""
    return sha1(content)[:12]


def same_hash(h, content: str) -> bool:
    """저장된 블록 해시(옛 캐시의 40자 전체 또는 12자)와 내용 비교."""
    if not h:
        return False
    hs = str(h)
    return sha1(content)[:len(hs)] == hs if len(hs) <= 40 else False


def yk_blocks_value(block_hashes: dict[str, str]) -> list[str]:
    return [f"{n}:{h}" for n, h in block_hashes.items()]


def parse_yk_blocks(v) -> dict[str, str]:
    out: dict[str, str] = {}
    for item in as_list(v):
        s = str(item)
        if ":" in s:
            n, h = s.split(":", 1)
            if n.strip() and re.fullmatch(r"[0-9a-f]{6,40}", h.strip()):
                out[n.strip()] = h.strip()
    return out


def id8(uuid: str, width: int = 8) -> str:
    return str(uuid or "").replace("-", "")[:width] if "-" in str(uuid or "") else str(uuid or "")[:width]


def emoji_for(area: str, name: str) -> str:
    """aZ 규칙 (area + ' ' + name)."""
    a = f"{area or ''} {name or ''}"
    rules = [
        (r"(건강|운동|헬스|몸)", "💪"), (r"(유튜브|영상|채널)", "🎬"), (r"(게임|에임|랭크)", "🎮"),
        (r"(스타일|패션|미용|헤어|옷)", "💇"), (r"(공부|학교|시험|영어|독서)", "📚"),
        (r"(돈|재테크|주식|저축|소비)", "💰"), (r"(생활|집|방|정리)", "🏠"),
    ]
    for pat, em in rules:
        if re.search(pat, a):
            return em
    return "📁"


def host_of(url: str) -> str:
    t = (url or "").strip()
    if not t:
        return ""
    try:
        h = urllib.parse.urlparse(t).hostname or ""
    except Exception:
        h = ""
    if not h:
        h = re.sub(r"^https?://", "", t, flags=re.I).split("/")[0]
    return re.sub(r"^www\.", "", h, flags=re.I)


def auto_title(url: str) -> str:
    """a$(url): 유튜브 → '유튜브 영상', 그 외 '<host> 글', 호스트 없으면 ''."""
    h = host_of(url)
    if not h:
        return ""
    if re.search(r"(^|\.)youtube\.com$|(^|\.)youtu\.be$", h, re.I):
        return "유튜브 영상"
    return f"{h} 글"


def color_name(hex_color: str) -> str:
    c = (hex_color or "").strip().lower()
    return COLOR_NAMES.get(c, hex_color or "")


def iso_date(ts, tz: ZoneInfo):
    """ISO UTC 타임스탬프 → --tz 날짜 문자열. 날짜만 오면 그대로."""
    if not ts:
        return None
    s = str(ts).strip()
    if DATE_RE.match(s):
        return s
    try:
        s2 = s.replace("Z", "+00:00")
        s2 = re.sub(r"(\.\d{3})\d+", r"\1", s2)  # 마이크로초 6자리 초과 방어
        d = dt.datetime.fromisoformat(s2)
        if d.tzinfo is None:
            d = d.replace(tzinfo=dt.timezone.utc)
        return d.astimezone(tz).date().isoformat()
    except Exception:
        m = re.search(r"\d{4}-\d{2}-\d{2}", s)
        return m.group(0) if m else None


def parse_date(s: str) -> dt.date | None:
    try:
        return dt.date.fromisoformat(s)
    except Exception:
        return None


def iso_week(d: dt.date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def short_title_date(date_s: str, today: dt.date) -> str:
    """앱 td(): 올해면 M/D, 아니면 YYYY/M/D."""
    d = parse_date(date_s)
    if not d:
        return date_s
    md = f"{d.month}/{d.day}"
    return md if d.year == today.year else f"{d.year}/{md}"


def rel(path: Path, vault: Path) -> str:
    try:
        return path.relative_to(vault).as_posix()
    except Exception:
        return path.as_posix()


# ──────────────────────────────────────────────────────────────────────────────
# frontmatter 직렬화 / 관용 파서
# ──────────────────────────────────────────────────────────────────────────────
PLAIN_OK = re.compile(r"^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_.\-/ ·]+$")
RESERVED = {"true", "false", "null", "yes", "no", "on", "off", "~", ""}
# js-yaml(Obsidian)이 숫자로 읽는 토큰: 1e5 · 0x1F · 1_000 · .5 · 1. · 0o17 · 0b101 · .inf · .nan — 평문으로 두면 title 이 숫자가 된다
YAML_NUMLIKE = re.compile(
    r"^-?(?:0[bB][01_]+|0[oO][0-7_]+|0[xX][0-9a-fA-F_]+|[0-9][0-9_]*(?:\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\.[0-9_]+(?:[eE][-+]?[0-9]+)?|\.(?:inf|Inf|INF|nan|NaN|NAN))$")


class Verbatim:
    """fm_load 가 해석하지 않고 그대로 보존하는 frontmatter 줄 묶음(블록 스칼라 `|`/`>`, 중첩 맵, 빈 값 `key:`, `# 주석`).
    fm_dump 는 이 줄들을 원래 자리에 그대로 쓴다. 값으로서는 비어 있는 것(falsy)으로 취급한다."""
    __slots__ = ("lines",)

    def __init__(self, lines: list[str]):
        self.lines = list(lines)

    def __bool__(self):
        return False

    def __str__(self):
        return ""

    def __eq__(self, other):
        return isinstance(other, Verbatim) and other.lines == self.lines

    def __hash__(self):
        return hash(tuple(self.lines))

    def __repr__(self):
        return f"Verbatim({self.lines!r})"


def yaml_scalar(v) -> str:
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v)
    if DATE_RE.match(s):
        return s  # 날짜는 평문으로 두어야 Dataview date 로 읽힌다
    if s.lower() in RESERVED or YAML_NUMLIKE.match(s):
        return json.dumps(s, ensure_ascii=False)
    if PLAIN_OK.match(s) and not s.startswith("-") and not s.endswith(":") and "  " not in s:
        return s
    return json.dumps(s, ensure_ascii=False)


def yaml_value(v) -> str:
    if isinstance(v, (list, tuple)):
        return "[" + ", ".join(yaml_scalar(x) for x in v if not isinstance(x, Verbatim)) + "]"
    return yaml_scalar(v)


def fm_dump(fm: dict) -> str:
    lines = ["---"]
    for k, v in fm.items():
        if isinstance(v, Verbatim):      # 블록 스칼라·중첩 맵·빈 값·주석(__raw__N) — 원문 그대로, 제자리에
            lines.extend(v.lines)
            continue
        if k == "__raw__":               # 옛 캐시/호환: 위치를 모르는 잔여 줄은 yk_* 앞(여기)에
            lines.extend(v or [])
            continue
        if v is None:
            continue
        lines.append(f"{k}: {yaml_value(v)}")
    lines.append("---")
    return "\n".join(lines) + "\n"


def _parse_scalar(s: str):
    s = s.strip()
    if s == "" or s == "~" or s == "null":
        return None
    if s in ("true", "True"):
        return True
    if s in ("false", "False"):
        return False
    if (s.startswith('"') and s.endswith('"')) and len(s) >= 2:
        try:
            return json.loads(s)
        except Exception:
            return s[1:-1]
    if s.startswith("'") and s.endswith("'") and len(s) >= 2:
        return s[1:-1].replace("''", "'")
    if re.match(r"^-?\d+$", s):
        try:
            return int(s)
        except Exception:
            return s
    if re.match(r"^-?\d+\.\d+$", s):
        try:
            return float(s)
        except Exception:
            return s
    return s


def _split_inline_list(s: str) -> list:
    out, cur, q, depth = [], "", None, 0
    it = iter(s)
    for ch in it:
        if q:
            cur += ch
            if q == '"' and ch == "\\":
                cur += next(it, "")   # 이스케이프된 다음 문자(\" 등)는 닫는 따옴표가 아니다
                continue
            if ch == q:
                q = None
            continue
        if ch in "\"'":
            q = ch
            cur += ch
        elif ch == "[":
            depth += 1
            cur += ch
        elif ch == "]":
            depth -= 1
            cur += ch
        elif ch == "," and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur)
    return [_parse_scalar(x) for x in out]


def fm_load(text: str) -> tuple[dict, str]:
    """`---` 블록을 인라인 리스트와 블록 리스트(`- `) 둘 다 읽는 관용 파서. (fm, body) 반환."""
    if not text.startswith("---"):
        return {}, text
    # 빈 블록(`---\n---`)도 frontmatter 다 — 빈 경우를 먼저 시도해야 본문의 `---` 수평선을 닫는 펜스로 오인하지 않는다
    m = re.match(r"^---[ \t]*\r?\n(?:---[ \t]*\r?\n?|([\s\S]*?)\r?\n---[ \t]*\r?\n?)", text)
    if not m:
        return {}, text
    block, body = (m.group(1) or ""), text[m.end():]
    fm: dict = {}
    nraw = 0
    lines = block.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].rstrip("\r")
        i += 1
        if not line.strip():
            continue
        if line.lstrip().startswith("#"):          # 주석은 제자리에 보존
            fm[f"__raw__{nraw}"] = Verbatim([line])
            nraw += 1
            continue
        km = re.match(r"^([^\s:][^:]*?):(?:\s+(.*))?$", line)
        if not km:
            fm[f"__raw__{nraw}"] = Verbatim([line])
            nraw += 1
            continue
        key, val = km.group(1).strip(), (km.group(2) or "").strip()
        if re.match(r"^[|>][+-]?\d?$|^[|>]\d?[+-]?$", val):
            # 블록 스칼라(summary: |) — 들여쓴 줄 전부 원문 그대로
            vb = [line]
            while i < len(lines) and (lines[i].startswith((" ", "\t")) or not lines[i].strip()):
                if not lines[i].strip() and not (i + 1 < len(lines) and lines[i + 1].startswith((" ", "\t"))):
                    break
                vb.append(lines[i].rstrip("\r"))
                i += 1
            fm[key] = Verbatim(vb)
        elif val == "":
            items = []
            is_list = False
            while i < len(lines) and re.match(r"^\s*-\s*", lines[i]) and not lines[i].strip().startswith("---"):
                is_list = True
                items.append(_parse_scalar(re.sub(r"^\s*-\s*", "", lines[i].rstrip("\r"))))
                i += 1
            if is_list:
                fm[key] = items
            elif i < len(lines) and lines[i].startswith((" ", "\t")) and lines[i].strip():
                # 중첩 맵(meta:\n  nested: 1) — 들여쓴 줄 전부 원문 그대로
                vb = [line]
                while i < len(lines) and lines[i].startswith((" ", "\t")) and lines[i].strip():
                    vb.append(lines[i].rstrip("\r"))
                    i += 1
                fm[key] = Verbatim(vb)
            else:
                fm[key] = Verbatim([line])      # 빈 값(`energy:`, Obsidian 속성 UI가 만든 것) — 지우지 않고 그대로
        elif re.match(r"^\[\[[^\[\]]+\]\]$", val):
            fm[key] = val      # 따옴표 없는 [[링크]] 하나 — YAML 로는 중첩 리스트지만 Obsidian/Dataview 처럼 링크 문자열로 읽는다
        elif val.startswith("[") and val.endswith("]"):
            fm[key] = _split_inline_list(val[1:-1])
        else:
            fm[key] = _parse_scalar(val)
    return fm, body


def order_fm(fm: dict) -> dict:
    """결정적 키 순서: type · up · 내용 키(주어진 순서) · tags · 태그 · 사용자 키(주석·원문 줄 포함) · yk_* · yk_hash."""
    keys = list(fm.keys())
    head = [k for k in ("type", "up") if k in fm]
    yk = [k for k in keys if k.startswith("yk_") and k != "yk_hash"]
    tags = [k for k in ("tags", "태그") if k in fm]
    mid = [k for k in keys if k not in head and k not in yk and k not in tags and k != "yk_hash"]
    ordered = head + mid + tags + yk + (["yk_hash"] if "yk_hash" in fm else [])
    return {k: fm[k] for k in ordered}


def as_list(v) -> list:
    if v is None or isinstance(v, Verbatim):
        return []
    if isinstance(v, list):
        return [x for x in v if x is not None and not isinstance(x, Verbatim)]
    return [v]


def link_target(v) -> str:
    """"[[이름|별칭]]" → 이름."""
    s = str(v or "")
    m = re.match(r"^\[\[([^\]|#]+)", s.strip())
    return m.group(1).strip() if m else s.strip()


# ──────────────────────────────────────────────────────────────────────────────
# 관리 블록
# ──────────────────────────────────────────────────────────────────────────────
def block_markers(name: str) -> tuple[str, str]:
    return MARK_START.format(name=name), MARK_END.format(name=name)


def get_block(text: str, name: str) -> str | None:
    s, e = block_markers(name)
    lines = text.split("\n")
    si = ei = None
    for idx, ln in enumerate(lines):
        if ln.strip() == s and si is None:
            si = idx
        elif ln.strip() == e and si is not None:
            ei = idx
            break
    if si is None or ei is None:
        return None
    return "\n".join(lines[si + 1:ei])


ANY_MARK_RE = re.compile(r"^%% yk:[^:]+:(start|end) %%$")
OWNED_LINE_RE = re.compile(r"%%yk:\w+ |^- (✅|❌|⬜) \[\[|^\|")   # importer 가 쓴 줄이라고 확신할 수 있는 모양(인라인 id 마커·습관 불릿·일과표 행)


def _stale_run(lines: list[str], start: int, step: int, free: bool) -> int:
    """고아 마커 옆에 남은 옛 블록 줄의 범위 끝(배타)을 찾는다. free(자유 텍스트)면 빈 줄·헤딩·다른 마커 전까지,
    아니면 importer 가 쓴 줄이라고 확신할 수 있는 줄만(사용자 줄은 절대 지우지 않는다)."""
    j = start
    while 0 <= j < len(lines):
        ln = lines[j]
        if not ln.strip() or ln.startswith("#") or ANY_MARK_RE.match(ln.strip()):
            break
        if not free and not OWNED_LINE_RE.search(ln):
            break
        j += step
    return j


def set_block(text: str, name: str, content: str, header: str | None, log: list[str] | None = None, label: str = "",
              free: bool = False) -> tuple[str, str]:
    """블록 내용 교체. 마커가 없으면 header 아래 재삽입, header 도 없으면 파일 끝에 1회 추가. (text, 상태) 반환.
    마커 하나만 지워졌으면 남은 마커 자리에서 블록을 다시 닫고 그 옆의 옛 블록 줄을 치운다(중복 방지)."""
    s, e = block_markers(name)
    lines = text.split("\n")
    si = ei = None
    for idx, ln in enumerate(lines):
        if ln.strip() == s and si is None:
            si = idx
        elif ln.strip() == e and si is not None:
            ei = idx
            break
    new_lines = [s] + ([content] if content != "" else []) + [e]
    if si is not None and ei is not None:
        lines[si:ei + 1] = new_lines
        return "\n".join(lines), "replaced"
    if si is not None and ei is None:
        # 끝 마커만 사라짐: 시작 마커 + 그 아래 이어지는 옛 블록 줄을 통째로 교체
        j = _stale_run(lines, si + 1, +1, free)
        lines[si:j] = new_lines
        if log is not None:
            log.append(f"  ↺ {label}: `{name}` 끝 마커가 사라져 시작 마커 자리에서 블록을 다시 닫음")
        return "\n".join(lines), "reclosed"
    only_end = next((idx for idx, ln in enumerate(lines) if ln.strip() == e), None)
    if only_end is not None:
        # 시작 마커만 사라짐: 끝 마커 위의 옛 블록 줄 + 끝 마커를 통째로 교체
        j = _stale_run(lines, only_end - 1, -1, free)
        lines[j + 1:only_end + 1] = new_lines
        if log is not None:
            log.append(f"  ↺ {label}: `{name}` 시작 마커가 사라져 끝 마커 자리에서 블록을 다시 닫음")
        return "\n".join(lines), "reclosed"
    if header:
        for idx, ln in enumerate(lines):
            if ln.strip() == header.strip() or (header.endswith(" ") and ln.startswith(header)):
                lines[idx + 1:idx + 1] = new_lines
                if log is not None:
                    log.append(f"  ↺ {label}: `{name}` 마커가 사라져 `{header.strip()}` 아래 다시 넣음")
                return "\n".join(lines), "reinserted"
    if lines and lines[-1] != "":
        lines.append("")
    if header:
        lines.append(header.strip())
    lines.extend(new_lines)
    lines.append("")
    if log is not None:
        log.append(f"  ↺ {label}: `{name}` 마커와 섹션이 모두 없어 파일 끝에 추가")
    return "\n".join(lines), "appended"


def wrap_block(name: str, content: str) -> str:
    """생성 템플릿용: set_block 과 같은 모양(내용이 비면 마커 두 줄만)."""
    sm, em = block_markers(name)
    return f"{sm}\n{content}\n{em}" if content != "" else f"{sm}\n{em}"


def strip_callouts(block: str) -> str:
    """블록 안의 '📲 YouKnow에서 바뀐 내용' 콜아웃(들)을 제거한 사용자 텍스트."""
    out, skipping = [], False
    for ln in block.split("\n"):
        if ln.startswith("> [!note] 📲 YouKnow에서 바뀐 내용"):
            skipping = True
            continue
        if skipping and ln.startswith(">"):
            continue
        skipping = False
        out.append(ln)
    return "\n".join(out).rstrip("\n")


def callout(app_text: str, date_s: str) -> str:
    body = app_text if app_text.strip() else "_(비어 있음)_"
    quoted = "\n".join("> " + ln for ln in body.split("\n"))
    return CALLOUT_TITLE.format(date=date_s) + "\n" + quoted


# ──────────────────────────────────────────────────────────────────────────────
# 데이터 소스
# ──────────────────────────────────────────────────────────────────────────────
def load_env(*paths: Path) -> dict:
    env = {}
    for path in paths:
        if not path.exists():
            continue
        for ln in path.read_text(encoding="utf-8").splitlines():
            ln = ln.strip()
            if not ln or ln.startswith("#") or "=" not in ln:
                continue
            k, v = ln.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    for k in ("YK_SUPABASE_URL", "YK_SUPABASE_ANON_KEY", "YK_OWNER_ID", "YK_WIDGET_KEY", "YK_APP_URL", "YK_TODAY"):
        if os.environ.get(k):
            env[k] = os.environ[k]
    env.setdefault("YK_OWNER_ID", DEFAULT_OWNER)
    env.setdefault("YK_APP_URL", DEFAULT_APP_URL)
    return env


class Source:
    """12테이블을 {table: list|None} 로 든다. None = 이 소스에 없음(블록 불변)."""

    def __init__(self, kind: str):
        self.kind = kind          # supabase | backup | zip | none
        self.tables: dict[str, list | None] = {t: None for t in TABLES_12}
        self.settings: dict | None = None
        self.exported_at: str | None = None
        self.failed: dict[str, str] = {}
        self.has_binary = kind == "supabase"
        self.extended_backup = False
        self.from_fallback: set[str] = set()   # REST 실패 → 백업으로 보충한 테이블(휴지통 행이 없어 yk_missing 판정 금지)

    def present(self, t: str) -> bool:
        return self.tables.get(t) is not None

    def rows(self, t: str) -> list:
        return self.tables.get(t) or []


def http_json(url: str, headers: dict, method: str = "GET", data: bytes | None = None, timeout: int = 60):
    req = urllib.request.Request(url, headers=headers, method=method, data=data)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        return json.loads(raw.decode("utf-8")) if raw else None, resp.headers


def fetch_supabase(env: dict, log: list[str]) -> Source:
    src = Source("supabase")
    base = env.get("YK_SUPABASE_URL", "").rstrip("/")
    key = env.get("YK_SUPABASE_ANON_KEY", "")
    owner = env.get("YK_OWNER_ID", DEFAULT_OWNER)
    if not base or not key:
        raise SystemExit("❌ .env 에 YK_SUPABASE_URL / YK_SUPABASE_ANON_KEY 가 없습니다 (_System/Scripts/.env.example 참고)")
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"}
    for table in TABLES_12:
        try:
            if table == "settings":
                url = f"{base}/rest/v1/settings?user_id=eq.{owner}&select=*"
                data, _ = http_json(url, headers)
                src.settings = (data or [None])[0] if isinstance(data, list) else data
                if not src.settings:
                    raise RuntimeError("settings 행이 없습니다 (앱을 한 번 열어 설정을 만들어 주세요)")
                src.tables["settings"] = [src.settings]
                continue
            rows: list = []
            start = 0
            while True:
                url = f"{base}/rest/v1/{table}?owner_id=eq.{owner}&select=*&order=id.asc"
                h = dict(headers)
                h["Range-Unit"] = "items"
                h["Range"] = f"{start}-{start + PAGE_SIZE - 1}"
                try:
                    page, _ = http_json(url, h)
                except urllib.error.HTTPError as ex:
                    if ex.code == 416:   # 행 수가 정확히 PAGE_SIZE 의 배수일 때 다음 페이지는 416
                        page = []
                    else:
                        raise
                page = page or []
                rows.extend(page)
                if len(page) < PAGE_SIZE:
                    break
                start += PAGE_SIZE
            src.tables[table] = rows
        except urllib.error.HTTPError as ex:
            body = ""
            try:
                body = ex.read().decode("utf-8")[:200]
            except Exception:
                pass
            src.failed[table] = f"HTTP {ex.code} {body}"
            log.append(f"⚠️ {table}: 읽기 실패 (HTTP {ex.code}) — 이 테이블의 블록은 건드리지 않음")
            if table == "settings":
                raise SystemExit(f"❌ settings 읽기 실패: HTTP {ex.code} {body}")
        except Exception as ex:  # noqa: BLE001
            src.failed[table] = str(ex)
            log.append(f"⚠️ {table}: 읽기 실패 ({ex}) — 이 테이블의 블록은 건드리지 않음")
            if table == "settings":
                raise SystemExit(f"❌ settings 읽기 실패: {ex}")
    src.env = env  # type: ignore[attr-defined]
    src.headers = headers  # type: ignore[attr-defined]
    src.base = base  # type: ignore[attr-defined]
    return src


def load_backup(path: Path, log: list[str]) -> Source:
    src = Source("backup")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or "settings" not in data:
        raise SystemExit(f"❌ 백업 JSON 형식이 아닙니다: {path}")
    src.exported_at = data.get("exported_at")
    src.settings = data.get("settings") or {}
    src.tables["settings"] = [src.settings]
    for t in BACKUP_8[1:]:
        v = data.get(t)
        src.tables[t] = list(v) if isinstance(v, list) else []
        if not isinstance(v, list):
            log.append(f"⚠️ 백업에 {t} 배열이 없어 빈 목록으로 처리")
    extra = [t for t in BACKUP_EXTRA if isinstance(data.get(t), list)]
    for t in extra:
        src.tables[t] = list(data[t])
    if extra:
        src.extended_backup = True
        log.append(f"확장 백업: {', '.join(extra)} 테이블 포함")
    missing = [t for t in BACKUP_EXTRA if t not in extra]
    if missing:
        log.append(f"건너뜀(백업에 없음): {', '.join(missing)} — 기존 블록 불변")
    return src


def merge_sources(primary: Source, fallback: Source, log: list[str]) -> Source:
    for t in TABLES_12:
        if primary.tables.get(t) is None and fallback.tables.get(t) is not None:
            primary.tables[t] = fallback.tables[t]
            primary.from_fallback.add(t)
            log.append(f"보충: {t} 는 REST 실패 → 백업 JSON 사용")
            if t == "settings":
                primary.settings = fallback.settings
    primary.exported_at = primary.exported_at or fallback.exported_at
    return primary


# ──────────────────────────────────────────────────────────────────────────────
# 볼트 인덱스 (yk_id → 경로, 직전 앱 태그, 블록 해시) — 캐시는 매 실행 검증·자가 복구
# ──────────────────────────────────────────────────────────────────────────────
class Index:
    def __init__(self, vault: Path, cache_path: Path):
        self.vault = vault
        self.cache_path = cache_path
        self.by_id: dict[str, str] = {}
        self.dups: dict[str, list[str]] = {}
        self.meta: dict[str, dict] = {}     # key(yk_id 또는 path:<rel>) → {app_tags, app_tag_links, blocks}
        self.notes: dict[str, dict] = {}    # rel → fm (타입·자연키 조회용)
        self.pending_tasks: list[str] = []
        self.load_cache()
        self.scan()

    def load_cache(self):
        try:
            data = json.loads(self.cache_path.read_text(encoding="utf-8"))
            self.meta = data.get("meta", {}) if isinstance(data, dict) else {}
        except Exception:
            self.meta = {}

    def scan(self):
        self.by_id, self.dups, self.notes = {}, {}, {}
        for p in self.vault.rglob("*.md"):
            relp = rel(p, self.vault)
            if relp.startswith(".") or "/." in relp or relp.startswith("_System/Templates"):
                continue
            try:
                text = p.read_text(encoding="utf-8")
            except Exception:
                continue
            if not text.startswith("---"):
                continue
            fm, _ = fm_load(text)
            if not fm:
                continue
            self.notes[relp] = fm
            yk = fm.get("yk_id")
            if yk:
                yk = str(yk)
                if yk in self.by_id and self.by_id[yk] != relp:
                    self.dups.setdefault(yk, [self.by_id[yk]]).append(relp)
                else:
                    self.by_id[yk] = relp
            if fm.get("yk_pending") is True and not yk:
                self.pending_tasks.append(relp)
        # 자가 복구: 캐시에 있지만 볼트에서 사라진 항목 제거
        for k in list(self.meta.keys()):
            if k.startswith("path:"):
                if k[5:] not in self.notes:
                    self.meta.pop(k, None)
            elif k not in self.by_id:
                self.meta.pop(k, None)

    def key_for(self, yk_id: str | None, relp: str) -> str:
        return str(yk_id) if yk_id else "path:" + relp

    def get_meta(self, yk_id: str | None, relp: str) -> dict:
        return self.meta.get(self.key_for(yk_id, relp), {})

    def set_meta(self, yk_id: str | None, relp: str, **kw):
        k = self.key_for(yk_id, relp)
        m = self.meta.setdefault(k, {})
        m.update(kw)
        m["path"] = relp

    def register(self, yk_id: str | None, relp: str, fm: dict):
        self.notes[relp] = fm
        if yk_id:
            self.by_id[str(yk_id)] = relp

    def save(self):
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache_path.write_text(json.dumps({"version": 1, "updated": dt.datetime.now().isoformat(timespec="seconds"), "meta": self.meta},
                                              ensure_ascii=False, indent=1), encoding="utf-8")

    # 자연키 조회 ---------------------------------------------------------
    def find_diary(self, date_s: str, type_name: str) -> str | None:
        for relp, fm in self.notes.items():
            if not relp.startswith("50_일기/") or fm.get("type") != "일기" or fm.get("yk_id"):
                continue
            if str(fm.get("date") or "") == date_s and str(fm.get("diary_type") or "일반") == type_name:
                return relp
        return None

    def find_task(self, title: str, due: str | None, created: str | None) -> str | None:
        cd = parse_date(created or "")
        for relp, fm in self.notes.items():
            if not relp.startswith("30_할일/목록/") or fm.get("type") != "할일" or fm.get("yk_id"):
                continue
            if fm.get("yk_pending") is not True:
                continue
            if str(fm.get("title") or Path(relp).stem) != title:
                continue
            pushed = parse_date(str(fm.get("yk_pushed") or ""))
            if not pushed and (str(fm.get("due")) if fm.get("due") else None) != (due or None):
                continue      # --push-pending 으로 보낸 노트는 지난 마감을 보내지 않으므로 마감 비교를 건너뛴다
            # --push-pending 으로 보낸 노트는 앱 행이 보낸 날 생기므로 created 대신 yk_pushed 와 비교한다
            fcd = pushed or parse_date(str(fm.get("created") or ""))
            if cd and fcd and abs((cd - fcd).days) > 1:
                continue
            return relp
        return None

    def find_project(self, name: str) -> str | None:
        for relp, fm in self.notes.items():
            if relp.startswith("40_프로젝트/") and fm.get("type") == "프로젝트" and not fm.get("yk_id") and Path(relp).stem == name:
                return relp
        return None

    def find_resource(self, project_name: str, title: str) -> str | None:
        for relp, fm in self.notes.items():
            if fm.get("type") == "자료" and not fm.get("yk_id") and relp.startswith(f"40_프로젝트/{project_name}/자료/") and Path(relp).stem == title:
                return relp
        return None


# ──────────────────────────────────────────────────────────────────────────────
# Importer
# ──────────────────────────────────────────────────────────────────────────────
class Counter:
    def __init__(self):
        self.d: dict[str, dict[str, int]] = {}

    def add(self, table: str, what: str, n: int = 1):
        self.d.setdefault(table, {"새로": 0, "갱신": 0, "건너뜀": 0, "실패": 0})
        self.d[table][what] = self.d[table].get(what, 0) + n

    def get(self, table: str, what: str) -> int:
        return self.d.get(table, {}).get(what, 0)


class Importer:
    def __init__(self, args, src: Source, env: dict):
        self.args = args
        self.src = src
        self.env = env
        self.vault: Path = Path(args.vault).expanduser().resolve()
        self.tz = ZoneInfo(args.tz)
        today_env = env.get("YK_TODAY")
        self.today: dt.date = parse_date(today_env) if today_env and parse_date(today_env) else dt.datetime.now(self.tz).date()
        self.today_s = self.today.isoformat()
        self.dry = bool(args.dry_run)
        self.log: list[str] = []
        self.counts = Counter()
        self.conflicts = 0
        self.dirty: list[tuple[str, str, str]] = []   # (노트, Obsidian 값, 앱 값)
        self.failures: list[str] = []
        self.photo_count = 0
        self.photo_fail = 0
        self.planned_paths: set[str] = set()
        self.written: set[str] = set()
        self.index = Index(self.vault, self.vault / "_System" / "Scripts" / ".yk_index.json")
        self.app_url = env.get("YK_APP_URL", DEFAULT_APP_URL).rstrip("/")
        self.settings = src.settings or {}
        self.diary_types = self.settings.get("diary_types") if isinstance(self.settings.get("diary_types"), list) else None
        self.types_by_id = {t.get("id"): t for t in (self.diary_types or DEFAULT_DIARY_TYPES) if isinstance(t, dict)}
        self.projects_by_id: dict[str, dict] = {}
        self.project_paths: dict[str, Path] = {}      # project id → 폴더 노트 경로
        self.habit_names: dict[str, str] = {}          # habit id → 노트 basename
        self.habit_rows: list[dict] = []
        self.weekday_names = [f"{w}요일" for w in WEEKDAYS]
        self.adopt_fail: list[str] = []
        self.project_folders: dict[str, Path] = {}    # project id → 프로젝트 폴더(자료/ 의 부모)
        for yk, paths in self.index.dups.items():
            self.log.append(f"  ⚠️ yk_id 중복 {yk}: {' · '.join(paths)}")   # 두 칸 들여쓰기 = stdout 에도 나온다

    # ── 출력 ────────────────────────────────────────────────────────────────
    def say(self, msg: str):
        print(msg)
        self.log.append(msg)

    def table_ids_short(self, rows: list) -> dict[str, str]:
        """테이블 안 id8 충돌 시 12자, 그래도 겹치면 16자 → 전체."""
        ids = [str(r.get("id")) for r in rows if r.get("id") is not None]
        out: dict[str, str] = {}
        for width in (8, 12, 16, 32):
            groups: dict[str, list[str]] = {}
            for i in ids:
                if i in out:
                    continue
                groups.setdefault(id8(i, width), []).append(i)
            for short, members in groups.items():
                if len(members) == 1:
                    out[members[0]] = short
            if len(out) == len(set(ids)):
                break
        for i in ids:
            out.setdefault(i, i.replace("-", ""))
        return out

    # ── 파일 I/O ────────────────────────────────────────────────────────────
    def read(self, p: Path) -> str:
        return p.read_text(encoding="utf-8")

    def inside(self, p: Path) -> Path:
        """볼트 밖 경로는 쓰지 않는다(앱 데이터가 경로 조각으로 들어오므로 `..` 가 섞여도 탈출 불가)."""
        rp = p.resolve()
        vr = self.vault.resolve()
        if rp != vr and vr not in rp.parents:
            raise ValueError(f"볼트 밖 경로 거부: {p}")
        return p

    def write(self, p: Path, text: str):
        self.inside(p)
        relp = rel(p, self.vault)
        self.written.add(relp)
        if self.dry:
            return
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)

    def exists(self, p: Path) -> bool:
        return p.exists() or rel(p, self.vault) in self.planned_paths

    def unique_path(self, folder: Path, base: str, own_rel: str | None = None) -> Path:
        """같은 폴더 충돌 → ' (2)', ' (3)'. own_rel 이 이미 그 경로면 그대로. base 는 파일명 바이트 상한 안으로 자른다."""
        base = fname(base)
        cand = folder / f"{base}.md"
        n = 1
        while self.exists(cand) and rel(cand, self.vault) != own_rel:
            n += 1
            cand = folder / f"{base} ({n}).md"
        return cand

    # ── 공통 upsert ─────────────────────────────────────────────────────────
    def upsert_note(self, *, table: str, path: Path, yk_id: str | None, owned: dict, blocks: list[tuple[str, str, str | None]],
                    create_fn, free_text: set[str] = frozenset(), up: str | None = None, app_tags: list | None = None,
                    app_tag_links: list | None = None, new_title: str | None = None, hash_extra: str = "",
                    status_hook=None) -> str:
        """노트 하나를 만들거나 갱신. 반환: 새로 | 갱신 | 건너뜀."""
        relp = rel(path, self.vault)

        def managed_hash(owned_: dict, blocks_: list) -> str:
            # 앱 태그도 해시에 넣는다 — daily_logs 엔 updated_at 이 없어 태그만 바뀐 행은 다른 신호가 없다
            managed = json.dumps({"fm": {k: v for k, v in owned_.items() if k != "yk_hash"}, "blocks": [(n, c) for n, c, _ in blocks_],
                                  "extra": hash_extra, "tags": list(app_tags or []), "tag_links": list(app_tag_links or [])},
                                 ensure_ascii=False, sort_keys=True, default=str)
            return sha1(managed)

        new_hash = managed_hash(owned, blocks)
        meta = self.index.get_meta(yk_id, relp)
        block_hashes = {n: block_hash(c) for n, c, _ in blocks}

        if not path.exists():
            fm = dict(owned)
            if up:
                fm["up"] = up
            if app_tags is not None:
                fm["tags"] = list(app_tags)
            if app_tag_links is not None and app_tag_links:
                fm["태그"] = list(app_tag_links)
            if blocks:
                fm["yk_blocks"] = yk_blocks_value(block_hashes)
            fm["yk_hash"] = new_hash
            fm = order_fm({k: v for k, v in fm.items() if v is not None})
            text = create_fn(fm, {n: c for n, c, _ in blocks})
            self.write(path, text)
            self.last_path = path
            self.planned_paths.add(relp)
            self.index.register(yk_id, relp, fm)
            self.index.set_meta(yk_id, relp, app_tags=list(app_tags or []), app_tag_links=list(app_tag_links or []), blocks=block_hashes)
            self.counts.add(table, "새로")
            return "새로"

        text = self.read(path)
        fm, body = fm_load(text)
        if status_hook is not None:
            # 역방향 변경 감지(할 일): 볼트 값이 앞서면 owned/blocks 를 바꾼다
            owned, blocks, changed_hash = status_hook(fm, text, owned, blocks)
            if changed_hash:
                new_hash = managed_hash(owned, blocks)
                block_hashes = {n: block_hash(c) for n, c, _ in blocks}
        markers_ok = all(get_block(text, n) is not None for n, _, _ in blocks)
        has_yk_blocks = (not blocks) or bool(fm.get("yk_blocks"))      # 블록 해시가 노트에 아직 없으면(업그레이드 전 노트) 한 번은 써 준다
        if str(fm.get("yk_hash") or "") == new_hash and markers_ok and has_yk_blocks:   # 마커를 지웠으면 해시가 같아도 재삽입하러 내려간다
            self.counts.add(table, "건너뜀")
            self.last_path = path
            self.index.register(yk_id or fm.get("yk_id"), relp, fm)
            if not meta.get("blocks"):
                # 캐시가 사라졌어도 yk_hash 가 같으면 "직전 가져온 블록 텍스트" = 지금 생성한 내용 → 자가 복구(가짜 충돌 콜아웃 방지)
                self.index.set_meta(yk_id, relp, app_tags=list(app_tags or []), app_tag_links=list(app_tag_links or []), blocks=block_hashes)
            return "건너뜀"

        # (a) frontmatter 병합 — 소유 키만 덮어씀, 사용자 키 보존, up 은 없을 때만
        merged: dict = {}
        if "type" in owned:
            merged["type"] = owned["type"]
        elif "type" in fm:
            merged["type"] = fm["type"]
        # 소유 키 canonical 순서
        for k, v in owned.items():
            if k == "type":
                continue
            if v is None:
                continue
            merged[k] = v
        if up and not fm.get("up"):
            merged["up"] = up
        elif fm.get("up"):
            merged["up"] = fm["up"]
        # tags 합집합 − 직전 앱 태그 중 사라진 것
        if app_tags is not None:
            prev = [str(x) for x in meta.get("app_tags", app_tags)]
            cur = [str(x) for x in as_list(fm.get("tags"))]
            removed = {t for t in prev if t not in app_tags}
            kept = [t for t in cur if t not in removed]
            merged["tags"] = kept + [t for t in app_tags if t not in kept]
        elif "tags" in fm:
            merged["tags"] = fm["tags"]
        if app_tag_links is not None:
            prev = [str(x) for x in meta.get("app_tag_links", app_tag_links)]
            cur = [str(x) for x in as_list(fm.get("태그"))]
            removed = {t for t in prev if t not in app_tag_links}
            kept = [t for t in cur if t not in removed]
            links = kept + [t for t in app_tag_links if t not in kept]
            if links:
                merged["태그"] = links
        elif "태그" in fm:
            merged["태그"] = fm["태그"]
        # 사용자 키(및 소유 키 중 이번에 None 으로 지운 것 제외) 보존
        for k, v in fm.items():
            if k in merged or k in ("yk_hash",):
                continue
            if k in owned:         # 소유 키인데 이번 값이 None → 제거
                continue
            if k in OWNED_KEYS and k in ("yk_deleted", "yk_missing", "yk_dirty", "yk_pending", "yk_pushed", "yk_key", "yk_area", "photos_pending"):
                merged[k] = v     # 상태 플래그는 owned 에 명시될 때만 바뀐다
                continue
            if k in OWNED_KEYS and k not in owned and k not in ("tags", "태그", "up"):
                merged[k] = v     # 이 유형에서 쓰지 않는 소유 키(예: 사용자가 둔 값)는 보존
                continue
            merged[k] = v
        # 제목 변경 → aliases 에 옛/새 이름, # 제목 줄 갱신
        if new_title is not None:
            old_title = str(fm.get("title") or "")
            if old_title and old_title != new_title:
                al = [str(a) for a in as_list(fm.get("aliases"))]
                for t in (old_title, new_title):
                    if t and t not in al and t != path.stem:
                        al.append(t)
                if al:
                    merged["aliases"] = al
                lines = body.split("\n")
                for i, ln in enumerate(lines):
                    if ln.startswith("# "):
                        # 앱 제목을 정규식 치환 템플릿으로 쓰지 않는다(`\1`·`\U` 같은 역슬래시가 있으면 깨진다) — 접미사 교체
                        lines[i] = ln[: len(ln) - len(old_title)] + new_title if ln.endswith(old_title) else ln
                        break
                body = "\n".join(lines)
                if self.args.rename_follow:
                    path, relp = self.rename_follow(path, new_title)
                else:
                    self.log.append(f"  ✎ {relp}: 제목 '{old_title}' → '{new_title}' (파일명 유지, aliases 추가)")
        if blocks:
            merged["yk_blocks"] = yk_blocks_value(block_hashes)
        else:
            merged.pop("yk_blocks", None)
        merged["yk_hash"] = new_hash
        merged = order_fm(merged)

        # (b) 블록 교체 — "직전에 가져온 블록" 해시는 캐시(.yk_index.json) → 노트 frontmatter yk_blocks 순으로 찾는다.
        #     둘 다 없으면(처음 입양하는 노트) 보수적으로 "현재 텍스트 ≠ 새 내용 = 사용자 편집" 으로 본다.
        prev_blocks = meta.get("blocks") or parse_yk_blocks(fm.get("yk_blocks")) or {}
        new_body = body
        for name, content, header in blocks:
            if name in free_text:
                cur_block = get_block(new_body, name)
                if cur_block is not None:
                    user_text = strip_callouts(cur_block)
                    last_hash = prev_blocks.get(name)
                    user_edited = (last_hash is not None and not same_hash(last_hash, user_text) and not same_hash(last_hash, cur_block)) or \
                                  (last_hash is None and user_text.strip() != content.strip() and user_text.strip() != "")
                    app_changed = (last_hash is None) or not same_hash(last_hash, content)
                    if user_edited and app_changed and user_text.strip() != content.strip():
                        # 이미 콜아웃이 있으면 쌓지 않고 최신 앱 텍스트로 바꾼다
                        base = user_text if cur_block != user_text else cur_block
                        content = base.rstrip("\n") + "\n" + callout(content, self.today_s)
                        self.conflicts += 1
                        hint = "" if last_hash is not None else " (직전 해시 없음 — 사용자 편집으로 간주, 확인 필요)"
                        self.log.append(f"  ⚡ {relp}: `{name}` 블록을 Obsidian 에서 고쳤고 앱도 바뀜 → 사용자 텍스트 유지 + 콜아웃{hint}")
                    elif user_edited and not app_changed:
                        content = cur_block
            new_body, _ = set_block(new_body, name, content, header, self.log, relp, free=name in free_text)
        new_text = fm_dump(merged) + new_body
        if new_text != text or relp != rel(path, self.vault):
            self.write(path, new_text)
        self.last_path = path
        self.index.register(yk_id or merged.get("yk_id"), relp, merged)
        self.index.set_meta(yk_id, relp, app_tags=list(app_tags or meta.get("app_tags", [])), app_tag_links=list(app_tag_links or meta.get("app_tag_links", [])),
                            blocks=block_hashes)
        self.counts.add(table, "갱신")
        return "갱신"

    def rename_follow(self, path: Path, new_title: str) -> tuple[Path, str]:
        """--rename-follow: 제목이 바뀐 노트의 파일명(프로젝트는 폴더까지)을 E(새 제목)으로 바꾼다. 충돌하면 그대로 둔다."""
        base = E(new_title)
        relp = rel(path, self.vault)
        is_project_note = relp.startswith("40_프로젝트/") and path.parent.name == path.stem
        if is_project_note:
            old_folder = path.parent
            new_folder = old_folder.parent / base
            new_path = new_folder / f"{base}.md"
            if new_folder.exists() or old_folder.name == base:
                return path, relp
            self.log.append(f"  ↪ {relp} → {rel(new_path, self.vault)} (--rename-follow; 폴더째 이동 — Obsidian 에서 링크를 고쳐 주세요)")
            if not self.dry:
                old_folder.rename(new_folder)
                (new_folder / path.name).rename(new_path)
            # 인덱스의 폴더 안 경로(자료 노트 등)를 새 폴더로 옮긴다
            old_prefix, new_prefix = rel(old_folder, self.vault) + "/", rel(new_folder, self.vault) + "/"
            for yk, rp in list(self.index.by_id.items()):
                if rp.startswith(old_prefix):
                    self.index.by_id[yk] = new_prefix + rp[len(old_prefix):]
            for rp in list(self.index.notes.keys()):
                if rp.startswith(old_prefix):
                    self.index.notes[new_prefix + rp[len(old_prefix):]] = self.index.notes.pop(rp)
            self.index.notes.pop(relp, None)
            return new_path, rel(new_path, self.vault)
        new_path = path.parent / f"{base}.md"
        if new_path.exists() or new_path == path:
            return path, relp
        self.log.append(f"  ↪ {relp} → {rel(new_path, self.vault)} (--rename-follow; Obsidian 에서 링크를 고쳐 주세요)")
        if not self.dry:
            path.rename(new_path)
        self.index.notes.pop(relp, None)
        return new_path, rel(new_path, self.vault)

    def mark_flag(self, relp: str, key: str, value):
        """상태 플래그(yk_deleted/yk_missing/yk_dirty) 한 개만 바꾼다."""
        p = self.vault / relp
        if not p.exists():
            return
        text = self.read(p)
        fm, body = fm_load(text)
        if fm.get(key) == value or (value is None and key not in fm):
            return
        if value is None:
            fm.pop(key, None)
        else:
            fm[key] = value
        self.write(p, fm_dump(fm) + body)
        self.index.register(fm.get("yk_id"), relp, fm)

    # ── 1. settings → facet ────────────────────────────────────────────────
    def run_settings(self):
        if not self.src.present("settings"):
            return
        s = self.settings
        moods = [str(m) for m in (s.get("moods") or DEFAULT_MOODS)]
        tags = [str(t) for t in (s.get("tags") or DEFAULT_TAGS)]
        used_tags: list[str] = []
        for r in self.src.rows("daily_logs"):
            for t in as_list(r.get("tags")):
                if str(t) not in used_tags:
                    used_tags.append(str(t))
        types = self.diary_types if self.diary_types is not None else DEFAULT_DIARY_TYPES
        self.say(f"⚙️ 설정: 기분 {len(moods)} · 태그 {len(tags)}(+실사용 {len([t for t in used_tags if t not in tags])}) · 종류 {len(types)}")
        # 종류
        folder = self.vault / "50_일기" / "종류"
        seen_type_files = set()
        for t in types:
            if not isinstance(t, dict):
                continue
            name = "일반" if t.get("id") == "general" else E(t.get("name") or t.get("id") or "기록")
            if t.get("id") == "general" and (not self.args.link_general_type):
                pass
            path = folder / f"{name}.md"
            seen_type_files.add(path.name)
            owned = {"type": "종류", "yk_id": str(t.get("id")), "icon": t.get("icon") or "file", "color": t.get("color") or "#94a3b8",
                     "kind": t.get("kind") or "general", "template": t.get("template") or ""}
            if t.get("kind") == "workout" or t.get("parts"):
                owned["parts"] = [str(p) for p in as_list(t.get("parts"))] or None
            owned["yk_deleted"] = None
            tpl = t.get("template") or ""
            blocks = [("template", tpl, "## 템플릿")]
            self.upsert_note(table="facet", path=path, yk_id=None, owned=owned, blocks=blocks, up="[[일기]]",
                             create_fn=lambda fm, b, name=name, tpl=tpl: self.tpl_facet("종류", name, fm, tpl))
        self.retire_facets(folder, seen_type_files, "종류")
        # 기분
        folder = self.vault / "50_일기" / "기분"
        seen = set()
        for m in moods:
            name = E(m)
            path = folder / f"{name}.md"
            seen.add(path.name)
            em, score, col = MOOD_MAP.get(m, (None, None, None))
            owned = {"type": "기분", "emoji": em, "color": col or "#94a3b8", "score": score, "yk_deleted": None}
            self.upsert_note(table="facet", path=path, yk_id=None, owned=owned, blocks=[], up="[[일기]]",
                             create_fn=lambda fm, b, name=name: self.tpl_facet("기분", name, fm, None))
        self.retire_facets(folder, seen, "기분")
        # 태그 = settings ∪ 실사용
        folder = self.vault / "50_일기" / "태그"
        seen = set()
        for tg in tags + [t for t in used_tags if t not in tags]:
            name = E(tg)
            path = folder / f"{name}.md"
            seen.add(path.name)
            owned = {"type": "태그", "source": "settings" if tg in tags else "used", "yk_deleted": None}
            self.upsert_note(table="facet", path=path, yk_id=None, owned=owned, blocks=[], up="[[일기]]",
                             create_fn=lambda fm, b, name=name: self.tpl_facet("태그", name, fm, None))
        self.retire_facets(folder, seen, "태그")

    def retire_facets(self, folder: Path, seen: set[str], facet: str):
        if not folder.exists():
            return
        for p in folder.glob("*.md"):
            if p.name in seen:
                continue
            relp = rel(p, self.vault)
            fm = self.index.notes.get(relp) or {}
            imported_before = bool(fm.get("yk_id")) or ("path:" + relp) in self.index.meta   # 사용자가 tpl-facet 으로 만든 노트는 건드리지 않음
            if fm.get("type") == facet and imported_before and not fm.get("yk_deleted"):
                self.mark_flag(rel(p, self.vault), "yk_deleted", self.today_s)
                self.log.append(f"  🗑 {facet} '{p.stem}' 이(가) 앱 설정에서 사라짐 → yk_deleted")

    def tpl_facet(self, facet: str, name: str, fm: dict, template: str | None) -> str:
        F = "```"
        extra = ""
        if facet == "종류":
            extra = f"## 템플릿\n{wrap_block('template', template or '')}\n\n"
            where = f'diary_type = "{name}"'
        elif facet == "기분":
            where = f'mood = "{name}"'
        else:
            where = f'contains(tags, "{name}")'
        return f"""{fm_dump(fm)}# {name}

{extra}## 이 값의 일기
{F}dataview
TABLE WITHOUT ID file.link AS "일기", date AS "날짜", mood AS "기분", tags AS "태그"
FROM "50_일기" AND -"50_일기/종류" AND -"50_일기/기분" AND -"50_일기/태그"
WHERE type = "일기" AND {where}
SORT date DESC
{F}

## 월별 카운트
{F}dataviewjs
const value = dv.current().file.name;
const facet = "{facet}";
const pages = dv.pages('"50_일기"').where(p => p.type === "일기" && p.date && (
  facet === "종류" ? String(p.diary_type ?? "") === value :
  facet === "기분" ? String(p.mood ?? "") === value :
  (Array.isArray(p.tags) ? p.tags : [p.tags]).map(String).includes(value)));
const byMonth = new Map();
for (const p of pages) {{ const k = p.date.toFormat("yyyy-MM"); byMonth.set(k, (byMonth.get(k) || 0) + 1); }}
const rows = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([k, n]) => [k, "█".repeat(Math.min(n, 30)) + " " + n]);
if (rows.length) dv.table(["월", "일기 수"], rows); else dv.paragraph("_아직 이 값의 일기가 없어요._");
{F}
"""

    # ── 2. projects (+70_분야) ─────────────────────────────────────────────
    def ensure_area(self, area: str) -> str:
        name = E(area or "개인")
        path = self.vault / "70_분야" / f"{name}.md"
        if self.exists(path):
            return name
        em = emoji_for(name, "")
        F = "```"
        fm = {"type": "분야", "tags": ["hub"], "up": "[[분야]]", "emoji": em, "created": self.today_s, "yk_area": True}
        text = f"""{fm_dump(fm)}# {em} {name}

> [!abstract] 이 분야에서 지키고 싶은 기준
> 

## 진행 중인 프로젝트
{F}dataview
TABLE WITHOUT ID file.link AS "프로젝트", status AS "상태", due AS "마감", next_action AS "다음 행동"
FROM "40_프로젝트"
WHERE type = "프로젝트" AND contains(string(area), "{name}") AND status != "완료"
SORT due ASC
{F}

## 이 분야의 뉴런들
{F}dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형", file.cday AS "날짜"
FROM -"_System" AND -"70_분야"
WHERE contains(string(area), "{name}")
SORT file.cday DESC
LIMIT 30
{F}

## 메모
- 
"""
        self.write(path, text)
        self.planned_paths.add(rel(path, self.vault))
        self.index.register(None, rel(path, self.vault), fm)
        self.counts.add("분야", "새로")
        self.log.append(f"  🧭 분야 노트 생성: 70_분야/{name}.md")
        return name

    def project_note_for(self, row: dict) -> tuple[Path, Path]:
        """(프로젝트 노트 경로, 프로젝트 폴더). yk_id 로 찾은 노트는 사용자가 이름을 바꿨거나 옮겼어도 그 경로를 그대로 쓴다
        (폴더 이름에서 다시 만들지 않는다 — 같은 yk_id 의 두 번째 노트가 생기는 것을 막는다)."""
        pid = str(row.get("id"))
        root = self.vault / "40_프로젝트"
        existing = self.index.by_id.get(pid)
        if not existing or not existing.startswith("40_프로젝트/"):
            name = E(row.get("name") or "새 프로젝트")
            existing = self.index.find_project(name)
        if existing:
            path = self.vault / existing
            # 폴더 노트가 아니라 40_프로젝트 바로 아래 평면 노트면, 자료/ 는 '40_프로젝트/<노트 이름>/자료' 로 간다
            folder = path.parent if path.parent != root else root / path.stem
            return path, folder
        name = fname(row.get("name") or "새 프로젝트")
        folder = root / name
        n = 1
        while self.exists(folder / f"{folder.name}.md"):
            n += 1
            folder = root / f"{name} ({n})"
        return folder / f"{folder.name}.md", folder

    def run_projects(self):
        if not self.src.present("projects"):
            return
        rows = sorted(self.src.rows("projects"), key=lambda r: (str(r.get("created_at") or ""), str(r.get("id"))))
        self.projects_by_id = {str(r["id"]): r for r in rows if r.get("id")}
        sections = self.src.rows("project_sections") if self.src.present("project_sections") else None
        checklist = self.src.rows("project_checklist") if self.src.present("project_checklist") else None
        sec_short = self.table_ids_short(sections or [])
        chk_short = self.table_ids_short(checklist or [])
        for r in rows:
            pid = str(r.get("id"))
            try:
                name = E(r.get("name") or "새 프로젝트")
                path, folder = self.project_note_for(r)
                self.project_paths[pid] = path
                self.project_folders[pid] = folder
                relp = rel(path, self.vault)
                if r.get("deleted_at") and not path.exists():
                    self.counts.add("프로젝트", "건너뜀")
                    continue
                area = self.ensure_area(r.get("area") or "개인") if not self.dry or True else E(r.get("area") or "개인")
                em = emoji_for(r.get("area") or "", r.get("name") or "")
                start, due = r.get("start_date") or None, r.get("due_date") or None
                if r.get("status") == "보류":
                    due = None
                owned = {
                    "type": "프로젝트", "title": r.get("name") or "새 프로젝트", "status": r.get("status") or "진행 중", "area": f"[[{area}]]", "emoji": em,
                    "start": start, "due": due, "daily": f"[[{start}]]" if start else None, "마감": f"[[{due}]]" if due else None,
                    "goal": r.get("goal") or "", "next_action": r.get("next_action") or "", "created": iso_date(r.get("created_at"), self.tz),
                    "yk_id": pid, "yk_updated": r.get("updated_at") or r.get("created_at"), "yk_url": f"{self.app_url}/#/projects/{pid}",
                    "yk_deleted": iso_date(r.get("deleted_at"), self.tz) if r.get("deleted_at") else None, "yk_missing": None,
                    "yk_dirty": None,
                }
                blocks: list[tuple[str, str, str | None]] = []
                if sections is not None or checklist is not None:
                    chk = self.render_checklist(pid, sections or [], checklist or [], sec_short, chk_short)
                    blocks.append(("checklist", chk, "## 체크리스트"))
                    if path.exists():
                        # 역방향 변경 감지: Obsidian 에서만 체크한 항목은 앱 승이지만 조용히 버리지 않는다 → 로그 + yk_dirty + YouKnow.md
                        cur = get_block(self.read(path), "checklist")
                        if cur is not None:
                            rx = re.compile(r"^- \[(.)\] (.*?) %%yk:chk (\S+)%%")
                            old = {m.group(3): (m.group(1), m.group(2)) for m in (rx.match(ln) for ln in cur.split("\n")) if m}
                            new = {m.group(3): m.group(1) for m in (rx.match(ln) for ln in chk.split("\n")) if m}
                            for cid, (box, label) in old.items():
                                if cid in new and new[cid] != box:
                                    owned["yk_dirty"] = True
                                    self.dirty.append((relp, f"체크 '{label}' [{box}]", f"[{new[cid]}]"))
                                    self.log.append(f"  ⚠️ {relp}: 체크리스트 '{label}' Obsidian [{box}] · 앱 [{new[cid]}] → 앱 승, yk_dirty")
                legacy = (r.get("resources") or "").rstrip()
                if legacy or (path.exists() and get_block(self.read(path), "resources_legacy") is not None):
                    blocks.append(("resources_legacy", legacy, "### 메모 (예전 자료)"))
                self.upsert_note(table="프로젝트", path=path, yk_id=pid, owned=owned, blocks=blocks, up="[[프로젝트]]",
                                 free_text={"resources_legacy"}, new_title=r.get("name") or "새 프로젝트",
                                 create_fn=lambda fm, b, r=r, name=name, em=em, area=area, folder=folder: self.tpl_project(fm, b, r, name, em, area, folder.name))
                self.project_paths[pid] = self.last_path
            except Exception as ex:  # noqa: BLE001
                self.counts.add("프로젝트", "실패")
                self.failures.append(f"프로젝트 {r.get('name')}: {ex}")
                self.log.append(f"  ❌ 프로젝트 {r.get('name')}: {ex}")
                if self.args.verbose:
                    traceback.print_exc()
        self.mark_missing("projects", "프로젝트", rows)

    def render_checklist(self, pid: str, sections: list, checklist: list, sec_short: dict, chk_short: dict) -> str:
        secs = sorted([s for s in sections if str(s.get("project_id")) == pid], key=lambda s: (s.get("sort_order") or 0, str(s.get("id"))))
        sec_ids = {str(s.get("id")) for s in secs}
        items = sorted([c for c in checklist if str(c.get("project_id")) == pid], key=lambda c: (str(c.get("created_at") or ""), str(c.get("id"))))
        out: list[str] = []

        def emit(c):
            box = "x" if c.get("done") else " "
            out.append(f"- [{box}] {(c.get('text') or '').strip()} %%yk:chk {chk_short.get(str(c.get('id')), id8(c.get('id')))}%%")
            details = (c.get("details") or "").strip()
            if details:
                dl = [ln for ln in details.split("\n") if ln.strip()]
                for i, ln in enumerate(dl):
                    out.append(f"  - {'세부: ' if i == 0 else ''}{ln.strip()}")
            if c.get("photo_path"):
                base = photo_base(c["photo_path"])
                if not base:
                    self.log.append(f"  ⚠️ 체크 항목 사진 경로를 파일명으로 쓸 수 없어 건너뜀: {c['photo_path']!r}")
                    return
                if self.src.has_binary and not self.args.no_photos:
                    self.download_photo(c["photo_path"], self.vault / "_Attachments" / "YouKnow" / "checklist" / base)
                out.append(f"  ![[{base}]]")

        for c in items:
            if not c.get("section_id") or str(c.get("section_id")) not in sec_ids:
                emit(c)
        for s in secs:
            out.append(f"### {(s.get('name') or '').strip()} %%yk:sec {sec_short.get(str(s.get('id')), id8(s.get('id')))}%%")
            for c in items:
                if str(c.get("section_id")) == str(s.get("id")):
                    emit(c)
        return "\n".join(out)

    def tpl_project(self, fm: dict, blocks: dict, r: dict, name: str, em: str, area: str, folder_name: str) -> str:
        F = "```"
        legacy = ""
        if "resources_legacy" in blocks:
            legacy = f"### 메모 (예전 자료)\n%% yk:resources_legacy:start %%\n{blocks['resources_legacy']}\n%% yk:resources_legacy:end %%\n"
            if blocks["resources_legacy"] == "":
                legacy = "### 메모 (예전 자료)\n%% yk:resources_legacy:start %%\n%% yk:resources_legacy:end %%\n"
        chk = blocks.get("checklist", "")
        chk_block = f"%% yk:checklist:start %%\n{chk}\n%% yk:checklist:end %%" if chk else "%% yk:checklist:start %%\n%% yk:checklist:end %%"
        return f"""{fm_dump(fm)}# {em} {name}
> {r.get('goal') or ''}
**다음 행동**: {r.get('next_action') or ''}

## 체크리스트
{chk_block}

## 할 일
{F}dataview
TABLE WITHOUT ID file.link AS "할 일", status AS "상태", priority_label AS "우선순위", due AS "마감"
FROM "30_할일/목록"
WHERE project = link(this.file.name) AND !yk_deleted AND !yk_missing
SORT status ASC, priority DESC
{F}

## 자료
{F}dataview
TABLE WITHOUT ID file.link AS "자료", kind AS "종류", updated AS "갱신"
FROM "40_프로젝트/{folder_name}/자료"
SORT sort_order ASC, created DESC
{F}
{legacy}
## 진행
{F}dataviewjs
// (체크 완료 + 할 일 완료) / (체크 전체 + 할 일 − 달성 못함) · 계획 X% 대비 실제 Y% (앱 aL 규칙: 차이 ≥ −10 순항, ≥ −30 주의, 그 외 지연)
const cur = dv.current();
const f = app.vault.getAbstractFileByPath(cur.file.path);
const txt = await app.vault.cachedRead(f);
const m = txt.match(new RegExp("%% yk:" + "checklist:start %%([^]*?)%% yk:" + "checklist:end %%"));
const body = m ? m[1] : txt;
const chk = body.split("\\n").filter(l => /^\\s*- \\[[ xX\\/-]\\]\\s*\\S/.test(l));
const chkDone = chk.filter(l => /^\\s*- \\[[xX]\\]/.test(l)).length;
const linkName = v => !v ? "" : (v.path ? String(v.path) : String(v).replace(/^\\[\\[|\\]\\]$/g, "").split("|")[0]).split("/").pop().replace(/\\.md$/, "");
const tasks = dv.pages('"30_할일/목록"').where(p => linkName(p.project) === cur.file.name && !p.yk_deleted && !p.yk_missing);
const tAll = tasks.where(p => p.status !== "달성 못함").length;
const tDone = tasks.where(p => p.status === "완료").length;
const total = chk.length + tAll, done = chkDone + tDone;
const pct = total ? Math.round(done / total * 100) : 0;
let pace = "";
if (cur.start && cur.due) {{
  const span = Math.max(1, cur.due.diff(cur.start, "days").days);
  const gone = Math.max(0, dv.date("today").diff(cur.start, "days").days);
  const expected = Math.max(0, Math.min(100, Math.round(gone / span * 100)));
  const diff = pct - expected;
  pace = " · 계획 " + expected + "% → " + (diff >= -10 ? "🟢 순항" : diff >= -30 ? "🟡 주의" : "🔴 지연");
  const left = Math.round(cur.due.diff(dv.date("today"), "days").days);
  pace += " · 마감까지 " + (left >= 0 ? "D-" + left : "D+" + (-left));
}}
dv.paragraph("**" + pct + "%** (" + done + "/" + total + ") — 체크 " + chkDone + "/" + chk.length + " · 할 일 " + tDone + "/" + tAll + pace);
dv.paragraph("█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5)));
{F}

## 연결
- [[{area}]]
"""

    # ── 3. project_resources → 자료 ───────────────────────────────────────
    def run_resources(self):
        if not self.src.present("project_resources"):
            return
        rows = sorted(self.src.rows("project_resources"), key=lambda r: (str(r.get("created_at") or ""), str(r.get("id"))))
        memo_counter: dict[str, int] = {}
        for r in rows:
            rid = str(r.get("id"))
            pid = str(r.get("project_id"))
            try:
                ppath = self.project_paths.get(pid)
                if not ppath:
                    self.counts.add("자료", "건너뜀")
                    self.log.append(f"  ⤼ 자료 '{r.get('title') or rid}': 딸린 프로젝트({pid})가 없어 건너뜀")
                    continue
                pfolder = self.project_folders.get(pid, ppath.parent)
                pname = pfolder.name
                url = (r.get("url") or "").strip()
                title = (r.get("title") or "").strip()
                if not title:
                    title = auto_title(url)
                existing = self.index.by_id.get(rid)
                if not title:
                    # '메모 N' 은 행마다 고정: 이미 번호가 붙은 노트는 그대로, 새 메모는 이 프로젝트 자료 폴더의 가장 큰 N 다음부터
                    prev_title = str((self.index.notes.get(existing) or {}).get("title") or "") if existing else ""
                    if re.fullmatch(r"메모 \d+", prev_title):
                        title = prev_title
                    else:
                        if pid not in memo_counter:
                            used = [int(m.group(1)) for rp, fm in self.index.notes.items()
                                    if rp.startswith(rel(pfolder / "자료", self.vault) + "/") and fm.get("type") == "자료"
                                    for m in [re.fullmatch(r"메모 (\d+)", str(fm.get("title") or Path(rp).stem))] if m]
                            memo_counter[pid] = max(used, default=0)
                        memo_counter[pid] += 1
                        title = f"메모 {memo_counter[pid]}"
                base = E(title)
                if existing:
                    path = self.vault / existing
                else:
                    adopted = self.index.find_resource(pname, base)
                    path = self.vault / adopted if adopted else self.unique_path(pfolder / "자료", base)
                created = iso_date(r.get("created_at"), self.tz)
                owned = {
                    "type": "자료", "title": title, "project": f"[[{pname}]]", "url": url or None, "kind": "링크" if url else "메모",
                    "sort_order": r.get("sort_order") if r.get("sort_order") is not None else 0,
                    "daily": f"[[{created}]]" if created else None, "updated": iso_date(r.get("updated_at") or r.get("created_at"), self.tz),
                    "created": created, "yk_id": rid, "yk_updated": r.get("updated_at") or r.get("created_at"),
                    "yk_url": f"{self.app_url}/#/projects/{pid}/notes/{rid}", "yk_missing": None,
                }
                body = (r.get("body") or "").rstrip()
                blocks = [("body", body, None)]
                self.upsert_note(table="자료", path=path, yk_id=rid, owned=owned, blocks=blocks, free_text={"body"}, new_title=title,
                                 create_fn=lambda fm, b, title=title, url=url, pname=pname: self.tpl_resource(fm, b, title, url, pname))
            except Exception as ex:  # noqa: BLE001
                self.counts.add("자료", "실패")
                self.failures.append(f"자료 {r.get('title')}: {ex}")
                self.log.append(f"  ❌ 자료 {r.get('title')}: {ex}")
                if self.args.verbose:
                    traceback.print_exc()
        self.mark_missing("project_resources", "자료", rows)

    def tpl_resource(self, fm: dict, blocks: dict, title: str, url: str, pname: str) -> str:
        link = f"🔗 {url}\n" if url else ""
        return f"""{fm_dump(fm)}# {title}
{link}{wrap_block('body', blocks.get('body', ''))}

## 내 생각
- 

## 여기서 나온 영구 노트
- 

## 연결
- [[{pname}]]
"""

    # ── 4. tasks ─────────────────────────────────────────────────────────
    def task_line(self, title: str, status: str, priority: int, start, due, short_id: str, done_date=None, deleted: bool = False) -> str:
        box = "-" if deleted else STATUS_BOX.get(status, " ")      # 휴지통 행은 취소 `[-]` → Tasks `not done` 질의에서 빠진다
        parts = [f"- [{box}] {title}"]
        mark = PRIORITY_MARK.get(priority, "")
        if mark:
            parts.append(mark)
        if start:
            parts.append(f"🛫 {start}")
        if due:
            parts.append(f"📅 {due}")
        if status == "완료" and (done_date or due):
            parts.append(f"✅ {done_date or due}")      # 볼트에서 Tasks 로 체크한 실제 완료일이 있으면 그것, 없으면 마감일 근사
        parts.append(f"🆔 yk-{short_id}")
        return " ".join(parts)

    def run_tasks(self):
        if not self.src.present("tasks"):
            return
        rows = sorted(self.src.rows("tasks"), key=lambda r: (str(r.get("created_at") or ""), str(r.get("id"))))
        short = self.table_ids_short(rows)
        folder = self.vault / "30_할일" / "목록"
        for r in rows:
            tid = str(r.get("id"))
            try:
                title = (r.get("title") or "").strip() or "새 할 일"
                status = r.get("status") or "진행 전"
                try:
                    priority = int(r.get("priority") or 3)
                except Exception:
                    priority = 3
                start, due = r.get("start_date") or None, r.get("due_date") or None
                created = iso_date(r.get("created_at"), self.tz)
                existing = self.index.by_id.get(tid)
                adopted_pending = False
                if existing:
                    path = self.vault / existing
                else:
                    adopted = self.index.find_task(title, due, created)
                    if adopted:
                        path = self.vault / adopted
                        adopted_pending = True
                        self.log.append(f"  🔗 할 일 '{title}': yk_pending 노트 채택 → yk_id 채움")
                    elif r.get("deleted_at"):
                        self.counts.add("할 일", "건너뜀")
                        continue
                    else:
                        path = self.unique_path(folder, E(title))
                pname = None
                if r.get("project_id") and str(r["project_id"]) in self.project_folders:
                    pname = self.project_folders[str(r["project_id"])].name
                elif r.get("project_id") and str(r["project_id"]) in self.projects_by_id:
                    pname = E(self.projects_by_id[str(r["project_id"])].get("name") or "새 프로젝트")
                deleted = bool(r.get("deleted_at"))
                owned = {
                    "type": "할일", "title": title, "status": status, "priority": priority, "priority_label": PRIORITY_LABELS.get(priority, "보통"),
                    "start": start, "due": due, "done": None, "daily": f"[[{start}]]" if start else None, "마감": f"[[{due}]]" if due else None,
                    "project": f"[[{pname}]]" if pname else None, "created": created,
                    "yk_id": tid, "yk_updated": r.get("updated_at") or r.get("created_at"), "yk_url": f"{self.app_url}/#/tasks/{tid}",
                    "yk_deleted": iso_date(r.get("deleted_at"), self.tz) if deleted else None, "yk_missing": None,
                    "yk_dirty": None, "yk_pending": None, "yk_pushed": None,
                }
                if r.get("project_id") and not pname and not self.src.present("projects"):
                    owned.pop("project")   # 이번 실행에 projects 테이블이 없으면 기존 링크 보존
                line = self.task_line(title, status, priority, start, due, short[tid], deleted=deleted)
                blocks = [("task", line, "# "), ("note", (r.get("note") or "").rstrip(), "## 세부 메모")]

                def hook(fm, text, owned, blocks, r=r, title=title, priority=priority, start=start, due=due, sid=short[tid], path=path, deleted=deleted):
                    app_status = owned["status"]
                    vault_status = str(fm.get("status") or "")
                    cur = get_block(text, "task")
                    changed = False
                    owned = dict(owned)
                    # 볼트에서 Tasks 플러그인으로 체크하면 `✅ YYYY-MM-DD`(실제 완료일)가 붙는다 — 앱엔 완료 시각이 없으니 볼트가 유일한 기록.
                    # 마감일 근사치(✅ <due>)와 다를 때만 `done` 으로 간직해 이후 앱 승 재작성에서도 지키지 않는다.
                    vault_done = None
                    if cur is not None:
                        md = re.search(r"✅ (\d{4}-\d{2}-\d{2})", cur)
                        if md:
                            vault_done = md.group(1)
                    if not vault_done and DATE_RE.match(str(fm.get("done") or "")):
                        vault_done = str(fm.get("done"))
                    if vault_done and vault_done != (due or None):
                        owned["done"] = vault_done
                        changed = True
                    if deleted:   # 휴지통 행: 역방향 감지 안 함(`[-]` 는 importer 가 쓴 것)
                        if changed:
                            blocks = [("task", self.task_line(title, app_status, priority, start, due, sid, owned.get("done"), deleted=True), "# "), blocks[1]]
                        return owned, blocks, changed
                    if cur is not None:
                        m = re.search(r"^\s*- \[(.)\]", cur, re.M)
                        if m and BOX_STATUS.get(m.group(1)):
                            box_status = BOX_STATUS[m.group(1)]
                            if STATUS_RANK.get(box_status, 0) > STATUS_RANK.get(vault_status, 0) or not vault_status:
                                vault_status = box_status
                    if vault_status and vault_status != app_status and STATUS_RANK.get(vault_status, 0) >= 2 and STATUS_RANK.get(app_status, 0) < 2:
                        owned["status"] = vault_status
                        owned["yk_dirty"] = True
                        new_blocks = [("task", self.task_line(title, vault_status, priority, start, due, sid, owned.get("done")), "# "), blocks[1]]
                        self.dirty.append((rel(path, self.vault), vault_status, app_status))
                        self.log.append(f"  ⚠️ 할 일 '{title}': Obsidian '{vault_status}' · 앱 '{app_status}' → 볼트 승, yk_dirty")
                        return owned, new_blocks, True
                    if changed:
                        blocks = [("task", self.task_line(title, app_status, priority, start, due, sid, owned.get("done")), "# "), blocks[1]]
                    return owned, blocks, changed

                self.upsert_note(table="할 일", path=path, yk_id=tid, owned=owned, blocks=blocks, free_text={"note"}, new_title=title,
                                 status_hook=hook,
                                 create_fn=lambda fm, b, title=title, start=start, due=due: self.tpl_task(fm, b, title, start, due))
            except Exception as ex:  # noqa: BLE001
                self.counts.add("할 일", "실패")
                self.failures.append(f"할 일 {r.get('title')}: {ex}")
                self.log.append(f"  ❌ 할 일 {r.get('title')}: {ex}")
                if self.args.verbose:
                    traceback.print_exc()
        self.mark_missing("tasks", "할 일", rows)

    def tpl_task(self, fm: dict, blocks: dict, title: str, start, due) -> str:
        base = (due or start or self.today_s)
        d0 = parse_date(base) or self.today
        gcal = ("https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + urllib.parse.quote(title) +
                f"&dates={d0.strftime('%Y%m%d')}/{(d0 + dt.timedelta(days=1)).strftime('%Y%m%d')}&details=YouKnow%20Meta%20data%20%ED%95%A0%20%EC%9D%BC")
        return f"""{fm_dump(fm)}# ✅ {title}
{wrap_block('task', blocks['task'])}
🗓️ [구글 캘린더에 추가]({gcal})

## 세부 메모
{wrap_block('note', blocks.get('note', ''))}

## 연결
- 
"""

    # ── 5. daily_logs (+daily_photos) → 일기 ─────────────────────────────
    def type_name_for(self, type_id) -> tuple[str, dict]:
        tid = type_id or "general"
        t = self.types_by_id.get(tid)
        if t is None:
            return (str(tid) if tid != "general" else "일반"), {"id": tid, "kind": "general"}
        return ("일반" if tid == "general" else E(t.get("name") or tid)), t

    def run_diaries(self):
        if not self.src.present("daily_logs"):
            return
        rows = sorted(self.src.rows("daily_logs"), key=lambda r: (str(r.get("log_date") or ""), str(r.get("created_at") or ""), str(r.get("id"))))
        photos_by_log: dict[str, list] = {}
        if self.src.present("daily_photos"):
            for p in self.src.rows("daily_photos"):
                photos_by_log.setdefault(str(p.get("daily_log_id")), []).append(p)
        missing_binary = 0
        for r in rows:
            lid = str(r.get("id"))
            try:
                date_s = str(r.get("log_date") or "")
                if not DATE_RE.match(date_s):
                    raise ValueError(f"log_date 형식 오류: {date_s!r}")   # 날짜가 경로 조각이 되므로 YYYY-MM-DD 만 허용
                tname, tdef = self.type_name_for(r.get("diary_type"))
                kind = tdef.get("kind") or "general"
                base = f"{date_s} 일기" if tname == "일반" else f"{date_s} {E(tname)}"
                existing = self.index.by_id.get(lid)
                if existing:
                    path = self.vault / existing
                else:
                    adopted = self.index.find_diary(date_s, tname)
                    if adopted:
                        path = self.vault / adopted
                        self.log.append(f"  🔗 일기 {base}: yk_id 없는 노트 채택")
                    elif r.get("deleted_at"):
                        self.counts.add("일기", "건너뜀")
                        continue
                    else:
                        path = self.unique_path(self.vault / "50_일기" / date_s[:4], base)
                title = (r.get("title") or "").strip() or date_s
                mood = (r.get("mood") or "").strip()
                tags = [str(t) for t in as_list(r.get("tags"))]
                metrics = r.get("metrics") if isinstance(r.get("metrics"), dict) else {}
                photos = sorted(photos_by_log.get(lid, []), key=lambda p: (p.get("sort_order") if p.get("sort_order") is not None else 0, str(p.get("created_at") or "")))
                if not photos and r.get("photo_path"):
                    # daily_photos 행 없이 대표 사진(photo_path)만 있는 옛 일기 — 같은 루프를 타게 가짜 행 하나로
                    photos = [{"photo_path": r["photo_path"], "caption": "", "sort_order": 0}]
                for p in photos:
                    if p.get("photo_path") and not photo_base(p["photo_path"]):
                        self.log.append(f"  ⚠️ 일기 {date_s} 사진 경로를 파일명으로 쓸 수 없어 건너뜀: {p['photo_path']!r}")
                photos = [p for p in photos if photo_base(p.get("photo_path"))]
                bases = [photo_base(p.get("photo_path")) for p in photos]
                owned: dict = {"type": "일기", "title": title, "date": date_s, "daily": f"[[{date_s}]]", "diary_type": tname}
                owned["종류"] = None if (tname == "일반" and (not self.args.link_general_type)) else f"[[{tname}]]"
                ms = MOOD_MAP.get(mood)
                owned["mood"] = mood or None
                owned["mood_score"] = ms[1] if ms else None
                owned["기분"] = f"[[{E(mood)}]]" if mood else None
                if kind == "workout":
                    parts = [str(x) for x in as_list(metrics.get("parts"))]
                    owned["parts"] = parts or None
                    owned["duration_min"] = metrics.get("duration_min") if metrics.get("duration_min") not in (None, "", 0) else None
                    owned["intensity"] = metrics.get("intensity") or None
                else:
                    owned["parts"] = owned["duration_min"] = owned["intensity"] = None
                for k, v in metrics.items():
                    if k in ("parts", "duration_min", "intensity") and kind == "workout":
                        continue
                    if v in (None, "", []):
                        continue
                    label = re.sub(r"[:#\s\[\]]+", "_", str(k)).strip("_") or "x"  # f-string 안의 백슬래시는 3.12+ 전용이라 밖으로
                    owned[f"기록_{label}"] = v
                owned["photos"] = len(bases) if bases else None
                owned["cover"] = f"[[{bases[0]}]]" if bases else None
                owned["created"] = iso_date(r.get("created_at"), self.tz)
                owned.update({
                    "yk_id": lid, "yk_updated": r.get("updated_at") or r.get("created_at"),
                    "yk_url": f"{self.app_url}/#/daily/{date_s}" + (f"?type={r.get('diary_type')}" if r.get("diary_type") and r.get("diary_type") != "general" else ""),
                    "yk_deleted": iso_date(r.get("deleted_at"), self.tz) if r.get("deleted_at") else None, "yk_missing": None, "yk_key": None,
                })
                # 사진 블록
                plines: list[str] = []
                pending = 0
                for i, p in enumerate(photos):
                    b = photo_base(p.get("photo_path"))
                    cap = (p.get("caption") or "").strip()
                    if self.src.has_binary and not self.args.no_photos:
                        ok = self.download_photo(p["photo_path"], self.vault / "_Attachments" / "YouKnow" / "daily" / date_s / b)
                        if ok:
                            plines.append(f"![[{b}]]" + (" (대표)" if i == 0 else ""))
                        else:
                            pending += 1
                            plines.append(f"- 📷 {b} (다운로드 실패)")
                    else:
                        missing_binary += 1
                        plines.append(f"- 📷 {b}" + (f" — {cap}" if cap else "") + " (앱에서만 보임)")
                        continue
                    if cap:
                        plines.append(f"> {cap}")
                owned["photos_pending"] = pending or None
                body = (r.get("body") or "").rstrip()
                blocks = [("body", body, "# "), ("photos", "\n".join(plines), "## 📷 사진")]
                tag_links = [f"[[{E(t)}]]" for t in tags]
                self.upsert_note(table="일기", path=path, yk_id=lid, owned=owned, blocks=blocks, free_text={"body"}, app_tags=tags,
                                 app_tag_links=tag_links, new_title=title,
                                 create_fn=lambda fm, b, title=title: self.tpl_diary(fm, b, title))
            except Exception as ex:  # noqa: BLE001
                self.counts.add("일기", "실패")
                self.failures.append(f"일기 {r.get('log_date')}: {ex}")
                self.log.append(f"  ❌ 일기 {r.get('log_date')}: {ex}")
                if self.args.verbose:
                    traceback.print_exc()
        if missing_binary:
            self.log.append(f"  📷 사진 {missing_binary}장은 --supabase 로 받을 수 있음 (백업/zip 모드에는 바이너리 없음)")
        self.mark_missing("daily_logs", "일기", rows)

    def tpl_diary(self, fm: dict, blocks: dict, title: str) -> str:
        pb = wrap_block("photos", blocks.get("photos", ""))
        return f"""{fm_dump(fm)}# {title}
{wrap_block('body', blocks.get('body', ''))}

## 📷 사진
{pb}

## 생각 · 연결
- 
"""

    def download_photo(self, storage_path: str, target: Path) -> bool:
        """Storage sign → GET. 이미 있고 크기 같으면 재다운로드 안 함."""
        if self.dry:
            return True
        try:
            base = getattr(self.src, "base", "")
            headers = dict(getattr(self.src, "headers", {}))
            headers["Content-Type"] = "application/json"
            sign_url = f"{base}/storage/v1/object/sign/life-photos/{urllib.parse.quote(storage_path)}"
            data, _ = http_json(sign_url, headers, method="POST", data=json.dumps({"expiresIn": 600}).encode("utf-8"))
            signed = (data or {}).get("signedURL") or (data or {}).get("signedUrl")
            if not signed:
                raise RuntimeError("signedURL 없음")
            full = signed if signed.startswith("http") else f"{base}/storage/v1{signed}"
            self.inside(target)
            req = urllib.request.Request(full, headers={"apikey": headers.get("apikey", "")})
            with urllib.request.urlopen(req, timeout=120) as resp:
                length = resp.headers.get("Content-Length")
                if target.exists() and length and target.stat().st_size == int(length):
                    return True
                target.parent.mkdir(parents=True, exist_ok=True)
                with open(target, "wb") as fh:
                    shutil.copyfileobj(resp, fh)
            self.photo_count += 1
            return True
        except Exception as ex:  # noqa: BLE001
            self.photo_fail += 1
            self.log.append(f"  📷 다운로드 실패 {storage_path}: {ex}")
            return False

    # ── 6. habits ────────────────────────────────────────────────────────
    def run_habits(self):
        # 폴더의 기존 습관 노트 이름(링크 매칭용)
        hdir = self.vault / "60_습관"
        existing_names = {p.stem for p in hdir.glob("*.md")} if hdir.exists() else set()
        self.habit_note_names: set[str] = {n for n in existing_names if (self.index.notes.get(f"60_습관/{n}.md") or {}).get("type") == "습관"}
        if not self.src.present("habits"):
            return
        rows = sorted(self.src.rows("habits"), key=lambda r: (str(r.get("created_at") or ""), str(r.get("id"))))
        self.habit_rows = rows
        for r in rows:
            hid = str(r.get("id"))
            try:
                name = (r.get("name") or "").strip() or "새 습관"
                existing = self.index.by_id.get(hid)
                path = self.vault / existing if existing else self.unique_path(hdir, E(name))
                created = iso_date(r.get("created_at"), self.tz)
                owned = {
                    "type": "습관", "title": name, "color": r.get("color") or "#94a3b8", "color_name": color_name(r.get("color") or ""),
                    "sort_order": r.get("sort_order") if r.get("sort_order") is not None else 0, "created": created,
                    "daily": f"[[{created}]]" if created else None, "yk_id": hid, "yk_updated": r.get("updated_at") or r.get("created_at"),
                    "yk_url": f"{self.app_url}/#/habits", "yk_missing": None,
                }
                self.upsert_note(table="습관", path=path, yk_id=hid, owned=owned, blocks=[], up="[[습관]]", app_tags=["hub"], new_title=name,
                                 create_fn=lambda fm, b, name=name: self.tpl_habit(fm, name))
                self.habit_names[hid] = self.last_path.stem
                self.habit_note_names.add(self.last_path.stem)
            except Exception as ex:  # noqa: BLE001
                self.counts.add("습관", "실패")
                self.failures.append(f"습관 {r.get('name')}: {ex}")
                self.log.append(f"  ❌ 습관 {r.get('name')}: {ex}")
        self.mark_missing("habits", "습관", rows)

    def tpl_habit(self, fm: dict, name: str) -> str:
        F = "```"
        return f"""{fm_dump(fm)}# 🔁 {name}

## 기록
{F}dataviewjs
// 10_오늘 노트의 "- ✅ [[이름]]" 줄을 세어 연속일(오늘 미체크면 어제부터 역산 — 앱 알고리즘), 이번 주(일~토) %, 최근 8주 막대
const name = dv.current().file.name;
const esc = name.replace(/[.*+?^$()|[\\]\\\\{{}}]/g, "\\\\$&");
const re = new RegExp("^\\\\s*- (✅|⬜|❌) \\\\[\\\\[" + esc + "(\\\\|[^\\\\]]*)?\\\\]\\\\]", "m");
const pages = dv.pages('"10_오늘"').where(p => p.type === "오늘" && p.date);
const checked = new Set();
for (const p of pages) {{
  const f = app.vault.getAbstractFileByPath(p.file.path);
  if (!f) continue;
  const txt = await app.vault.cachedRead(f);
  const m = txt.match(re);
  if (m && m[1] === "✅") checked.add(p.file.name);
}}
const today = dv.date("today");
const fmt = d => d.toFormat("yyyy-MM-dd");
let cur = checked.has(fmt(today)) ? today : today.minus({{ days: 1 }});
let streak = 0;
while (checked.has(fmt(cur))) {{ streak += 1; cur = cur.minus({{ days: 1 }}); }}
const dow = today.weekday % 7;                 // 0=일 … 6=토
const sun = today.minus({{ days: dow }});
let wk = 0;
for (let i = 0; i <= dow; i++) if (checked.has(fmt(sun.plus({{ days: i }})))) wk += 1;
const bars = [];
for (let w = 7; w >= 0; w--) {{
  const s = sun.minus({{ weeks: w }});
  let c = 0, days = 0;
  for (let i = 0; i < 7; i++) {{ const d = s.plus({{ days: i }}); if (d > today) break; days += 1; if (checked.has(fmt(d))) c += 1; }}
  bars.push(s.toFormat("MM/dd") + "  " + "█".repeat(c) + "░".repeat(Math.max(0, days - c)) + "  " + c + "/" + days);
}}
dv.paragraph("**" + streak + "일 연속** · 이번 주 " + Math.round(wk / (dow + 1) * 100) + "% (" + wk + "/" + (dow + 1) + ") · 총 " + checked.size + "회");
dv.el("pre", bars.join("\\n"));
{F}

## 메모
- 
"""

    # ── 7. routine_blocks → 요일 노트 ─────────────────────────────────────
    def weekday_path(self, wd: int) -> Path:
        return self.vault / "20_일정" / "일과" / f"{WEEKDAYS[wd]}요일.md"

    def tpl_weekday(self, fm: dict, blocks: dict, name: str) -> str:
        F = "```"
        rt = blocks.get("routines", "| 시작 | 끝 | 일과 | 색 | |\n| --- | --- | --- | --- | --- |")
        return f"""{fm_dump(fm)}# {name} 일과

## 일과표
%% yk:routines:start %%
{rt}
%% yk:routines:end %%

## 이 요일의 하루들
{F}dataview
LIST FROM "10_오늘" WHERE contains(string(weekday), "{name}") SORT date DESC LIMIT 12
{F}

## 메모
- 
"""

    def run_routines(self):
        present = self.src.present("routine_blocks")
        rows = self.src.rows("routine_blocks") if present else []
        short = self.table_ids_short(rows)
        self.routine_titles: set[str] = {str(r.get("title") or "").strip() for r in rows}
        for wd in range(7):
            name = f"{WEEKDAYS[wd]}요일"
            path = self.weekday_path(wd)
            owned = {"type": "일과", "weekday": wd, "yk_url": f"{self.app_url}/#/schedule/routines"}
            blocks: list[tuple[str, str, str | None]] = []
            if present:
                lines = ["| 시작 | 끝 | 일과 | 색 | |", "| --- | --- | --- | --- | --- |"]
                for r in sorted([r for r in rows if int(r.get("weekday") or 0) == wd], key=lambda r: (str(r.get("start_time") or ""), str(r.get("id")))):
                    title = str(r.get("title") or "").strip()
                    t = f"[[{title}]]" if title in self.habit_note_names else title
                    end = str(r.get("end_time") or "").strip() or "—"
                    lines.append(f"| {r.get('start_time') or ''} | {end} | {t} | {color_name(r.get('color') or '') or ''} | %%yk:rt {short.get(str(r.get('id')), id8(r.get('id')))}%% |")
                blocks.append(("routines", "\n".join(lines), "## 일과표"))
            elif not path.exists() and not self.args.no_fill_days:
                pass
            else:
                continue
            self.upsert_note(table="일과", path=path, yk_id=None, owned=owned, blocks=blocks, up="[[일정]]",
                             create_fn=lambda fm, b, name=name: self.tpl_weekday(fm, b, name))

    # ── 8. 일간 스켈레톤 + day_plans + habit_checks ────────────────────────
    def daily_path(self, d: dt.date) -> Path:
        return self.vault / "10_오늘" / f"{d.year:04d}" / f"{d.month:02d}" / f"{d.isoformat()}.md"

    def daily_skeleton(self, d: dt.date, fm_extra: dict, plans_block: str, habits_block: str, embed_routine: bool) -> str:
        date = d.isoformat()
        prev = (d - dt.timedelta(days=1)).isoformat()
        nxt = (d + dt.timedelta(days=1)).isoformat()
        week = iso_week(d)
        dow = WEEKDAYS[(d.weekday() + 1) % 7]
        weekday = f"{dow}요일"
        fm = {"type": "오늘", "date": date, "week": f"[[{week}]]", "weekday": f"[[{weekday}]]", "prev": f"[[{prev}]]", "next": f"[[{nxt}]]",
              "plans": 0, "plans_done": 0, "habits_checked": 0}
        fm.update(fm_extra)
        F = "```"
        pb = f"%% yk:plans:start %%\n{plans_block}\n%% yk:plans:end %%" if plans_block else "%% yk:plans:start %%\n%% yk:plans:end %%"
        hb = f"%% yk:habits:start %%\n{habits_block}\n%% yk:habits:end %%" if habits_block else "%% yk:habits:start %%\n%% yk:habits:end %%"
        routine = f"![[{weekday}#일과표]]\n" if embed_routine else ""
        return f"""{fm_dump(fm)}# ☀️ {date} ({dow})
← [[{prev}]] · [[{nxt}]] → · 이번 주 [[{week}]] · [[{weekday}]]

## 🗓️ 오늘 일정
### 하루 계획
{pb}
### 캘린더
- _(가져오기로 생성 — 일정 없음)_
### 일과
{routine}
## ✅ 오늘 할 일
### 지난 마감
{F}dataview
TABLE WITHOUT ID file.link AS "할 일", priority_label AS "우선순위", due AS "마감", project AS "프로젝트"
FROM "30_할일/목록"
WHERE due AND due < date({date}) AND status != "완료" AND status != "달성 못함" AND !yk_deleted AND !yk_missing
SORT due ASC, priority DESC
{F}
### 오늘 마감
{F}dataview
TABLE WITHOUT ID file.link AS "할 일", status AS "상태", priority_label AS "우선순위", project AS "프로젝트"
FROM "30_할일/목록"
WHERE due = date({date}) AND !yk_deleted AND !yk_missing
SORT status ASC, priority DESC
{F}
{F}tasks
not done
due on {date}
hide backlink
short mode
{F}
### 달성 못함
{F}dataview
TABLE WITHOUT ID file.link AS "할 일", priority_label AS "우선순위", project AS "프로젝트"
FROM "30_할일/목록"
WHERE due = date({date}) AND status = "달성 못함" AND !yk_deleted AND !yk_missing
SORT priority DESC
{F}
- [ ] 

## 🔁 습관
{hb}

## 📔 오늘 일기
{F}dataview
LIST FROM "50_일기" WHERE date = date({date})
{F}
· 일기 쓰기: Cmd+N → 📔 일기 (허브 링크 없음)

## 📝 메모
- 

## 🧠 오늘 생긴 뉴런
{F}dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형"
FROM -"_System" AND -"10_오늘"
WHERE contains(string(daily), "{date}") OR file.cday = date({date})
SORT file.ctime ASC
{F}
"""

    def min_row_date(self) -> dt.date | None:
        dates: list[dt.date] = []

        def push(v):
            if v:
                d = parse_date(str(v)[:10])
                if d:
                    dates.append(d)
        for r in self.src.rows("daily_logs"):
            push(r.get("log_date"))
        for r in self.src.rows("tasks"):
            push(r.get("start_date")); push(r.get("due_date")); push(iso_date(r.get("created_at"), self.tz))
        for r in self.src.rows("projects"):
            push(r.get("start_date")); push(iso_date(r.get("created_at"), self.tz))
        for r in self.src.rows("day_plans"):
            push(r.get("plan_date"))
        for r in self.src.rows("habit_checks"):
            push(r.get("check_date"))
        for r in self.src.rows("habits"):
            push(iso_date(r.get("created_at"), self.tz))
        return min(dates) if dates else None

    def run_daily(self):
        plans_present = self.src.present("day_plans")
        checks_present = self.src.present("habit_checks") and self.src.present("habits")
        plans_by_date: dict[str, list] = {}
        for r in self.src.rows("day_plans") if plans_present else []:
            plans_by_date.setdefault(str(r.get("plan_date")), []).append(r)
        checks_by_date: dict[str, set[str]] = {}
        for r in self.src.rows("habit_checks") if checks_present else []:
            checks_by_date.setdefault(str(r.get("check_date")), set()).add(str(r.get("habit_id")))
        plan_short = self.table_ids_short(self.src.rows("day_plans") if plans_present else [])

        dates: set[dt.date] = set()
        since = parse_date(self.args.since) if self.args.since else self.min_row_date()
        if self.args.since and not since:
            self.say(f"⚠️ --since '{self.args.since}' 는 YYYY-MM-DD 가 아니라서 일간 스켈레톤 채우기를 건너뜀")
        if not self.args.no_fill_days and since:
            d = since
            while d <= self.today:
                dates.add(d)
                d += dt.timedelta(days=1)
        for k in list(plans_by_date) + list(checks_by_date):
            dd = parse_date(k)
            if dd:
                dates.add(dd)
        if not dates:
            return
        habits_sorted = sorted(self.habit_rows, key=lambda h: (h.get("sort_order") if h.get("sort_order") is not None else 0, str(h.get("created_at") or "")))
        plan_days = check_days = 0
        for d in sorted(dates):
            ds = d.isoformat()
            path = self.daily_path(d)
            fm_owned: dict = {"type": "오늘"}
            blocks: list[tuple[str, str, str | None]] = []
            embed_routine = True
            plans = sorted(plans_by_date.get(ds, []), key=lambda p: (str(p.get("start_time") or ""), str(p.get("id"))))
            if plans_present:
                lines = []
                for p in plans:
                    em = "✅" if p.get("done") else ("❌" if p.get("failed") else "⬜")
                    title = str(p.get("title") or "").strip()
                    t = f"[[{title}]]" if (title in self.habit_note_names or title in self.weekday_names) else title
                    span = f"{p.get('start_time') or ''}–{p.get('end_time') or ''}".strip("–")
                    tail = " (달성 못함)" if p.get("failed") else ""
                    cn = color_name(p.get("color") or "") or (p.get("color") or "")
                    lines.append(f"- {em} {span} {t}{tail} %%yk:plan {plan_short.get(str(p.get('id')), id8(p.get('id')))} {cn}%%".replace("  ", " "))
                blocks.append(("plans", "\n".join(lines), "### 하루 계획"))
                fm_owned["plans"] = len(plans)
                fm_owned["plans_done"] = sum(1 for p in plans if p.get("done"))
                embed_routine = len(plans) == 0
                if plans:
                    plan_days += 1
            if checks_present:
                checked = checks_by_date.get(ds, set())
                lines = []
                n = 0
                for h in habits_sorted:
                    hc = iso_date(h.get("created_at"), self.tz)
                    if hc and hc > ds:
                        continue
                    name = self.habit_names.get(str(h.get("id")), E(h.get("name") or "새 습관"))
                    ok = str(h.get("id")) in checked
                    n += ok
                    lines.append(f"- {'✅' if ok else '⬜'} [[{name}]]")
                blocks.append(("habits", "\n".join(lines), "## 🔁 습관"))
                fm_owned["habits_checked"] = n
                if checked:
                    check_days += 1
            extra = f"embed:{int(embed_routine) if plans_present else 'keep'}"
            self.upsert_daily(path, d, fm_owned, blocks, embed_routine if plans_present else None, extra)
        self.counts.add("계획", "일", plan_days)
        self.counts.add("습관 체크", "일", check_days)

    def upsert_daily(self, path: Path, d: dt.date, owned: dict, blocks: list, embed_routine: bool | None, hash_extra: str):
        relp = rel(path, self.vault)
        plans_block = next((c for n, c, _ in blocks if n == "plans"), "")
        habits_block = next((c for n, c, _ in blocks if n == "habits"), "")
        if not path.exists():
            if self.dry:
                self.write(path, "")
                self.counts.add("일간", "새로")
                return
            managed = json.dumps({"fm": owned, "blocks": [(n, c) for n, c, _ in blocks], "extra": hash_extra}, ensure_ascii=False, sort_keys=True)
            fm_extra = dict(owned)
            fm_extra["yk_hash"] = sha1(managed)
            text = self.daily_skeleton(d, fm_extra, plans_block, habits_block, embed_routine if embed_routine is not None else True)
            self.write(path, text)
            self.planned_paths.add(relp)
            self.index.register(None, relp, fm_load(text)[0])
            self.index.set_meta(None, relp, blocks={n: sha1(c) for n, c, _ in blocks})
            self.counts.add("일간", "새로")
            return
        text = self.read(path)
        if DAILY_HUB_LINK_OLD in text:   # 1회 마이그레이션: 허브로 가는 링크 줄 제거(그래프 별 방지)
            text = text.replace(DAILY_HUB_LINK_OLD, DAILY_HUB_LINK_NEW)
            self.write(path, text)
            self.log.append(f"  🔧 {relp}: 일기 허브 링크 줄을 안내 문구로 교체")
        fm, body = fm_load(text)
        managed = json.dumps({"fm": owned, "blocks": [(n, c) for n, c, _ in blocks], "extra": hash_extra}, ensure_ascii=False, sort_keys=True)
        new_hash = sha1(managed)
        markers_ok = all(get_block(body, n) is not None for n, _, _ in blocks)
        if str(fm.get("yk_hash") or "") == new_hash and markers_ok:
            self.counts.add("일간", "건너뜀")
            return
        dirty = False
        # 역방향 변경 감지: 볼트에만 있던 ✅/마커 줄은 앱 승 + 로그
        for name, content, header in blocks:
            cur = get_block(body, name)
            if cur is None:
                continue
            if name == "plans":
                unmarked = [ln for ln in cur.split("\n") if ln.strip() and "%%yk:plan" not in ln]
                old_marked = {m.group(2): m.group(1) for m in (re.match(r"^- (✅|❌|⬜) .*%%yk:plan (\S+)", ln) for ln in cur.split("\n")) if m}
                new_marked = {m.group(2): m.group(1) for m in (re.match(r"^- (✅|❌|⬜) .*%%yk:plan (\S+)", ln) for ln in content.split("\n")) if m}
                for pid, em in old_marked.items():
                    if pid in new_marked and new_marked[pid] != em:
                        dirty = True
                        self.log.append(f"  ⚠️ {relp}: 계획 {pid} Obsidian '{em}' · 앱 '{new_marked[pid]}' → 앱 승")
                if unmarked:
                    # 마커 없는 줄은 블록 뒤로 보존
                    s, e = block_markers("plans")
                    lines = body.split("\n")
                    try:
                        ei = next(i for i, ln in enumerate(lines) if ln.strip() == e)
                        after = lines[ei + 1:ei + 1 + len(unmarked)]
                        if after != unmarked:
                            lines[ei + 1:ei + 1] = unmarked
                            body = "\n".join(lines)
                    except StopIteration:
                        pass
            if name == "habits":
                old_checked = {m.group(2) for m in (re.match(r"^- (✅) \[\[([^\]|]+)", ln) for ln in cur.split("\n")) if m}
                new_checked = {m.group(2) for m in (re.match(r"^- (✅) \[\[([^\]|]+)", ln) for ln in content.split("\n")) if m}
                for nm in old_checked - new_checked:
                    dirty = True
                    self.log.append(f"  ⚠️ {relp}: 습관 '{nm}' Obsidian ✅ · 앱 미체크 → 앱 승(⬜)")
        for name, content, header in blocks:
            body, _ = set_block(body, name, content, header, self.log, relp)
        # ### 일과 임베드: 계획 0개인 날만
        if embed_routine is not None:
            dow = WEEKDAYS[(d.weekday() + 1) % 7]
            embed_line = f"![[{dow}요일#일과표]]"
            lines = body.split("\n")
            has = any(ln.strip() == embed_line for ln in lines)
            if embed_routine and not has:
                for i, ln in enumerate(lines):
                    if ln.strip() == "### 일과":
                        lines.insert(i + 1, embed_line)
                        break
            elif not embed_routine and has:
                lines = [ln for ln in lines if ln.strip() != embed_line]
            body = "\n".join(lines)
        merged = dict(fm)
        for k, v in owned.items():
            merged[k] = v
        merged["yk_hash"] = new_hash
        if dirty:
            merged["yk_dirty"] = True
            self.dirty.append((relp, "계획/습관 체크", "앱 값으로 덮어씀"))
        elif "yk_dirty" in merged:
            merged.pop("yk_dirty", None)
        new_text = fm_dump(merged) + body
        if new_text != text:
            self.write(path, new_text)
        self.index.register(None, relp, merged)
        self.index.set_meta(None, relp, blocks={n: sha1(c) for n, c, _ in blocks})
        self.counts.add("일간", "갱신")

    # ── 9. yk_missing / 채택 실패 ─────────────────────────────────────────
    def mark_missing(self, table: str, type_name: str, rows: list):
        ids = {str(r.get("id")) for r in rows}
        prefix = {"일기": "50_일기/", "할 일": "30_할일/", "프로젝트": "40_프로젝트/", "자료": "40_프로젝트/", "습관": "60_습관/"}[type_name]
        tname = {"일기": "일기", "할 일": "할일", "프로젝트": "프로젝트", "자료": "자료", "습관": "습관"}[type_name]
        self.missing_candidates = getattr(self, "missing_candidates", [])
        for relp, fm in list(self.index.notes.items()):
            if not relp.startswith(prefix) or fm.get("type") != tname or not fm.get("yk_id"):
                continue
            if str(fm["yk_id"]) in ids:
                if fm.get("yk_missing"):
                    self.mark_flag(relp, "yk_missing", None)
                continue
            if self.src.kind == "supabase" and table not in self.src.from_fallback:
                if not fm.get("yk_missing"):
                    self.mark_flag(relp, "yk_missing", self.today_s)
                    self.log.append(f"  👻 {relp}: {table} 에서 사라짐 → yk_missing")
            else:
                self.missing_candidates.append(relp)

    # ── 10. 98_연동/YouKnow.md ────────────────────────────────────────────
    def write_youknow_md(self, exit_code: int):
        path = self.vault / "98_연동" / "YouKnow.md"
        s = self.settings
        types = self.diary_types if self.diary_types is not None else DEFAULT_DIARY_TYPES
        flags = {
            "V10 일기 종류": self.diary_types is not None,
            "V10 프로젝트 단계": self.src.present("project_sections"),
            "V11 습관": self.src.present("habits"),
            "V11 일과": self.src.present("routine_blocks"),
            "V14 하루 계획": self.src.present("day_plans"),
            "V15 마감일": any("due_date" in r for r in self.src.rows("projects")),
            "V16 달성 못함": any("failed" in r for r in self.src.rows("day_plans")),
            "V17 자료": self.src.present("project_resources"),
        }
        counts = {t: len(self.src.rows(t)) for t in TABLES_12 if self.src.present(t) and t != "settings"}
        fm = {
            "type": "연동", "up": "[[연동]]", "site_name": s.get("site_name") or "YouKnow Meta data",
            "moods": [str(m) for m in (s.get("moods") or DEFAULT_MOODS)], "tags": [str(t) for t in (s.get("tags") or DEFAULT_TAGS)],
            "diary_types": [("일반" if t.get("id") == "general" else str(t.get("name") or t.get("id"))) for t in types if isinstance(t, dict)],
            "flags": [k for k, v in flags.items() if v],
            "last_import": self.today_s if self.env.get("YK_TODAY") else dt.datetime.now(self.tz).isoformat(timespec="seconds"),
            "source": self.src.kind, "counts": [f"{k} {v}" for k, v in counts.items()],
        }
        if self.src.exported_at:
            fm["last_backup"] = self.src.exported_at
        F = "```"
        warn = "" if exit_code == 0 and not self.failures else f"> [!warning] ⚠️ 마지막 가져오기에서 실패 {len(self.failures)}건 — 아래 로그 참고\n\n"
        type_rows = "\n".join(f"| {t.get('id')} | {'일반' if t.get('id') == 'general' else t.get('name')} | {t.get('icon') or ''} | {t.get('color') or ''} | {t.get('kind') or 'general'} |"
                              for t in types if isinstance(t, dict))
        flag_rows = "\n".join(f"| {k} | {'✅' if v else '—'} |" for k, v in flags.items())
        log_rows = "\n".join(f"| {t} | {c.get('새로', 0)} | {c.get('갱신', 0)} | {c.get('건너뜀', 0)} | {c.get('실패', 0)} |"
                             for t, c in self.counts.d.items() if "일" not in c)
        dirty_rows = "\n".join(f"| [[{Path(p).stem}]] | {a} | {b} |" for p, a, b in self.dirty) or "| — | — | — |"
        adopt = "\n".join(f"- [[{Path(p).stem}]]" for p in self.adopt_fail) or "- _(없음)_"
        missing_note = ""
        mc = getattr(self, "missing_candidates", [])
        if mc:
            missing_note = "\n백업/zip 모드에는 휴지통 행이 없어 `yk_missing` 을 쓰지 않았어요. 아래 노트는 이번 소스에 없던 행입니다 (--supabase 로 확인):\n" + "\n".join(f"- [[{Path(p).stem}]]" for p in mc[:50])
        log_text = "\n".join(self.log)
        text = f"""{fm_dump(fm)}# 📲 YouKnow

{warn}앱 **{fm['site_name']}** ↔ 이 볼트. 매 실행마다 이 노트 전체가 다시 쓰입니다 (`_System/Scripts/import_youknow.py`).
마지막 가져오기: `{fm['last_import']}` · 소스: `{self.src.kind}`{f" · 백업 시각: `{self.src.exported_at}`" if self.src.exported_at else ""}

## 설정
- 기분: {", ".join(f"[[{E(m)}]]" for m in fm['moods'])}
- 태그: {", ".join(f"[[{E(t)}]]" for t in fm['tags'])}

| id | 종류 | 아이콘 | 색 | kind |
| --- | --- | --- | --- | --- |
{type_rows}

## 기능 플래그 (추정)
| 플래그 | 상태 |
| --- | --- |
{flag_rows}

## 가져오기 로그
| 테이블 | 생성 | 갱신 | 건너뜀 | 실패 |
| --- | --- | --- | --- | --- |
{log_rows}

{self.summary_line()}

{F}
{log_text}
{F}

## ⚠️ YouKnow에 반영 필요
볼트에서 먼저 바꾼 값(완료/달성 못함 등). 앱에서 같은 값으로 바꾼 뒤 다음 가져오기에서 `yk_dirty` 가 사라집니다.

| 노트 | Obsidian | 앱 |
| --- | --- | --- |
{dirty_rows}

{F}dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형", status AS "Obsidian 상태"
FROM -"_System" WHERE yk_dirty = true
{F}

## 휴지통
{F}dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형", yk_deleted AS "휴지통에 들어간 날"
FROM -"_System" WHERE yk_deleted
SORT yk_deleted DESC
{F}

## 사라진 행
{F}dataview
TABLE WITHOUT ID file.link AS "노트", type AS "유형", yk_missing AS "사라진 날"
FROM -"_System" WHERE yk_missing
SORT yk_missing DESC
{F}
{missing_note}

## 채택 실패
`yk_pending: true` 인데 앱 행과 (제목, 마감, 생성일 ±1일)로 맞춰지지 않은 노트. `yk_pushed` 가 없는 노트는 `--push-pending` 으로 앱에 한 번 보낼 수 있어요(보낸 뒤엔 제목 + yk_pushed ±1일로 채택).
{adopt}
"""
        self.write(path, text)

    def summary_line(self) -> str:
        c = self.counts

        def trio(t):
            return f"{t} 새로 {c.get(t, '새로')} · 갱신 {c.get(t, '갱신')} · 건너뜀 {c.get(t, '건너뜀')}"
        return (f"{trio('일기')} / {trio('할 일')} / {trio('프로젝트')} / {trio('자료')} / 습관 체크 {c.get('습관 체크', '일')}일 / 계획 {c.get('계획', '일')}일 / "
                f"사진 {self.photo_count}장 / 충돌 {self.conflicts} / 반영 필요 {len(self.dirty)}")

    # ── 실행 ──────────────────────────────────────────────────────────────
    def run(self) -> int:
        self.say(f"🗂️ 볼트: {self.vault} · 오늘 {self.today_s} ({self.args.tz}) · 소스 {self.src.kind}{' · dry-run' if self.dry else ''}")
        steps = [("settings", self.run_settings), ("projects", self.run_projects), ("resources", self.run_resources), ("tasks", self.run_tasks),
                 ("diaries", self.run_diaries), ("habits", self.run_habits), ("routines", self.run_routines), ("daily", self.run_daily)]
        for name, fn in steps:
            try:
                fn()
            except Exception as ex:  # noqa: BLE001
                self.failures.append(f"{name}: {ex}")
                self.say(f"❌ {name} 단계 실패: {ex}")
                if self.args.verbose:
                    traceback.print_exc()
        # 채택 실패 = 아직 yk_pending 인 노트
        for relp in self.index.pending_tasks:
            fm = self.index.notes.get(relp) or {}
            if fm.get("yk_pending") is True and not fm.get("yk_id"):
                self.adopt_fail.append(relp)
        if self.args.push_pending and self.adopt_fail:
            self.push_pending()
        exit_code = 1 if self.failures or (self.src.failed and self.src.kind == "supabase") else 0
        for f in self.src.failed:
            self.failures.append(f"{f} 테이블 읽기 실패")
        for ln in self.log:
            if ln.startswith("  "):      # 노트 단위 이벤트(채택·충돌·재삽입·이름 변경·yk_dirty 등)는 stdout 에도 보여 준다
                print(ln)
        if self.dry:
            self.say(f"(dry-run) 쓰기 예정 파일 {len(self.written)}개 — 실제로는 아무것도 쓰지 않음")
        else:
            self.write_youknow_md(exit_code)
            self.index.save()
        print(self.summary_line())
        if self.dirty:
            print(f"⚠️ YouKnow에 반영 필요 {len(self.dirty)}건 → 98_연동/YouKnow.md")
        return exit_code

    def push_pending(self):
        key = self.env.get("YK_WIDGET_KEY", "")
        for relp in list(self.adopt_fail):
            fm = self.index.notes.get(relp) or {}
            title = str(fm.get("title") or Path(relp).stem)
            if fm.get("yk_pushed") and not self.args.force_push:
                self.log.append(f"  ⏭ /api/capture 이미 보냄 ({title}, yk_pushed: {fm.get('yk_pushed')}) — 다시 보내려면 --force-push")
                continue
            text = title
            due = fm.get("due")
            d = parse_date(str(due)) if due else None
            if d and d >= self.today:
                text += f" {d.month}/{d.day}까지"      # 지난 날짜는 앱 파서가 내년으로 넘기므로 보내지 않는다(채택은 제목+yk_pushed 로)
            pr = int(fm.get("priority") or 3)
            text += {5: " 긴급", 4: " 중요", 2: " 낮음", 1: " 언젠가"}.get(pr, "")
            proj = link_target(fm.get("project")) if fm.get("project") else ""
            if proj:
                text += f" [{proj}]" if len(proj) >= 2 else f" #{proj}"   # `[이름]` 꼴은 띄어쓰기가 있는 프로젝트 이름도 앱 파서가 통째로 읽는다(2자 이상)
            if self.dry:
                self.log.append(f"  (dry) /api/capture ← {text}")
                continue
            try:
                body = json.dumps({"text": text, "key": key, "today": self.today_s}, ensure_ascii=False).encode("utf-8")
                data, _ = http_json(f"{self.app_url}/api/capture", {"Content-Type": "application/json"}, method="POST", data=body)
                self.log.append(f"  📤 /api/capture ← {text} → {(data or {}).get('message', 'ok')}")
                self.mark_flag(relp, "yk_pushed", self.today_s)    # 한 번만 보낸다 — 다음 가져오기가 yk_pushed ±1일로 채택
            except Exception as ex:  # noqa: BLE001
                self.log.append(f"  ❌ /api/capture 실패 ({title}): {ex}")


# ──────────────────────────────────────────────────────────────────────────────
# zip (일기만) → Source
# ──────────────────────────────────────────────────────────────────────────────
def load_zip(path: Path, log: list[str]) -> Source:
    """앱 '마크다운 볼트 내보내기' zip 에서 일기/*.md 만 읽어 daily_logs 유사 행으로 바꾼다 (id 없음 → yk_key)."""
    src = Source("zip")
    src.settings = {}
    src.tables["settings"] = [src.settings]
    rows = []
    with zipfile.ZipFile(path) as zf:
        for name in zf.namelist():
            if not re.match(r"^일기/[^/]+\.md$", name):
                continue
            text = zf.read(name).decode("utf-8")
            fm, body = fm_load(text)
            date_s = str(fm.get("date") or "")
            if not DATE_RE.match(date_s):
                m = re.search(r"\d{4}-\d{2}-\d{2}", Path(name).name)
                date_s = m.group(0) if m else ""
            if not date_s:
                log.append(f"⚠️ zip: 날짜를 못 읽어 건너뜀 — {name}")
                continue
            lines = body.lstrip("\n").split("\n")
            title = lines[0][2:].strip() if lines and lines[0].startswith("# ") else Path(name).stem
            body_text = "\n".join(lines[1:]).strip("\n") if lines and lines[0].startswith("# ") else body.strip("\n")
            tname = str(fm.get("type") or "일반")
            row = {
                "yk_key": f"{date_s}|{tname}", "title": title, "log_date": date_s, "mood": fm.get("mood") or "",
                "tags": [str(t) for t in as_list(fm.get("tags"))], "body": body_text, "type_name": tname,
                "metrics": {k: fm[k] for k in ("parts", "duration_min", "intensity") if fm.get(k) not in (None, "", [])},
            }
            rows.append(row)
    src.tables["daily_logs"] = rows
    log.append(f"zip: 일기 {len(rows)}편 (프로젝트/할 일/README 는 가져오지 않음 — id 없음)")
    return src


def run_zip_import(imp: Importer) -> int:
    """zip 일기는 yk_id 가 없어 (date, 종류) 자연키 + yk_key 로만 만든다. 이미 있는 노트는 건드리지 않는다."""
    imp.say(f"🗂️ 볼트: {imp.vault} · 오늘 {imp.today_s} · 소스 zip{' · dry-run' if imp.dry else ''}")
    types_by_name = {("일반" if t.get("id") == "general" else t.get("name")): t for t in DEFAULT_DIARY_TYPES}
    for r in imp.src.rows("daily_logs"):
        date_s, tname = r["log_date"], r["type_name"]
        base = f"{date_s} 일기" if tname == "일반" else f"{date_s} {E(tname)}"
        folder = imp.vault / "50_일기" / date_s[:4]
        exists = (folder / f"{base}.md").exists() or imp.index.find_diary(date_s, tname) or any(
            str(fm.get("yk_key") or "") == r["yk_key"] for fm in imp.index.notes.values())
        if exists:
            imp.counts.add("일기", "건너뜀")
            continue
        path = imp.unique_path(folder, base)
        mood = r["mood"]
        ms = MOOD_MAP.get(mood)
        kind = (types_by_name.get(tname) or {}).get("kind", "workout" if tname == "운동" else "general")
        fm = {"type": "일기", "title": r["title"], "date": date_s, "daily": f"[[{date_s}]]", "diary_type": tname,
              "종류": None if (tname == "일반" and (not imp.args.link_general_type)) else f"[[{tname}]]",
              "mood": mood or None, "mood_score": ms[1] if ms else None, "기분": f"[[{E(mood)}]]" if mood else None,
              "tags": r["tags"], "태그": [f"[[{E(t)}]]" for t in r["tags"]] or None}
        if kind == "workout":
            for k in ("parts", "duration_min", "intensity"):
                if r["metrics"].get(k) not in (None, "", []):
                    fm[k] = r["metrics"][k]
        fm["created"] = imp.today_s
        fm["yk_key"] = r["yk_key"]
        fm = {k: v for k, v in fm.items() if v is not None}
        imp.write(path, imp.tpl_diary(fm, {"body": r["body"], "photos": ""}, r["title"]))
        imp.planned_paths.add(rel(path, imp.vault))
        imp.counts.add("일기", "새로")
    print(imp.summary_line())
    if not imp.dry:
        imp.index.save()
    return 0


# ──────────────────────────────────────────────────────────────────────────────
# 역방향: --export-diaries-for-youknow
# ──────────────────────────────────────────────────────────────────────────────
def export_diaries(vault: Path, out_dir: Path, export_all: bool, dry: bool) -> int:
    out = out_dir.expanduser().resolve() / "일기"
    n = 0
    for p in sorted((vault / "50_일기").rglob("*.md")):
        relp = rel(p, vault)
        if any(relp.startswith(f"50_일기/{f}/") for f in ("종류", "기분", "태그")):
            continue
        text = p.read_text(encoding="utf-8")
        fm, body = fm_load(text)
        if fm.get("type") != "일기":
            continue
        if fm.get("yk_id") and not export_all:
            continue
        date_s = str(fm.get("date") or "")
        if not DATE_RE.match(date_s):
            continue
        tname = str(fm.get("diary_type") or link_target(fm.get("종류")) or "일반")
        mood = str(fm.get("mood") or "")
        tags = [str(t) for t in as_list(fm.get("tags")) if str(t) != "hub"]
        block = get_block(body, "body")
        if block is None:
            # 마커가 없으면 '# 제목' 다음부터 첫 '## ' 전까지
            lines = body.split("\n")
            buf = []
            started = False
            for ln in lines:
                if ln.startswith("# ") and not started:
                    started = True
                    continue
                if ln.startswith("## "):
                    break
                if started:
                    buf.append(ln)
            block = "\n".join(buf)
        block = strip_callouts(block).strip("\n")
        title = str(fm.get("title") or "")
        if not title:
            m = re.search(r"^# (.+)$", body, re.M)
            title = m.group(1).strip() if m else date_s
        lines = ["---", f"date: {date_s}", f"type: {tname}", f"mood: {json.dumps(mood, ensure_ascii=False)}",
                 "tags: [" + ", ".join(json.dumps(t, ensure_ascii=False) for t in tags) + "]"]
        if fm.get("parts"):
            lines.append("parts: [" + ", ".join(json.dumps(str(x), ensure_ascii=False) for x in as_list(fm.get("parts"))) + "]")
        if fm.get("duration_min") not in (None, ""):
            lines.append(f"duration_min: {fm.get('duration_min')}")
        if fm.get("intensity"):
            lines.append(f"intensity: {json.dumps(str(fm.get('intensity')), ensure_ascii=False)}")
        lines.append("---")
        # 앱 nw() 는 frontmatter 바로 다음 줄(x[0])이 '# ' 로 시작할 때만 제목으로 읽는다 — 빈 줄을 두면 제목이 본문으로 떨어진다
        content = "\n".join(lines) + f"\n# {title}\n\n{block}\n"
        fname = f"{date_s}.md" if tname == "일반" else f"{date_s} {E(tname)}.md"
        target = out / fname
        print(f"  📤 {relp} → {target}")
        if not dry:
            out.mkdir(parents=True, exist_ok=True)
            with open(target, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(content)
        n += 1
    print(f"일기 {n}편 내보냄 → {out}  (앱: 설정 → 데이터·백업 → 옵시디언 .md 가져오기)")
    return 0


def csv_preview(path: Path) -> int:
    with open(path, encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    print(f"📄 {path.name}: 할 일 {len(rows)}행 — 미리보기만 (id 가 없어 볼트에 쓰지 않습니다; --backup 또는 --supabase 를 쓰세요)")
    cols = ["title", "status", "priority", "start_date", "due_date", "project", "note"]
    print("| " + " | ".join(cols) + " |")
    print("|" + "---|" * len(cols))
    for r in rows[:50]:
        print("| " + " | ".join(str(r.get(c, "") or "").replace("|", "¦").replace("\n", " ")[:40] for c in cols) + " |")
    if len(rows) > 50:
        print(f"… 외 {len(rows) - 50}행")
    return 0


# ──────────────────────────────────────────────────────────────────────────────
def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--supabase", action="store_true", help="Supabase REST 에서 12테이블 + 사진을 읽는다 (.env 필요)")
    ap.add_argument("--backup", metavar="JSON", help="앱 전체 백업(.json)")
    ap.add_argument("--zip", metavar="ZIP", help="앱 마크다운 볼트 내보내기(.zip) — 일기만")
    ap.add_argument("--export-diaries-for-youknow", metavar="DIR", help="볼트 일기(yk_id 없음)를 앱 .md 형식으로 DIR/일기/ 에 쓴다")
    ap.add_argument("--all", action="store_true", help="--export-diaries-for-youknow 에서 yk_id 있는 일기도 포함")
    ap.add_argument("--dry-run", action="store_true", help="아무것도 쓰지 않고 할 일만 출력")
    ap.add_argument("--tz", default="Asia/Seoul", help="created_at 등 ISO 타임스탬프를 날짜로 바꿀 시간대 (기본 Asia/Seoul)")
    ap.add_argument("--since", metavar="YYYY-MM-DD", help="일간 스켈레톤 하한 (기본: 가장 오래된 행 날짜)")
    ap.add_argument("--no-fill-days", action="store_true", help="데이터 있는 날만 일간 노트 생성")
    ap.add_argument("--no-photos", action="store_true", help="사진 바이너리를 받지 않음")
    ap.add_argument("--link-general-type", action="store_true", help="일반 종류 일기에도 종류: [[일반]] 링크를 넣음 (기본은 넣지 않음 — 일반 일기 수백 개가 노드 하나를 가리켜 큰 별이 되는 것을 막기 위해)")
    ap.add_argument("--vault", default=str(DEFAULT_VAULT), help="볼트 경로 (기본: 스크립트의 두 단계 위)")
    ap.add_argument("--csv", metavar="CSV", help="할 일 CSV 미리보기만 (쓰기 거부)")
    ap.add_argument("--push-pending", action="store_true", help="채택 실패한 yk_pending 할 일을 /api/capture 로 한 번 보낸다(보낸 노트엔 yk_pushed 날짜가 남아 다시 보내지 않음)")
    ap.add_argument("--force-push", action="store_true", help="--push-pending 에서 이미 yk_pushed 가 있는 노트도 다시 보낸다")
    ap.add_argument("--rename-follow", action="store_true", help="(옵트인) 제목이 바뀐 노트의 파일명도 바꾼다 — 링크는 Obsidian 에서 고쳐야 함")
    ap.add_argument("--verbose", action="store_true", help="예외 스택 출력")
    return ap


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    vault = Path(args.vault).expanduser().resolve()
    env = load_env(vault / "_System" / "Scripts" / ".env", SCRIPT_DIR / ".env")
    if args.csv:
        return csv_preview(Path(args.csv).expanduser())
    if args.export_diaries_for_youknow:
        return export_diaries(vault, Path(args.export_diaries_for_youknow), args.all, args.dry_run)
    if not (args.supabase or args.backup or args.zip):
        build_parser().print_help()
        print("\n입력을 하나 고르세요: --supabase | --backup <json> | --zip <zip> | --export-diaries-for-youknow <dir> | --csv <file>")
        return 1
    log: list[str] = []
    src: Source | None = None
    try:
        if args.supabase:
            src = fetch_supabase(env, log)
        if args.backup:
            b = load_backup(Path(args.backup).expanduser(), log)
            src = merge_sources(src, b, log) if src else b
        if args.zip and src is None:
            src = load_zip(Path(args.zip).expanduser(), log)
        elif args.zip:
            log.append("zip 은 REST/백업과 함께 쓰면 무시됩니다 (상위 집합이 이미 있음)")
    except SystemExit:
        raise
    except Exception as ex:  # noqa: BLE001
        print(f"❌ 입력을 읽지 못했습니다: {ex}", file=sys.stderr)
        return 1
    assert src is not None
    imp = Importer(args, src, env)
    imp.log.extend(log)
    for ln in log:
        print(ln)
    if src.kind == "zip":
        return run_zip_import(imp)
    if args.rename_follow:
        imp.log.append("--rename-follow: 제목이 바뀐 노트는 파일명도 바꿉니다 — 다른 노트의 [[링크]]는 Obsidian 에서 '파일 이름 바꾸기'로 고쳐야 합니다")
    return imp.run()


if __name__ == "__main__":
    sys.exit(main())
