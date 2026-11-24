# Changelog

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
