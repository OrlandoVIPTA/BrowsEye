@echo off
chcp 65001 >nul
setlocal

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo Node.js wurde auf diesem Rechner nicht gefunden.
  echo.
  echo Bitte zuerst die Datei "node-installer\node-v24.18.0-x64.msi"
  echo per Doppelklick installieren, danach dieses Fenster schliessen
  echo und start.bat erneut per Doppelklick starten.
  echo.
  pause
  exit /b 1
)

echo Starte StereoVisor Splat Player...
start "StereoVisor Player Server" /min cmd /c "node "%~dp0serve.js""

timeout /t 2 /nobreak >nul
start "" "http://localhost:4173/"

echo.
echo Player laeuft unter http://localhost:4173/
echo Dieses Fenster kann geschlossen werden.
echo Das minimierte Server-Fenster (Taskleiste) muss waehrend der
echo Vorfuehrung geoeffnet bleiben - beim Schliessen stoppt der Player.
echo.
pause
