'use client'

/**
 * Modal Détails Source - Sprint 10
 *
 * Affiche les détails d'une source juridique cliquée dans l'arbre IRAC
 * avec métadonnées, extrait pertinent, et lien vers document complet.
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { BookOpen, Calendar, Building2, FileText, Copy, ExternalLink, Star } from 'lucide-react'
import { useState } from 'react'

// =============================================================================
// TYPES
// =============================================================================

export interface SourceReference {
  id: string
  title: string
  type: 'code' | 'jurisprudence' | 'doctrine' | 'autre'
  relevance: number
  excerpt?: string
  metadata?: {
    tribunal?: string
    chambre?: string
    decisionDate?: string
    articleNumber?: string
    legalBasis?: string
  }
}

interface SourceDetailsModalProps {
  source: SourceReference | null
  isOpen: boolean
  onClose: () => void
}

// =============================================================================
// COMPOSANT PRINCIPAL
// =============================================================================

export function SourceDetailsModal({ source, isOpen, onClose }: SourceDetailsModalProps) {
  const [copied, setCopied] = useState(false)

  if (!source) return null

  const handleCopyReference = () => {
    const reference = formatCitation(source)
    navigator.clipboard.writeText(reference)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleViewDocument = () => {
    // TODO: Ouvrir KB Explorer avec ce document
    window.open(`/client/knowledge-base?doc=${source.id}`, '_blank')
  }

  const getCategoryColor = (type: string) => {
    const colors = {
      code: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
      jurisprudence: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
      doctrine: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
      autre: 'bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-300',
    }
    return colors[type as keyof typeof colors] || colors.autre
  }

  const getCategoryLabel = (type: string) => {
    const labels = {
      code: 'Code',
      jurisprudence: 'Jurisprudence',
      doctrine: 'Doctrine',
      autre: 'Autre',
    }
    return labels[type as keyof typeof labels] || 'Autre'
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-lg leading-tight pr-8">
                {source.title}
              </DialogTitle>
              <DialogDescription className="mt-2">
                Référence juridique - Pertinence {Math.round(source.relevance * 100)}%
              </DialogDescription>
            </div>
            <Badge className={getCategoryColor(source.type)}>
              {getCategoryLabel(source.type)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Score de pertinence */}
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">Pertinence</span>
            <div className="flex-1 bg-muted rounded-full h-2">
              <div
                className="bg-yellow-500 h-2 rounded-full transition-all"
                style={{ width: `${source.relevance * 100}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {Math.round(source.relevance * 100)}%
            </span>
          </div>

          <Separator />

          {/* Métadonnées */}
          {source.metadata && Object.keys(source.metadata).length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Informations</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {source.metadata.tribunal && (
                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-xs text-muted-foreground">Tribunal</p>
                      <p>{source.metadata.tribunal}</p>
                    </div>
                  </div>
                )}

                {source.metadata.chambre && (
                  <div className="flex items-start gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-xs text-muted-foreground">Chambre</p>
                      <p>{source.metadata.chambre}</p>
                    </div>
                  </div>
                )}

                {source.metadata.decisionDate && (
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-xs text-muted-foreground">Date</p>
                      <p>{new Date(source.metadata.decisionDate).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>
                )}

                {source.metadata.articleNumber && (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-xs text-muted-foreground">Article</p>
                      <p>{source.metadata.articleNumber}</p>
                    </div>
                  </div>
                )}
              </div>

              {source.metadata.legalBasis && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="font-medium text-xs text-muted-foreground mb-1">Base légale</p>
                  <p className="text-sm">{source.metadata.legalBasis}</p>
                </div>
              )}
            </div>
          )}

          {/* Extrait pertinent */}
          {source.excerpt && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Extrait Pertinent</h4>
                <div className="bg-accent/30 rounded-lg p-4 border border-accent">
                  <p className="text-sm leading-relaxed">{source.excerpt}</p>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyReference} className="flex-1">
              <Copy className="h-4 w-4 mr-2" />
              {copied ? 'Référence copiée !' : 'Copier référence'}
            </Button>
            <Button variant="default" size="sm" onClick={handleViewDocument} className="flex-1">
              <ExternalLink className="h-4 w-4 mr-2" />
              Voir document complet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// HELPERS
// =============================================================================

function formatCitation(source: SourceReference): string {
  const parts: string[] = []

  if (source.type === 'jurisprudence' && source.metadata) {
    // Format : Tribunal, Chambre, Date, Titre
    if (source.metadata.tribunal) parts.push(source.metadata.tribunal)
    if (source.metadata.chambre) parts.push(source.metadata.chambre)
    if (source.metadata.decisionDate) {
      parts.push(new Date(source.metadata.decisionDate).toLocaleDateString('fr-FR'))
    }
    parts.push(source.title)
  } else if (source.type === 'code' && source.metadata?.articleNumber) {
    // Format : Code, Article X
    parts.push(source.title)
    parts.push(`Article ${source.metadata.articleNumber}`)
  } else {
    // Format simple
    parts.push(source.title)
  }

  return parts.join(', ')
}
