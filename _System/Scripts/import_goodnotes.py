#!/usr/bin/env python3
"""
GoodNotes 5 → Obsidian 노트 자동 생성

GoodNotes가 클라우드(Google Drive / Dropbox / OneDrive)로 자동 백업한 PDF를
볼트 안으로 복사하고, 노트북마다 `80_Sources/GoodNotes/<노트북>.md` 를 만들어
PDF를 임베드합니다. 이미 있는 .md 는 절대 덮어쓰지 않습니다 (내가 적은 메모 보호).

사용법 (볼트 루트에서):
    python3 _System/Scripts/import_goodnotes.py
    python3 _System/Scripts/import_goodnotes.py --src "~/Google Drive/GoodNotes"
    python3 _System/Scripts/import_goodnotes.py --src "~/Dropbox/GoodNotes" --dry-run

자동화: macOS launchd / Windows 작업 스케줄러 / cron 으로 하루 한 번 돌리면 끝.
    0 22 * * *  cd /path/to/second-brain && python3 _System/Scripts/import_goodnotes.py
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import shutil
import sys
from pathlib import Path

VAULT = Path(__file__).resolve().parents[2]
PDF_DIR = VAULT / "90_Attachments" / "GoodNotes"
NOTE_DIR = VAULT / "80_Sources" / "GoodNotes"
FORBIDDEN = re.compile(r'[\\/:*?"<>|#^\[\]]')


def safe_name(stem: str) -> str:
    """Obsidian 파일명/위키링크에 쓸 수 없는 문자를 제거합니다."""
    return FORBIDDEN.sub("", stem).strip() or "untitled"


def copy_new_pdfs(src: Path, dry_run: bool) -> list[Path]:
    """src 아래의 PDF 중 새로 생겼거나 바뀐 것만 PDF_DIR로 복사합니다."""
    copied: list[Path] = []
    for pdf in sorted(src.rglob("*.pdf")):
        target = PDF_DIR / (safe_name(pdf.stem) + ".pdf")
        if target.exists():
            same = target.stat().st_size == pdf.stat().st_size and target.stat().st_mtime >= pdf.stat().st_mtime
            if same:
                continue
        print(f"  📄 {'(dry) ' if dry_run else ''}복사: {pdf.name} → {target.relative_to(VAULT)}")
        if not dry_run:
            PDF_DIR.mkdir(parents=True, exist_ok=True)
            shutil.copy2(pdf, target)
        copied.append(target)
    return copied


def note_body(stem: str, today: str) -> str:
    return f"""---
type: goodnotes
tags: [goodnotes]
up: "[[🔌 Sources]]"
pdf: "[[{stem}.pdf]]"
daily: "[[{today}]]"
created: {today}
area: 
---
# ✍️ {stem}

> [!info] GoodNotes 5에서 가져온 손글씨 노트
> 원본 PDF: `90_Attachments/GoodNotes/{stem}.pdf` · 가져온 날: {today}

## 핵심 정리 (손글씨 → 텍스트)
- 

## 연결
- 

## 원본
![[{stem}.pdf]]
"""


def create_notes(dry_run: bool) -> int:
    """PDF_DIR의 PDF마다 노트가 없으면 만듭니다."""
    today = dt.date.today().isoformat()
    made = 0
    for pdf in sorted(PDF_DIR.glob("*.pdf")):
        note = NOTE_DIR / (pdf.stem + ".md")
        if note.exists():
            continue
        print(f"  🧠 {'(dry) ' if dry_run else ''}노트 생성: {note.relative_to(VAULT)}")
        if not dry_run:
            NOTE_DIR.mkdir(parents=True, exist_ok=True)
            note.write_text(note_body(pdf.stem, today), encoding="utf-8")
        made += 1
    return made


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", help="GoodNotes 백업 PDF가 떨어지는 폴더 (생략하면 90_Attachments/GoodNotes 만 스캔)")
    ap.add_argument("--dry-run", action="store_true", help="실제로 쓰지 않고 할 일만 출력")
    args = ap.parse_args()

    print(f"🗂️  볼트: {VAULT}")
    if args.src:
        src = Path(args.src).expanduser().resolve()
        if not src.is_dir():
            print(f"❌ 폴더가 없습니다: {src}", file=sys.stderr)
            return 1
        print(f"📥 백업 폴더 스캔: {src}")
        copied = copy_new_pdfs(src, args.dry_run)
        print(f"   → PDF {len(copied)}개 복사")

    made = create_notes(args.dry_run)
    print(f"✅ 새 노트 {made}개 생성 ({'dry-run' if args.dry_run else '완료'})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
