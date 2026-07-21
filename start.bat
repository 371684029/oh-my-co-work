@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [acw] 未检测到 Node.js，请先安装 Node.js 18+ ：https://nodejs.org
  pause
  exit /b 1
)
echo [acw] 正在启动 apple-co-work …
node start.mjs
if errorlevel 1 pause
