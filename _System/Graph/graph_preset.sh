#!/usr/bin/env bash
# 그래프 프리셋 전환: full(전체 그물) | knowledge(순수 제텔카스텐 — 할 일·일정·습관·일간 숨김)
# ⚠️ 옵시디언의 그래프 뷰를 '닫은 뒤' 실행하세요. 열려 있으면 Obsidian이 메모리의 설정을 graph.json에 다시 써서 덮어씁니다.
set -euo pipefail
VAULT="$(cd "$(dirname "$0")/../.." && pwd)"
PRESET="${1:-}"
case "$PRESET" in
  full|knowledge) cp "$VAULT/_System/Graph/$PRESET.json" "$VAULT/.obsidian/graph.json"; echo "✅ graph.json ← $PRESET (그래프 뷰를 다시 여세요)";;
  *) echo "사용법: $0 <full|knowledge>"; exit 1;;
esac
