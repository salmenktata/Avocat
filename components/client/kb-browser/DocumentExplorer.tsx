'use client'

import { useState, useCallback, useEffect } from 'react'
import { Search, Filter, Grid3x3, List, SortAsc, ChevronDown, AlertCircle, Loader2 } from 'lucide-react'
import { getCategoriesForContext, LEGAL_CATEGORY_TRANSLATIONS, LEGAL_CATEGORY_COLORS } from '@/lib/categories/legal-categories'
import type { LegalCategory } from '@/lib/categories/legal-categories'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DocumentDetailModal } from './DocumentDetailModal'
import { useRAGSearchMutation } from '@/lib/hooks/useRAGSearch'
import type { RAGSearchResult as APISearchResult } from '@/lib/hooks/useRAGSearch'

// =============================================================================
// TYPES
// =============================================================================

export interface SearchResultItem {
  kbId: string
  title: string
  category: string
  similarity: number
  chunkContent?: string
  metadata: {
    tribunalCode?: string | null
    tribunalLabelAr?: string | null
    tribunalLabelFr?: string | null
    chambreCode?: string | null
    chambreLabelAr?: string | null
    chambreLabelFr?: string | null
    decisionDate?: string | null
    decisionNumber?: string | null
    legalBasis?: string[] | null
    extractionConfidence?: number | null
    citesCount?: number
    citedByCount?: number
    [key: string]: unknown
  }
  relations?: {
    cites?: Array<{ relationType: string; relatedTitle: string; relatedCategory: string; context: string | null; confidence: number | null }>
    citedBy?: Array<{ relationType: string; relatedTitle: string; relatedCategory: string; context: string | null; confidence: number | null }>
    supersedes?: Array<{ relationType: string; relatedTitle: string; relatedCategory: string; context: string | null; confidence: number | null }>
    supersededBy?: Array<{ relationType: string; relatedTitle: string; relatedCategory: string; context: string | null; confidence: number | null }>
    relatedCases?: Array<{ relationType: string; relatedTitle: string; relatedCategory: string; context: string | null; confidence: number | null }>
  }
}

export interface DocumentFilters {
  category?: string
  domain?: string
  tribunal?: string
  chambre?: string
  language?: 'fr' | 'ar' | 'bi'
}

export interface DocumentExplorerProps {
  initialCategory?: string
  initialQuery?: string
  onBack?: () => void
  className?: string
}

type ViewMode = 'list' | 'grid'
type SortField = 'relevance' | 'date' | 'title' | 'citations'
type SortOrder = 'asc' | 'desc'

// =============================================================================
// COMPOSANT PRINCIPAL
// =============================================================================

