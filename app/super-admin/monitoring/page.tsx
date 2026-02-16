import { Suspense } from 'react'
import { MonitoringClient } from './MonitoringClient'

/**
 * Dashboard Monitoring Unifié - Consolidation 7+ pages
 *
 * 10 onglets :
 * 0. Config Système : Configuration RAG, providers embeddings, stats KB
 * 1. Overview : Métriques production temps réel
 * 2. KB Quality : Analyse qualité base de connaissances + budget OpenAI
 * 3. RAG Health : Santé système RAG (embeddings, query success, incidents) 🆕
 * 4. Doc Types : Statistiques par type de document
 * 5. Providers : Matrice provider × opération
 * 6. Costs : Analyse coûts IA
 * 7. API Health : Health check clés API
 * 8. Crons & Batches : Monitoring exécution crons et batches
 * 9. Impersonations : Log des impersonations admins
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
