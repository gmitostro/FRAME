import type { Exercise, MuscleGroup } from '../../domain/types'

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function matchesQuery(ex: Exercise, q: string): boolean {
  const n = normalize(q)
  if (!n) return true
  const hay = normalize(`${ex.namePt} ${ex.nameEn ?? ''}`)
  return n.split(/\s+/).every((w) => hay.includes(w))
}

export function byName(a: Exercise, b: Exercise): number {
  return a.namePt.localeCompare(b.namePt, 'pt-BR')
}

/** Substitution candidates: same muscle and movement first, then same muscle. */
export function substitutionCandidates(target: Pick<Exercise, 'id' | 'primaryMuscle' | 'pattern'>, all: Exercise[]): { suggested: Exercise[]; others: Exercise[] } {
  const pool = all.filter((e) => !e.archived && e.id !== target.id)
  const score = (e: Exercise) => (e.primaryMuscle === target.primaryMuscle ? 2 : 0) + (e.pattern === target.pattern ? 1 : 0)
  const suggested = pool.filter((e) => score(e) >= 2).sort((a, b) => score(b) - score(a) || byName(a, b))
  const ids = new Set(suggested.map((e) => e.id))
  return { suggested, others: pool.filter((e) => !ids.has(e.id)).sort(byName) }
}

export function filterExercises(all: Exercise[], q: string, muscle: MuscleGroup | null): Exercise[] {
  return all.filter((e) => !e.archived && (!muscle || e.primaryMuscle === muscle || e.secondaryMuscles.includes(muscle)) && matchesQuery(e, q)).sort(byName)
}
