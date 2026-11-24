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

`npm run e2e` needs a build first. Run it as `SHOTS=1 npm run e2e` to save screenshots to `e2e/shots/`.

## Unit and persistence tests (Vitest, 36 tests)

| File | Covers |
|---|---|
| `tests/timer.test.ts` | Remaining time from timestamps, long background gaps, pause/resume, double pause, +15/+30 s including after overrun, restart |
| `tests/progression.test.ts` | Every double-progression branch, RIR tolerance, technique flag, incomplete sets, reps below range, step size by body region and equipment, step above 10% |
| `tests/duration.test.ts` | Empty workout, breakdown (work, rest, warm-ups, transition), rest override clamped to minimum, ±5 min target band |
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
| Rest timer (foreground) | Yes | Tested | Not tested |
| Rest timer after background/lock | Yes (timestamps) | Logic unit-tested | Not tested |
| End-of-rest sound | Yes | Not verifiable headless | Not tested |
| Vibration | Yes (feature-detected) | n/a | Not supported by iOS Safari |
| Keep screen on (Wake Lock) | Yes | Not verified | Not tested |
| Offline | Yes | Tested | Not tested |
| PWA install | Manifest and icons | n/a | Needs HTTPS deployment |
| Notifications | No | — | — |
