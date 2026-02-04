import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TemplateForm from '@/components/templates/TemplateForm'

export default async function NewTemplatePage() {
  const supabase = await createClient()

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
          ← Retour aux templates
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Nouveau template</h1>
        <p className="mt-1 text-sm text-gray-500">
          Créez un modèle de document juridique réutilisable avec variables dynamiques
        </p>
      </div>

      {/* Formulaire */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <TemplateForm />
      </div>
    </div>
  )
}
