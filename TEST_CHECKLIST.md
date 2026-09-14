# Noura 0.15 – iPhone Abnahmecheckliste

## 1. Erster Start / Profil
- [ ] Einrichtung vollständig durchlaufen
- [ ] Name ändern → Initialen oben rechts aktualisieren sich
- [ ] Profilbild wählen / ändern / entfernen
- [ ] alle Tracking-Bereiche im Profil an-/abschaltbar
- [ ] Zyklusdaten (letzte Periode, Zyklus-/Periodenlänge) änderbar

## 2. Startseite
- [ ] keine gequetschten Karten auf kleinem iPhone
- [ ] Tagesgefühl verständlich, keine medizinische Wertung
- [ ] wichtigste Erkenntnis passt auf die Karte
- [ ] Wochenrückblick erscheint erst bei ausreichenden Daten
- [ ] Warnsignal-Karte erscheint bei Testdaten mit Blut im Stuhl / hoher Temperatur

## 3. Eintragen
- [ ] + Sheet ist kompakt und vollständig scrollbar/sichtbar
- [ ] Noura erzählen → Entwurf → einzelne Teile änderbar → Speichern
- [ ] Spracheingabe startet/stoppt verständlich
- [ ] Essensfoto → KI-Entwurf → bestätigen
- [ ] manuelle Mahlzeit / Beschwerden / Beobachtung / Stuhlgang / Zyklus
- [ ] Medikamente/Supplements
- [ ] Körperdaten speichern keine leeren Standardwerte

## 4. Essen
- [ ] Lebensmittelsuche online und Offline-Fallback
- [ ] Barcode → Produkt gefunden → Menge → hinzufügen
- [ ] unbekannter Barcode zeigt verständliche Alternative
- [ ] Favorit setzen
- [ ] Mahlzeit wiederholen
- [ ] eigenes Gericht speichern / erneut nutzen

## 5. Tagebuch
- [ ] Tagesnavigation vor/zurück/heute
- [ ] Suche
- [ ] Eintrag öffnen, bearbeiten, Datum/Uhrzeit ändern
- [ ] löschen → Rückgängig
- [ ] nach iCloud-Sync bleibt gelöschter Eintrag gelöscht

## 6. Insights / KI
- [ ] Standardansicht kurz und verständlich
- [ ] „Warum sagt Noura das?“ zeigt Belege, Unsicherheit, Mitfaktoren
- [ ] Provider/Modell/Scope/Datenumfang vor KI-Anfrage sichtbar
- [ ] KI-Nutzungsprotokoll zeigt nur Metadaten
- [ ] „Hilfreich / Trifft nicht zu“ funktioniert
- [ ] bei medizinischem Warnsignal keine Selbstexperiment-Empfehlung

## 7. Apple Health
### Kostenloser Build
- [ ] Health Export ZIP importieren
- [ ] Schritte/Schlaf/Gewicht etc. werden sinnvoll als Tageswerte aggregiert
- [ ] erneuter Import erzeugt keine Duplikate
### Full-Capabilities Build
- [ ] Systemdialog für Health-Berechtigungen erscheint
- [ ] nur freigegebene Werte werden synchronisiert
- [ ] direkter Sync lässt sich wiederholen ohne Duplikate

## 8. Erinnerungen
- [ ] Abend-Check-in
- [ ] Mahlzeiten-Follow-up
- [ ] Zyklus-Reminder
- [ ] Tippen auf Notification öffnet passenden Bereich

## 9. Backup / Export / Cloud
- [ ] Backup erstellen, teilen, wiederherstellen
- [ ] JSON/CSV ZIP exportieren
- [ ] Portable Export wieder importieren
- [ ] iCloud Live-Sync nur im Full-Capabilities Build aktivierbar
- [ ] Cloud Merge auf zwei Geräten / zwei lokalen Ständen prüfen

## 10. Datenschutz
- [ ] Face ID aktivieren
- [ ] App-Wechsel verdeckt sensible Inhalte
- [ ] Tagebuch löschen
- [ ] nur KI-Verbindung löschen
- [ ] alle Noura-Daten löschen

## 11. Accessibility / Layout
- [ ] iOS Textgröße auf groß stellen
- [ ] Display Zoom testen
- [ ] VoiceOver auf + Sheet, Today und Profil testen
- [ ] lange Produktnamen
- [ ] Tastatur verdeckt keine primären Buttons
- [ ] kleinere iPhones und Pro Max prüfen

## 12. Logiktests
```powershell
npm.cmd run test:logic
npm.cmd run typecheck
```
