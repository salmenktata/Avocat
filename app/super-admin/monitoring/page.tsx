import { Suspense } from 'react'
import { MonitoringClient } from './MonitoringClient'

/**
 * Dashboard Monitoring Unifié - Consolidation 6 pages
 *
 * 6 onglets :
 * 1. Overview : Métriques production temps réel
 * 2. KB Quality : Analyse qualité base de connaissances + budget OpenAI
 * 3. Providers : Matrice provider × opération
 * 4. Costs : Analyse coûts IA
 * 5. API Health : Health check clés API (ancien /api-keys-health)
 * 6. Crons & Batches : Monitoring exécution crons et batches
 *
 * Note: Wrapper avec Suspense requis pour useSearchParams() en Next.js 13+
 */

export default function MonitoringPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Chargement...</div>}>
      <MonitoringClient />
    </Suspense>
  )
}
