import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const ProvidersContent = dynamic(
  () => import('./ProvidersContent'),
  {
    loading: () => (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    ),
  }
)

export default function ProvidersPage() {
  return <ProvidersContent />
}
