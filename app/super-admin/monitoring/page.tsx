'use client'

/**
 * Dashboard Monitoring Unifié - Consolidation 3 pages
 *
 * 4 onglets :
 * 1. Overview : Métriques production temps réel
 * 2. Providers : Matrice provider × opération
 * 3. Costs : Analyse coûts IA
 * 4. Quotas : Limites et alertes API
 */

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Activity, PieChart, DollarSign, Gauge } from 'lucide-react'
import { ProductionMonitoringTab } from '@/components/super-admin/monitoring/ProductionMonitoringTab'
import { ProviderUsageTab } from '@/components/super-admin/monitoring/ProviderUsageTab'
import { AICostsTab } from '@/components/super-admin/monitoring/AICostsTab'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function MonitoringPage() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitoring Production</h1>
          <p className="text-muted-foreground">
            Surveillance infrastructure, coûts et performance en temps réel
          </p>
        </div>

        {/* Quick link to Quotas (separate page) */}
        <Link href="/super-admin/quotas">
          <Button variant="outline">
            <Gauge className="h-4 w-4 mr-2" />
            Quotas & Alertes
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="providers" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            <span className="hidden sm:inline">Providers</span>
          </TabsTrigger>
          <TabsTrigger value="costs" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Coûts IA</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Production Overview */}
        <TabsContent value="overview" className="space-y-6">
          <ProductionMonitoringTab />
        </TabsContent>

        {/* Tab 2: Provider Usage */}
        <TabsContent value="providers" className="space-y-6">
          <ProviderUsageTab />
        </TabsContent>

        {/* Tab 3: AI Costs */}
        <TabsContent value="costs" className="space-y-6">
          <AICostsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
