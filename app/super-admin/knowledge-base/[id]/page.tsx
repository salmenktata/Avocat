import { notFound } from 'next/navigation'
import { query } from '@/lib/db/postgres'
import { KnowledgeBaseDetail } from '@/components/super-admin/knowledge-base/KnowledgeBaseDetail'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

async function getDocument(id: string) {
  const result = await query(
    `SELECT kb.*,
            COUNT(kbc.id) as chunk_count,
            u.email as uploaded_by_email
     FROM knowledge_base kb
     LEFT JOIN knowledge_base_chunks kbc ON kb.id = kbc.knowledge_base_id
     LEFT JOIN users u ON kb.uploaded_by = u.id
     WHERE kb.id = $1
     GROUP BY kb.id, u.email`,
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
    isActive: row.is_active !== false,
    version: row.version || 1,
    chunkCount: parseInt(row.chunk_count) || 0,
    uploadedBy: row.uploaded_by,
    uploadedByEmail: row.uploaded_by_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function getVersions(documentId: string) {
  const result = await query(
    `SELECT * FROM get_knowledge_base_versions($1, $2, $3)`,
    [documentId, 20, 0]
  )

  return result.rows.map((row) => ({
    id: row.id,
    version: row.version,
    title: row.title,
    changeType: row.change_type,
    changeReason: row.change_reason,
    changedBy: row.changed_by,
    changedByEmail: row.changed_by_email,
    changedAt: row.changed_at,
  }))
}

export default async function KnowledgeBaseDetailPage({ params }: PageProps) {
  const { id } = await params

  const document = await getDocument(id)

  if (!document) {
    notFound()
  }

  const versions = await getVersions(id)

  return (
    <div className="p-6">
      <KnowledgeBaseDetail document={document} versions={versions} />
    </div>
  )
}
