import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getDocumentByCitationKey, type LegalDocument } from '@/lib/legal-documents/document-service'
import type { DocumentStructure, BookEntry, ChapterEntry, ArticleEntry } from '@/lib/legal-documents/content-consolidation-service'

export const revalidate = 3600 // ISR 1h

// =============================================================================
// METADATA SEO
// =============================================================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ citationKey: string }>
}): Promise<Metadata> {
  const { citationKey } = await params
  const doc = await getDocumentByCitationKey(citationKey)

  if (!doc || doc.consolidationStatus !== 'complete') {
    return { title: 'Document non trouvé | Qadhya' }
  }

  const titleAr = doc.officialTitleAr || doc.citationKey
  const titleFr = doc.officialTitleFr || ''
  const title = titleFr ? `${titleAr} - ${titleFr}` : titleAr

  return {
    title: `${title} | Qadhya`,
    description: `${titleFr || titleAr} - Texte consolidé et à jour. ${(doc.structure as DocumentStructure)?.totalArticles || ''} articles.`,
    openGraph: {
      title: `${title} | Qadhya`,
      description: `Texte juridique consolidé - ${titleFr || titleAr}`,
      type: 'article',
      locale: 'ar_TN',
      alternateLocale: 'fr_TN',
    },
  }
}

// =============================================================================
// DOCUMENT TYPE LABELS
// =============================================================================

