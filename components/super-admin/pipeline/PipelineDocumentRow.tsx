'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Icons } from '@/lib/icons'

interface DocumentSummary {
  id: string
  title: string
  category: string
  language: string
  pipeline_stage: string
  quality_score: number | null
  is_indexed: boolean
  source_file: string | null
  days_in_stage: number
  created_at: string
}

interface PipelineDocumentRowProps {
  doc: DocumentSummary
  isSelected: boolean
  onSelect: (id: string, checked: boolean) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  jurisprudence: 'bg-blue-100 text-blue-800',
  legislation: 'bg-purple-100 text-purple-800',
  codes: 'bg-indigo-100 text-indigo-800',
  doctrine: 'bg-amber-100 text-amber-800',
  modeles: 'bg-green-100 text-green-800',
  formulaires: 'bg-teal-100 text-teal-800',
  autre: 'bg-gray-100 text-gray-800',
}

export function PipelineDocumentRow({ doc, isSelected, onSelect }: PipelineDocumentRowProps) {
  return (
    <tr className="border-b hover:bg-muted/50 transition-colors">
      <td className="p-3 w-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(doc.id, !!checked)}
        />
      </td>
      <td className="p-3 max-w-md">
        <Link
          href={`/super-admin/pipeline/${doc.id}`}
          className="font-medium text-sm hover:underline text-foreground line-clamp-1"
        >
          {doc.title || 'Sans titre'}
        </Link>
        {doc.source_file && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.source_file}</p>
        )}
      </td>
      <td className="p-3">
        <Badge variant="outline" className={CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.autre}>
          {doc.category}
        </Badge>
      </td>
      <td className="p-3 text-sm text-center">
        <Badge variant="outline" className="uppercase">
          {doc.language}
        </Badge>
      </td>
      <td className="p-3 text-sm text-center">
        {doc.quality_score !== null ? (
          <span className={doc.quality_score >= 70 ? 'text-green-600' : doc.quality_score >= 50 ? 'text-amber-600' : 'text-red-600'}>
            {doc.quality_score}/100
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="p-3 text-sm text-center">
        {doc.is_indexed ? (
          <Icons.checkCircle className="h-4 w-4 text-green-500 mx-auto" />
        ) : (
          <Icons.xCircle className="h-4 w-4 text-muted-foreground mx-auto" />
        )}
      </td>
      <td className="p-3 text-sm text-muted-foreground text-center">
        {doc.days_in_stage > 1
          ? `${doc.days_in_stage}j`
          : doc.days_in_stage > 0
          ? `${Math.round(doc.days_in_stage * 24)}h`
          : '< 1h'}
      </td>
      <td className="p-3">
        <Link
          href={`/super-admin/pipeline/${doc.id}`}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          <Icons.eye className="h-3.5 w-3.5" />
          Détail
        </Link>
      </td>
    </tr>
  )
}
