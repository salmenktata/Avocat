import { Suspense } from 'react'
import { query } from '@/lib/db/postgres'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/lib/icons'
import { KnowledgeBaseUpload } from '@/components/super-admin/knowledge-base/KnowledgeBaseUpload'
import { KnowledgeBaseList } from '@/components/super-admin/knowledge-base/KnowledgeBaseList'

interface PageProps {
  searchParams: Promise<{
    category?: string
    indexed?: string
    search?: string
    page?: string
  }>
}

async function KnowledgeBaseStats() {
  const result = await query(`
    SELECT
      COUNT(*) as total_docs,
      COUNT(*) FILTER (WHERE is_indexed = TRUE) as indexed_docs,
      COALESCE(SUM(chunk_count), 0) as total_chunks
    FROM knowledge_base
  `)
  const stats = result.rows[0]

  // Répartition par catégorie
  const categoryResult = await query(`
    SELECT category, COUNT(*) as count, SUM(chunk_count) as chunks
    FROM knowledge_base
    GROUP BY category
    ORDER BY count DESC
  `)

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-white">{stats.total_docs}</p>
              <p className="text-sm text-slate-400">Total documents</p>
            </div>
            <Icons.bookOpen className="h-8 w-8 text-blue-500/20" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-green-500">{stats.indexed_docs}</p>
              <p className="text-sm text-slate-400">Indexés</p>
            </div>
            <Icons.checkCircle className="h-8 w-8 text-green-500/20" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-purple-500">{stats.total_chunks}</p>
              <p className="text-sm text-slate-400">Chunks vectoriels</p>
            </div>
            <Icons.layers className="h-8 w-8 text-purple-500/20" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            {categoryResult.rows.map((cat: { category: string; count: string; chunks: string }) => (
              <Badge key={cat.category} variant="secondary" className="bg-slate-700 text-slate-300">
                {cat.category}: {cat.count}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-slate-400 mt-2">Par catégorie</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function KnowledgeBasePage({ searchParams }: PageProps) {
  const params = await searchParams
  const category = params.category || 'all'
  const indexed = params.indexed || 'all'
  const search = params.search || ''
  const page = parseInt(params.page || '1')
  const limit = 20
  const offset = (page - 1) * limit

  // Construire la requête avec filtres
  let whereClause = 'WHERE 1=1'
  const queryParams: (string | number | boolean)[] = []
  let paramIndex = 1

  if (category !== 'all') {
    whereClause += ` AND category = $${paramIndex}`
    queryParams.push(category)
    paramIndex++
  }

  if (indexed !== 'all') {
    whereClause += ` AND is_indexed = $${paramIndex}`
    queryParams.push(indexed === 'true')
    paramIndex++
  }

  if (search) {
    whereClause += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`
    queryParams.push(`%${search}%`)
    paramIndex++
  }

  // Compter le total
  const countResult = await query(
    `SELECT COUNT(*) as count FROM knowledge_base ${whereClause}`,
    queryParams
  )
  const total = parseInt(countResult.rows[0]?.count || '0')

  // Récupérer les documents
  const docsResult = await query(
    `SELECT
      kb.id, kb.title, kb.description, kb.category, kb.language,
      kb.is_indexed, kb.chunk_count, kb.file_name, kb.file_type,
      kb.created_at, kb.updated_at,
      u.email as uploaded_by_email
    FROM knowledge_base kb
    LEFT JOIN users u ON kb.uploaded_by = u.id
    ${whereClause}
    ORDER BY kb.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...queryParams, limit, offset]
  )

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Base de Connaissances</h2>
        <p className="text-slate-400">Gérer les documents juridiques pour l'IA</p>
      </div>

      {/* Stats */}
      <Suspense fallback={<div className="h-24 bg-slate-800 animate-pulse rounded-lg" />}>
        <KnowledgeBaseStats />
      </Suspense>

      {/* Upload */}
      <KnowledgeBaseUpload />

      {/* Liste des documents */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Documents ({total})</CardTitle>
          <CardDescription className="text-slate-400">
            Page {page} sur {totalPages || 1}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KnowledgeBaseList
            documents={docsResult.rows}
            currentPage={page}
            totalPages={totalPages}
            category={category}
            indexed={indexed}
            search={search}
          />
        </CardContent>
      </Card>
    </div>
  )
}
