import { CalendarDays, Dumbbell, History, House, Settings as SettingsIcon } from 'lucide-react'
import { useEffect } from 'react'
import { createHashRouter, NavLink, Outlet, RouterProvider, Link, useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { ToastProvider, useToast } from '../components/Toast'
import { sessionElapsedMs } from '../domain/session'
import { remainingMs } from '../domain/timer'
import { ExerciseDetailPage } from '../features/exercises/ExerciseDetailPage'
import { ExerciseFormPage } from '../features/exercises/ExerciseFormPage'
import { ExerciseLibraryPage } from '../features/exercises/ExerciseLibraryPage'
import { HistoryPage } from '../features/history/HistoryPage'
import { SessionDetailPage } from '../features/history/SessionDetailPage'
import { HomePage } from '../features/home/HomePage'
import { ProgramPage } from '../features/program/ProgramPage'
import { WorkoutEditorPage } from '../features/program/WorkoutEditorPage'
import { DeviceCheckPage } from '../features/settings/DeviceCheckPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { VolumePage } from '../features/volume/VolumePage'
import { ActiveWorkoutPage } from '../features/workout/ActiveWorkoutPage'
import { WorkoutSummaryPage } from '../features/workout/WorkoutSummaryPage'
import { formatClock, t } from '../i18n'
import { useActiveSession, useNow } from './hooks'
import { RestWatcher } from './RestWatcher'

function TabBar() {
  const tabs = [
    { to: '/', label: t('nav.home'), icon: House, end: true },
    { to: '/treinos', label: t('nav.program'), icon: CalendarDays },
    { to: '/exercicios', label: t('nav.exercises'), icon: Dumbbell },
    { to: '/historico', label: t('nav.history'), icon: History },
    { to: '/ajustes', label: t('nav.settings'), icon: SettingsIcon },
  ]
  return (
    <div className="tabbar">
      <nav aria-label="Navegação principal">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon size={22} strokeWidth={1.9} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function LiveBanner() {
  const session = useActiveSession()
  const now = useNow(1000, !!session)
  if (!session) return null
  const timer = session.restTimer
  const remaining = timer ? remainingMs(timer, now) : null
  return (
    <div className="live-banner">
      <Link to="/treino">
        <span className="pulse" />
        <span className="grow">
          <span style={{ display: 'block', fontWeight: 600 }}>{session.templateName}</span>
          <span className="xs muted">
            {session.pausedAt ? t('workout.paused') : t('home.workoutInProgress')}
          </span>
        </span>
        {remaining !== null && (
          <span className="num" style={{ fontWeight: 650, color: remaining <= 0 ? 'var(--accent)' : 'var(--text)' }}>
            {remaining > 0 ? formatClock(remaining) : `${t('timer.restDoneShort')} ${t('timer.overrun', { time: formatClock(-remaining) })}`}
          </span>
        )}
        {remaining === null && <span className="num muted">{formatClock(sessionElapsedMs(session, now))}</span>}
      </Link>
    </div>
  )
}

function Shell() {
  const session = useActiveSession()
  const location = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])
  return (
    <>
      <main className={`shell ${session ? 'with-banner' : ''}`}>
        <Outlet />
      </main>
      <LiveBanner />
      <TabBar />
    </>
  )
}

function Bare() {
  return <Outlet />
}

function PwaStatus() {
  const toast = useToast()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  useEffect(() => {
    if (needRefresh) {
      toast.show(t('pwa.updateAvailable'), { action: { label: t('pwa.update'), run: () => void updateServiceWorker(true) }, durationMs: 0 })
    }
  }, [needRefresh, toast, updateServiceWorker])
  useEffect(() => {
    const onOffline = () => toast.show(t('pwa.offline'))
    window.addEventListener('offline', onOffline)
    return () => window.removeEventListener('offline', onOffline)
  }, [toast])
  return null
}

const router = createHashRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/treinos', element: <ProgramPage /> },
      { path: '/treinos/:id', element: <WorkoutEditorPage /> },
      { path: '/exercicios', element: <ExerciseLibraryPage /> },
      { path: '/exercicios/novo', element: <ExerciseFormPage /> },
      { path: '/exercicios/:id', element: <ExerciseDetailPage /> },
      { path: '/exercicios/:id/editar', element: <ExerciseFormPage /> },
      { path: '/historico', element: <HistoryPage /> },
      { path: '/historico/:id', element: <SessionDetailPage /> },
      { path: '/ajustes', element: <SettingsPage /> },
      { path: '/volume', element: <VolumePage /> },
      { path: '/ajustes/verificacao', element: <DeviceCheckPage /> },
    ],
  },
  {
    element: <Bare />,
    children: [
      { path: '/treino', element: <ActiveWorkoutPage /> },
      { path: '/treino/resumo/:id', element: <WorkoutSummaryPage /> },
    ],
  },
])

export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <PwaStatus />
        <RestWatcher />
        <RouterProvider router={router} />
      </ToastProvider>
    </ErrorBoundary>
  )
}
