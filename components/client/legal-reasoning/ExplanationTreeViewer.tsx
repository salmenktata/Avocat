'use client'

/**
 * Composant ExplanationTreeViewer - Sprint 4
 *
 * Affiche un arbre décisionnel juridique (IRAC) interactif
 * avec nœuds collapsibles, sources cliquables, et export PDF/JSON
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, BookOpen, FileText, Scale, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TreeNodeCard } from './TreeNodeCard'

// =============================================================================
// TYPES
// =============================================================================

export interface SourceReference {
  id: string
  title: string
  type: 'code' | 'jurisprudence' | 'doctrine' | 'autre'
  relevance: number
  excerpt?: string
}

export interface ExplanationNode {
  id: string
  type: 'question' | 'rule' | 'application' | 'conclusion'
  content: string
  sources: SourceReference[]
  confidence: number // 0-100
  children: ExplanationNode[]
  metadata?: {
    isControversial?: boolean
    hasAlternative?: boolean
    isReversed?: boolean
  }
}

export interface ExplanationTree {
  root: ExplanationNode
  metadata: {
    totalNodes: number
    maxDepth: number
    totalSources: number
    averageConfidence: number
  }
  summary: {
    question: string
    mainRules: string[]
    conclusion: string
    language: 'fr' | 'ar'
  }
  exportFormats?: {
    markdown?: string
    json?: string
    plainText?: string
  }
}

interface ExplanationTreeViewerProps {
  tree: ExplanationTree
  onSourceClick?: (source: SourceReference) => void
  onExport?: (format: 'pdf' | 'json' | 'markdown') => void
  className?: string
}

// =============================================================================
// COMPOSANT PRINCIPAL
// =============================================================================

export function ExplanationTreeViewer({
  tree,
  onSourceClick,
  onExport,
  className = '',
}: ExplanationTreeViewerProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']))

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  const expandAll = () => {
    const allNodeIds = getAllNodeIds(tree.root)
    setExpandedNodes(new Set(allNodeIds))
  }

  const collapseAll = () => {
    setExpandedNodes(new Set(['root']))
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header avec résumé */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                Raisonnement Juridique Détaillé
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                {tree.summary.question}
              </p>
            </div>

            {/* Statistiques */}
            <div className="flex gap-2">
              <Badge variant="outline" className="h-fit">
                <FileText className="h-3 w-3 mr-1" />
                {tree.metadata.totalNodes} étapes
              </Badge>
              <Badge variant="outline" className="h-fit">
                <BookOpen className="h-3 w-3 mr-1" />
                {tree.metadata.totalSources} sources
              </Badge>
              <Badge
                variant={tree.metadata.averageConfidence >= 80 ? 'default' : 'secondary'}
                className="h-fit"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {Math.round(tree.metadata.averageConfidence)}% confiance
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Actions */}
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={expandAll}>
              <ChevronDown className="h-4 w-4 mr-2" />
              Tout Développer
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              <ChevronRight className="h-4 w-4 mr-2" />
              Tout Réduire
            </Button>

            {onExport && (
              <>
                <Separator orientation="vertical" className="h-6" />
                <Button variant="outline" size="sm" onClick={() => onExport('pdf')}>
                  Exporter PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => onExport('json')}>
                  Exporter JSON
                </Button>
              </>
            )}
          </div>

          {/* Règles principales */}
          {tree.summary.mainRules.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-sm mb-2">Règles Applicables</h4>
              <ul className="space-y-1">
                {tree.summary.mainRules.map((rule, index) => (
                  <li key={index} className="text-sm flex items-start gap-2">
                    <span className="text-primary font-semibold min-w-[20px]">{index + 1}.</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Conclusion principale */}
          <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              Conclusion
            </h4>
            <p className="text-sm">{tree.summary.conclusion}</p>
          </div>
        </CardContent>
      </Card>

      {/* Arbre décisionnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arbre de Raisonnement (IRAC)</CardTitle>
        </CardHeader>
        <CardContent>
          <TreeNodeRenderer
            node={tree.root}
            depth={0}
            expandedNodes={expandedNodes}
            onToggle={toggleNode}
            onSourceClick={onSourceClick}
          />
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================================
// COMPOSANT RÉCURSIF NŒUD
// =============================================================================

interface TreeNodeRendererProps {
  node: ExplanationNode
  depth: number
  expandedNodes: Set<string>
  onToggle: (nodeId: string) => void
  onSourceClick?: (source: SourceReference) => void
}

function TreeNodeRenderer({
  node,
  depth,
  expandedNodes,
  onToggle,
  onSourceClick,
}: TreeNodeRendererProps) {
  const isExpanded = expandedNodes.has(node.id)
  const hasChildren = node.children.length > 0

  return (
    <div className="space-y-2">
      {/* Nœud actuel */}
      <TreeNodeCard
        node={node}
        depth={depth}
        isExpanded={isExpanded}
        hasChildren={hasChildren}
        onToggle={() => hasChildren && onToggle(node.id)}
        onSourceClick={onSourceClick}
      />

      {/* Enfants (récursif) */}
      {isExpanded && hasChildren && (
        <div className="ml-6 border-l-2 border-muted pl-4 space-y-2">
          {node.children.map(child => (
            <TreeNodeRenderer
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              onSourceClick={onSourceClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// HELPERS
// =============================================================================

function getAllNodeIds(node: ExplanationNode): string[] {
  const ids = [node.id]

  node.children.forEach(child => {
    ids.push(...getAllNodeIds(child))
  })

  return ids
}
