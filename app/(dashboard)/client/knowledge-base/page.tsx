/**
 * Page : /client/knowledge-base
 *
 * Explorateur de la base de connaissances juridique tunisienne
 * avec recherche sémantique, filtres avancés et métadonnées enrichies.
 *
 * Sprint 4 - Fonctionnalités Client
 * Sprint 6 - Migration React Query (simplified)
 */

import { Metadata } from 'next'
import { DocumentExplorer } from '@/components/client/kb-browser/DocumentExplorer'

// =============================================================================
// METADATA
// =============================================================================

export const metadata: Metadata = {
  title: 'Base de Connaissances | Qadhya',
  description: 'Explorez la base de connaissances juridique tunisienne avec recherche sémantique et filtres avancés',
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function KnowledgeBasePage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Base de Connaissances Juridique
        </h1>
        <p className="text-muted-foreground">
          Explorez et recherchez dans notre base de données juridique complète :
          codes, jurisprudence, doctrine et législation tunisienne.
        </p>
      </div>

      {/* Explorer - now uses React Query internally */}
      <DocumentExplorer initialResults={[]} />

      {/* Info section */}
      <div className="bg-muted/30 rounded-lg p-6 border">
        <h3 className="font-semibold mb-3">Comment utiliser l'explorateur</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
              1
            </div>
            <div>
              <strong>Recherche sémantique :</strong> Posez votre question en
              langage naturel. Le système comprend le contexte juridique et trouve
              les documents pertinents.
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
              2
            </div>
            <div>
              <strong>Filtres avancés :</strong> Affinez votre recherche par
              catégorie (codes, jurisprudence, doctrine), tribunal, chambre,
              langue et période.
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
              3
            </div>
            <div>
              <strong>Relations juridiques :</strong> Cliquez sur un document pour
              voir ses citations, les arrêts qui le citent, et les décisions
              connexes.
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
              4
            </div>
            <div>
              <strong>Tri et organisation :</strong> Triez par pertinence, date,
              titre ou nombre de citations. Basculez entre vue liste et grille.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
