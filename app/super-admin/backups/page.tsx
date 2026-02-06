import { Metadata } from 'next'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import BackupsManager from '@/components/super-admin/backups/BackupsManager'

export const metadata: Metadata = {
  title: 'Backups - Super Admin',
  description: 'Gestion des sauvegardes système',
}

export default async function BackupsPage() {
  const session = await getSession()

  if (!session?.user || session.user.role !== 'super_admin') {
    redirect('/login')
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Sauvegardes Système</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez les backups PostgreSQL, MinIO et code source
        </p>
      </div>

      {/* Gestionnaire de backups */}
      <BackupsManager />
    </div>
  )
}
