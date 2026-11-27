import { MUSCLE_GROUPS, type Exercise, type MuscleGroup, type Settings, type WorkoutSession, type WorkoutTemplate } from './types'

/**
 * Weekly volume per muscle (Phase 6).
 *
 * - Direct sets: working sets of exercises whose primary muscle is the muscle.
 * - Indirect sets: working sets of exercises that list the muscle as secondary.
 *   Shown whole and never added to the direct count: how to weigh them
 *   (fractional counting) is still an open research question
 *   (EVIDENCE_LIBRARY.md, "Pesquisas pendentes" 2).
 * - Warm-ups never count. Sets flagged with poor technique still count: they
 *   were performed, they are only excluded from progression.
 *
 * The comparison uses direct sets only, against ≥10 weekly sets [STR-02]
 * with diminishing returns above ~20 [STR-04].
 */

export const VOLUME_REFERENCE = { min: 10, high: 20 } as const

export interface MuscleSets {
  direct: number
  indirect: number
}

export type VolumeMap = Map<MuscleGroup, MuscleSets>

export type PriorityTier = 'primary' | 'secondary' | null

/** none = 0 direct sets; below < 10; within 10–20; above > 20. */
export type VolumeStatus = 'none' | 'below' | 'within' | 'above'

export interface VolumeRow {
  muscle: MuscleGroup
  tier: PriorityTier
  planned: MuscleSets
  performed: MuscleSets
  /** Status of the planned direct sets against the reference. */
  plannedStatus: VolumeStatus
  /** Status of the performed direct sets against the reference. */
  performedStatus: VolumeStatus
}

type Lookup = (exerciseId: string) => Exercise | undefined

function add(map: VolumeMap, ex: Exercise, sets: number) {
  if (sets <= 0) return
  const p = map.get(ex.primaryMuscle) ?? { direct: 0, indirect: 0 }
  p.direct += sets
  map.set(ex.primaryMuscle, p)
  for (const m of new Set(ex.secondaryMuscles)) {
    if (m === ex.primaryMuscle) continue
    const s = map.get(m) ?? { direct: 0, indirect: 0 }
    s.indirect += sets
    map.set(m, s)
  }
}

/** Weekly sets prescribed by the workouts (one week = each workout once). */
export function plannedVolume(templates: WorkoutTemplate[], lookup: Lookup): { volume: VolumeMap; unknownSets: number } {
  const volume: VolumeMap = new Map()
  let unknownSets = 0
  for (const tpl of templates)
    for (const te of tpl.exercises) {
      const ex = lookup(te.exerciseId)
      if (ex) add(volume, ex, te.workingSets)
      else unknownSets += te.workingSets
    }
  return { volume, unknownSets }
}

/** Working sets logged in completed sessions started in [from, to). */
export function performedVolume(sessions: WorkoutSession[], lookup: Lookup, from: number, to: number): { volume: VolumeMap; unknownSets: number; sessions: number } {
  const volume: VolumeMap = new Map()
  let unknownSets = 0
  let count = 0
  for (const s of sessions) {
    if (s.status !== 'completed' || s.startedAt < from || s.startedAt >= to) continue
    count++
    for (const e of s.exercises) {
      const sets = e.sets.filter((x) => x.kind === 'working').length
      if (sets === 0) continue
      const ex = lookup(e.exerciseId)
      if (ex) add(volume, ex, sets)
      else unknownSets += sets
    }
  }
  return { volume, unknownSets, sessions: count }
}

export function volumeStatus(direct: number): VolumeStatus {
  if (direct <= 0) return 'none'
  if (direct < VOLUME_REFERENCE.min) return 'below'
  if (direct <= VOLUME_REFERENCE.high) return 'within'
  return 'above'
}

export function priorityTier(m: MuscleGroup, priorities: Settings['priorities']): PriorityTier {
  if (priorities.primary.includes(m)) return 'primary'
  if (priorities.secondary.includes(m)) return 'secondary'
  return null
}

const ZERO: MuscleSets = { direct: 0, indirect: 0 }

/**
 * One row per muscle: priorities first (primary, then secondary, in the
 * order chosen in Ajustes), then the other muscles that have any planned or
 * performed sets, in library order. Priorities always appear, even at zero.
 */
export function volumeRows(planned: VolumeMap, performed: VolumeMap, priorities: Settings['priorities']): VolumeRow[] {
  const order: MuscleGroup[] = [...priorities.primary, ...priorities.secondary.filter((m) => !priorities.primary.includes(m))]
  for (const m of MUSCLE_GROUPS) if (!order.includes(m) && (planned.has(m) || performed.has(m))) order.push(m)
  return order.map((muscle) => {
    const p = planned.get(muscle) ?? ZERO
    const d = performed.get(muscle) ?? ZERO
    return {
      muscle,
      tier: priorityTier(muscle, priorities),
      planned: { ...p },
      performed: { ...d },
      plannedStatus: volumeStatus(p.direct),
      performedStatus: volumeStatus(d.direct),
    }
  })
}
