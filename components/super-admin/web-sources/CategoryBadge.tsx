'use client'

import { useLocale } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { getCategoryLabel, CATEGORY_COLORS } from '@/lib/web-scraper/category-labels'
import type { WebSourceCategory } from '@/lib/web-scraper/types'

interface CategoryBadgeProps {
  category: string
  className?: string
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const locale = useLocale() as 'fr' | 'ar'

  return (
    <Badge
      className={`${CATEGORY_COLORS[category] || CATEGORY_COLORS.autre} ${className || ''}`}
    >
      {getCategoryLabel(category as WebSourceCategory, locale)}
    </Badge>
  )
}
