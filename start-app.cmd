@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing app dependencies...
  call npm install --prefer-offline --no-audit --no-fund
  if errorlevel 1 exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-app.ps1"
if errorlevel 1 pause
