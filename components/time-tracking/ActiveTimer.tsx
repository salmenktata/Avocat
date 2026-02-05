'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { stopTimerAction } from '@/app/actions/time-entries'
import type { ActiveTimer as ActiveTimerType } from '@/types/time-tracking'

interface ActiveTimerProps {
  timer: ActiveTimerType
}

export default function ActiveTimer({ timer: initialTimer }: ActiveTimerProps) {
  const router = useRouter()
  const [timer, setTimer] = useState<ActiveTimerType | null>(initialTimer)
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!timer) return

    // Calculer le temps écoulé initial
    const start = new Date(`${timer.date}T${timer.heure_debut}`)
    const now = new Date()
    const initialElapsed = Math.floor((now.getTime() - start.getTime()) / 1000)
    setElapsed(initialElapsed)

    // Mettre à jour chaque seconde
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [timer])

  const handleStop = async () => {
    if (!timer) return

    setLoading(true)
    const result = await stopTimerAction(timer.id)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setTimer(null)
    router.refresh()
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  if (!timer) return null

  const clientName = timer.dossiers?.clients
    ? timer.dossiers.clients.type_client === 'PERSONNE_PHYSIQUE'
      ? `${timer.dossiers.clients.nom} ${timer.dossiers.clients.prenom || ''}`.trim()
      : timer.dossiers.clients.nom
    : ''

  return (
    <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-4 shadow-lg">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-semibold text-orange-900">
              Timer en cours
            </span>
          </div>

          <h3 className="text-lg font-semibold text-foreground">{timer.description}</h3>

          <p className="mt-1 text-sm text-muted-foreground">
            📁 {timer.dossiers?.numero} - {clientName}
          </p>

          <div className="mt-3 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-2xl font-mono font-bold text-orange-700">
                {formatTime(elapsed)}
              </span>
            </div>

            <div className="text-sm text-muted-foreground">
              Démarré à {timer.heure_debut}
            </div>
          </div>
        </div>

        <button
          onClick={handleStop}
          disabled={loading}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? '⏹️ Arrêt...' : '⏹️ Arrêter'}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-md bg-red-100 p-2 text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  )
}
