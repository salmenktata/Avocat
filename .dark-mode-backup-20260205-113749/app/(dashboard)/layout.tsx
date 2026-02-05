import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { GlobalKeyboardShortcuts } from '@/components/ui/KeyboardShortcuts'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Récupérer le profil
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <>
      <AppLayout
        user={{
          email: user.email!,
          nom: profile?.nom,
          prenom: profile?.prenom,
        }}
      >
        {children}
      </AppLayout>
      <GlobalKeyboardShortcuts />
    </>
  )
}
