import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileForm from '@/components/profile/ProfileForm'

export const metadata = {
  title: 'Mon Profil - MonCabinet',
  description: 'Gérer vos informations personnelles',
}

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

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
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mon Profil</h1>
        <p className="mt-2 text-muted-foreground">
          Gérez vos informations personnelles et votre compte
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <ProfileForm profile={profile} userEmail={user.email!} />
      </div>

      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <h3 className="font-semibold text-yellow-900">ℹ️ Informations importantes</h3>
        <ul className="mt-2 space-y-1 text-sm text-yellow-800">
          <li>• La modification de l'email nécessitera une nouvelle vérification</li>
          <li>• Le mot de passe doit contenir au moins 6 caractères</li>
          <li>
            • Pour les paramètres du cabinet (logo, matricule ONAT), rendez-vous dans{' '}
            <a href="/parametres/cabinet" className="underline font-medium">
              Paramètres Cabinet
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}
