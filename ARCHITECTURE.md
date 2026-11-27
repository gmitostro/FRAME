# Architecture

## Stack

| Concern | Choice | Why |
|---|---|---|
| UI | React 19 + TypeScript 7 (strict) | Requested stack; typed models end to end |
| Build | Vite 8 | Fast, simple config |
| Storage | IndexedDB via Dexie 4 (+ dexie-react-hooks) | Versioned schema with upgrade hooks, indexes, transactions, live queries; ~30 KB gz |
| State | IndexedDB is the source of truth; `useLiveQuery` re-renders on change | No separate state store to keep in sync; every action is persisted immediately |
| Routing | React Router 7, hash router | Works on any static host or sub-path without rewrites |
| PWA | vite-plugin-pwa (Workbox `generateSW`, `registerType: 'prompt'`) | Precache for offline use; updates wait for the user ("Atualizar") so a workout is never reloaded mid-set |
| Icons | lucide-react (tree-shaken) | Consistent line icons |
| Styling | Plain CSS with design tokens (`src/styles/tokens.css`) | No runtime cost, easy theming |
| Tests | Vitest + fake-indexeddb; Playwright script for e2e | Logic and persistence tested without a browser; real interaction tested in Chromium |
| Lint | oxlint (Vite template default) | Fast; includes React hooks rules |

No backend, no analytics, no paid APIs.

## Layout

```
src/
  domain/      pure training logic, no React, no storage
    types.ts         data model
    defaults.ts      default settings (rest profiles, duration model)
    timer.ts         rest timer maths (timestamps only)
    progression.ts   double progression engine
    duration.ts      session duration estimate
    session.ts       live-workout state transitions (pure)
    records.ts       recorded personal records
    week.ts          calendar helpers (Monday-first weeks)
  data/        the only code that touches IndexedDB
    db.ts            Dexie schema, versions, seeding, persistent storage
    repo.ts          repository functions (settings, exercises, templates, sessions)
    backup.ts        export / validate / restore
    seed/            exercise library and empty FRFB skeleton
  i18n/        pt-BR dictionary + typed t() + pt-BR formatters
  components/  shared UI (Sheet, Stepper, Switch, Toast, PageHeader, ErrorBoundary)
  features/    screens: home, program, workout, exercises, history, settings
  app/         App shell, router, data hooks
  lib/         id generation, sound/vibration/wake lock, file download
tests/         unit and persistence tests
e2e/           Playwright smoke test
```

Training rules live in `src/domain`. UI components call them and never hold rules of their own.

## Data flow

1. A screen reads data with `useLiveQuery` (via `app/hooks.ts`).
2. A user action calls a repository function. Live-workout actions go through `mutateSession(id, fn)`, which reads, applies a pure function from `domain/session.ts`, and writes inside one IndexedDB transaction. Two quick taps cannot overwrite each other.
3. Dexie notifies live queries and the screen re-renders.

## Data model (summary)

- `Exercise`: pt-BR/EN names, primary/secondary muscles, equipment, movement pattern, category, rest profile, smallest load step, lower-body flag, notes, `isCustom`.
- `Program` and `WorkoutTemplate`: name, weekday (0 = Sunday), order, notes. Each `TemplateExercise` holds working sets, warm-up sets, rep range, RIR target and a rest override.
- `WorkoutSession`: status (`active` | `completed` | `discarded`), start/end, pause bookkeeping, current exercise, `restTimer`, and `exercises[]`. Each entry stores a **snapshot** of the name and prescription, its status and its `SetLog[]`. Editing or deleting a template never changes history. `exerciseIds` is a multi-entry index for exercise history queries.
- `SetLog`: kind (`warmup` | `working`), load, reps, RIR, `rirSource` (`user` = tapped, `default` = pre-fill kept; absent = logged before v0.3, unknown), technique flag, timestamp, actual rest before the set.
- `SessionExercise.loadProfile`: snapshot of the exercise's load classification when the session ran (absent before v0.3).

### Load classification (v0.3)

`Exercise.loadType`, `loadBasis`, `unilateral` and `measure` are optional. The effective value is resolved by `domain/load.ts` in this order:
1. explicit fields saved on the exercise (set when the user edits it in the form);
2. the built-in library table (`LIBRARY_LOAD_OVERRIDES`, e.g. unilateral rows);
3. the equipment default: `bodyweight` → bodyweight, `band` → none, else external; dumbbell/kettlebell → per dumbbell, else total.

The table lives in code, so corrections reach existing installs without a migration. What the logged weight means:

| Classification | Logged weight |
|---|---|
| external · total | total load: barbell + plates, machine or cable stack |
| external · perDumbbell | one dumbbell |
| external · perSide | plates on one side |
| bodyweight | added load only (0 = body only) |
| assisted | machine assistance |
| none | not logged (stored as 0) |

`unilateral` means load and reps are per side. `measure: 'time'` exists in the model but time cannot be logged yet. Each session stores a snapshot (`SessionExercise.loadProfile`) so history keeps the meaning it had when it was logged; sessions from before v0.3 fall back to the current classification.
- `Settings`: singleton.

## Rest timer

