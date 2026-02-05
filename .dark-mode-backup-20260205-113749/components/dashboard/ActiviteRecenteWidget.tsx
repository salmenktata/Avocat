'use client'

import Link from 'next/link'

interface ActiviteRecenteWidgetProps {
  dossiers: any[]
  factures: any[]
  documents: any[]
  echeances: any[]
}

interface Activite {
  id: string
  type: 'dossier' | 'facture' | 'document' | 'echeance'
  titre: string
  description: string
  date: Date
  lien?: string
  couleur: string
  icone: string
}

export default function ActiviteRecenteWidget({
  dossiers,
  factures,
  documents,
  echeances,
}: ActiviteRecenteWidgetProps) {
  const activites: Activite[] = []

  // Dossiers récents
  dossiers.slice(0, 3).forEach((d) => {
    activites.push({
      id: d.id,
      type: 'dossier',
      titre: `Dossier ${d.numero_dossier}`,
      description: d.objet,
      date: new Date(d.created_at),
      lien: `/dossiers/${d.id}`,
      couleur: 'bg-blue-100 text-blue-700',
      icone: '📁',
    })
  })

  // Factures récentes
  factures.slice(0, 3).forEach((f) => {
    activites.push({
      id: f.id,
      type: 'facture',
      titre: `Facture ${f.numero_facture}`,
      description: `${parseFloat(f.montant_ttc || 0).toFixed(2)} TND - ${f.statut}`,
      date: new Date(f.created_at),
      lien: `/factures/${f.id}`,
      couleur: 'bg-green-100 text-green-700',
      icone: '💰',
    })
  })

  // Documents récents
  documents.slice(0, 3).forEach((doc) => {
    activites.push({
      id: doc.id,
      type: 'document',
      titre: doc.nom_fichier,
      description: `Document ${doc.categorie || 'autre'}`,
      date: new Date(doc.created_at),
      couleur: 'bg-purple-100 text-purple-700',
      icone: '📄',
    })
  })

  // Échéances récentes
  echeances.slice(0, 3).forEach((e) => {
    activites.push({
      id: e.id,
      type: 'echeance',
      titre: e.titre,
      description: `Échéance le ${new Date(e.date_echeance).toLocaleDateString('fr-FR')}`,
      date: new Date(e.created_at),
      lien: `/echeances`,
      couleur: 'bg-orange-100 text-orange-700',
      icone: '⏰',
    })
  })

  // Trier par date décroissante
  activites.sort((a, b) => b.date.getTime() - a.date.getTime())

  // Prendre les 8 plus récentes
  const activitesRecentes = activites.slice(0, 8)

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-card-foreground mb-4">🔔 Activité récente</h2>

      {activitesRecentes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucune activité récente</p>
      ) : (
        <div className="space-y-3">
          {activitesRecentes.map((activite) => {
            const content = (
              <div className="flex items-start gap-3 rounded-lg border p-3 hover:bg-accent transition-colors">
                <span
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-lg ${activite.couleur}`}
                >
                  {activite.icone}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {activite.titre}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{activite.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRelativeTime(activite.date)}
                  </p>
                </div>
              </div>
            )

            return activite.lien ? (
              <Link key={`${activite.type}-${activite.id}`} href={activite.lien} className="block group">
                {content}
              </Link>
            ) : (
              <div key={`${activite.type}-${activite.id}`} className="block">
                {content}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatRelativeTime(date: Date): string {
  const maintenant = new Date()
  const diffMs = maintenant.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHeures = Math.floor(diffMs / (1000 * 60 * 60))
  const diffJours = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'À l\'instant'
  if (diffMins < 60) return `Il y a ${diffMins} min`
  if (diffHeures < 24) return `Il y a ${diffHeures}h`
  if (diffJours === 1) return 'Hier'
  if (diffJours < 7) return `Il y a ${diffJours} jours`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
