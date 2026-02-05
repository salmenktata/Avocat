import { createClient } from '@/lib/supabase/server'
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
    .eq('user_id', user.id) // Seulement si propriétaire
    .single()

  if (error || !template) {
    redirect('/templates')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* En-tête */}
      <div>
        <Link href={`/templates/${id}`} className="text-sm text-blue-600 hover:text-blue-700">
          ← {t('backToTemplate')}
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{t('editTemplate')}</h1>
        <p className="mt-1 text-sm text-gray-500">{template.titre}</p>
      </div>

      {/* Formulaire */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <TemplateForm initialData={template} templateId={id} />
      </div>
    </div>
  )
}
