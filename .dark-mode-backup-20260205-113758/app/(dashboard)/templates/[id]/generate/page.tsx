import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()
  const t = await getTranslations('templates')

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Récupérer le template
  const { data: template, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .single()

  if (templateError || !template) {
    redirect('/templates')
  }

  // Récupérer les dossiers de l'utilisateur
  const { data: dossiers, error: dossiersError } = await supabase
    .from('dossiers')
    .select('*, clients(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (dossiersError) {
    console.error('Erreur chargement dossiers:', dossiersError)
  }

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
