'use client'

/**
 * Tab Provider Usage - Réutilise composants existants
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ProviderOperationMatrix } from '@/components/super-admin/provider-usage/ProviderOperationMatrix'
import { ProviderTrendsChart } from '@/components/super-admin/provider-usage/ProviderTrendsChart'
import { OperationDistributionChart } from '@/components/super-admin/provider-usage/OperationDistributionChart'
import { CostBreakdownChart } from '@/components/super-admin/provider-usage/CostBreakdownChart'

export function ProviderUsageTab() {
  const [days, setDays] = useState(7)

  return (
    <div className="space-y-6">
      {/* Header with period selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Usage par Provider</h2>
          <p className="text-sm text-muted-foreground">
            Consommation détaillée par provider et type d'opération
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={days === 7 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(7)}
          >
            7 jours
          </Button>
          <Button
            variant={days === 30 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(30)}
          >
            30 jours
          </Button>
        </div>
      </div>

      {/* Matrice principale */}
      <ProviderOperationMatrix days={days} />

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ProviderTrendsChart days={days} />
        <OperationDistributionChart days={days} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CostBreakdownChart days={days} />
        <div className="hidden lg:block" />
      </div>
    </div>
  )
}
