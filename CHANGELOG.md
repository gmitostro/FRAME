# Changelog

## Unreleased

### Fixed
- Double progression on assisted exercises: the suggestion now reduces the machine assistance by one equipment step (never below 0) instead of adding assistance labeled as an increase. The reference is the most assisted set. At zero assistance the app holds and suggests the bodyweight version.

## 0.3.0-alpha.2 · 27/11/2026 · Device check

### Added
- "Verificação do aparelho" screen (Ajustes › Sobre › Verificar este aparelho) to validate alpha.1 on a real iPhone. Four guided checks:
  - **Sound:** a tone right after a tap, then one 5 s later outside a tap (as at the end of a rest); the user answers whether each was heard.
  - **Screen on:** holds a screen wake lock for 1, 2 or 5 min; fails if the screen goes off (page hidden) or the system releases the lock; a touch makes the result inconclusive.
  - **Persistent storage:** `persisted()` before and after `persist()`, a write/read probe, usage and quota, and the first time data was seen on this device.
  - **Return from background:** a 30 s countdown; measures time away, the countdown on return (from timestamps), whether iOS reloaded the page, the audio state on return, and whether sound works after the next tap.
- Results are saved per run (last 20) in the `meta` table, so they travel in the backup. Each run can be copied as text or exported as JSON (`frame-device-check`).
- Tests: 10 unit tests (`tests/deviceCheck.test.ts`) and a fifth e2e suite (`e2e/device.cjs`).

### Not changed
- Database schema, backup format, workout, timer and progression.

## 0.3.0-alpha.1 · 26/11/2026 · Data Foundation, etapa 1

### Added
- RIR origin per working set (`rirSource`: tapped by the user or pre-fill kept). The pre-filled RIR is shown outlined ("Sugerido: toque para confirmar") until tapped; logging still takes one tap.
- Load classification per exercise: load type (external, bodyweight + added, assisted, none), how the load is logged (total, per dumbbell, per side), unilateral, measure. Resolved from user edits, then the built-in library table, then the equipment, with no migration.
- Classification snapshot in every session exercise, so history keeps its meaning if the classification changes later.
- Captions in the set logger and set editor follow the classification ("Carga por halter (kg)", "Assistência (kg)", "Reps por lado"); no weight field for no-load exercises.
- Exercise form and detail show and edit the classification.
- Program files accept and validate the optional classification fields.
- Tests: 14 new unit tests and a fourth e2e suite (`e2e/data.cjs`) covering capture, captions and pre-v0.3 data.

### Not changed
- FRFB program, progression rules, history and backup format (fields are optional; old backups restore as before).

## 0.2.3 · 26/11/2026 · Reliability & Polish

### Fixed
- "Reiniciar" on the rest timer removes only manual +15/+30 s extensions and keeps the elapsed time (2:00 → 20 s → +30 s → Reiniciar = 1:40, no longer 2:00).
- "Reiniciar" while the workout is paused no longer detaches the timer from the workout pause, so resuming the workout resumes the timer again.

## 0.2.2 · 25/11/2026

### Fixed
- Rest-end alert now fires on any screen. Before, it only fired on the workout screen, and returning dropped it silently.
- Screen wake lock is kept for the whole workout instead of being released when leaving the workout screen.
- Resuming a paused workout no longer resumes a rest timer the user had paused.
- Logging a set while the workout is paused resumes the workout.
- Recorded rest between sets excludes time the workout was paused.
- "Reiniciar" returns to the prescribed rest instead of keeping +15/+30 s extensions.
- Audio is revived from the iOS "interrupted" state on the next tap.
- Changing exercise opens the next one at the top.
- Automatic scroll moves the screen only when the timer or footer would cover the button, measured from the real layout. Before, it used a fixed 150 px margin.

### Changed
- Live workout order: name, prescription, compact suggestion with last performance, set logger (set pills in its header, button "Concluir série N"), note (two lines, tap to open), logged sets, actions.
- The top-bar clock re-renders only itself, no longer the whole workout screen every second.
- Workout summary adds records of the day (recorded values only), the duration estimate and skipped exercises.
- `npm run e2e` runs three suites (smoke, timer, layout).

## 0.2.1 · 24/11/2026

### Fixed
- Exercise picker: the muscle filter chips collapsed inside the bottom sheet (flex shrink).
- Rest timer: the "rest done" label was cut by the buttons; it now reads "Concluído".

## 0.2.0 · 24/11/2026

### Added
- FRFB V1 program transcribed from the user's ficha, loaded on first run. Interpretation notes are in DECISION_LOG T-003.
- Program files (`frame-program` JSON): import, export, and reload of FRFB V1 under Settings → Programa.
- GitHub Pages deployment workflow (lint, tests and build before publishing).
- Program tests (5) and e2e checks for the seeded program and the program export.

## 0.1.0 · 24/11/2026

First working version (phases 0–4, parts of 5 and 6).

### Added
- Project foundation: React 19, TypeScript strict, Vite 8, Dexie/IndexedDB, PWA (manifest, icons, offline cache, update prompt).
- Design system: dark tokens, sage-green accent, viewfinder brand mark, mobile-first components (bottom sheets, large steppers, segmented controls, switches, toasts).
- pt-BR localization with a typed dictionary and pt-BR number, date and time formatting.
- FRFB skeleton with four empty workouts (Mon–Thu); workout editor with duration estimate.
- Live workout: pre-filled set logger, warm-ups, RIR, technique flag, set edit and delete, skip, substitute, add exercise, notes, pause and resume, finish and discard, summary.
- Timestamp-based rest timer with pause, restart, +15/+30 s, dismiss, overrun display, sound, vibration, wake lock and actual-rest tracking.
- Double-progression load suggestions with explanations.
- Exercise library (84 exercises), search, filters, custom exercises, history and recorded PRs.
- Workout history and session detail.
- Settings, JSON backup/restore and storage persistence status.
- Unit tests (31) and an iPhone-viewport e2e smoke test.
- Documentation set.
