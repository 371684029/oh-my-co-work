#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "[acw] 未检测到 Node.js，请先安装 Node.js 18+ ：https://nodejs.org"
  exit 1
fi
echo "[acw] 正在启动 apple-co-work …"
echo "[acw] 提示：关闭本窗口或 Ctrl+C 即可结束服务（关浏览器不会停）"
exec node start.mjs
