#!/usr/bin/env python3
"""
YouKnow 연동용 .env 자동 설정

배포된 YouKnow 앱(Next.js)의 JS 번들에는 Supabase URL 과 anon key(공개용 키)가 들어 있습니다.
이 스크립트가 그 값을 읽어 _System/Scripts/.env 를 만들어 줍니다. (.env 는 .gitignore 에 있어 커밋되지 않습니다)

    python3 -I _System/Scripts/setup_youknow_env.py                       # 기본 앱 주소
    python3 -I _System/Scripts/setup_youknow_env.py --app https://...     # 다른 주소
    python3 -I _System/Scripts/setup_youknow_env.py --print               # 쓰지 않고 값만 출력
"""
from __future__ import annotations

import argparse
import base64
import json
import re
import sys
import urllib.request
from pathlib import Path

DEFAULT_APP = "https://youknow-meta-data-weom.vercel.app"
SCRIPT_DIR = Path(__file__).resolve().parent
ENV_PATH = SCRIPT_DIR / ".env"
EXAMPLE_PATH = SCRIPT_DIR / ".env.example"
JWT_RE = re.compile(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}")
SUPA_RE = re.compile(r"https://[a-z0-9]+\.supabase\.co")


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "second-brain-setup/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def jwt_role(token: str) -> str | None:
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload)).get("role")
    except Exception:
        return None


def discover(app: str) -> tuple[str | None, str | None]:
    """index.html → 페이지 번들 경로 → URL·anon key."""
    html = fetch(app.rstrip("/") + "/")
    chunks = re.findall(r'src="(/_next/static/chunks/[^"]+\.js)"', html)
    url = key = None
    for chunk in chunks:
        try:
            js = fetch(app.rstrip("/") + chunk)
        except Exception:
            continue
        if url is None:
            m = [u for u in SUPA_RE.findall(js) if "placeholder" not in u]
            if m:
                url = m[0]
        if key is None:
            for tok in JWT_RE.findall(js):
                if jwt_role(tok) == "anon":
                    key = tok
                    break
        if url and key:
            break
    return url, key


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--app", default=DEFAULT_APP, help="YouKnow 앱 주소")
    ap.add_argument("--print", action="store_true", help=".env 를 쓰지 않고 값만 출력")
    args = ap.parse_args()

    print(f"🔎 {args.app} 번들에서 Supabase 설정을 찾는 중…")
    url, key = discover(args.app)
    if not url or not key:
        print("❌ 찾지 못했습니다. 앱이 바뀌었거나 네트워크가 막혀 있습니다. 앱 설정 → 문제 진단의 값을 .env 에 직접 넣어 주세요.", file=sys.stderr)
        return 1
    print(f"   URL  : {url}")
    print(f"   key  : {key[:12]}… (role=anon, {len(key)}자)")
    if args.print:
        return 0

    text = ENV_PATH.read_text(encoding="utf-8") if ENV_PATH.exists() else (EXAMPLE_PATH.read_text(encoding="utf-8") if EXAMPLE_PATH.exists() else "")
    def put(t: str, k: str, v: str) -> str:
        if re.search(rf"^{k}=.*$", t, re.M):
            return re.sub(rf"^{k}=.*$", f"{k}={v}", t, flags=re.M)
        return t.rstrip("\n") + f"\n{k}={v}\n"
    text = put(text, "YK_SUPABASE_URL", url)
    text = put(text, "YK_SUPABASE_ANON_KEY", key)
    text = put(text, "YK_APP_URL", args.app.rstrip("/"))
    ENV_PATH.write_text(text, encoding="utf-8")
    print(f"✅ {ENV_PATH} 저장. 다음: python3 -I _System/Scripts/import_youknow.py --supabase --dry-run")
    return 0


if __name__ == "__main__":
    sys.exit(main())
