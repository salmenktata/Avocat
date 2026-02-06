import { notFound } from 'next/navigation'
import { query } from '@/lib/db/postgres'
import { KnowledgeBaseEdit } from '@/components/super-admin/knowledge-base/KnowledgeBaseEdit'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

async function getDocument(id: string) {
  const result = await query(
    `SELECT * FROM knowledge_base WHERE id = $1`,
    [id]
  )

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    id: row.id,
    category: row.category,
    subcategory: row.subcategory,
    language: row.language || 'ar',
    title: row.title,
    description: row.description,
    metadata: row.metadata || {},
    tags: row.tags || [],
    sourceFile: row.source_file,
    fullText: row.full_text,
    isIndexed: row.is_indexed,
    version: row.version || 1,
  }
}

export default async function KnowledgeBaseEditPage({ params }: PageProps) {
  const { id } = await params

  const document = await getDocument(id)

  if (!document) {
    notFound()
  }

  return (
    <div className="p-6">
      <KnowledgeBaseEdit document={document} />
    </div>
  )
}
