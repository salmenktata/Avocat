import ClientForm from '@/components/clients/ClientForm'
import { getTranslations } from 'next-intl/server'

export default async function NewClientPage() {
  const t = await getTranslations('clients')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('newClient')}</h1>
        <p className="mt-2 text-muted-foreground">
          {t('addNewClient')}
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <ClientForm />
      </div>
    </div>
  )
}
