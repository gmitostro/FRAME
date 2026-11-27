# Testing

## How to run

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run build
```

```bash
npm run e2e
```

`npm run e2e` needs a build first. It runs five suites: `e2e/smoke.cjs` (full flow), `e2e/timer.cjs` (rest timer reliability), `e2e/layout.cjs` (four screen sizes and the summary) `e2e/data.cjs` (v0.3 data capture and pre-v0.3 compatibility) and `e2e/backup.cjs` (backup reminder). `SHOTS=1 node e2e/smoke.cjs` saves screenshots to `e2e/shots/`.

## Unit and persistence tests (Vitest, 71 tests)

| File | Covers |
|---|---|
| `tests/timer.test.ts` | Remaining time from timestamps, long background gaps, pause/resume, double pause, +15/+30 s including after overrun; "Reiniciar" scenarios A–E (+30, +15, accumulated, none, paused), overrun without a late alert, legacy timers |
| `tests/progression.test.ts` | Every double-progression branch, RIR tolerance, technique flag, incomplete sets, reps below range, step size by body region and equipment, step above 10% |
| `tests/duration.test.ts` | Empty workout, breakdown (work, rest, warm-ups, transition), rest override clamped to minimum, ±5 min target band |
| `tests/load.test.ts` | Library overrides point to real exercises, equipment defaults, library exceptions, user fields win, FRFB V1 fully classified, weight meaning; session snapshots (start, substitution, added exercise); RIR origin on working sets only; edits keep or set the origin; legacy sets stay unknown; program files validate the optional fields |
| `tests/session.test.ts` | "Reiniciar" while the workout is paused (stays paused, resumes with the workout), Workout pause vs. a manually paused timer, logging a set while paused, recorded rest excluding pauses and legacy sets, set edit and delete (timer cleared), records of the day |
| `tests/prefill.test.ts` | Warm-up vs working order, history warm-ups, suggested load, repeat of the session's last set, no-history fallback |
| `tests/program.test.ts` | FRFB V1 validates against the library, weekly direct sets match the ficha's summary, estimated durations, invalid ficha rejection, import replaces workouts without touching history, export/import round-trip with custom exercises |
| `tests/data.test.ts` | Database seed (library, FRFB V1, settings), seed sync preserving user edits, template editing with clamping, live-session persistence across a new DB connection (reload), a second active session blocked, history snapshot unaffected by template edits, substitution in place and after logged sets, pause excluded from workout time and rest, backup round-trip and rejection of invalid/newer files |

Persistence tests run against `fake-indexeddb`, a spec-compliant in-memory IndexedDB.

## End-to-end (`e2e/smoke.cjs`)

The test runs Chromium emulating an iPhone 13 (390×844, touch) against the production build served by `vite preview`. It checks:

1. Home loads in pt-BR with today's workout.
2. FRFB V1 is loaded (6/6/5/6 exercises); a new workout starts with no exercises.
3. Exercises are added and the duration estimate is shown.
4. The workout starts.
5. Warm-ups are logged with typed loads and do not start the timer.
6. A working set starts the 3:00 rest timer.
7. A page reload keeps the sets and the timer running.
8. +30 s, pause and resume work.
9. The next set is pre-filled with the last load.
10. The exercise completes and the next exercise opens.
11. The workout finishes and the summary is shown.
12. The history shows the session with its sets.
13. The next session suggests 82,5 kg (+2,5 kg, 3,1%) after 2 × 10 at 80 kg, RIR 2.
14. The session is discarded.
15. The priority filter in the library works.
16. The program (ficha) and a full backup are exported and their JSON validated.
17. The app reloads offline from the service worker cache.
18. No English UI strings appear on the five main screens (heuristic).
19. There are no console errors.

## Rest timer e2e (`e2e/timer.cjs`)

Chromium, iPhone 13 viewport, Playwright-controlled clock. Web Audio and Wake Lock are instrumented to count alert attempts and lock requests; this proves the app *tries*, not that a phone played a sound.

1. Wake lock kept when leaving the workout screen.
2. Rest-end alert fires while the Home tab is open; banner shows the overrun.
3. No repeated alert when returning to the workout.
4. +30 s after the end counts from now and alerts again.
5. Real-use repro: 2:00 → 20 s → 1:40 → +30 s → 2:10 → +15 s → 2:25 → Reiniciar → 1:40, checked on screen and in the IndexedDB state (start and pauses unchanged). Then 5 min paused without change, Reiniciar while paused stays paused, resume continues.
6. A timer paused by the user stays paused when the workout is resumed.
7. A 10-minute clock jump (JavaScript not running, as when the phone is locked): overrun computed from timestamps, no late beep.
8. Reload during rest keeps the remaining time.
9. Finishing the workout releases the wake lock.
10. No console errors.

## Layout e2e (`e2e/layout.cjs`)

On iPhone SE (375×667), 13 mini (375×812), 13 (390×844) and Pro Max (430×932), the test uses the tallest case: suggestion, note and warm-ups. It checks:
- the "Concluir" button is visible on open, after warm-ups and with the timer showing;
- the exercise name is visible on open;
- on screens 800 px or taller, there is no automatic scroll;
- the next exercise opens at the top.

On the iPhone 13 it also checks the summary: record of the day, duration estimate and skipped exercises.

Measured automatic scroll on iPhone SE (after warm-ups / with timer):

| Version | After warm-ups | With timer |
|---|---|---|
| 0.2.1 | 296 px | 296 px |
| 0.2.2 | 12 px | 94 px |

On the mini, the 13 and the Pro Max it dropped from 151 px, 99 px and 0 px to 0 px.

## Data e2e (`e2e/data.cjs`, v0.3)

1. Library detail shows the classification (Remada unilateral: external, per dumbbell, unilateral, reps).
2. A custom exercise saved as "assisted".
3. Logger captions "Carga por halter (kg)" and "Reps por lado"; the pre-filled RIR shown as a suggestion; IndexedDB stores `default` for an untouched RIR and `user` for a tapped one; the session stores the classification snapshot.
4. Set edit: reps-only keeps `default`, choosing an RIR stores `user`.
5. Captions "Assistência (kg)" and "Carga adicional (kg)", and no weight field for Roda abdominal (stored 0 kg).
6. A backup stripped of every v0.3 field (as an older app wrote it) restores: unknown fields stay unknown, captions fall back to the library, new sets record their origin.
7. No console errors.

Backup compatibility is also unit-tested in `tests/data.test.ts` (round-trip of the new fields and restore of a pre-v0.3 backup).


## Backup reminder e2e (`e2e/backup.cjs`)

1. Fresh app: no reminder on Início; Ajustes says no backup was exported.
2. A finished workout without any backup shows the reminder; "Exportar backup agora" downloads a valid `frame-backup` with that workout and the reminder goes away; Ajustes shows "Último backup: hoje".
3. A backup 8 days old with workouts after it shows "Último backup há 8 dias" with the number of workouts not in it, on Início and in Ajustes.
4. A backup 3 days old shows no reminder, even with newer workouts.

The rule itself (`src/domain/backup.ts`) is unit-tested in `tests/backup-reminder.test.ts`; recording and restoring the last backup time in `tests/data.test.ts`.

## Results, 26/11/2026 (v0.3.0-alpha.1)

| Check | Result |
|---|---|
| TypeScript (`tsc -b`, strict) | Pass, 0 errors |
| Lint (oxlint) | Pass, 0 errors; 2 dev-only fast-refresh warnings |
| Unit and persistence | 71/71 pass |
| Production build + service worker | Pass |
| E2E smoke / timer / layout / data | 20 / 11 / 6 / 7 checks pass |

## Results, 25/11/2026 (v0.2.2)

| Check | Result |
|---|---|
| TypeScript (`tsc -b`, strict) | Pass, 0 errors |
| Lint (oxlint) | Pass, 0 errors; 2 warnings about dev-only fast refresh |
| Unit and persistence | 47/47 pass |
| Production build + service worker | Pass |
| E2E smoke (19 checks) | Pass |
| E2E rest timer (10 checks) | Pass |
| E2E layout, 4 sizes (6 checks) | Pass |

## Results, 24/11/2026

| Check | Result |
|---|---|
| TypeScript (`tsc -b`, strict) | Pass, 0 errors |
| Lint (oxlint) | Pass, 0 errors; 2 warnings about dev-only fast refresh |
| Unit and persistence | 36/36 pass |
| Production build + service worker | Pass |
| E2E smoke (Chromium, iPhone viewport) | Pass |

## Bugs found by testing and fixed

- An effect returned `window.scrollTo(...)`, which now returns a Promise in Chromium, and broke navigation. Fixed.
- Logged loads could be lost when typing during the save. The confirm button is now blocked until the save finishes (this also prevents double taps).
- The warm-up pre-fill ignored history when the logger rendered before history loaded. The logger now waits for history.
- The rest timer card hid the confirm button. The layout was reworked (see DECISION_LOG D-008).

## Verification status

| Area | Implemented | Browser (Chromium) | iPhone |
|---|---|---|---|
| Workout logging, persistence, reload | Yes | Tested | Not tested |
| Rest timer (foreground, any tab) | Yes | Tested (e2e, controlled clock) | Not tested |
| Rest timer after background/lock | Yes (timestamps) | Simulated by a clock jump | Not tested |
| End-of-rest sound | Yes | Attempt counted (instrumented); audio not heard | Not tested; silent switch mutes it |
| Vibration | Yes (feature-detected) | n/a | Not supported by iOS Safari |
| Keep screen on (Wake Lock) | Yes, whole workout | Requests/releases counted (instrumented) | Not tested |
| Offline | Yes | Tested | Not tested |
| PWA install | Manifest and icons | n/a | Needs HTTPS deployment |
| Notifications | No | — | — |
