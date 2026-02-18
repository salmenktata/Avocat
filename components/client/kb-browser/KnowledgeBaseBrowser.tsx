'use client'

import { useState, useCallback } from 'react'
import { Search, Book, Gavel, BookOpen, Newspaper, ClipboardList, Scroll, Scale, Handshake } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useKBStats } from '@/lib/hooks/useKBStats'
import {
  LEGAL_CATEGORY_TRANSLATIONS,
  LEGAL_CATEGORY_DESCRIPTIONS,
  getCategoriesForContext,
} from '@/lib/categories/legal-categories'
import type { LegalCategory } from '@/lib/categories/legal-categories'
import { DocumentExplorer } from './DocumentExplorer'

// =============================================================================
// ICON MAP (string → component)
// =============================================================================

const CATEGORY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  codes: Book,
  jurisprudence: Gavel,
  doctrine: BookOpen,
  legislation: Scale,
  procedures: ClipboardList,
  conventions: Handshake,
  constitution: Scroll,
  jort: Newspaper,
}

// Catégories principales à afficher sur la landing
const MAIN_CATEGORIES: LegalCategory[] = [
  'codes',
  'jurisprudence',
  'doctrine',
  'legislation',
  'procedures',
  'conventions',
]

// Couleurs de bordure pour les cartes catégorie
const CATEGORY_CARD_COLORS: Record<string, string> = {
  codes: 'border-indigo-500 hover:bg-indigo-500/5',
  jurisprudence: 'border-purple-500 hover:bg-purple-500/5',
  doctrine: 'border-green-500 hover:bg-green-500/5',
  legislation: 'border-blue-500 hover:bg-blue-500/5',
  procedures: 'border-cyan-500 hover:bg-cyan-500/5',
  conventions: 'border-teal-500 hover:bg-teal-500/5',
  constitution: 'border-pink-500 hover:bg-pink-500/5',
  jort: 'border-red-500 hover:bg-red-500/5',
}

const CATEGORY_ICON_COLORS: Record<string, string> = {
  codes: 'text-indigo-500',
  jurisprudence: 'text-purple-500',
  doctrine: 'text-green-500',
  legislation: 'text-blue-500',
  procedures: 'text-cyan-500',
  conventions: 'text-teal-500',
  constitution: 'text-pink-500',
  jort: 'text-red-500',
}

// =============================================================================
// COMPOSANT PRINCIPAL
// =============================================================================

export function KnowledgeBaseBrowser() {
  const [mode, setMode] = useState<'landing' | 'results'>('landing')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()

  const { data: stats, isLoading: statsLoading } = useKBStats()

  const handleSearch = useCallback(() => {
    const q = searchQuery.trim()
    if (!q) return
    setSelectedCategory(undefined)
    setMode('results')
  }, [searchQuery])

  const handleCategoryClick = useCallback((category: string) => {
    setSelectedCategory(category)
    setSearchQuery('')
    setMode('results')
  }, [])

  const handleBack = useCallback(() => {
    setMode('landing')
    setSearchQuery('')
    setSelectedCategory(undefined)
  }, [])

  if (mode === 'results') {
    return (
      <div className="container mx-auto py-6">
        <DocumentExplorer
          initialCategory={selectedCategory}
          initialQuery={searchQuery || undefined}
          onBack={handleBack}
        />
      </div>
    )
  }

  // =========================================================================
  // LANDING MODE
  // =========================================================================

  const totalDocs = stats?.totalDocuments || 0

  // Catégories disponibles dans KB context, avec stats
  const kbCategories = getCategoriesForContext('knowledge_base', 'fr')

  return (
    <div className="container mx-auto py-6 space-y-10">
      {/* Hero Search */}
      <div className="text-center space-y-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Base de Connaissances Juridique
        </h1>
        <p className="text-muted-foreground text-lg">
          {statsLoading ? (
            <Skeleton className="h-5 w-48 mx-auto" />
          ) : (
            `${totalDocs.toLocaleString('fr-FR')}+ documents juridiques tunisiens`
          )}
        </p>

        {/* Grande barre de recherche */}
        <div className="max-w-2xl mx-auto flex gap-2 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Rechercher un texte de loi, un arrêt, une doctrine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-12 h-12 text-base"
            />
          </div>
          <Button onClick={handleSearch} size="lg" className="h-12 px-6">
            Rechercher
          </Button>
        </div>
      </div>

      {/* Grille de catégories */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Explorer par catégorie</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MAIN_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICON_MAP[cat] || BookOpen
            const label = LEGAL_CATEGORY_TRANSLATIONS[cat]?.fr || cat
            const description = LEGAL_CATEGORY_DESCRIPTIONS[cat]?.fr || ''
            const count = stats?.byCategory[cat] || 0
            const borderColor = CATEGORY_CARD_COLORS[cat] || 'border-slate-500'
            const iconColor = CATEGORY_ICON_COLORS[cat] || 'text-slate-500'

            return (
              <Card
                key={cat}
                className={`cursor-pointer border-l-4 transition-colors ${borderColor}`}
                onClick={() => handleCategoryClick(cat)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`shrink-0 ${iconColor}`}>
                      <Icon className="h-8 w-8" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold">{label}</h3>
                        {statsLoading ? (
                          <Skeleton className="h-5 w-10 rounded-full" />
                        ) : (
                          <span className="text-sm text-muted-foreground shrink-0">
                            {count.toLocaleString('fr-FR')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Autres catégories (si elles ont des docs) */}
      {stats && (() => {
        const otherCats = kbCategories.filter(
          c => !MAIN_CATEGORIES.includes(c.value as LegalCategory) && (stats.byCategory[c.value] || 0) > 0
        )
        if (otherCats.length === 0) return null
        return (
          <div>
            <h2 className="text-lg font-semibold mb-3">Autres catégories</h2>
            <div className="flex flex-wrap gap-2">
              {otherCats.map((cat) => (
                <Button
                  key={cat.value}
                  variant="outline"
                  size="sm"
                  onClick={() => handleCategoryClick(cat.value)}
                >
                  {LEGAL_CATEGORY_TRANSLATIONS[cat.value as LegalCategory]?.fr || cat.label}
                  <span className="ml-2 text-muted-foreground">
                    ({(stats.byCategory[cat.value] || 0).toLocaleString('fr-FR')})
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
