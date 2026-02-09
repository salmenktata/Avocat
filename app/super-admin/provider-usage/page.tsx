'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ProviderOperationMatrix } from '@/components/super-admin/provider-usage/ProviderOperationMatrix'
import { ProviderTrendsChart } from '@/components/super-admin/provider-usage/ProviderTrendsChart'
import { OperationDistributionChart } from '@/components/super-admin/provider-usage/OperationDistributionChart'
import { CostBreakdownChart } from '@/components/super-admin/provider-usage/CostBreakdownChart'

export default function ProviderUsagePage() {
  const [days, setDays] = useState(7)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitoring Providers IA</h1>
          <p className="text-muted-foreground">
            Consommation détaillée par provider et type d'opération
          </p>
        </div>

        {/* Period selector */}
        <div className="flex gap-2">
          <Button
            variant={days === 7 ? 'default' : 'outline'}
            onClick={() => setDays(7)}
          >
            7 jours
          </Button>
          <Button
            variant={days === 30 ? 'default' : 'outline'}
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
        {/* Future: ProviderAlertsCard */}
        <div className="hidden lg:block" />
      </div>
    </div>
  )
}