export function DocumentExplorer({
  initialCategory,
  initialQuery,
  onBack,
  className = '',
}: DocumentExplorerProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery || '')
  const [filters, setFilters] = useState<DocumentFilters>(
    initialCategory ? { category: initialCategory } : {}
  )
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortField, setSortField] = useState<SortField>('relevance')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [selectedDocument, setSelectedDocument] = useState<SearchResultItem | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [displayedCount, setDisplayedCount] = useState(20)

  const { mutate: search, isPending: isLoading } = useRAGSearchMutation({
    onSuccess: (data: APISearchResult) => {
      const items = (data.results || []) as SearchResultItem[]
      setResults(items)
      setError(null)
      setHasSearched(true)
      setDisplayedCount(20)
    },
    onError: (err: Error) => {
      setError(err.message || 'Erreur lors de la recherche')
      setHasSearched(true)
    },
  })

  const handleSearch = useCallback(() => {
    const query = searchQuery.trim()
    const hasCategory = !!filters.category

    if (!query && !hasCategory) return

    setError(null)
    search({
      question: query || `catégorie:${filters.category}`,
      filters: {
        category: filters.category,
        domain: filters.domain,
        tribunal: filters.tribunal,
        chambre: filters.chambre,
        language: filters.language,
      },
      limit: 50,
      includeRelations: true,
    })
  }, [searchQuery, filters, search])

  // Auto-search on initial category/query
  const [initialSearchDone, setInitialSearchDone] = useState(false)
  useEffect(() => {
    if (!initialSearchDone && (initialCategory || initialQuery)) {
      setInitialSearchDone(true)
      handleSearch()
    }
  }, [initialSearchDone, initialCategory, initialQuery, handleSearch])

  const handleFilterChange = (key: keyof DocumentFilters, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({})
  }

  // Tri des résultats
  const sortedResults = [...results].sort((a, b) => {
    let comparison = 0
    switch (sortField) {
      case 'relevance':
        comparison = b.similarity - a.similarity
        break
      case 'date': {
        const dateA = a.metadata.decisionDate ? new Date(a.metadata.decisionDate).getTime() : 0
        const dateB = b.metadata.decisionDate ? new Date(b.metadata.decisionDate).getTime() : 0
        comparison = dateB - dateA
        break
      }
      case 'title':
        comparison = a.title.localeCompare(b.title)
        break
      case 'citations': {
        const citA = a.metadata.citedByCount || 0
        const citB = b.metadata.citedByCount || 0
        comparison = citB - citA
        break
      }
    }
    return sortOrder === 'asc' ? -comparison : comparison
  })

  const displayedResults = sortedResults.slice(0, displayedCount)
  const hasMore = sortedResults.length > displayedCount

  const activeFiltersCount = Object.values(filters).filter(v => v !== undefined).length

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Barre de recherche */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ChevronDown className="h-4 w-4 rotate-90" />
              </Button>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher dans la base de connaissances..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>

            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recherche...
                </>
              ) : (
                'Rechercher'
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtres
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Filtres avancés */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select
                  value={filters.category}
                  onValueChange={(value) => handleFilterChange('category', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {getCategoriesForContext('knowledge_base', 'fr').map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.tribunal}
                  onValueChange={(value) => handleFilterChange('tribunal', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tribunal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRIBUNAL_CASSATION">Cassation</SelectItem>
                    <SelectItem value="TRIBUNAL_APPEL">Appel</SelectItem>
                    <SelectItem value="TRIBUNAL_PREMIERE_INSTANCE">Première Instance</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.language}
                  onValueChange={(value) => handleFilterChange('language', value as 'fr' | 'ar' | 'bi')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Langue" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="ar">Arabe</SelectItem>
                    <SelectItem value="bi">Bilingue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Effacer filtres
                </Button>
                <Button size="sm" onClick={handleSearch}>
                  Appliquer
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Erreur */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Toolbar - seulement si on a cherché */}
      {hasSearched && !isLoading && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {results.length} {results.length === 1 ? 'résultat' : 'résultats'}
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <SortAsc className="h-4 w-4 mr-2" />
                  Trier
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Trier par</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={sortField === 'relevance'}
                  onCheckedChange={() => setSortField('relevance')}
                >
                  Pertinence
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={sortField === 'date'}
                  onCheckedChange={() => setSortField('date')}
                >
                  Date
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={sortField === 'title'}
                  onCheckedChange={() => setSortField('title')}
                >
                  Titre
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={sortField === 'citations'}
                  onCheckedChange={() => setSortField('citations')}
                >
                  Citations
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={sortOrder === 'desc'}
                  onCheckedChange={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  Ordre décroissant
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex gap-1 border rounded-md">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-r-none"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-l-none"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Skeleton loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Résultats */}
      {!isLoading && hasSearched && results.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Aucun résultat trouvé. Essayez avec d&apos;autres termes.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && displayedResults.length > 0 && (
        <>
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
            {displayedResults.map((document) => (
              <DocumentCard
                key={document.kbId}
                document={document}
                viewMode={viewMode}
                onClick={() => setSelectedDocument(document)}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setDisplayedCount(prev => prev + 20)}
              >
                Charger plus ({sortedResults.length - displayedCount} restants)
              </Button>
            </div>
          )}
        </>
      )}

      {/* Modal détail document */}
      {selectedDocument && (
        <DocumentDetailModal
          document={selectedDocument}
          open={!!selectedDocument}
          onOpenChange={(open) => !open && setSelectedDocument(null)}
        />
      )}
    </div>
  )
}

// =============================================================================
// COMPOSANT DOCUMENT CARD
// =============================================================================

interface DocumentCardProps {
  document: SearchResultItem
  viewMode: ViewMode
  onClick: () => void
}

function getCategoryBorderColor(category: string): string {
  const colorMap: Record<string, string> = {
    legislation: 'border-l-blue-500',
    jurisprudence: 'border-l-purple-500',
    doctrine: 'border-l-green-500',
    jort: 'border-l-red-500',
    modeles: 'border-l-orange-500',
    procedures: 'border-l-cyan-500',
    formulaires: 'border-l-yellow-500',
    codes: 'border-l-indigo-500',
    constitution: 'border-l-pink-500',
    conventions: 'border-l-teal-500',
    guides: 'border-l-lime-500',
    lexique: 'border-l-emerald-500',
    google_drive: 'border-l-violet-500',
  }
  return colorMap[category] || 'border-l-slate-500'
}

function getSimilarityColor(similarity: number): string {
  const pct = similarity * 100
  if (pct >= 80) return 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30'
  if (pct >= 60) return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30'
  return 'bg-muted text-muted-foreground'
}

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR')
  } catch {
    return null
  }
}

function getCategoryLabel(category: string): string {
  const translations = LEGAL_CATEGORY_TRANSLATIONS[category as LegalCategory]
  return translations?.fr || category
}

function DocumentCard({ document, viewMode, onClick }: DocumentCardProps) {
  const categoryColor = LEGAL_CATEGORY_COLORS[document.category as LegalCategory]
  const formattedDate = formatDate(document.metadata.decisionDate as string | null)

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${getCategoryBorderColor(document.category)}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm line-clamp-2 flex-1">
              {document.title}
            </h3>
            <Badge variant="outline" className={`shrink-0 ${getSimilarityColor(document.similarity)}`}>
              {Math.round(document.similarity * 100)}%
            </Badge>
          </div>

          {/* Métadonnées */}
          <div className="flex flex-wrap gap-1">
            <Badge className={`text-xs ${categoryColor || ''}`}>
              {getCategoryLabel(document.category)}
            </Badge>

            {document.metadata.tribunalLabelFr && (
              <Badge variant="outline" className="text-xs">
                {document.metadata.tribunalLabelFr}
              </Badge>
            )}

            {formattedDate && (
              <Badge variant="outline" className="text-xs">
                {formattedDate}
              </Badge>
            )}

            {document.metadata.citedByCount != null && document.metadata.citedByCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {document.metadata.citedByCount} citations
              </Badge>
            )}
          </div>

          {/* Extrait - en vue liste OU grille (1 ligne en grille) */}
          {document.chunkContent && (
            <p className={`text-sm text-muted-foreground ${viewMode === 'list' ? 'line-clamp-2' : 'line-clamp-1'}`}>
              {document.chunkContent}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
