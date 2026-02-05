import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { GlobalKeyboardShortcuts } from '@/components/ui/KeyboardShortcuts'
import { Toaster } from '@/components/ui/toaster'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Récupérer le profil
  const result = await query(
    'SELECT * FROM profiles WHERE id = $1',
    [session.user.id]
  )
  const profile = result.rows[0]

  return (
    <>
      <AppLayout
        user={{
          email: session.user.email!,
          nom: profile?.nom,
          prenom: profile?.prenom,
        }}
      >
        {children}
      </AppLayout>
      <GlobalKeyboardShortcuts />
      <Toaster />
    </>
  )
}
