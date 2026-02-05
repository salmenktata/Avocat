import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TemplateForm from '@/components/templates/TemplateForm'
import { getTranslations } from 'next-intl/server'

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSession()
  const t = await getTranslations('templates')

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Récupérer le template
  const result = await query(
    'SELECT * FROM templates WHERE id = $1 AND user_id = $2',
    [id, session.user.id]
  )
  const template = result.rows[0]

  if (!template) {
    redirect('/templates')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* En-tête */}
      <div>
        <Link href={`/templates/${id}`} className="text-sm text-blue-600 hover:text-blue-700">
          ← {t('backToTemplate')}
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-foreground">{t('editTemplate')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{template.titre}</p>
      </div>

      {/* Formulaire */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <TemplateForm initialData={template} templateId={id} />
      </div>
    </div>
  )
}
