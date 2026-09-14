# Noura 0.15 – Architektur

## Prinzip

**Schnell erfassen → lokal strukturieren → lokal analysieren → optional KI erklären lassen.**

Die KI ist nicht die Quelle der Rohdaten und entscheidet nicht allein über Unverträglichkeiten. Noura berechnet zunächst lokale Signale mit Kontrollwerten, Gegenbeispielen und Mitfaktoren.

## Kernmodule

- `App.tsx` – Navigation, Today, Tagebuch, Tracking, Insights, KI, Profil/Einstellungen
- `src/storage.ts` – verschlüsselter Store, Migration, Tombstones, Cloud-Merge
- `src/analysis.ts` – lokale Signal-/Qualitäts-/Zyklus-/Confounder-Analyse
- `src/medicalSafety.ts` – lokale nicht-diagnostische Warnsignal-Logik
- `src/ai.ts` – BYOK Provider, Modelllisten, strukturierte KI-Ausgaben, Transmission Preview
- `src/aiUsage.ts` – lokales Metadatenprotokoll der KI-Aufrufe
- `src/foodLookup.ts` / `foodGroups.ts` – Produktdaten, Offline-Katalog, Normalisierung
- `src/appleHealth.ts` – Apple-Health-Exportimport
- `src/healthKitLive.ts` – optionaler direkter HealthKit-Sync
- `src/cloudSync.ts` – optionaler CloudKit-Snapshot-Sync
- `src/dataExport.ts` – JSON/CSV Portable Export + Import
- `src/backup.ts` – lokaler Backup-Snapshot + Restore
- `src/reminders.ts` – lokale Erinnerungen
- `src/weeklyReview.ts` – lokale 7-Tage-Zusammenfassung
- `src/healthReport.ts` – PDF-Bericht
- `src/shortcuts.ts` – Deep Links für Apple Kurzbefehle/Siri

## Datenfluss KI

1. Nutzer erfasst Daten manuell, per Barcode, Suche, Foto oder Sprache.
2. Noura speichert lokal verschlüsselt.
3. `analysis.ts` erzeugt lokale Signale.
4. Nutzer entscheidet über Datenfreigabe und Scope.
5. Vor dem Senden zeigt die UI Anbieter, Modell, Zeitraum und ungefähren Umfang.
6. Die eigene KI liefert strukturiertes JSON: Headline, Summary, Findings, Next Steps, Details.
7. Warnsignale aus `medicalSafety.ts` werden zusätzlich in den Prompt aufgenommen.

## Cloud-Merge

Einträge besitzen `updatedAt`. Löschungen werden als Tombstones gespeichert. Beim Merge gewinnt der neuere Stand; Tombstones verhindern Wiederauferstehung gelöschter Einträge. Der komplette Snapshot wird in CloudKit in mehrere Records aufgeteilt.

## Native Capabilities

`app.config.js` aktiviert HealthKit und CloudKit nur über Umgebungsvariablen:

- `NOURA_ENABLE_HEALTHKIT=1`
- `NOURA_ENABLE_ICLOUD=1`

Dadurch bleibt der kostenlose Sideload-Build capability-arm, während ein separater Full-Capabilities-Workflow vorhanden ist.

## Grenzen

- keine Diagnosefunktion
- kein Ersatz für medizinische Abklärung
- HealthKit/CloudKit benötigen passende Apple-Provisionierung
- keine OTA-/EAS-Updates (bewusste Produktentscheidung in diesem Stand)
