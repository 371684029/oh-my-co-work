@echo off
rem Keep this file ASCII-only and CRLF: cmd.exe seeks the next line by byte
rem offset, so multibyte text plus "chcp 65001" truncates later lines.
rem User-facing Chinese messages live in start.mjs instead.
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [acw] Node.js not found. Please install Node.js 18+ from https://nodejs.org
  pause
  exit /b 1
)
node start.mjs
if errorlevel 1 pause