**State** (`domain/timer.ts`, stored in the active session):
- `{ startedAt, durationMs, baseDurationMs, pausedAt, pausedMs, alerted }`.
- Remaining time is always `duration − (now − startedAt − pausedMs)`. It is never a decrementing counter, so it is correct after backgrounding, screen lock or reload.
- +15/+30 s only increase `durationMs` (after the end they count from "now").
- "Reiniciar" removes every manual extension by restoring `durationMs = baseDurationMs`. It leaves `startedAt`, `pausedAt` and `pausedMs` untouched, so elapsed time stays elapsed and the pause state is preserved. Example: 2:00, 20 s pass (1:40), +30 s (2:10), Reiniciar → 1:40.

**Display** (`features/workout/RestTimerDock.tsx`):
- Ticks every 250 ms only to refresh the digits, and recomputes on `visibilitychange`/`focus`.
- Display and controls only; it holds no alert logic.

**Alert, wake lock and audio** (`app/RestWatcher.tsx`, mounted once at the app root):
- Works on every screen. It schedules one `setTimeout` for the exact end time and re-checks when the app becomes visible.
- An end seen within 5 s plays two tones (and vibrates where supported). A missed end never plays late: the screen shows the overrun.
- Each alert marks only the timer instance that produced it.
- The screen wake lock is held for the whole active workout and re-acquired when the app returns to the foreground.
- Any tap revives the audio context (iOS needs a gesture and can leave it "interrupted").

**Workout pause:**
- Pausing the workout also pauses a running timer.
- Resuming resumes only a timer that the workout pause paused; a timer the user paused stays paused.
- Logging a set resumes a paused workout.
- Recorded rest (`restBeforeSec`) excludes paused time, via `SetLog.pausedMsAt`.

## iOS / PWA platform limits

Verified in browsers, still to be confirmed on a physical iPhone:

| Capability | iOS installed PWA | What FRAME does |
|---|---|---|
| JavaScript in background or with the screen locked | Suspended | Timers stop; time is recomputed from timestamps on return |
| Sound at rest end while backgrounded or locked | Not possible from the page | No late beep; overrun shown on return |
| Sound in foreground | Web Audio; needs a prior tap; muted by the silent switch | Unlocked on any tap; revived from "interrupted" |
| Vibration API | Not available in Safari | Feature-detected; no effect on iPhone |
| Screen Wake Lock | Available in recent iOS; behaviour in installed web apps has varied between iOS versions | Requested during the workout; must be checked on the device |
| Scheduled local notifications | Not available (no Notification Triggers) | None |
| Web Push (iOS 16.4+, installed app, permission) | Needs a push server to send the message | Not implemented. A server cannot time a rest alert reliably to the second, so it suits training reminders (Phase 9), not rest alarms |

## Storage, migrations and backup

- Schema version 1 lives in `db.ts`. Every change adds `db.version(n).stores(...).upgrade(...)` and never edits an old version.
- The library seed has its own version (`meta.exerciseSeedVersion`). New built-in exercises are added on startup without touching ones the user edited.
- `navigator.storage.persist()` is requested at startup and when a workout starts.
- **Backup format** (`frame-backup`, version 1):

  ```json
  { "format": "frame-backup", "version": 1, "app": "FRAME", "exportedAt": "ISO date",
    "data": { "exercises": [], "programs": [], "templates": [], "sessions": [], "settings": [], "meta": [] } }
  ```

  Restore validates the format, the version (it rejects newer versions) and every record's shape before touching the database, then replaces all tables in one transaction. A failed restore changes nothing.
- **Backup reminder.** Exporting records `meta.lastBackupAt` (ms). Restoring sets it to the file's `exportedAt`, since the data then matches that file. Início shows a reminder with an "Exportar backup agora" shortcut when at least one finished workout ended after the last backup and the last backup is 7 days old or older (or there was never one); Ajustes shows the last backup date. The rule is `backupStatus()` in `src/domain/backup.ts`. Limitation: on iOS the export opens the share sheet, and the app cannot tell if it was cancelled, so the time is recorded when the file is handed over.

## Program files ("fichas")

Programs without history are moved around as `frame-program` JSON (`src/data/program.ts`):

```json
{ "format": "frame-program", "version": 1, "name": "FRFB V1",
  "customExercises": [ { "id": "...", "namePt": "...", "primaryMuscle": "lats", "...": "..." } ],
  "workouts": [ { "name": "Frame A", "weekday": 1, "notes": "...",
    "exercises": [ { "exerciseId": "puxada-neutra", "workingSets": 3, "warmupSets": 2, "repMin": 6, "repMax": 8, "rirTarget": 2, "restSec": 180, "notes": "..." } ] } ] }
```

`weekday` uses 0 = Sunday … 6 = Saturday, or null. `exerciseId` must be a library id or a `customExercises` id. Validation runs before anything is written. Applying a file replaces the active program's workouts in one transaction and leaves sessions alone. The FRFB V1 file is bundled (`src/data/seed/frfb-v1.ts`) and seeds the first run.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`: `npm ci`, lint, unit tests, build, then publishes `dist/` to GitHub Pages at `https://gmitostro.github.io/FRAME/`.

## Dependencies

Runtime: react, react-dom, react-router-dom, dexie, dexie-react-hooks, lucide-react.
Dev: vite, @vitejs/plugin-react, vite-plugin-pwa, typescript, oxlint, vitest, fake-indexeddb, jsdom. Playwright is preinstalled in the environment and is not a project dependency.

## Technical limitations

- No iPhone/WebKit testing yet (Chromium emulation only).
- Background alerts are not possible without push infrastructure; see "iOS / PWA platform limits".
- No sync between devices. The backup file is the only way to move data.
