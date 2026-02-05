import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function createTestClient() {
  console.log('👤 Création d\'un client de test...\n')

  // Connexion
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@avocat.tn',
    password: 'Test123456!',
  })

  if (authError) {
    console.error('❌ Erreur connexion:', authError.message)
    return
  }

  console.log('✅ Connecté:', authData.user.email)

  // Créer un client
  const clientData = {
    user_id: authData.user.id,
    type: 'PERSONNE_PHYSIQUE',
    nom: 'Dupont',
    prenom: 'Jean',
    email: 'jean.dupont@example.com',
    telephone: '+216 20 123 456',
    adresse: '15 Avenue Habib Bourguiba',
    code_postal: '1000',
    ville: 'Tunis',
    cin: '01234567',
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert(clientData)
    .select()
    .single()

  if (clientError) {
    console.error('❌ Erreur création client:', clientError.message)
    return
  }

  console.log('✅ Client créé:', client.nom, client.prenom)
  console.log('   - Email:', client.email)
  console.log('   - Téléphone:', client.telephone)
  console.log('   - Adresse:', client.adresse, client.code_postal, client.ville)
  console.log('\nVous pouvez maintenant exécuter: node test-facture.mjs')
}

createTestClient().catch(console.error)
