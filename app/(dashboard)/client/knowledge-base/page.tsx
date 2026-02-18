import { Metadata } from 'next'
import { KnowledgeBaseBrowser } from '@/components/client/kb-browser/KnowledgeBaseBrowser'

export const metadata: Metadata = {
  title: 'Base de Connaissances | Qadhya',
  description: 'Explorez la base de connaissances juridique tunisienne avec recherche sémantique et filtres avancés',
}

export default function KnowledgeBasePage() {
  return <KnowledgeBaseBrowser />
}
