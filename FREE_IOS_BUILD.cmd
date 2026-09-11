@echo off
setlocal
cd /d "%~dp0"
echo.
echo Noura - kostenloser iOS Sideload Build
echo ======================================
echo.
echo Dieser Build wird ueber GitHub Actions auf macOS erzeugt.
echo Danach installierst du die IPA mit AltStore Classic / AltServer.
echo.
echo Anleitung: INSTALL_FREE_IOS_WINDOWS.md
echo.
if exist .git (
  echo Git repository erkannt.
  echo.
  git status --short
) else (
  echo Noch kein Git-Repository in diesem Ordner erkannt.
  echo Folge bitte zuerst Teil A der Anleitung.
)
echo.
pause
