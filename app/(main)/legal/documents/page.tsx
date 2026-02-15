import { Metadata } from 'next'
import Link from 'next/link'
import { listDocuments, type LegalDocument } from '@/lib/legal-documents/document-service'
import type { DocumentStructure } from '@/lib/legal-documents/content-consolidation-service'

export const revalidate = 3600 // ISR 1h

export const metadata: Metadata = {
  title: 'Documents Juridiques Consolidés | Qadhya',
  description:
    'Consultez les textes juridiques tunisiens consolidés et à jour : codes, lois, décrets. Textes complets avec navigation par article.',
  openGraph: {
    title: 'Documents Juridiques Consolidés | Qadhya',
    description: 'Textes juridiques tunisiens consolidés et à jour',
    locale: 'fr_TN',
  },
}

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

export default async function LegalDocumentsListPage() {
  const documents = await listDocuments({
    isActive: true,
  })

  // Only show approved + consolidated documents
  const consolidatedDocs = documents.filter(
    (doc) => doc.consolidationStatus === 'complete' && doc.isApproved
  )

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Documents Juridiques Consolidés
          </h1>
          <p className="text-gray-600">
            Textes juridiques tunisiens consolidés et à jour.
            {consolidatedDocs.length > 0 && (
              <span className="text-gray-400">
                {' '}&middot; {consolidatedDocs.length} document{consolidatedDocs.length > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </header>

      {/* Document list */}
      <div className="container mx-auto px-4 py-8">
        {consolidatedDocs.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">Aucun document consolidé disponible pour le moment.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {consolidatedDocs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DocumentCard({ doc }: { doc: LegalDocument }) {
  const typeLabel = DOCUMENT_TYPE_LABELS[doc.documentType] || DOCUMENT_TYPE_LABELS.autre
  const structure = doc.structure as DocumentStructure | null

  return (
    <Link
      href={`/legal/documents/${doc.citationKey}`}
      className="block border rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeLabel.color}`}>
          {typeLabel.fr}
        </span>
        <code className="text-xs text-gray-400 font-mono">{doc.citationKey}</code>
      </div>

      {doc.officialTitleAr && (
        <h3
          className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-700 transition-colors"
          dir="rtl"
        >
          {doc.officialTitleAr}
        </h3>
      )}
      {doc.officialTitleFr && (
        <p className="text-sm text-gray-600 mb-3">{doc.officialTitleFr}</p>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-auto pt-3 border-t border-gray-100">
        {structure && (
          <span>{structure.totalArticles} articles</span>
        )}
        {doc.effectiveDate && (
          <span>{new Date(doc.effectiveDate).toLocaleDateString('fr-TN')}</span>
        )}
        {doc.isAbrogated && (
          <span className="text-red-600 font-medium">Abrogé</span>
        )}
      </div>
    </Link>
  )
}
