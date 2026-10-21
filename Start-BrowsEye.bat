@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Bitte zuerst Node.js installieren. Der Installer liegt im bisherigen StereoVisor-Player-Ordner.
  pause
  exit /b 1
)
if not exist dist\index.html (
  echo Bitte zuerst npm install und npm run build ausfuehren.
  pause
  exit /b 1
)
start "" http://localhost:4174
node server.mjs
pause
