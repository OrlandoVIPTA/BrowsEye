@echo off
cd /d "%~dp0"
if not exist "release\win-unpacked\BrowsEye Player.exe" (
  echo Der BrowsEye Player wurde noch nicht erzeugt.
  echo Bitte zuerst im Projektordner npm run package:windows ausfuehren.
  pause
  exit /b 1
)
start "" "release\win-unpacked\BrowsEye Player.exe"
