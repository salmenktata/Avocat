'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface TemplateLanguageFilterProps {
  currentFilter: string
}

export default function TemplateLanguageFilter({ currentFilter }: TemplateLanguageFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('templates')

  const handleFilterChange = (langue: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (langue === 'all') {
      params.delete('langue')
    } else {
      params.set('langue', langue)
    }
    router.push(`/templates?${params.toString()}`)
  }

  const filters = [
    { value: 'all', label: t('allLanguages'), icon: '🌐' },
    { value: 'fr', label: 'Français', icon: '🇫🇷' },
    { value: 'ar', label: 'العربية', icon: '🇹🇳' },
  ]

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{t('filterByLanguage')}:</span>
      <div className="flex rounded-lg border bg-card p-1">
        {filters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => handleFilterChange(filter.value)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              currentFilter === filter.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <span>{filter.icon}</span>
            <span>{filter.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
