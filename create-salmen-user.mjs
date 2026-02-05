import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function createSalmenUser() {
  console.log('👤 Création de l\'utilisateur Salmen...\n')

  const email = 'salmen.ktata@gmail.com'
  const password = '724@Lnb.13'

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nom: 'Ktata',
        prenom: 'Salmen',
      },
    },
  })

  if (error) {
    console.error('❌ Erreur création utilisateur:', error.message)
    return
  }

  console.log('✅ Utilisateur créé:', data.user.email)
  console.log('📧 Email:', email)
  console.log('🔑 Mot de passe:', password)
  console.log('\n✅ Vous pouvez maintenant vous connecter avec ces identifiants')
}

createSalmenUser().catch(console.error)
