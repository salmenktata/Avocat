import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TemplateForm from '@/components/templates/TemplateForm'
import { getTranslations } from 'next-intl/server'

export default async function NewTemplatePage() {
  const supabase = await createClient()
  const t = await getTranslations('templates')

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* En-tête */}
      <div>
        <Link href="/templates" className="text-sm text-blue-600 hover:text-blue-700">
          ← {t('backToTemplates')}
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-foreground">{t('newTemplate')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('createTemplate')}
        </p>
      </div>

      {/* Formulaire */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <TemplateForm />
      </div>
    </div>
  )
}
