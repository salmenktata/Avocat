'use client'

import { useTranslations } from 'next-intl'
import type { ProcedureType } from '@/lib/ai/dossier-structuring-service'

interface ProcedureTypeBadgeProps {
  type: ProcedureType
  sousType?: string | null
}

const TYPE_CONFIG: Record<
  ProcedureType,
  { icon: string; colorClass: string; labelKey: string }
> = {
  divorce: {
    icon: '&#128141;',
    colorClass: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300 border-pink-200 dark:border-pink-800',
    labelKey: 'procedureTypes.divorce',
  },
  commercial: {
    icon: '&#128188;',
    colorClass: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    labelKey: 'procedureTypes.commercial',
  },
  civil_premiere_instance: {
    icon: '&#9878;',
    colorClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    labelKey: 'procedureTypes.civil',
  },
  refere: {
    icon: '&#9889;',
    colorClass: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    labelKey: 'procedureTypes.refere',
  },
  cassation: {
    icon: '&#9878;',
    colorClass: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    labelKey: 'procedureTypes.cassation',
  },
  penal: {
    icon: '&#9878;',
    colorClass: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
    labelKey: 'procedureTypes.penal',
  },
  administratif: {
    icon: '&#127963;',
    colorClass: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    labelKey: 'procedureTypes.administratif',
  },
  social: {
    icon: '&#129309;',
    colorClass: 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    labelKey: 'procedureTypes.social',
  },
  autre: {
    icon: '&#128209;',
    colorClass: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    labelKey: 'procedureTypes.autre',
  },
}

export default function ProcedureTypeBadge({
  type,
  sousType,
}: ProcedureTypeBadgeProps) {
  const t = useTranslations('assistant')

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.autre

  return (
    <div
      className={`inline-flex items-center gap-3 rounded-lg border px-4 py-3 ${config.colorClass}`}
    >
      <span
        className="text-2xl"
        dangerouslySetInnerHTML={{ __html: config.icon }}
      />
      <div>
        <span className="text-sm font-medium uppercase tracking-wide">
          {t('result.type')}:
        </span>
        <span className="ml-2 text-lg font-bold">{t(config.labelKey)}</span>
        {sousType && (
          <span className="ml-2 text-sm opacity-75">({sousType})</span>
        )}
      </div>
    </div>
  )
}
