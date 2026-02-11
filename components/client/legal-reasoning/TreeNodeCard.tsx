'use client'

/**
 * Composant TreeNodeCard - Sprint 4
 *
 * Card pour un nœud de l'arbre décisionnel avec :
 * - Icône et couleur selon type
 * - Badge de confiance
 * - Sources cliquables
 * - Indicateurs (controversé, alternatif, renversé)
 */

import { ChevronDown, ChevronRight, HelpCircle, Scale, Target, CheckCircle, AlertTriangle, BookOpen } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ExplanationNode, SourceReference } from './ExplanationTreeViewer'

// =============================================================================
// TYPES
// =============================================================================

interface TreeNodeCardProps {
  node: ExplanationNode
  depth: number
  isExpanded: boolean
  hasChildren: boolean
  onToggle: () => void
  onSourceClick?: (source: SourceReference) => void
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const NODE_CONFIG = {
  question: {
    icon: HelpCircle,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Question',
  },
  rule: {
    icon: Scale,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950',
    borderColor: 'border-purple-200 dark:border-purple-800',
    label: 'Règle de Droit',
  },
  application: {
    icon: Target,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950',
    borderColor: 'border-amber-200 dark:border-amber-800',
    label: 'Application',
  },
  conclusion: {
    icon: CheckCircle,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950',
    borderColor: 'border-green-200 dark:border-green-800',
    label: 'Conclusion',
  },
}

// =============================================================================
// COMPOSANT
// =============================================================================

export function TreeNodeCard({
  node,
  depth,
  isExpanded,
  hasChildren,
  onToggle,
  onSourceClick,
}: TreeNodeCardProps) {
  const config = NODE_CONFIG[node.type]
  const Icon = config.icon

  // Badge de confiance
  const confidenceBadge = getConfidenceBadge(node.confidence)

  return (
    <Card className={`${config.borderColor} transition-all hover:shadow-md`}>
      <div className={`${config.bgColor} p-4 rounded-t-lg`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            {/* Toggle button si enfants */}
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggle}
                className="h-6 w-6 p-0 shrink-0"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Icône type */}
            <div className={`${config.color} shrink-0 mt-0.5`}>
              <Icon className="h-5 w-5" />
            </div>

            {/* Contenu */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs">
                  {config.label}
                </Badge>

                {/* Badge confiance */}
                <Badge
                  variant={confidenceBadge.variant}
                  className={`text-xs ${confidenceBadge.className}`}
                >
                  {node.confidence}% {confidenceBadge.icon}
                </Badge>

                {/* Indicateurs métadonnées */}
                {node.metadata?.isControversial && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Controversé
                  </Badge>
                )}

                {node.metadata?.hasAlternative && (
                  <Badge variant="secondary" className="text-xs">
                    Position Alternative
                  </Badge>
                )}

                {node.metadata?.isReversed && (
                  <Badge variant="destructive" className="text-xs">
                    Renversé
                  </Badge>
                )}
              </div>

              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {node.content}
              </p>
            </div>
          </div>
        </div>

        {/* Sources */}
        {node.sources.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground">
                Sources ({node.sources.length})
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {node.sources.map((source, index) => (
                <SourceBadge
                  key={source.id || index}
                  source={source}
                  onClick={onSourceClick}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

// =============================================================================
// COMPOSANT SOURCE BADGE
// =============================================================================

interface SourceBadgeProps {
  source: SourceReference
  onClick?: (source: SourceReference) => void
}

function SourceBadge({ source, onClick }: SourceBadgeProps) {
  const typeConfig = getSourceTypeConfig(source.type)

  return (
    <button
      onClick={() => onClick?.(source)}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs
        ${typeConfig.className}
        ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
        border
      `}
      disabled={!onClick}
    >
      <typeConfig.icon className="h-3 w-3" />
      <span className="font-medium">{source.title}</span>
      {source.relevance && (
        <Badge variant="secondary" className="ml-1 text-xs px-1 py-0 h-4">
          {Math.round(source.relevance * 100)}%
        </Badge>
      )}
    </button>
  )
}

// =============================================================================
// HELPERS
// =============================================================================

function getConfidenceBadge(confidence: number): {
  variant: 'default' | 'secondary' | 'destructive'
  className: string
  icon: string
} {
  if (confidence >= 80) {
    return {
      variant: 'default',
      className: 'bg-green-600 text-white',
      icon: '✓',
    }
  } else if (confidence >= 60) {
    return {
      variant: 'secondary',
      className: 'bg-amber-500 text-white',
      icon: '~',
    }
  } else {
    return {
      variant: 'destructive',
      className: 'bg-red-600 text-white',
      icon: '!',
    }
  }
}

function getSourceTypeConfig(type: SourceReference['type']): {
  icon: React.ElementType
  className: string
} {
  switch (type) {
    case 'code':
      return {
        icon: BookOpen,
        className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
      }
    case 'jurisprudence':
      return {
        icon: Scale,
        className: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
      }
    case 'doctrine':
      return {
        icon: BookOpen,
        className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
      }
    default:
      return {
        icon: BookOpen,
        className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
      }
  }
}
