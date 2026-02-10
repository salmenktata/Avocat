'use client'

/**
 * Onglets de filtrage par catégorie juridique pour les pages d'une source web
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { getUnifiedLabel } from '@/lib/categories/taxonomy-bridge'

interface CategoryStats {
  legal_domain: string | null
  count: number
  indexed_count: number
}

interface WebSourceCategoryTabsProps {
  stats: CategoryStats[]
  sourceId: string
  onCategoryChange?: (category: string | null) => void
}

const CATEGORY_ICONS: Record<string, string> = {
  legislation: '📜',
  jurisprudence: '⚖️',
  doctrine: '📚',
  autre: '📄',
  null: '❓',
}

export function WebSourceCategoryTabs({
  stats,
  sourceId,
  onCategoryChange,
}: WebSourceCategoryTabsProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // Calculer le total
  const total = stats.reduce((sum, s) => sum + s.count, 0)
  const totalIndexed = stats.reduce((sum, s) => sum + s.indexed_count, 0)

  const handleCategoryClick = (category: string | null) => {
    const newCategory = activeCategory === category ? null : category
    setActiveCategory(newCategory)
    onCategoryChange?.(newCategory)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Onglet "Toutes" */}
      <button
        onClick={() => handleCategoryClick(null)}
        className={cn(
          'px-4 py-2 rounded-lg text-sm font-medium transition-all',
          'border border-slate-600',
          activeCategory === null
            ? 'bg-blue-600 text-white border-blue-500'
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
        )}
      >
        <div className="flex items-center gap-2">
          <span>📊 Toutes</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-xs',
              activeCategory === null
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-300'
            )}
          >
            {total}
          </span>
        </div>
      </button>

      {/* Onglets par catégorie */}
      {stats
        .filter(s => s.count > 0)
        .sort((a, b) => b.count - a.count)
        .map(stat => {
          const category = stat.legal_domain || 'null'
          const icon = CATEGORY_ICONS[category] || '📄'
          const labelAr = category === 'null' ? 'غير مصنف' : getUnifiedLabel(category, 'ar')
          const isActive = activeCategory === category

          return (
            <button
              key={category}
              onClick={() => handleCategoryClick(category)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                'border border-slate-600',
                isActive
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              )}
            >
              <div className="flex items-center gap-2">
                <span>
                  {icon} {labelAr}
                </span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs',
                    isActive
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-700 text-slate-300'
                  )}
                >
                  {stat.count}
                </span>
                {stat.indexed_count > 0 && (
                  <span className="text-xs opacity-70">
                    ({stat.indexed_count} indexées)
                  </span>
                )}
              </div>
            </button>
          )
        })}
    </div>
  )
}
