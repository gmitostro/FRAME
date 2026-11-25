import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../data/db'
import { getActiveProgram, listTemplates } from '../data/repo'
import { withSettingsDefaults } from '../domain/defaults'
import type { Exercise, Settings } from '../domain/types'

export function useSettings(): Settings | undefined {
  const row = useLiveQuery(() => db.settings.get('singleton'), [])
  return useMemo(() => (row === undefined ? undefined : withSettingsDefaults(row)), [row])
}

export function useExercises(): Exercise[] | undefined {
  return useLiveQuery(() => db.exercises.toArray(), [])
}

export function useExerciseMap(): Map<string, Exercise> | undefined {
  const list = useExercises()
  return useMemo(() => (list ? new Map(list.map((e) => [e.id, e])) : undefined), [list])
}

export function useActiveSession() {
  // null = loaded and none; undefined = still loading
  return useLiveQuery(async () => (await db.sessions.where('status').equals('active').first()) ?? null, [])
}

export function useProgram() {
  return useLiveQuery(async () => {
    const program = await getActiveProgram()
    if (!program) return { program: null, templates: [] }
    return { program, templates: await listTemplates(program.id) }
  }, [])
}

export function useCompletedSessions() {
  return useLiveQuery(async () => {
    const rows = await db.sessions.where('status').equals('completed').toArray()
    return rows.sort((a, b) => b.startedAt - a.startedAt)
  }, [])
}

/** Re-renders every `intervalMs`; also on returning from background. */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const tick = () => setNow(Date.now())
    tick() // fresh value as soon as (re)enabled, not one interval later
    const id = window.setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [intervalMs, enabled])
  return now
}
