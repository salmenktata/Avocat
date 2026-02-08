import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const ClassificationMetricsContent = dynamic(
  () => import('./ClassificationMetricsContent'),
  {
    loading: () => (
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <Skeleton className="h-9 w-80 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    ),
  }
)

export default function ClassificationMetricsPage() {
  return <ClassificationMetricsContent />
}
