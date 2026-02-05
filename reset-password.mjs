import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function resetPassword() {
  console.log('🔐 Réinitialisation du mot de passe...\n')

  const email = 'salmen.ktata@gmail.com'
  const newPassword = '724@Lnb.13'

  // Trouver l'utilisateur
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

  if (listError) {
    console.error('❌ Erreur:', listError.message)
    return
  }

  const user = users.find(u => u.email === email)

  if (!user) {
    console.error('❌ Utilisateur non trouvé')
    return
  }

  // Réinitialiser le mot de passe
  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  )

  if (error) {
    console.error('❌ Erreur réinitialisation:', error.message)
    return
  }

  console.log('✅ Mot de passe réinitialisé avec succès!')
  console.log('📧 Email:', email)
  console.log('🔑 Nouveau mot de passe:', newPassword)
  console.log('\n✅ Vous pouvez maintenant vous connecter avec ces identifiants')
}

resetPassword().catch(console.error)
