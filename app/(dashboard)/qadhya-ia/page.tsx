import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { UnifiedChatPage } from './UnifiedChatPage'

export const metadata: Metadata = {
  title: 'Qadhya IA | Qadhya',
  description: 'Interface unifiée d\'assistance juridique intelligente - Chat, Structuration et Consultation',
}

export default async function QadhyaIAPage() {
  const session = await getSession()

  if (!session?.user?.id) {
    redirect('/login')
  }

  return <UnifiedChatPage userId={session.user.id} />
}
