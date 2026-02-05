import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkUser() {
  console.log('🔍 Vérification de l\'utilisateur...\n')

  // Lister tous les utilisateurs
  const { data: { users }, error } = await supabase.auth.admin.listUsers()

  if (error) {
    console.error('❌ Erreur:', error.message)
    return
  }

  console.log(`📊 Nombre total d'utilisateurs: ${users.length}\n`)

  // Chercher l'utilisateur spécifique
  const user = users.find(u => u.email === 'salmen.ktata@gmail.com')

  if (user) {
    console.log('✅ Utilisateur trouvé:')
    console.log('   Email:', user.email)
    console.log('   ID:', user.id)
    console.log('   Créé le:', user.created_at)
    console.log('   Email confirmé:', user.email_confirmed_at ? 'Oui' : 'Non')
    console.log('   Dernière connexion:', user.last_sign_in_at || 'Jamais')
  } else {
    console.log('❌ Utilisateur non trouvé')
  }

  console.log('\n📋 Liste de tous les utilisateurs:')
  users.forEach(u => {
    console.log(`   - ${u.email} (confirmé: ${u.email_confirmed_at ? 'oui' : 'non'})`)
  })
}

checkUser().catch(console.error)
