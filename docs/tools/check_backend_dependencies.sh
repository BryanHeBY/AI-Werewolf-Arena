#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ALLOW_ROOTS=(
  "backend/src/app"
  "backend/src/config"
  "backend/src/domain"
  "backend/src/engine"
  "backend/src/gateway"
  "backend/src/infra"
  "backend/src/memory"
  "backend/src/scenarios"
  "backend/src/server"
  "backend/src/v3"
)

DISALLOWED=(
  "../core"
  "../agent"
  "../ecs"
  "../llm"
  "../logger"
  "../broadcaster"
  "../../core"
  "../../agent"
  "../../ecs"
  "../../llm"
  "../../logger"
  "../../broadcaster"
)

FAIL=0
for root in "${ALLOW_ROOTS[@]}"; do
  if [ ! -d "$root" ]; then
    continue
  fi

  while IFS= read -r file; do
    for needle in "${DISALLOWED[@]}"; do
      if rg -n --fixed-strings "$needle" "$file" >/dev/null 2>&1; then
        echo "[FAIL] $file contains forbidden import prefix: $needle"
        FAIL=1
      fi
    done
  done < <(find "$root" -type f -name '*.ts' | sort)
done

if [ "$FAIL" -ne 0 ]; then
  echo "Backend dependency audit failed."
  exit 1
fi

echo "Backend dependency audit passed."
