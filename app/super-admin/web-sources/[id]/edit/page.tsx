/**
 * Page Super Admin - Modifier une source web
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getWebSource } from '@/lib/web-scraper/source-service'
import { Button } from '@/components/ui/button'
import { Icons } from '@/lib/icons'
import { EditWebSourceWizard } from '@/components/super-admin/web-sources/EditWebSourceWizard'
import type { WebSource } from '@/lib/web-scraper/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

// PostgreSQL interval::text → valeurs du Select (ex: '01:00:00' → '1 hour')
function normalizeCrawlFrequency(pgInterval: string): string {
  const mapping: Record<string, string> = {
    '01:00:00': '1 hour',
    '06:00:00': '6 hours',
    '12:00:00': '12 hours',
    '24:00:00': '24 hours',
    '1 day': '24 hours',
    '7 days': '7 days',
    '30 days': '30 days',
  }
  return mapping[pgInterval] || pgInterval
}

/** Convertit un WebSource du service en FormData attendu par le wizard */
function webSourceToFormData(source: WebSource) {
  return {
    id: source.id,
    name: source.name,
    baseUrl: source.baseUrl,
    description: source.description || '',
    category: source.category,
    language: source.language,
    crawlFrequency: normalizeCrawlFrequency(source.crawlFrequency),
    maxDepth: source.maxDepth,
    maxPages: source.maxPages,
    requiresJavascript: source.requiresJavascript,
    downloadFiles: source.downloadFiles,
    ignoreSSLErrors: source.ignoreSSLErrors ?? false,
    autoIndexFiles: source.autoIndexFiles ?? false,
    useSitemap: source.useSitemap,
    sitemapUrl: source.sitemapUrl || '',
    respectRobotsTxt: source.respectRobotsTxt,
    rateLimitMs: source.rateLimitMs,
    contentSelector: source.cssSelectors?.content?.join(', ') || '',
    excludeSelectors: source.cssSelectors?.exclude?.join(', ') || '',
    urlPatterns: source.urlPatterns?.join('\n') || '',
    excludedPatterns: source.excludedPatterns?.join('\n') || '',
    isActive: source.isActive,
  }
}

export default async function EditWebSourcePage({ params }: PageProps) {
  const { id } = await params
  const source = await getWebSource(id)

  if (!source) {
    notFound()
  }

  const formData = webSourceToFormData(source)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/super-admin/web-sources/${id}`}>
          <Button variant="ghost" size="sm" className="text-slate-400">
            <Icons.arrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Modifier {source.name}</h1>
          <p className="text-slate-400 mt-1">
            Modifiez la configuration de la source
          </p>
        </div>
      </div>

      {/* Wizard en mode édition */}
      <EditWebSourceWizard initialData={formData} sourceId={id} />
    </div>
  )
}
