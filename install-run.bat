@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js/npm not found. Install Node.js from https://nodejs.org and try again.
  pause
  exit /b 1
)

call npm install
if errorlevel 1 goto :fail

call npm run build
if errorlevel 1 goto :fail

echo.
echo Starting server. Open http://localhost:4000 in your browser.
echo Press Ctrl+C to stop.
echo.

call npm run server
goto :eof

:fail
echo Something failed. See messages above.
pause
exit /b 1
