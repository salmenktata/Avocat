import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { ChatPage } from './ChatPage'

export const metadata: Metadata = {
  title: 'Assistant IA | Qadhya',
  description: 'Posez vos questions juridiques à l\'assistant IA',
}

export default async function Page() {
  const session = await getSession()
  if (!session?.user?.id) redirect('/login')

  return <ChatPage userId={session.user.id} />
}
