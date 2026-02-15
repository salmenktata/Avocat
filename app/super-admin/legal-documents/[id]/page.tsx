/**
 * Page Super Admin - Détail Document Juridique
 * Affiche info, structure, pages liées, amendements et texte consolidé
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
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
import { ApprovalActions } from './approval-actions'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function LegalDocumentDetailPage({ params }: PageProps) {
  const { id } = await params

  const [docResult, pagesResult, amendmentsResult] = await Promise.all([
    db.query<any>(
      `SELECT ld.*,
        ws.name as source_name, ws.base_url as source_url,
        kb.title as kb_title,
        (SELECT COUNT(*) FROM web_pages_documents wpd WHERE wpd.legal_document_id = ld.id)::TEXT as linked_pages_count,
        (SELECT COUNT(*) FROM knowledge_base_chunks kbc WHERE kbc.knowledge_base_id = ld.knowledge_base_id)::TEXT as chunks_count,
        EXTRACT(DAY FROM NOW() - COALESCE(ld.last_verified_at, ld.created_at))::INTEGER as staleness_days
      FROM legal_documents ld
      LEFT JOIN web_sources ws ON ld.canonical_source_id = ws.id
      LEFT JOIN knowledge_base kb ON ld.knowledge_base_id = kb.id
      WHERE ld.id = $1`,
      [id]
    ),
    db.query<{
      url: string
      title: string | null
      article_number: string | null
      page_order: number | null
      contribution_type: string
      word_count: number | null
    }>(
      `SELECT wp.url, wp.title, wpd.article_number, wpd.page_order, wpd.contribution_type, wp.word_count
      FROM web_pages_documents wpd
      JOIN web_pages wp ON wpd.web_page_id = wp.id
      WHERE wpd.legal_document_id = $1
      ORDER BY wpd.page_order ASC NULLS LAST
      LIMIT 50`,
      [id]
    ),
    db.query<{
      id: string
      amending_law_reference: string | null
      amendment_date: string | null
      amendment_scope: string | null
      affected_articles: string[] | null
      description: string | null
    }>(
      `SELECT * FROM legal_document_amendments
      WHERE original_document_id = $1
      ORDER BY amendment_date DESC NULLS LAST`,
      [id]
    ),
  ])

  if (docResult.rows.length === 0) {
    notFound()
  }

  const doc = docResult.rows[0]
  const pages = pagesResult.rows
  const amendments = amendmentsResult.rows
  const threshold = getStalenessThreshold(doc.document_type || 'autre')
  const stalenessDays = doc.staleness_days ?? 0
  const structure = doc.structure as any

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/super-admin/legal-documents">
            <Button variant="ghost" size="sm">
              <Icons.arrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{doc.citation_key}</h1>
            <p className="text-slate-400 mt-1">
              {doc.official_title_fr || doc.official_title_ar || 'Document juridique'}
            </p>
          </div>
        </div>
        <ApprovalActions
          documentId={doc.id}
          isApproved={doc.is_approved ?? false}
          consolidationStatus={doc.consolidation_status}
          approvedAt={doc.approved_at}
        />
      </div>

      {/* Section 1 - Info document */}
      <div className="rounded-lg border border-slate-700 p-6 bg-slate-900/50">
        <h2 className="text-lg font-semibold text-white mb-4">Informations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoRow label="Citation Key" value={doc.citation_key} mono />
          <InfoRow label="Type">
            <Badge variant="outline" className={getTypeColor(doc.document_type)}>
              {doc.document_type || 'autre'}
            </Badge>
            {doc.is_abrogated && (
              <Badge variant="outline" className="ml-2 bg-red-500/20 text-red-400 border-red-500/30">
                Abrogé {doc.abrogation_date ? `(${new Date(doc.abrogation_date).toLocaleDateString('fr-FR')})` : ''}
              </Badge>
            )}
          </InfoRow>
          <InfoRow label="Titre (AR)" value={doc.official_title_ar} dir="rtl" />
          <InfoRow label="Titre (FR)" value={doc.official_title_fr} />
          <InfoRow label="Catégorie principale" value={doc.primary_category} />
          <InfoRow label="Catégories secondaires" value={doc.secondary_categories?.join(', ') || '-'} />
          <InfoRow label="Domaines juridiques" value={doc.legal_domains?.join(', ') || '-'} />
          <InfoRow label="Tags" value={doc.tags?.join(', ') || '-'} />
          <InfoRow label="Date effective" value={doc.effective_date ? new Date(doc.effective_date).toLocaleDateString('fr-FR') : '-'} />
          <InfoRow label="Date publication" value={doc.publication_date ? new Date(doc.publication_date).toLocaleDateString('fr-FR') : '-'} />
          <InfoRow label="Réf. JORT" value={doc.jort_reference} />
          <InfoRow label="Dernière vérification" value={doc.last_verified_at ? new Date(doc.last_verified_at).toLocaleDateString('fr-FR') : 'Jamais'} />
          <InfoRow label="Fraîcheur">
            <FreshnessBadge days={stalenessDays} threshold={threshold} />
          </InfoRow>
          <InfoRow label="Source canonique">
            {doc.source_name ? (
              <Link href={doc.source_url || '#'} className="text-blue-400 hover:underline" target="_blank">
                {doc.source_name}
              </Link>
            ) : (
              <span className="text-slate-500">-</span>
            )}
          </InfoRow>
          <InfoRow label="Lien KB">
            {doc.knowledge_base_id ? (
              <span className="text-slate-300">
                {doc.kb_title || doc.knowledge_base_id} ({doc.chunks_count} chunks)
              </span>
            ) : (
              <span className="text-slate-500">Non lié</span>
            )}
          </InfoRow>
          <InfoRow label="Pages liées" value={doc.linked_pages_count} />
          <InfoRow label="Consolidation">
            <Badge variant="outline" className={getConsolidationColor(doc.consolidation_status)}>
              {doc.consolidation_status === 'complete' ? 'Complet' :
               doc.consolidation_status === 'partial' ? 'Partiel' : 'En attente'}
            </Badge>
            {doc.page_count > 0 && (
              <span className="ml-2 text-sm text-slate-400">({doc.page_count} pages)</span>
            )}
          </InfoRow>
          <InfoRow label="Approbation">
            {doc.is_approved ? (
              <>
                <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                  Approuvé
                </Badge>
                {doc.approved_at && (
                  <span className="ml-2 text-sm text-slate-400">
                    le {new Date(doc.approved_at).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </>
            ) : (
              <Badge variant="outline" className="bg-slate-500/20 text-slate-400 border-slate-500/30">
                En attente d&apos;approbation
              </Badge>
            )}
          </InfoRow>
        </div>
      </div>

      {/* Section 2 - Structure */}
      {structure && (
        <div className="rounded-lg border border-slate-700 p-6 bg-slate-900/50">
          <h2 className="text-lg font-semibold text-white mb-4">Structure du document</h2>
          <StructureTree structure={structure} />
        </div>
      )}

      {/* Section 3 - Pages liées */}
      <div className="rounded-lg border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            Pages liées ({pages.length}{parseInt(doc.linked_pages_count) > 50 ? ` / ${doc.linked_pages_count}` : ''})
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="text-slate-400">#</TableHead>
              <TableHead className="text-slate-400">Article</TableHead>
              <TableHead className="text-slate-400">Titre / URL</TableHead>
              <TableHead className="text-slate-400">Type contribution</TableHead>
              <TableHead className="text-slate-400 text-right">Mots</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-slate-400">
                  Aucune page liée
                </TableCell>
              </TableRow>
            ) : (
              pages.map((p, i) => (
                <TableRow key={i} className="border-slate-700 hover:bg-slate-800/50">
                  <TableCell className="text-sm text-slate-500">
                    {p.page_order ?? i + 1}
                  </TableCell>
                  <TableCell className="text-sm text-white font-mono">
                    {p.article_number || '-'}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:underline truncate block"
                    >
                      {p.title || p.url}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-slate-500/20 text-slate-300 border-slate-500/30">
                      {p.contribution_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-slate-400">
                    {p.word_count?.toLocaleString() || '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Section 4 - Amendements */}
      {amendments.length > 0 && (
        <div className="rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">
              Amendements ({amendments.length})
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-400">Référence</TableHead>
                <TableHead className="text-slate-400">Date</TableHead>
                <TableHead className="text-slate-400">Portée</TableHead>
                <TableHead className="text-slate-400">Articles affectés</TableHead>
                <TableHead className="text-slate-400">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {amendments.map((a) => (
                <TableRow key={a.id} className="border-slate-700 hover:bg-slate-800/50">
                  <TableCell className="text-sm text-white">
                    {a.amending_law_reference || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-slate-300">
                    {a.amendment_date ? new Date(a.amendment_date).toLocaleDateString('fr-FR') : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-slate-500/20 text-slate-300 border-slate-500/30">
                      {a.amendment_scope || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-400 max-w-xs truncate">
                    {a.affected_articles?.join(', ') || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-slate-400 max-w-md truncate">
                    {a.description || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Section 5 - Texte consolidé */}
      {doc.consolidated_text && (
        <div className="rounded-lg border border-slate-700 p-6 bg-slate-900/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Texte consolidé
            </h2>
            <div className="flex items-center gap-3">
              {structure?.totalArticles > 0 && (
                <span className="text-sm text-slate-400">
                  {structure.totalArticles} articles
                </span>
              )}
              <span className="text-sm text-slate-400">
                {structure?.totalWords?.toLocaleString() || '?'} mots
              </span>
              <span className="text-sm text-slate-500">
                {doc.consolidated_text.length.toLocaleString()} car.
              </span>
            </div>
          </div>
          <div
            className="text-sm text-slate-300 whitespace-pre-wrap max-h-[80vh] overflow-y-auto bg-slate-950 rounded-lg p-6 border border-slate-800 leading-relaxed"
            dir="rtl"
          >
            {doc.consolidated_text}
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Composants utilitaires
// =============================================================================

function InfoRow({
  label,
  value,
  mono,
  dir,
  children,
}: {
  label: string
  value?: string | null
  mono?: boolean
  dir?: string
  children?: React.ReactNode
}) {
  return (
    <div>
      <span className="text-sm text-slate-400">{label}</span>
      <div className={`mt-1 text-sm text-white ${mono ? 'font-mono' : ''}`} dir={dir}>
        {children || value || <span className="text-slate-500">-</span>}
      </div>
    </div>
  )
}

function FreshnessBadge({ days, threshold }: { days: number; threshold: number }) {
  const color = days > threshold
    ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : days > threshold * 0.75
      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      : 'bg-green-500/20 text-green-400 border-green-500/30'

  return (
    <Badge variant="outline" className={color}>
      {days}j / {threshold}j
    </Badge>
  )
}

function StructureTree({ structure }: { structure: any }) {
  if (!structure) return null

  const renderNode = (node: any, depth: number = 0): React.ReactNode => {
    if (!node) return null

    if (Array.isArray(node)) {
      return (
        <ul className={`space-y-1 ${depth > 0 ? 'ml-4 border-l border-slate-700 pl-3' : ''}`}>
          {node.map((item: any, i: number) => (
            <li key={i}>{renderNode(item, depth + 1)}</li>
          ))}
        </ul>
      )
    }

    if (typeof node === 'object') {
      const title = node.title || node.name || node.label
      const children = node.children || node.items || node.articles || node.chapters || node.sections

      return (
        <div>
          {title && (
            <div className="text-sm text-slate-300">
              {node.number && <span className="text-slate-500 mr-2">{node.number}</span>}
              {title}
              {node.count && <span className="text-slate-500 ml-2">({node.count})</span>}
            </div>
          )}
          {children && renderNode(children, depth + 1)}
        </div>
      )
    }

    return <span className="text-sm text-slate-400">{String(node)}</span>
  }

  return <div className="space-y-2">{renderNode(structure)}</div>
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    code: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    loi: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    decret: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    arrete: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    circulaire: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    jurisprudence: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    doctrine: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    guide: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    formulaire: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  }
  return colors[type] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
}

function getConsolidationColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    partial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    complete: 'bg-green-500/20 text-green-400 border-green-500/30',
  }
  return colors[status] || colors.pending
}
