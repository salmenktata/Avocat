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

async function checkAdminAccess(userId: string): Promise<boolean> {
  const result = await query('SELECT role FROM users WHERE id = $1', [userId])
  return result.rows[0]?.role === 'admin'
}

export default async function BaseConnaissancesPage() {
  const session = await getSession()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Vérifier accès admin
  const isAdmin = await checkAdminAccess(session.user.id)
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
