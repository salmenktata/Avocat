import { Suspense } from 'react'
import { PipelineDocumentDetail } from '@/components/super-admin/pipeline/PipelineDocumentDetail'

export default async function PipelineDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Chargement...</div>}>
      <PipelineDocumentDetail documentId={id} />
    </Suspense>
  )
}
