import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { query } from '@/lib/db/postgres'
import KnowledgeBasePage from './KnowledgeBasePage'

// Import dynamique pour éviter les problèmes avec pdf-parse en RSC
async function getKnowledgeBaseService() {
  return await import('@/lib/ai/knowledge-base-service')
}

export const metadata = {
  title: 'Base de Connaissances - MonCabinet',
  description: 'Gérer la base de connaissances juridique partagée',
}

async function checkAdminAccess(userId: string): Promise<{ isAdmin: boolean; isSuperAdmin: boolean }> {
  const result = await query('SELECT role FROM users WHERE id = $1', [userId])
  const role = result.rows[0]?.role
  return {
    isAdmin: role === 'admin' || role === 'super_admin',
    isSuperAdmin: role === 'super_admin'
  }
}

export default async function BaseConnaissancesPage() {
  const session = await getSession()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Vérifier accès admin
  const { isAdmin, isSuperAdmin } = await checkAdminAccess(session.user.id)

  // Rediriger super_admin vers la page dédiée
  if (isSuperAdmin) {
    redirect('/super-admin/knowledge-base')
  }

  // Les utilisateurs normaux n'ont pas accès
  if (!isAdmin) {
    redirect('/dashboard')
  }

  // Récupérer les données initiales (import dynamique)
  const { listKnowledgeDocuments, getKnowledgeBaseStats } = await getKnowledgeBaseService()
  const [documentsResult, stats] = await Promise.all([
    listKnowledgeDocuments({ limit: 50, offset: 0 }),
    getKnowledgeBaseStats(),
  ])

  return (
    <KnowledgeBasePage
      initialDocuments={documentsResult.documents}
      initialTotal={documentsResult.total}
      initialStats={stats}
    />
  )
}
