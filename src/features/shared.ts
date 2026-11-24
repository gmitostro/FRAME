import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { requestPersistentStorage } from '../data/db'
import { ActiveSessionExistsError, startSession } from '../data/repo'
import { estimateSession, type DurationEstimate } from '../domain/duration'
import type { Exercise, MuscleGroup, Settings, WorkoutTemplate } from '../domain/types'
import { unlockAudio } from '../lib/feedback'
import { t } from '../i18n'

export function templateEstimate(tpl: WorkoutTemplate, exMap: Map<string, Exercise>, settings: Settings): DurationEstimate {
  return estimateSession(tpl.exercises, (id) => exMap.get(id), settings)
}

export function templateMuscles(tpl: WorkoutTemplate, exMap: Map<string, Exercise>): MuscleGroup[] {
  const seen = new Set<MuscleGroup>()
  for (const te of tpl.exercises) {
    const m = exMap.get(te.exerciseId)?.primaryMuscle
    if (m) seen.add(m)
  }
  return [...seen]
}

export function templateSetCount(tpl: WorkoutTemplate): number {
  return tpl.exercises.reduce((n, e) => n + e.workingSets, 0)
}

export function exercisesLabel(n: number): string {
  return n === 1 ? t('home.exercisesCountOne') : t('home.exercisesCount', { n })
}

/** Starts a workout, or opens the one already running. */
export function useStartWorkout() {
  const navigate = useNavigate()
  const toast = useToast()
  return useCallback(
    async (templateId: string) => {
      unlockAudio()
      void requestPersistentStorage()
      try {
        await startSession(templateId)
        navigate('/treino')
      } catch (err) {
        if (err instanceof ActiveSessionExistsError) {
          toast.show(t('program.activeElsewhere'))
          navigate('/treino')
        } else {
          console.error(err)
          toast.show(t('errors.saveFailed'), { kind: 'error' })
        }
      }
    },
    [navigate, toast],
  )
}

/** Wraps a mutation with a localized error toast. */
export function useSafe() {
  const toast = useToast()
  return useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await fn()
      } catch (err) {
        console.error(err)
        toast.show(t('errors.saveFailed'), { kind: 'error' })
        return undefined
      }
    },
    [toast],
  )
}
