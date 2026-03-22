@echo off
cd /d "%~dp0"
start "" http://localhost:4000
call npm run serve:ssr:dev
pause
