import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { StructurePage } from './StructurePage'

export const metadata: Metadata = {
  title: 'Structuration de Dossiers | Qadhya',
  description: 'Structurez automatiquement vos dossiers juridiques avec l\'IA',
}

export default async function Page() {
  const session = await getSession()
  if (!session?.user?.id) redirect('/login')

  return <StructurePage userId={session.user.id} />
}
