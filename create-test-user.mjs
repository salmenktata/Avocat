import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function createTestUser() {
  console.log('👤 Création d\'un utilisateur de test...\n')

  const email = 'test@avocat.tn'
  const password = 'Test123456!'

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nom: 'Avocat',
        prenom: 'Test',
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
  console.log('\nVous pouvez maintenant exécuter: node test-facture.mjs')
}

createTestUser().catch(console.error)
