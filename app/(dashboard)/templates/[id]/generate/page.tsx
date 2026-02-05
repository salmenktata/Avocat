import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import GenerateDocumentForm from '@/components/templates/GenerateDocumentForm'
import { getTranslations } from 'next-intl/server'

export default async function GenerateDocumentPage({
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
  const templateResult = await query(
    'SELECT * FROM templates WHERE id = $1',
    [id]
  )
  const template = templateResult.rows[0]

  if (!template) {
    redirect('/templates')
  }

  // Récupérer les dossiers de l'utilisateur
  const dossiersResult = await query(
    `SELECT d.*,
      json_build_object(
        'id', c.id,
        'type_client', c.type_client,
        'nom', c.nom,
        'prenom', c.prenom,
        'email', c.email,
        'telephone', c.telephone,
        'created_at', c.created_at,
        'user_id', c.user_id
      ) as clients
    FROM dossiers d
    LEFT JOIN clients c ON d.client_id = c.id
    WHERE d.user_id = $1
    ORDER BY d.created_at DESC`,
    [session.user.id]
  )
  const dossiers = dossiersResult.rows

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* En-tête */}
      <div>
        <Link href={`/templates/${id}`} className="text-sm text-blue-600 hover:text-blue-700">
          ← {t('backToTemplate')}
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-foreground">{t('generateDocumentTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('templateLabel')} <span className="font-medium">{template.titre}</span>
        </p>
      </div>

      {/* Formulaire de génération */}
      <GenerateDocumentForm template={template} dossiers={dossiers || []} />
    </div>
  )
}
