/**
 * Page Super Admin - Maintenance Sources Web
 */

import { Suspense } from 'react'
import { MaintenancePageClient } from './page-client'

export const metadata = {
  title: 'Maintenance Sources Web - Super Admin',
  description: 'Actions de maintenance pour les sources web',
}

export default function MaintenancePage() {
  return (
    <Suspense fallback={<div className="p-8">Chargement...</div>}>
      <MaintenancePageClient />
    </Suspense>
  )
}
