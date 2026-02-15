/**
 * Page Super Admin - Documents Juridiques
 * Liste des documents juridiques avec stats et pagination
 */

import Link from 'next/link'
import { db } from '@/lib/db/postgres'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icons } from '@/lib/icons'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getStalenessThreshold } from '@/lib/legal-documents/freshness-service'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    page?: string
  }>
}

const TYPE_COLORS: Record<string, string> = {
  code: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  loi: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  decret: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  arrete: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  circulaire: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  jurisprudence: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  doctrine: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  guide: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  formulaire: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  autre: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

const CONSOLIDATION_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  partial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  complete: 'bg-green-500/20 text-green-400 border-green-500/30',
}

const CONSOLIDATION_LABELS: Record<string, string> = {
  pending: 'En attente',
  partial: 'Partiel',
  complete: 'Complet',
}

export default async function LegalDocumentsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = parseInt(params.page || '1')
  const pageSize = 20
  const offset = (page - 1) * pageSize

  const [statsResult, docsResult] = await Promise.all([
    db.query<{
      total_docs: string
      consolidated: string
      approved: string
      total_pages: string
      total_amendments: string
    }>(`
      SELECT
        (SELECT COUNT(*) FROM legal_documents)::TEXT as total_docs,
        (SELECT COUNT(*) FROM legal_documents WHERE consolidation_status = 'complete')::TEXT as consolidated,
        (SELECT COUNT(*) FROM legal_documents WHERE is_approved = true)::TEXT as approved,
        (SELECT COUNT(*) FROM web_pages_documents)::TEXT as total_pages,
        (SELECT COUNT(*) FROM legal_document_amendments)::TEXT as total_amendments
    `),
    db.query<{
      id: string
      citation_key: string
      document_type: string
      official_title_ar: string | null
      official_title_fr: string | null
      consolidation_status: string
      is_abrogated: boolean
      is_approved: boolean
      page_count: number
      last_verified_at: string | null
      created_at: string
      linked_pages: string
      articles_count: string
      chunks_count: string
      staleness_days: number | null
    }>(`
      SELECT ld.*,
        (SELECT COUNT(*) FROM web_pages_documents wpd WHERE wpd.legal_document_id = ld.id)::TEXT as linked_pages,
        (SELECT COUNT(*) FROM web_pages_documents wpd WHERE wpd.legal_document_id = ld.id AND wpd.contribution_type = 'article')::TEXT as articles_count,
        (SELECT COUNT(*) FROM knowledge_base_chunks kbc WHERE kbc.knowledge_base_id = ld.knowledge_base_id)::TEXT as chunks_count,
        EXTRACT(DAY FROM NOW() - COALESCE(ld.last_verified_at, ld.created_at))::INTEGER as staleness_days
      FROM legal_documents ld
      ORDER BY ld.citation_key ASC
      LIMIT $1 OFFSET $2
    `, [pageSize, offset]),
  ])

  const stats = statsResult.rows[0]
  const docs = docsResult.rows
  const totalDocs = parseInt(stats.total_docs)
  const totalPages = Math.ceil(totalDocs / pageSize)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Documents Juridiques</h1>
        <p className="text-slate-400 mt-1">
          Couche document juridique - consolidation, fraîcheur et liens KB
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Total documents"
          value={parseInt(stats.total_docs)}
          icon={Icons.scale}
          color="text-slate-400"
        />
        <StatCard
          label="Consolidés"
          value={parseInt(stats.consolidated)}
          icon={Icons.check}
          color="text-blue-400"
        />
        <StatCard
          label="Approuvés"
          value={parseInt(stats.approved)}
          icon={Icons.check}
          color="text-green-400"
        />
        <StatCard
          label="Pages liées"
          value={parseInt(stats.total_pages)}
          icon={Icons.fileText}
          color="text-blue-400"
        />
        <StatCard
          label="Amendements"
          value={parseInt(stats.total_amendments)}
          icon={Icons.alertTriangle}
          color="text-orange-400"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-700 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="text-slate-400">Citation Key</TableHead>
              <TableHead className="text-slate-400">Type</TableHead>
              <TableHead className="text-slate-400">Titre (AR)</TableHead>
              <TableHead className="text-slate-400">Consolidation</TableHead>
              <TableHead className="text-slate-400 text-center">Articles</TableHead>
              <TableHead className="text-slate-400 text-center">Pages</TableHead>
              <TableHead className="text-slate-400 text-center">Chunks KB</TableHead>
              <TableHead className="text-slate-400">Approbation</TableHead>
              <TableHead className="text-slate-400">Fraîcheur</TableHead>
              <TableHead className="text-slate-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-slate-400">
                  <Icons.scale className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  Aucun document juridique
                </TableCell>
              </TableRow>
            ) : (
              docs.map((doc) => {
                const threshold = getStalenessThreshold(doc.document_type || 'autre')
                const stalenessDays = doc.staleness_days ?? 0
                const freshnessColor = stalenessDays > threshold
                  ? 'text-red-400'
                  : stalenessDays > threshold * 0.75
                    ? 'text-yellow-400'
                    : 'text-green-400'

                return (
                  <TableRow
                    key={doc.id}
                    className="border-slate-700 hover:bg-slate-800/50"
                  >
                    <TableCell className="font-mono text-sm text-white">
                      {doc.citation_key}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={TYPE_COLORS[doc.document_type] || TYPE_COLORS.autre}>
                        {doc.document_type || 'autre'}
                      </Badge>
                      {doc.is_abrogated && (
                        <Badge variant="outline" className="ml-1 bg-red-500/20 text-red-400 border-red-500/30">
                          Abrogé
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span className="text-sm text-slate-300 truncate block" dir="rtl">
                        {doc.official_title_ar || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={CONSOLIDATION_COLORS[doc.consolidation_status] || CONSOLIDATION_COLORS.pending}>
                        {CONSOLIDATION_LABELS[doc.consolidation_status] || doc.consolidation_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm text-white font-medium">
                      {parseInt(doc.articles_count)}
                    </TableCell>
                    <TableCell className="text-center text-sm text-slate-300">
                      {parseInt(doc.linked_pages)}
                    </TableCell>
                    <TableCell className="text-center text-sm text-slate-300">
                      {parseInt(doc.chunks_count)}
                    </TableCell>
                    <TableCell>
                      {doc.is_approved ? (
                        <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                          Approuvé
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-500/20 text-slate-400 border-slate-500/30">
                          En attente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm ${freshnessColor}`}>
                        {stalenessDays}j / {threshold}j
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/super-admin/legal-documents/${doc.id}`}>
                        <Button variant="ghost" size="sm">
                          <Icons.eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Page {page} sur {totalPages} ({totalDocs} documents)
          </div>
          <div className="flex gap-2">
            <Link
              href={`?page=${page - 1}`}
              className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
            >
              <Button variant="outline" size="sm" disabled={page <= 1}>
                <Icons.chevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Link
              href={`?page=${page + 1}`}
              className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
            >
              <Button variant="outline" size="sm" disabled={page >= totalPages}>
                <Icons.chevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
    </div>
  )
}
