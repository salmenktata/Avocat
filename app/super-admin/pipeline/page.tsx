import { Suspense } from 'react'
import { PipelineDashboard } from '@/components/super-admin/pipeline/PipelineDashboard'

export default function PipelinePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Chargement du pipeline...</div>}>
      <PipelineDashboard />
    </Suspense>
  )
}
