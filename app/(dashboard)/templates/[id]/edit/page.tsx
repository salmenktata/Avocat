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

  const userRole = session.user.role || 'user'
  const isAdmin = userRole === 'admin' || userRole === 'super_admin'

  // Récupérer le template (propre OU public)
  const result = await query(
    'SELECT * FROM templates WHERE id = $1 AND (user_id = $2 OR est_public = true)',
    [id, session.user.id]
  )
  const template = result.rows[0]

  if (!template) {
    redirect('/templates')
  }

  // Vérifier si c'est un template public dont l'utilisateur n'est pas propriétaire
  const isPublicNotOwned = template.est_public && template.user_id !== session.user.id
  // Mode copie : si c'est un template public non possédé par un non-admin
  const willCreateCopy = isPublicNotOwned && !isAdmin

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* En-tête */}
      <div>
        <Link href={`/templates/${id}`} className="text-sm text-blue-600 hover:text-blue-700">
          ← {t('backToTemplate')}
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          {willCreateCopy ? t('customizeTemplate') : t('editTemplate')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{template.titre}</p>
      </div>

      {/* Avertissement copie personnelle */}
      {willCreateCopy && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">📋</span>
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-200">
                {t('copyInfo.title')}
              </p>
              <p className="mt-1 text-sm text-blue-800 dark:text-blue-300">
                {t('copyInfo.description')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <TemplateForm
          initialData={{
            ...template,
            // Si copie, forcer est_public à false
            est_public: willCreateCopy ? false : template.est_public
          }}
          templateId={willCreateCopy ? undefined : id}
          isPublicCopy={willCreateCopy}
          originalTemplateId={willCreateCopy ? id : undefined}
        />
      </div>
    </div>
  )
}
