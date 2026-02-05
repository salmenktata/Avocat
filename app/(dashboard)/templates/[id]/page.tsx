import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TYPE_DOCUMENT_LABELS } from '@/lib/validations/template'
import { getTranslations } from 'next-intl/server'

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const t = await getTranslations('templates')

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Récupérer le template
  const { data: template, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !template) {
    redirect('/templates')
  }

  const variables: string[] = Array.isArray(template.variables) ? template.variables : []

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/templates" className="text-sm text-blue-600 hover:text-blue-700">
            ← {t('backToTemplates')}
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-foreground">{template.titre}</h1>
          {template.description && (
            <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
          )}
        </div>

        <div className="flex gap-2">
          <Link
            href={`/templates/${id}/edit`}
            className="rounded-md border border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            ✏️ {t('edit')}
          </Link>

          <Link
            href={`/templates/${id}/generate`}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            ⚡ {t('generateDocument')}
          </Link>
        </div>
      </div>

      {/* Informations */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">{t('information')}</h2>

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">{t('documentType')}</dt>
            <dd className="mt-1 text-sm text-foreground">
              {TYPE_DOCUMENT_LABELS[template.type_document] || 'Autre'}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-muted-foreground">{t('statusLabel')}</dt>
            <dd className="mt-1">
              {template.est_public ? (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                  {t('public')}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                  {t('private')}
                </span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-muted-foreground">{t('variables')}</dt>
            <dd className="mt-1 text-sm text-foreground">{variables.length}</dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-muted-foreground">{t('usages')}</dt>
            <dd className="mt-1 text-sm text-foreground">{template.nombre_utilisations || 0}</dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-muted-foreground">{t('createdOn')}</dt>
            <dd className="mt-1 text-sm text-foreground">
              {new Date(template.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-muted-foreground">{t('modifiedOn')}</dt>
            <dd className="mt-1 text-sm text-foreground">
              {new Date(template.updated_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </dd>
          </div>
        </dl>
      </div>

      {/* Variables */}
      {variables.length > 0 && (
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            {t('variablesCount', { count: variables.length })}
          </h2>
          <div className="flex flex-wrap gap-2">
            {variables.map((v) => (
              <code
                key={v}
                className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-mono text-blue-700"
              >
                {`{{${v}}}`}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Contenu */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-3">{t('templateContent')}</h2>
        <div className="rounded-md bg-muted p-4">
          <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">
            {template.contenu}
          </pre>
        </div>
      </div>
    </div>
  )
}
