$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Noura - iPhone Installation" -ForegroundColor Magenta
Write-Host "===========================" -ForegroundColor Magenta
Write-Host ""
Write-Host "Dieser Ablauf erstellt einen eigenstaendigen iOS Preview-Build." -ForegroundColor White
Write-Host "Dafuer brauchst du eine aktive Apple Developer Program Mitgliedschaft." -ForegroundColor Yellow
Write-Host ""

Write-Host "1/5 Abhaengigkeiten installieren..." -ForegroundColor Cyan
npm.cmd install

Write-Host ""
Write-Host "2/5 Expo/EAS Login..." -ForegroundColor Cyan
npx.cmd eas-cli@latest login

Write-Host ""
Write-Host "3/5 EAS Projekt pruefen..." -ForegroundColor Cyan
npx.cmd eas-cli@latest project:info
if ($LASTEXITCODE -ne 0) {
  Write-Host "Noch kein EAS-Projekt verknuepft. Einrichtung wird gestartet..." -ForegroundColor Yellow
  npx.cmd eas-cli@latest init
}

Write-Host ""
Write-Host "4/5 iPhone registrieren..." -ForegroundColor Cyan
Write-Host "Wenn dein iPhone bereits registriert ist, kannst du den Schritt in EAS entsprechend abbrechen/ueberspringen." -ForegroundColor Gray
Write-Host "Ansonsten 'Website' waehlen und den erzeugten Link auf deinem iPhone oeffnen." -ForegroundColor Gray
npx.cmd eas-cli@latest device:create

Write-Host ""
Write-Host "5/5 Installierbaren iOS-Build erstellen..." -ForegroundColor Cyan
Write-Host "Beim ersten Mal mit deiner Apple-ID anmelden und EAS die Signierung verwalten lassen." -ForegroundColor Gray
npx.cmd eas-cli@latest build --platform ios --profile preview

Write-Host ""
Write-Host "Fertig. Oeffne nach dem Build den von EAS angezeigten Install-Link auf deinem iPhone." -ForegroundColor Green
Write-Host "Danach startet Noura direkt vom Homescreen und braucht weder Expo Go noch Metro." -ForegroundColor Green
Write-Host "Auf iOS 16+ kann fuer interne Builds zusaetzlich Entwickler-Modus erforderlich sein." -ForegroundColor Yellow