const DOCUMENT_TYPE_LABELS: Record<string, { fr: string; ar: string; color: string }> = {
  code: { fr: 'Code', ar: 'مجلة', color: 'bg-blue-100 text-blue-800' },
  loi: { fr: 'Loi', ar: 'قانون', color: 'bg-green-100 text-green-800' },
  decret: { fr: 'Décret', ar: 'أمر', color: 'bg-purple-100 text-purple-800' },
  arrete: { fr: 'Arrêté', ar: 'قرار', color: 'bg-orange-100 text-orange-800' },
  circulaire: { fr: 'Circulaire', ar: 'منشور', color: 'bg-teal-100 text-teal-800' },
  jurisprudence: { fr: 'Jurisprudence', ar: 'اجتهاد قضائي', color: 'bg-amber-100 text-amber-800' },
  doctrine: { fr: 'Doctrine', ar: 'فقه', color: 'bg-indigo-100 text-indigo-800' },
  guide: { fr: 'Guide', ar: 'دليل', color: 'bg-cyan-100 text-cyan-800' },
  formulaire: { fr: 'Formulaire', ar: 'نموذج', color: 'bg-pink-100 text-pink-800' },
  autre: { fr: 'Autre', ar: 'أخرى', color: 'bg-gray-100 text-gray-800' },
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default async function LegalDocumentPage({
  params,
}: {
  params: Promise<{ citationKey: string }>
}) {
  const { citationKey } = await params
  const doc = await getDocumentByCitationKey(citationKey)

  if (!doc || doc.consolidationStatus !== 'complete' || !doc.isActive || !doc.isApproved) {
    notFound()
  }

  const structure = doc.structure as DocumentStructure | null
  const typeLabel = DOCUMENT_TYPE_LABELS[doc.documentType] || DOCUMENT_TYPE_LABELS.autre

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="border-b bg-gray-50">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/legal/documents" className="hover:text-gray-700 transition-colors">
              Documents juridiques
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">{doc.citationKey}</span>
          </nav>
        </div>
      </div>

      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-wrap items-start gap-3 mb-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${typeLabel.color}`}>
              {typeLabel.fr} / {typeLabel.ar}
            </span>
            {doc.isAbrogated && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                Abrogé / ملغى
              </span>
            )}
            {doc.effectiveDate && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                {new Date(doc.effectiveDate).toLocaleDateString('fr-TN')}
              </span>
            )}
          </div>

          {doc.officialTitleAr && (
            <h1 className="text-3xl font-bold text-gray-900 mb-2" dir="rtl">
              {doc.officialTitleAr}
            </h1>
          )}
          {doc.officialTitleFr && (
            <h2 className="text-xl text-gray-600">
              {doc.officialTitleFr}
            </h2>
          )}

          {structure && (
            <p className="mt-4 text-gray-500">
              {structure.totalArticles} articles &middot; {structure.totalWords.toLocaleString('fr-TN')} mots
              &middot; Consolidé le {new Date(structure.consolidatedAt).toLocaleDateString('fr-TN')}
            </p>
          )}
        </div>
      </header>

      {/* Abrogation banner */}
      {doc.isAbrogated && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="container mx-auto px-4 py-4">
            <p className="text-red-800 font-medium" dir="rtl">
              ⚠️ هذا النص ملغى
              {doc.abrogationDate && ` بتاريخ ${new Date(doc.abrogationDate).toLocaleDateString('ar-TN')}`}
            </p>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Table of Contents (sidebar) */}
          {structure && structure.books.length > 0 && (
            <aside className="lg:w-72 shrink-0">
              <div className="sticky top-4">
                <TableOfContents structure={structure} />
              </div>
            </aside>
          )}

          {/* Document Body */}
          <main className="flex-1 min-w-0">
            {structure && structure.books.length > 0 ? (
              <StructuredDocumentBody structure={structure} />
            ) : doc.consolidatedText ? (
              <div dir="rtl" className="prose prose-lg max-w-none text-right leading-loose">
                <pre className="whitespace-pre-wrap font-sans text-base text-gray-800">
                  {doc.consolidatedText}
                </pre>
              </div>
            ) : (
              <p className="text-gray-500">Contenu non disponible.</p>
            )}
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-gray-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-wrap gap-6 text-sm text-gray-500">
            {doc.jortReference && (
              <span>JORT: {doc.jortReference}</span>
            )}
            {doc.lastVerifiedAt && (
              <span>Dernière vérification: {new Date(doc.lastVerifiedAt).toLocaleDateString('fr-TN')}</span>
            )}
            {doc.sourceUrls && doc.sourceUrls.length > 0 && (
              <span>
                Source:{' '}
                {(doc.sourceUrls as string[]).map((url: string, i: number) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {new URL(url).hostname}
                  </a>
                ))}
              </span>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}

// =============================================================================
// TABLE OF CONTENTS
// =============================================================================

function TableOfContents({ structure }: { structure: DocumentStructure }) {
  return (
    <nav className="bg-gray-50 rounded-lg p-4 border" dir="rtl">
      <h3 className="font-bold text-gray-900 mb-3 text-lg">فهرس المحتويات</h3>
      <ul className="space-y-2 text-sm">
        {structure.books.map((book) => (
          <li key={book.number}>
            <a
              href={`#book-${book.number}`}
              className="font-semibold text-gray-800 hover:text-blue-600 transition-colors block py-1"
            >
              {book.titleAr || book.titleFr || `الكتاب ${book.number}`}
            </a>
            {book.chapters.length > 0 && (
              <ul className="mr-4 mt-1 space-y-1 border-r-2 border-gray-200 pr-3">
                {book.chapters.map((chapter, ci) => {
                  const firstArticle = chapter.articles[0]?.number
                  const lastArticle = chapter.articles[chapter.articles.length - 1]?.number
                  const articleRange = firstArticle && lastArticle
                    ? ` (${firstArticle}-${lastArticle})`
                    : ''

                  return (
                    <li key={ci}>
                      <a
                        href={`#chapter-${book.number}-${chapter.number || ci}`}
                        className="text-gray-600 hover:text-blue-600 transition-colors block py-0.5"
                      >
                        {chapter.titleAr || `الباب ${chapter.number || ci + 1}`}
                        <span className="text-gray-400 text-xs">{articleRange}</span>
                      </a>
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}

// =============================================================================
// STRUCTURED DOCUMENT BODY
// =============================================================================

function StructuredDocumentBody({ structure }: { structure: DocumentStructure }) {
  return (
    <div dir="rtl" className="text-right">
      {structure.books.map((book) => (
        <section key={book.number} id={`book-${book.number}`} className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-blue-200">
            {book.titleAr || book.titleFr || `الكتاب ${book.number}`}
            {book.titleFr && book.titleAr && (
              <span className="block text-base font-normal text-gray-500 mt-1" dir="ltr">
                {book.titleFr}
              </span>
            )}
          </h2>

          {book.chapters.map((chapter, ci) => (
            <section
              key={ci}
              id={`chapter-${book.number}-${chapter.number || ci}`}
              className="mb-8"
            >
              {chapter.titleAr && (
                <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                  {chapter.titleAr}
                </h3>
              )}

              <div className="space-y-4">
                {chapter.articles.map((article) => (
                  <ArticleBlock key={article.number} article={article} />
                ))}
              </div>
            </section>
          ))}
        </section>
      ))}
    </div>
  )
}

// =============================================================================
// ARTICLE BLOCK
// =============================================================================

function ArticleBlock({ article }: { article: ArticleEntry }) {
  return (
    <section
      id={`article-${article.number}`}
      className="group bg-white rounded-lg border border-gray-100 hover:border-blue-200 p-4 transition-colors scroll-mt-4"
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 bg-blue-50 text-blue-700 font-bold rounded px-2 py-1 text-sm">
          الفصل {article.number}
        </span>
        {article.isModified && (
          <span className="shrink-0 bg-amber-50 text-amber-700 text-xs rounded px-2 py-0.5">
            معدّل
          </span>
        )}
      </div>
      <div className="mt-3 text-gray-800 leading-loose text-base whitespace-pre-wrap">
        {article.text}
      </div>
    </section>
  )
}
