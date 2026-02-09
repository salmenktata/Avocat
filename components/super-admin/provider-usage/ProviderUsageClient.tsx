'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Icons } from '@/lib/icons'
import { ProviderOperationMatrix } from './ProviderOperationMatrix'
import { ProviderTrendsChart } from './ProviderTrendsChart'
import { OperationDistributionChart } from './OperationDistributionChart'
import { CostBreakdownChart } from './CostBreakdownChart'
import { TopUsersTable } from './TopUsersTable'
import { UserSelector } from './UserSelector'

interface ProviderUsageClientProps {
  days: number
  userId: string | null
}

export function ProviderUsageClient({ days, userId }: ProviderUsageClientProps) {
  const router = useRouter()

  const handlePeriodChange = (newDays: number) => {
    const params = new URLSearchParams()
    params.set('days', newDays.toString())
    if (userId) {
      params.set('userId', userId)
    }
    router.push(`/super-admin/provider-usage?${params}`)
  }

  const handleClearFilter = () => {
    const params = new URLSearchParams()
    params.set('days', days.toString())
    router.push(`/super-admin/provider-usage?${params}`)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitoring Providers IA</h1>
          <p className="text-muted-foreground">
            Consommation détaillée par provider et type d'opération
          </p>
        </div>

        <div className="flex gap-2 items-center">
          {/* Period selector */}
          <Button
            variant={days === 7 ? 'default' : 'outline'}
            onClick={() => handlePeriodChange(7)}
          >
            7 jours
          </Button>
          <Button
            variant={days === 30 ? 'default' : 'outline'}
            onClick={() => handlePeriodChange(30)}
          >
            30 jours
          </Button>

          {/* User selector */}
          <UserSelector currentUserId={userId} days={days} />

          {/* Clear filter button */}
          {userId && (
            <Button
              variant="outline"
              onClick={handleClearFilter}
              className="gap-2"
            >
              <Icons.x className="h-4 w-4" />
              Effacer filtre
            </Button>
          )}
        </div>
      </div>

      {/* Top Users Table (only when viewing all users) */}
      {!userId && <TopUsersTable days={days} />}

      {/* Matrice principale */}
      <ProviderOperationMatrix days={days} userId={userId} />

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ProviderTrendsChart days={days} userId={userId} />
        <OperationDistributionChart days={days} userId={userId} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CostBreakdownChart days={days} userId={userId} />
        {/* Future: ProviderAlertsCard */}
        <div className="hidden lg:block" />
      </div>
    </div>
  )
}
