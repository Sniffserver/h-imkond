#!/usr/bin/env bash
set -e

echo "=== [1/3] Typechecking TypeScript ==="
npm run typecheck

echo "=== [2/3] Running App Build ==="
npm run build

echo "=== [3/3] Verification Passed Successfully ==="
